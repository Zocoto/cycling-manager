import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { decodeManagementDraft, encodeManagementDraft, MANAGEMENT_DRAFT_TTL, MANAGEMENT_DRAFT_MAX_SIZE } from "./management-drafts";
import { confirmManagementDraftNavigation, registerUnsavedManagementChanges } from "./management-navigation";

describe("local management draft recovery", () => {
  const now = 1_000_000;
  it("round-trips a recent draft against the exact current baseline", () => {
    const raw = encodeManagementDraft("team/season/day/stock", { rider: 60 }, now);
    expect(decodeManagementDraft(raw, "team/season/day/stock", now + 1)).toEqual({ value: { rider: 60 } });
  });
  it.each(["other-team", "next-day", "different-stock", "different-staff"])('rejects changed context: %s', baseline => {
    expect(decodeManagementDraft(encodeManagementDraft("original", {}, now), baseline, now)).toBeNull();
  });
  it.each([MANAGEMENT_DRAFT_TTL, MANAGEMENT_DRAFT_TTL + 1, -1])("rejects expired or future timestamp (%i)", elapsed => {
    expect(decodeManagementDraft(encodeManagementDraft("base", {}, now), "base", now + elapsed)).toBeNull();
  });
  it.each([null, "{", "null", "[]", '{"version":2}', '{"version":1,"savedAt":"bad"}'])('rejects malformed data %s', raw => {
    expect(decodeManagementDraft(raw, "base", now)).toBeNull();
  });
  it("bounds both storage writes and parsing", () => {
    expect(encodeManagementDraft("base", "x".repeat(MANAGEMENT_DRAFT_MAX_SIZE), now)).toBeNull();
    expect(decodeManagementDraft("x".repeat(MANAGEMENT_DRAFT_MAX_SIZE + 1), "base", now)).toBeNull();
  });
});

describe("management navigation protection", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.unstubAllGlobals(); });
  function browser(lang = "fr") {
    const addEventListener = vi.fn(); const removeEventListener = vi.fn(); const confirm = vi.fn(() => false);
    vi.stubGlobal("window", { location: new URL("https://example.test/jeu/entrainement"), addEventListener, removeEventListener, confirm });
    vi.stubGlobal("document", { documentElement: { lang } });
    return { addEventListener, removeEventListener, confirm };
  }
  it("does no browser work when no editor is dirty", () => {
    expect(confirmManagementDraftNavigation("/jeu")).toBe(true);
  });
  it("shares one unload listener across dirty forms and removes it after the last", () => {
    const mocks = browser();
    const first = registerUnsavedManagementChanges(); const second = registerUnsavedManagementChanges();
    cleanups.push(first, second);
    expect(mocks.addEventListener).toHaveBeenCalledTimes(1);
    first(); expect(mocks.removeEventListener).not.toHaveBeenCalled();
    second(); expect(mocks.removeEventListener).toHaveBeenCalledTimes(1);
  });
  it("does not block in-page anchors, but protects route and filter changes", () => {
    const mocks = browser(); cleanups.push(registerUnsavedManagementChanges());
    expect(confirmManagementDraftNavigation("#rider")).toBe(true);
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(confirmManagementDraftNavigation("/jeu")).toBe(false);
    expect(confirmManagementDraftNavigation("/jeu/entrainement?onglet=preparation")).toBe(false);
    expect(confirmManagementDraftNavigation("/jeu/entrainement", true)).toBe(false);
    mocks.confirm.mockReturnValue(true);
    expect(confirmManagementDraftNavigation("/jeu")).toBe(true);
  });
  it("uses an English warning for an English page", () => {
    const mocks = browser("en"); cleanups.push(registerUnsavedManagementChanges());
    confirmManagementDraftNavigation("/jeu");
    expect(mocks.confirm).toHaveBeenCalledWith("You have unsaved changes. Leave this page?");
  });
  it("does not change browser history to trap the user", () => {
    const source = readFileSync("lib/game/management-navigation.ts", "utf8");
    expect(source).not.toMatch(/pushState|replaceState|popstate/);
  });
});

describe("management query budget", () => {
  it.each(["components/game/use-management-draft.tsx", "lib/game/management-drafts.ts", "lib/game/management-navigation.ts", "lib/game/race-preparation-ordering.ts", "components/game/team-contract-management.tsx"])("adds no request or polling in %s", file => {
    expect(readFileSync(file, "utf8")).not.toMatch(/\bfetch\s*\(|\.rpc\s*\(|\.from\s*\(|setInterval\s*\(|router\.refresh/);
  });
  it("keeps the existing bounded assistant service and deferred boundary", () => {
    const source = readFileSync("services/dashboard-assistant.ts", "utf8");
    expect(source.match(/\.rpc\(/g)).toHaveLength(7);
    expect(source.match(/\.from\(/g)).toHaveLength(2);
    expect(source).toContain("core ?? readAssistantCore");
    expect(readFileSync("components/game/dashboard-assistant-boundary.tsx", "utf8")).toContain("await ready");
  });
});
