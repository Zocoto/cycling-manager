/**
 * Real React/DOM checks for reward collection, without a Next server or network.
 * Install Happy DOM in an isolated directory, then pass its entry point:
 * node scripts/test-objective-claim-interactions.mjs /path/to/happy-dom/lib/index.js
 * No application environment files, credentials or live Supabase clients are loaded.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MessageChannel as NodeMessageChannel } from "node:worker_threads";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const happyDomEntry = process.argv[2];
if (!happyDomEntry) throw new Error("Pass the isolated Happy DOM module entry as the first argument.");
const { Window } = await import(pathToFileURL(path.resolve(happyDomEntry)).href);
const { build } = require("esbuild");
const scratch = await mkdtemp(path.join(tmpdir(), "objective-claim-dom-"));
const browser = new Window({ url: "http://localhost/objective-claim-dom-test" });
const runtimeKey = "__objectiveClaimDomTestRuntime";
const savedGlobals = new Map();
const messageChannels = [];
for (const [name, value] of Object.entries({
  window: browser, document: browser.document, navigator: browser.navigator,
  HTMLElement: browser.HTMLElement, HTMLFormElement: browser.HTMLFormElement,
  Node: browser.Node, Event: browser.Event, MouseEvent: browser.MouseEvent,
  MutationObserver: browser.MutationObserver, FormData: browser.FormData,
  // React's development act() fallback creates ports without closing them.
  // Track only channels created by this isolated test and close them at teardown.
  MessageChannel: class extends NodeMessageChannel {
    constructor() { super(); messageChannels.push(this); }
  },
  IS_REACT_ACT_ENVIRONMENT: true,
  fetch: () => { throw new Error("Network access is forbidden in this test."); },
})) {
  savedGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

const stubs = {
  "@/lib/supabase/client": `export function createSupabaseBrowserClient() { return globalThis.${runtimeKey}.client; }`,
  "@/app/jeu/objectifs/actions": `
    export async function claimGameObjectiveAction() { globalThis.${runtimeKey}.serverActionCalls++; throw new Error("Server action unexpectedly invoked"); }
    export const claimCycloStickersObjectiveAction = claimGameObjectiveAction;`,
  "@/components/ui/app-link": `import React from "react"; export default function Link({children, prefetch, ...props}) { return <a {...props}>{children}</a>; }`,
  "@/components/game/game-section-tabs": `import React from "react"; export function GameSectionTabLink({href,label,badge}) { return <a href={href}>{label}<span data-testid="tab-ready">{badge}</span></a>; }`,
  "@/components/game/objective-filters": `import React from "react"; export function ObjectiveFilters({totalCount,visibleCount}) { return <div data-testid="filter-count">{visibleCount}/{totalCount}</div>; }`,
};

let mountedRoot;
try {
  const bundlePath = path.join(scratch, "actual-objectives.cjs");
  await build({
    stdin: {
      contents: `export { createElement, act } from "react"; export { createRoot } from "react-dom/client"; export * from "@/components/game/objectives-panel";`,
      resolveDir: root, sourcefile: "objective-claim-dom-entry.tsx", loader: "tsx",
    },
    outfile: bundlePath, bundle: true, platform: "node", format: "cjs", jsx: "automatic",
    logLevel: "silent", define: { "process.env.NODE_ENV": '"development"' },
    plugins: [{ name: "isolated-test-boundaries", setup(plugin) {
      plugin.onResolve({ filter: /^@\// }, ({ path: specifier }) => specifier in stubs
        ? { path: specifier, namespace: "test-stub" }
        : { path: path.join(root, specifier.slice(2)) + (path.extname(specifier) ? "" : resolveExtension(specifier)) });
      plugin.onLoad({ filter: /.*/, namespace: "test-stub" }, ({ path: specifier }) => ({ contents: stubs[specifier], loader: "tsx", resolveDir: root }));
    } }],
  });
  const { createElement: h, act, createRoot, ObjectivesClaimProvider, ObjectivesHeroMetrics, ObjectivesPanel, ObjectivesTabLink } = require(bundlePath);
  const all = { type: "all", status: "all", group: "all" };
  const owner = "dom-test-owner";
  const claimedAt = "2026-11-26T10:00:00.000Z";
  let runtime;
  let props;
  let container;
  let assertions = 0;

  function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
  function objective(key, extra = {}) {
    return { key, type: "secondary", group: "transfers", title: `Reward ${key}`, description: "Interaction fixture", currentValue: 1, targetValue: 1, progressPercent: 100,
      reward: { cash: 1000, experience: 10, reputation: 1, itemName: null, itemKind: null }, displayOrder: 1, completed: true, claimedAt: null, ...extra };
  }
  function row(item) {
    return { objective_key: item.key, objective_type: item.type, objective_group: item.group, title: item.title, description: item.description,
      current_value: item.currentValue, target_value: item.targetValue, reward_cash: item.reward.cash, reward_experience: item.reward.experience,
      reward_reputation: item.reward.reputation, reward_item_name: item.reward.itemName, reward_item_kind: item.reward.itemKind,
      display_order: item.displayOrder, claimed_at: item.claimedAt, is_completed: item.completed };
  }
  function newRuntime() {
    const queues = new Map();
    const state = { userId: owner, calls: [], serverActionCalls: 0,
      enqueue(name, response) { const queue = queues.get(name) ?? []; queue.push(response); queues.set(name, queue); },
      client: null,
    };
    function query(name, args) {
      const queue = queues.get(name);
      assert.ok(queue?.length, `Unexpected data access: ${name}`);
      const call = { name, args, filters: [], signal: null };
      state.calls.push(call);
      const promise = Promise.resolve(queue.shift());
      const builder = { then: promise.then.bind(promise),
        eq(...filter) { call.filters.push(filter); return builder; },
        select(...selection) { call.selection = selection; return builder; },
        abortSignal(signal) { call.signal = signal; return builder; },
        maybeSingle() { return promise; },
      };
      return builder;
    }
    state.client = { auth: { async getSession() { return { data: { session: state.userId ? { user: { id: state.userId } } : null }, error: null }; } },
      rpc: (name, args) => query(name, args), from: name => query(`table:${name}`),
    };
    return state;
  }
  function tree() {
    return h(ObjectivesClaimProvider, { initialObjectives: props.objectives, ownerUserId: owner },
      h("div", { "data-testid": "metrics" }, h(ObjectivesHeroMetrics)),
      h(ObjectivesTabLink, { active: true }),
      h(ObjectivesPanel, { filters: props.filters, returnPath: "/jeu/objectifs?onglet=objectifs", success: null, errorMessage: null }));
  }
  async function mount(objectives, filters = all) {
    if (mountedRoot) await act(async () => mountedRoot.unmount());
    container?.remove();
    runtime = newRuntime(); globalThis[runtimeKey] = runtime;
    props = { objectives, filters };
    container = browser.document.createElement("main"); browser.document.body.append(container);
    mountedRoot = createRoot(container);
    await act(async () => mountedRoot.render(tree()));
  }
  async function rerender(change) { props = { ...props, ...change }; await act(async () => mountedRoot.render(tree())); }
  function card(key) { return [...container.querySelectorAll("article")].find(element => element.querySelector("h3")?.textContent === `Reward ${key}`); }
  function metric(label) { return [...container.querySelectorAll('[data-testid="metrics"] p')].find(element => element.textContent === label)?.nextElementSibling?.textContent; }
  function button(key) { const element = card(key)?.querySelector("button[type=submit]"); assert.ok(element, `Missing claim button for ${key}`); return element; }
  async function click(key) { await act(async () => button(key).click()); }
  async function settle(pending, result) { await act(async () => { pending.resolve(result); await pending.promise; }); }
  async function waitForRefresh() { await act(async () => new Promise(resolve => setTimeout(resolve, 400))); }
  function receipt(key) { return { data: { objectiveKey: key, claimedAt, itemName: null }, error: null }; }
  function check(condition, message) { assert.ok(condition, message); assertions++; }
  function transportUntouched() {
    check(runtime.serverActionCalls === 0, "Client submit must not invoke the SSR/server-action fallback");
    check(browser.location.href === "http://localhost/objective-claim-dom-test", "Claim must not navigate");
  }

  await mount([objective("first"), objective("second")]);
  {
    const pending = deferred(); runtime.enqueue("claim_current_game_objective", pending.promise);
    const firstButton = button("first");
    await act(async () => { firstButton.click(); firstButton.click(); button("second").click(); });
    check(runtime.calls.length === 1, "Double click and another card during attribution must produce one mutation");
    check(firstButton.disabled && firstButton.getAttribute("aria-busy") === "true" && firstButton.textContent.includes("Attribution…"), "Pending attribution must be immediately visible");
    check(button("second").disabled, "Other claims must be disabled during one in-flight mutation");
    check(metric("À récupérer") === "2" && metric("Réclamés") === "0" && !container.querySelector('[role="status"]'), "No reward or success counter may be shown before acknowledgment");
    await settle(pending, receipt("first"));
    check(!card("first").querySelector("form") && card("first").textContent.includes("Récompense récupérée"), "Confirmed receipt must update the actual reward card");
    check(metric("À récupérer") === "1" && metric("Réclamés") === "1", "Hero counters must update without reloading");
    check(container.querySelector('[data-testid="tab-ready"]').textContent === "1", "Objectives tab badge must follow the confirmed claim");
    check(runtime.calls.length === 1, "Immediate confirmation must not await a full objectives refetch");
    transportUntouched();
  }
  console.log("PASS career claim: pending, double click, local confirmation, counters and no navigation");

  const album = objective("album_count", { group: "cyclo_stickers", album: { editionId: "test-edition", sourceSeason: 4, achievementId: "count-1", trophy: false } });
  await mount([album], { ...all, status: "completed" });
  {
    const pending = deferred(); const confirmation = deferred();
    runtime.enqueue("claim_current_cyclo_stickers_achievement", pending.promise);
    runtime.enqueue("get_current_cyclo_stickers_reward_objectives", confirmation.promise);
    await click(album.key);
    await settle(pending, { data: { alreadyClaimed: false, state: { edition: { id: "test-edition" }, directorId: "test-director", owner: { directorId: "test-director" }, claimedAchievements: ["count-1"] } }, error: null });
    check(metric("Réclamés") === "0" && button(album.key).disabled, "Album card must await its actual claimed timestamp");
    await settle(confirmation, { data: { claimed_at: claimedAt }, error: null });
    check(!card(album.key) && container.textContent.includes("Aucun objectif ne correspond"), "Claimed album reward must leave the ready-only filter immediately");
    check(metric("À récupérer") === "0" && metric("Réclamés") === "1", "Album reward counters must update");
    check(runtime.calls[1].filters.length === 2, "Receipt lookup must target the exact album edition and achievement");
    transportUntouched();
  }
  console.log("PASS album claim: authoritative receipt, ready filter and counters");

  await mount([objective("retry")]);
  {
    runtime.enqueue("claim_current_game_objective", { data: null, error: { message: "Temporary test failure" } });
    runtime.enqueue("table:game_objective_claims", { data: null, error: null });
    await click("retry");
    check(container.querySelector('[role="alert"]')?.textContent === "Temporary test failure", "RPC failure must be explained");
    check(!button("retry").disabled && metric("Réclamés") === "0", "Failed claim must remain available for retry");
    runtime.enqueue("claim_current_game_objective", receipt("retry")); await click("retry");
    check(metric("Réclamés") === "1" && !container.querySelector('[role="alert"]'), "A later confirmed retry must clear the error and claim once");
    transportUntouched();
  }
  console.log("PASS error: preserved reward and successful retry");

  const progressing = objective("progress", { currentValue: 0, targetValue: 100, progressPercent: 0, completed: false });
  await mount([objective("a"), objective("b"), progressing]);
  {
    const oldRefresh = deferred(); const newRefresh = deferred();
    runtime.enqueue("claim_current_game_objective", receipt("a"));
    runtime.enqueue("get_current_game_objectives", oldRefresh.promise);
    await click("a"); await waitForRefresh();
    check(runtime.calls.length === 2, "Progress reconciliation must run in the background after confirmation");
    runtime.enqueue("claim_current_game_objective", receipt("b"));
    runtime.enqueue("get_current_game_objectives", newRefresh.promise);
    await click("b");
    await settle(oldRefresh, { data: [row(objective("a")), row(objective("b")), row({ ...progressing, title: "STALE PROGRESSION" })], error: null });
    check(metric("Réclamés") === "2" && !container.textContent.includes("STALE PROGRESSION"), "Old background response must not undo later claims or replace progression");
    await waitForRefresh();
    await settle(newRefresh, { data: [row(objective("a")), row(objective("b")), row({ ...progressing, title: "FRESH PROGRESSION", currentValue: 40 })], error: null });
    check(metric("Réclamés") === "2" && container.textContent.includes("FRESH PROGRESSION"), "Current refresh must update progression while retaining local receipts absent from its snapshot");
    transportUntouched();
  }
  console.log("PASS concurrent background response: stale result ignored and confirmed receipts retained");

  await mount([objective("ssr"), progressing]);
  {
    const pendingRefresh = deferred();
    runtime.enqueue("claim_current_game_objective", receipt("ssr"));
    runtime.enqueue("get_current_game_objectives", pendingRefresh.promise);
    await click("ssr"); await waitForRefresh();
    await rerender({ objectives: [objective("ssr"), { ...progressing, title: "NEW SERVER PROGRESSION", currentValue: 70 }] });
    check(metric("Réclamés") === "1" && container.textContent.includes("NEW SERVER PROGRESSION"), "Fresh server props must reconcile without dropping a locally confirmed claim");
    check(runtime.calls[1].signal?.aborted, "Fresh server props must cancel the obsolete background request");
    await settle(pendingRefresh, { data: [row({ ...progressing, title: "OBSOLETE SERVER PROGRESSION" })], error: null });
    check(container.textContent.includes("NEW SERVER PROGRESSION") && !container.textContent.includes("OBSOLETE SERVER PROGRESSION"), "Canceled response must not overwrite the new server snapshot");
  }
  console.log("PASS server snapshot reconciliation: fresh progress wins and old request is canceled");

  await mount([objective("session-before")]);
  runtime.userId = "another-test-owner";
  await click("session-before");
  check(runtime.calls.length === 0 && container.querySelector('[role="alert"]')?.textContent.includes("session a changé"), "Changed session before click must block all mutation");
  check(metric("Réclamés") === "0" && !button("session-before").disabled, "Session mismatch must not invent a receipt");
  console.log("PASS session changed before attribution: blocked without mutation");

  await mount([objective("session-after")]);
  {
    const pending = deferred(); runtime.enqueue("claim_current_game_objective", pending.promise);
    await click("session-after"); runtime.userId = "another-test-owner";
    await settle(pending, receipt("session-after"));
    check(metric("Réclamés") === "0" && container.querySelector('[role="alert"]')?.textContent.includes("session a changé"), "Changed session during RPC must not display another account's confirmation");
    transportUntouched();
  }
  console.log("PASS session changed during attribution: confirmation rejected");
  console.log(`Objective claim DOM interactions: 7 scenarios passed (${assertions} assertions).`);

  function resolveExtension(specifier) {
    // Resolve only repository source files; no environment/module side effects.
    for (const extension of [".tsx", ".ts", ".jsx", ".js"]) {
      try { require.resolve(path.join(root, specifier.slice(2)) + extension); return extension; } catch { /* try the next extension */ }
    }
    throw new Error(`No source file for ${specifier}`);
  }
} finally {
  if (mountedRoot) {
    const loaded = require.cache[path.join(scratch, "actual-objectives.cjs")]?.exports;
    if (loaded?.act) await loaded.act(async () => mountedRoot.unmount());
  }
  await browser.happyDOM.close();
  for (const channel of messageChannels) { channel.port1.close(); channel.port2.close(); }
  delete globalThis[runtimeKey];
  for (const [name, descriptor] of savedGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
  const resolvedScratch = path.resolve(scratch);
  if (path.dirname(resolvedScratch) === path.resolve(tmpdir()) && path.basename(resolvedScratch).startsWith("objective-claim-dom-")) {
    await rm(resolvedScratch, { recursive: true, force: true });
  }
}
