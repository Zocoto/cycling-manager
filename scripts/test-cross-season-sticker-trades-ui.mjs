/** Real React/DOM trade checks; no server, credentials or network.
 * node scripts/test-cross-season-sticker-trades-ui.mjs /path/to/happy-dom/lib/index.js
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MessageChannel as NodeMessageChannel } from "node:worker_threads";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
if (!process.argv[2]) throw new Error("Pass the isolated Happy DOM module entry as the first argument.");
const { Window } = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const { build } = require("esbuild");
const scratch = await mkdtemp(path.join(tmpdir(), "cross-season-sticker-dom-"));
const browser = new Window({ url: "http://localhost/cross-season-sticker-test" });
const runtimeKey = "__crossSeasonStickerDomTest";
const savedGlobals = new Map();
const channels = [];
for (const [name, value] of Object.entries({
  window: browser, document: browser.document, navigator: browser.navigator,
  HTMLElement: browser.HTMLElement, HTMLFormElement: browser.HTMLFormElement,
  Node: browser.Node, Event: browser.Event, MouseEvent: browser.MouseEvent,
  MutationObserver: browser.MutationObserver, FormData: browser.FormData,
  MessageChannel: class extends NodeMessageChannel { constructor() { super(); channels.push(this); } },
  IS_REACT_ACT_ENVIRONMENT: true,
  fetch: () => { throw new Error("Network access is forbidden in this isolated test."); },
})) {
  savedGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}
const stubs = {
  "@/lib/supabase/client": `export function createSupabaseBrowserClient(){return globalThis.${runtimeKey}.client;}`,
  "@/components/i18n/locale-provider": `export function useLocale(){return {locale:"fr"};}`,
  "@/components/ui/app-link": `import React from "react";export default function Link({children,prefetch,...props}){return <a {...props}>{children}</a>;}`,
  "@/components/game/rider-avatar": `import React from "react";export function RiderAvatar(){return <span data-test-avatar=""/>;}`,
};
let mountedRoot;
let act;
try {
  const bundlePath = path.join(scratch, "actual-sticker-trades.cjs");
  await build({
    stdin: {
      contents: `export {createElement,act,useState} from "react";export {createRoot} from "react-dom/client";export * from "@/components/game/cyclo-stickers-trades";export {createCycloStickersPersistentStateFixture} from "@/lib/game/cyclo-stickers-persistence.fixture";export {createCycloStickersFinalSnapshot,serializeCycloStickersSnapshot} from "@/lib/game/cyclo-stickers-final-snapshot";export {createFinalCycloStickersSourceFixture} from "@/lib/game/cyclo-stickers-final-snapshot.fixture";`,
      resolveDir: root, sourcefile: "cross-season-sticker-dom-entry.tsx", loader: "tsx",
    },
    outfile: bundlePath, bundle: true, platform: "node", format: "cjs", jsx: "automatic",
    logLevel: "silent", define: { "process.env.NODE_ENV": '"development"' },
    plugins: [{ name: "isolated-trade-boundaries", setup(plugin) {
      plugin.onResolve({ filter: /^@\// }, ({ path: specifier }) => specifier in stubs
        ? { path: specifier, namespace: "test-stub" }
        : { path: resolveSource(specifier) });
      plugin.onResolve({ filter: /^(\.\/|\.\.\/).*rider-avatar$/ }, () => ({ path: "@/components/game/rider-avatar", namespace: "test-stub" }));
      plugin.onLoad({ filter: /.*/, namespace: "test-stub" }, ({ path: specifier }) => ({ contents: stubs[specifier], loader: "tsx", resolveDir: root }));
      plugin.onLoad({ filter: /\.css$/ }, () => ({ contents: 'export default new Proxy({}, {get:(_,key)=>String(key)});', loader: "js" }));
    } }],
  });
  const api = require(bundlePath);
  const { createElement: h, createRoot, useState, CycloStickersTrades } = api;
  act = api.act;
  const original = api.createCycloStickersFinalSnapshot(api.createFinalCycloStickersSourceFixture());
  const snapshots = new Map([4, 5].map(season => [season, {
    ...structuredClone(original), edition: `test-edition-s${season}`, sourceSeason: season,
    collectionSeason: season + 1, ratingsFrozenFromSeason: season,
    sourceSeasonId: `10000000-0000-4000-8000-${String(season).padStart(12, "0")}`,
    presentationSeason: season, gamesEdition: season === 4,
    cards: original.cards.map(card => ({ ...structuredClone(card), name: `Vignette S${season} numéro ${card.number}` })),
  }]));
  const edition = season => snapshots.get(season).edition;
  const ref = (season, cardNumber = 1) => ({ editionId: edition(season), cardNumber });
  const item = (season, cardNumber = 1) => ({ ...ref(season, cardNumber), sourceSeason: season });
  const owner = "10000000-0000-4000-8000-000000000003";
  const recipient = "10000000-0000-4000-8000-000000000004";
  const summaries = [4, 5].map(season => ({
    editionId: edition(season), sourceSeasonId: snapshots.get(season).sourceSeasonId,
    collectionSeasonId: `10000000-0000-4000-8000-${String(season + 1).padStart(12, "0")}`,
    sourceSeason: season, collectionSeason: season + 1,
    totalCards: 72, pastedCount: 0, ownedCount: 0, completionPercent: 0,
  }));
  const baseWorkspace = () => ({ directorId: owner, editions: summaries,
    owned: [{ ...item(5), quantity: 3, pasted: false, reserved: 0 }],
    incomingOffers: [], outgoingOffers: [], history: [] });
  const offer = extra => ({ id: "10000000-0000-4000-8000-000000000090", legacy: false,
    fromDirectorId: recipient, fromName: "Collectionneur B", toDirectorId: owner, toName: "Moi",
    giveItems: [item(4)], receiveItems: [item(5)], status: "pending",
    createdAt: "2026-11-27T09:00:00Z", expiresAt: "2026-11-29T09:00:00Z", ...extra });
  let runtime;
  let container;
  let assertions = 0;
  const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const check = (condition, message) => { assertions++; assert.ok(condition, message); };
  const textOf = () => container.textContent.replace(/\s+/g, " ");
  const buttons = () => [...container.querySelectorAll("button")];
  const namedButton = text => buttons().find(button => button.textContent.includes(text));
  const addStickerButton = text => buttons().find(button => button.getAttribute("aria-label")?.startsWith("Ajouter ") && button.textContent.includes(text));
  function selectFor(label) {
    const entry = [...container.querySelectorAll("label")].find(candidate => candidate.textContent.includes(label));
    const select = entry?.querySelector("select") ?? (entry?.htmlFor ? browser.document.getElementById(entry.htmlFor) : null);
    assert.ok(select, `Missing selector: ${label}`);
    return select;
  }
  async function changeCollection(label, season) {
    const select = selectFor(label);
    const option = [...select.options].find(entry => entry.value === edition(season) || new RegExp(`S${season}\\b`).test(entry.textContent));
    assert.ok(option, `Missing S${season} in ${label}`);
    await act(async () => { select.value = option.value; select.dispatchEvent(new browser.Event("change", { bubbles: true })); });
  }
  async function click(button) {
    assert.ok(button, "Button must exist");
    check(!button.disabled, `Button unexpectedly disabled: ${button.textContent}`);
    await act(async () => { button.click(); });
  }
  async function until(condition, message) {
    for (let index = 0; index < 100; index++) {
      if (condition()) return;
      await act(async () => { await pause(20); });
    }
    assert.fail(message + `\nRendered: ${textOf()}`);
  }
  const refsOnly = entries => entries.map(({ editionId, cardNumber }) => ({ editionId, cardNumber }));
  function createRuntime(workspace) {
    const queues = new Map();
    const state = { workspace, calls: [], mutations: [], mutationQueue: [], notices: [], setView: null, setBusy: null,
      enqueue(name, response) { const queue = queues.get(name) ?? []; queue.push(response); queues.set(name, queue); },
      client: null,
    };
    state.client = {
      auth: { getSession: async () => ({ data: { session: { user: { id: owner } } }, error: null }) },
      rpc(name, args) {
        const call = { name, args, signal: null }; state.calls.push(call);
        let response;
        const queued = queues.get(name);
        if (queued?.length) response = queued.shift();
        else if (name === "get_current_cyclo_stickers_trade_inventory") response = { data: state.workspace, error: null };
        else if (name === "get_cyclo_stickers_catalogue") {
          const snapshot = [...snapshots.values()].find(value => value.edition === args.p_edition);
          assert.ok(snapshot, "Unknown test catalogue requested");
          response = { data: { snapshot, editionId: snapshot.edition, sha256: createHash("sha256").update(api.serializeCycloStickersSnapshot(snapshot)).digest("hex") }, error: null };
        } else {
          const queue = queues.get(name);
          assert.ok(queue?.length, `Unexpected RPC: ${name}`);
          response = queue.shift();
        }
        const promise = Promise.resolve(response);
        promise.abortSignal = signal => { call.signal = signal; return promise; };
        return promise;
      },
    };
    state.mutate = async (name, args, message, onError, onWorkspace) => {
      state.mutations.push({ name, args });
      assert.ok(state.mutationQueue.length, `Unexpected mutation: ${name}`);
      state.setBusy(true);
      try {
        const response = await state.mutationQueue.shift();
        if (response.error) { onError?.(response.error); return null; }
        if (response.tradeState) { state.workspace = response.tradeState; onWorkspace?.(response.tradeState, { status: response.status }); }
        state.setView(response.state);
        state.notices.push(typeof message === "function" ? message(response.state) : message);
        return response.state;
      } finally { state.setBusy(false); }
    };
    return state;
  }
  function makeView(workspace) {
    const state = api.createCycloStickersPersistentStateFixture();
    state.edition = { ...state.edition, id: edition(4), sourceSeason: 4, collectionSeason: 5 };
    state.owned = workspace.owned.filter(row => row.editionId === edition(4)).map(({ cardNumber, quantity, pasted, reserved }) => ({ cardNumber, quantity, pasted, reserved }));
    return state;
  }
  async function mount(workspace = baseWorkspace(), initialView = "compose", initialTarget = 1) {
    if (mountedRoot) await act(async () => mountedRoot.unmount());
    browser.document.body.innerHTML = "<div id='root'></div>";
    container = browser.document.getElementById("root");
    runtime = createRuntime(workspace); globalThis[runtimeKey] = runtime;
    function Harness() {
      const [view, setView] = useState(makeView(workspace));
      const [busy, setBusy] = useState(false);
      runtime.setView = setView; runtime.setBusy = setBusy;
      return h(CycloStickersTrades, { snapshot: snapshots.get(4), state: view, busy,
        mutate: runtime.mutate, initialTarget, initialOffer: null, initialView, wanted: [] });
    }
    mountedRoot = createRoot(container);
    await act(async () => mountedRoot.render(h(Harness)));
    await until(() => runtime.calls.some(call => call.name === "get_current_cyclo_stickers_trade_inventory"), "Workspace must be read on mount");
  }

  // Same card number across collections must be a valid, unambiguous exchange.
  await mount();
  const search = deferred();
  runtime.enqueue("search_cyclo_stickers_cross_season_matches", search.promise);
  await changeCollection("Collection proposée", 5);
  await until(() => addStickerButton("Vignette S5 numéro 1"), "S5 spare must use the S5 catalogue");
  await click(addStickerButton("Vignette S5 numéro 1"));
  await until(() => runtime.calls.some(call => call.name === "search_cyclo_stickers_cross_season_matches"), "Selecting a spare must search");
  const searchCall = runtime.calls.find(call => call.name === "search_cyclo_stickers_cross_season_matches");
  assert.deepEqual(refsOnly(searchCall.args.p_give), [ref(5)]);
  check(searchCall.args.p_wanted.some(value => value.editionId === edition(4) && value.cardNumber === 1), "Wanted S4 #1 must not be excluded by offered S5 #1");
  await act(async () => search.resolve({ data: [{ directorId: recipient, displayName: "Collectionneur B",
    availableCards: [{ ...item(4), quantity: 1 }], wantedOfferCards: [item(5)] }], error: null }));
  await until(() => namedButton("Collectionneur B"), "Compatible collector must appear");
  await click(namedButton("Collectionneur B"));
  await until(() => addStickerButton("Vignette S4 numéro 1"), "S4 requested card must retain its own name");
  await click(addStickerButton("Vignette S4 numéro 1"));
  check(textOf().includes("S4") && textOf().includes("S5"), "Both collection badges must be visible before sending");
  runtime.mutationQueue.push({ error: "Réponse perdue : réessayez pour vérifier la proposition." });
  await click(namedButton("Envoyer la proposition"));
  check(textOf().includes("Réponse perdue"), "A failed confirmation must preserve a visible retry");
  const uncertainRequest = runtime.mutations[0];
  const proposed = deferred(); runtime.mutationQueue.push(proposed.promise);
  await click(namedButton("Envoyer la proposition"));
  check(runtime.mutations.length === 2, "One explicit retry must submit only one additional request");
  const sent = runtime.mutations[1];
  check(sent.args.p_request_id === uncertainRequest.args.p_request_id, "A retry after a lost confirmation must retain the same idempotency identifier");
  check(namedButton("Envoyer la proposition").disabled, "The send button must wait for an acknowledged proposal");
  check(sent.name === "propose_cyclo_stickers_cross_season_trade", "New multi-season RPC must be used");
  assert.deepEqual(refsOnly(sent.args.p_give), [ref(5)]);
  assert.deepEqual(refsOnly(sent.args.p_receive), [ref(4)]);
  check(sent.args.p_view_edition === edition(4), "The displayed album must stay the mutation view");
  check(sent.args.p_expected_director_id === owner, "The mutation must verify the displayed director even if the auth session changes");
  check(Boolean(sent.args.p_request_id), "The proposal needs an idempotency identifier");
  const outgoing = offer({ fromDirectorId: owner, fromName: "Moi", toDirectorId: recipient, toName: "Collectionneur B", giveItems: [item(5)], receiveItems: [item(4)] });
  const reserved = { ...runtime.workspace, owned: [{ ...item(5), quantity: 3, pasted: false, reserved: 1 }], outgoingOffers: [outgoing] };
  await act(async () => proposed.resolve({ state: makeView(reserved), tradeState: reserved }));
  await until(() => textOf().includes("Propositions envoyées"), "Confirmed proposal must reach the mailbox");
  check(textOf().includes("Vignette S4 numéro 1") && textOf().includes("Vignette S5 numéro 1"), "Receipt must describe each edition's own card");
  console.log("PASS S5 spare for missing S4 with equal card numbers: catalogues, selectors, full refs, idempotent retry and pending receipt");

  // A copy in S5 must not turn the same numbered S4 card into a duplicate.
  const incoming = offer();
  await mount({ ...baseWorkspace(), incomingOffers: [incoming] }, "inbox", null);
  await until(() => textOf().includes("Vignette S4 numéro 1"), "Incoming S4 card name must load");
  check(textOf().includes("Nouvelle pour toi"), "Missing S4 card must be described as new despite owned S5 #1");
  check(!textOf().includes("Tu recevras 1 exemplaire en double."), "S5 ownership must not create a false S4 duplicate warning");
  const acceptedWorkspace = { ...runtime.workspace,
    owned: [{ ...item(5), quantity: 2, pasted: false, reserved: 0 }, { ...item(4), quantity: 1, pasted: false, reserved: 0 }],
    incomingOffers: [], history: [] };
  runtime.mutationQueue.push({ status: "accepted", state: makeView(acceptedWorkspace), tradeState: acceptedWorkspace });
  await click(namedButton("Accepter cet échange"));
  const accepted = runtime.mutations[0];
  check(accepted.name === "respond_cyclo_stickers_cross_season_trade", "Accept must use the explicit cross-season confirmation RPC");
  check(accepted.args.p_expected_director_id === owner, "Accept must also verify the displayed director");
  assert.deepEqual(refsOnly(accepted.args.p_expected_give), [ref(4)]);
  assert.deepEqual(refsOnly(accepted.args.p_expected_receive), [ref(5)]);
  check(runtime.notices.at(-1)?.includes("Échange accepté"), "Acceptance must use the authoritative status even when the offer is outside the recent history window");
  console.log("PASS incoming ownership and accept consent are scoped to the full edition/card identity");

  await mount({ ...baseWorkspace(), owned: [...baseWorkspace().owned, { ...item(4), quantity: 1, pasted: true, reserved: 0 }], incomingOffers: [incoming] }, "inbox", null);
  await until(() => textOf().includes("Déjà dans ta collection"), "A pasted S4 copy must still be owned");
  check(textOf().includes("Tu recevras 1 exemplaire en double."), "The actual same-edition duplicate warning must remain");
  check(!namedButton("Accepter cet échange").disabled, "Duplicate warning is informative, not a trade prohibition");
  console.log("PASS an actual pasted same-edition copy remains a visible duplicate warning");

  // Changing the desired collection must discard an older matching response.
  await mount();
  const obsoleteSearch = deferred();
  runtime.enqueue("search_cyclo_stickers_cross_season_matches", obsoleteSearch.promise);
  await changeCollection("Collection proposée", 5);
  await until(() => addStickerButton("Vignette S5 numéro 1"), "Offer catalogue must load");
  await click(addStickerButton("Vignette S5 numéro 1"));
  await until(() => runtime.calls.filter(call => call.name === "search_cyclo_stickers_cross_season_matches").length === 1, "First search must start");
  runtime.enqueue("search_cyclo_stickers_cross_season_matches", { data: [{ directorId: recipient, displayName: "Collectionneur C",
    availableCards: [{ ...item(5, 2), quantity: 1 }], wantedOfferCards: [item(5)] }], error: null });
  await changeCollection("Collection recherchée", 5);
  await until(() => namedButton("Collectionneur C"), "New collection results must load");
  const newestSearch = runtime.calls.filter(call => call.name === "search_cyclo_stickers_cross_season_matches").at(-1);
  check(newestSearch.args.p_wanted.length > 0 && newestSearch.args.p_wanted.every(value => value.editionId === edition(5)), "The new search must only want the selected collection");
  await act(async () => obsoleteSearch.resolve({ data: [{ directorId: recipient, displayName: "Ancien résultat S4",
    availableCards: [{ ...item(4), quantity: 1 }], wantedOfferCards: [item(5)] }], error: null }));
  check(Boolean(namedButton("Collectionneur C")) && !namedButton("Ancien résultat S4"), "A stale response must not restore results from another collection");
  check(!namedButton("Envoyer la proposition"), "Changing collection must clear the recipient and requested cards");
  console.log("PASS collection change invalidates pending results and clears the previous proposal selection");

  // A wrongly labelled catalogue may never lend its card names to another season.
  await mount();
  runtime.enqueue("get_cyclo_stickers_catalogue", { data: { editionId: edition(4), snapshot: snapshots.get(4), sha256: "0".repeat(64) }, error: null });
  await changeCollection("Collection proposée", 5);
  await until(() => container.querySelector('[role="alert"]'), "A mismatched catalogue must produce an explicit error");
  check(!addStickerButton("Vignette S4 numéro 1") && !addStickerButton("Vignette S5 numéro 1"), "A poisoned catalogue must not create tradable S5 stock");
  check(runtime.mutations.length === 0, "Invalid catalogue data must never mutate inventory");
  await click(namedButton("Actualiser mes collections"));
  await until(() => addStickerButton("Vignette S5 numéro 1"), "Retry must load the correct catalogue without a page reload");
  console.log("PASS mismatched catalogue rejected, cards preserved and correct catalogue recovered on retry");

  // Direct name search intentionally permits cards already owned by either side.
  await mount({ ...baseWorkspace(), owned: [...baseWorkspace().owned, { ...item(4), quantity: 1, pasted: true, reserved: 0 }] }, "compose", null);
  runtime.enqueue("search_cyclo_stickers_cross_season_matches", { data: [], error: null });
  await changeCollection("Collection proposée", 5);
  await until(() => addStickerButton("Vignette S5 numéro 1"), "Manual search offer catalogue must load");
  await click(addStickerButton("Vignette S5 numéro 1"));
  await until(() => runtime.calls.some(call => call.name === "search_cyclo_stickers_cross_season_matches"), "Initial matching request must complete");
  const manualSummary = [...container.querySelectorAll("summary")].find(summary => summary.textContent.includes("Chercher un DS par son nom"));
  await act(async () => manualSummary.click());
  const manualInput = container.querySelector("input");
  await act(async () => {
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, "value").set.call(manualInput, "Mon ami");
    manualInput.dispatchEvent(new browser.Event("input", { bubbles: true }));
  });
  runtime.enqueue("search_cyclo_stickers_cross_season_matches", { data: [{ directorId: recipient, displayName: "Mon ami",
    availableCards: [{ ...item(4), quantity: 1 }], wantedOfferCards: [] }], error: null });
  await click(namedButton("Chercher ce DS"));
  await until(() => namedButton("Mon ami"), "Explicitly named collector must remain selectable");
  const manualSearch = runtime.calls.filter(call => call.name === "search_cyclo_stickers_cross_season_matches").at(-1);
  check(manualSearch.args.p_query === "Mon ami", "A name search must retain its explicit mode on the RPC");
  check(manualSearch.args.p_wanted.some(value => value.editionId === edition(4) && value.cardNumber === 1), "Manual search may ask for a pasted card intentionally");
  console.log("PASS explicit director search preserves intentional duplicate-card exchanges");

  console.log(`Cross-season sticker DOM interactions passed (${assertions} assertions).`);

  function resolveSource(specifier) {
    const base = path.join(root, specifier.slice(2));
    for (const extension of ["", ".tsx", ".ts", ".jsx", ".js"]) {
      try { return require.resolve(base + extension); } catch { /* try next source extension */ }
    }
    throw new Error(`No source file for ${specifier}`);
  }
} finally {
  if (mountedRoot && act) await act(async () => mountedRoot.unmount());
  await browser.happyDOM.close();
  for (const channel of channels) { channel.port1.close(); channel.port2.close(); }
  delete globalThis[runtimeKey];
  for (const [name, descriptor] of savedGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
  const resolvedScratch = path.resolve(scratch);
  if (path.dirname(resolvedScratch) === path.resolve(tmpdir()) && path.basename(resolvedScratch).startsWith("cross-season-sticker-dom-")) {
    await rm(resolvedScratch, { recursive: true, force: true });
  }
}
