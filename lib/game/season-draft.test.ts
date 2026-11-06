import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canEditDraftPreferences, draftBannerExpiresAt, draftSalary, isDraftBannerVisible, reorderDraftPreferences, synchronizeDraftPreparation, type DraftPreparation, type DraftPreparationEditor, type SeasonDraftRider } from "./season-draft";
import { createDraftFixture } from "@/test/fixtures/season-draft";

const view = createDraftFixture();

describe("draft de début de saison", () => {
  it("allows a pending player's list until that player's own deadline, independently of 14 h", () => {
    const fixture = createDraftFixture();
    fixture.edition!.status = "running";
    fixture.edition!.currentPosition = 1;
    fixture.edition!.deadline = "2026-11-06T14:10:00+01:00";
    fixture.serverNow = "2026-11-06T14:20:00+01:00";
    expect(canEditDraftPreferences(fixture)).toBe(true);
    fixture.edition!.currentPosition = fixture.mine!.position;
    expect(canEditDraftPreferences(fixture)).toBe(false);
    fixture.edition!.deadline = "2026-11-06T14:30:00+01:00";
    expect(canEditDraftPreferences(fixture)).toBe(true);
    fixture.edition!.currentPosition = fixture.mine!.position + 1;
    expect(canEditDraftPreferences(fixture)).toBe(false);
    fixture.edition!.currentPosition = null;
    fixture.edition!.deadline = null;
    expect(canEditDraftPreferences(fixture)).toBe(true);
  });

  it("refreshes a clean preference editor from a newly saved list", () => {
    const saved: DraftPreparation = { editionId: "draft", teamId: "team", preferences: ["a"], autoEnabled: true };
    const editor: DraftPreparationEditor = { saved, preferences: ["a"], autoEnabled: true };
    const changed = { ...saved, preferences: ["b", "a"], autoEnabled: false };
    expect(synchronizeDraftPreparation(editor, changed)).toEqual({ saved: changed, preferences: ["b", "a"], autoEnabled: false });
  });

  it("keeps unsaved choices and manual mode when a refreshed server list changes", () => {
    const saved: DraftPreparation = { editionId: "draft", teamId: "team", preferences: ["a"], autoEnabled: true };
    const editor: DraftPreparationEditor = { saved, preferences: ["c", "a"], autoEnabled: false };
    const changed = { ...saved, preferences: ["b"] };
    const synchronized = synchronizeDraftPreparation(editor, changed);
    expect(synchronized.preferences).toEqual(["c", "a"]);
    expect(synchronized.autoEnabled).toBe(false);
    expect(synchronized.saved).toEqual(changed);
    expect(synchronizeDraftPreparation(synchronized, changed)).toBe(synchronized);
  });

  it("does not carry one edition's unsaved list into a different edition or team", () => {
    const saved: DraftPreparation = { editionId: "draft", teamId: "team", preferences: ["a"], autoEnabled: true };
    const editor: DraftPreparationEditor = { saved, preferences: ["c"], autoEnabled: false };
    for (const changed of [{ ...saved, editionId: "next" }, { ...saved, teamId: "other" }]) {
      expect(synchronizeDraftPreparation(editor, changed)).toEqual({ saved: changed, preferences: ["a"], autoEnabled: true });
    }
  });

  it("annonce uniquement à J1, même si la draft dépasse minuit", () => {
    expect(isDraftBannerVisible(view)).toBe(true);
    expect(isDraftBannerVisible({ ...view, serverNow: "2026-11-05T12:00:00+01:00" })).toBe(false);
    expect(isDraftBannerVisible({ ...view, serverNow: "2026-11-06T00:00:00+01:00" })).toBe(true);
    expect(isDraftBannerVisible({ ...view, serverNow: "2026-11-06T23:59:59+01:00" })).toBe(true);
    expect(isDraftBannerVisible({ ...view, serverNow: "2026-11-07T00:00:00+01:00" })).toBe(false);
    expect(isDraftBannerVisible({ ...view, serverNow: "2026-11-07T00:00:00+01:00", edition: { ...view.edition!, status: "running" } })).toBe(false);
    expect(isDraftBannerVisible({ ...view, enabled: false, edition: { ...view.edition!, status: "scheduled" } })).toBe(false);
    expect(isDraftBannerVisible({ ...view, edition: { ...view.edition!, status: "running" }, enabled: false })).toBe(true);
  });
  it.each([
    ["2026-12-04T14:00:00+01:00", "2026-12-03T23:00:00Z", "2026-12-04T23:00:00Z"],
    ["2027-06-18T14:00:00+02:00", "2027-06-17T22:00:00Z", "2027-06-18T22:00:00Z"],
    ["2027-03-28T14:00:00+02:00", "2027-03-27T23:00:00Z", "2027-03-28T22:00:00Z"],
    ["2027-10-31T14:00:00+01:00", "2027-10-30T22:00:00Z", "2027-10-31T23:00:00Z"],
  ])("borne chaque saison au jour de Paris, y compris au changement d’heure (%s)", (startsAt, beginning, end) => {
    const edition = { ...view.edition!, startsAt, status: "running" as const };
    expect(isDraftBannerVisible({ ...view, edition, serverNow: new Date(Date.parse(beginning) - 1).toISOString() })).toBe(false);
    expect(isDraftBannerVisible({ ...view, edition, serverNow: beginning })).toBe(true);
    expect(isDraftBannerVisible({ ...view, edition, serverNow: new Date(Date.parse(end) - 1).toISOString() })).toBe(true);
    expect(isDraftBannerVisible({ ...view, edition, serverNow: end })).toBe(false);
    expect(draftBannerExpiresAt(startsAt)).toBe(Date.parse(end));
  });
  it("réordonne sans perdre ni dupliquer un choix", () => {
    expect(reorderDraftPreferences(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(reorderDraftPreferences(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(reorderDraftPreferences(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(reorderDraftPreferences(["a", "b"], "unknown", 1)).toEqual(["a", "b"]);
  });
  it("affiche le salaire après les remises normales, sans frais supplémentaires", () => {
    const rider = { salaryPerSeason: 12500, abilities: ["homegrown"] } as SeasonDraftRider;
    expect(draftSalary(rider)).toBe(12500);
    expect(draftSalary(rider, 6)).toBe(11750);
    expect(draftSalary(rider, 6, true)).toBe(5875);
  });
  it("ne lance aucun traitement de draft pendant le rendu ou les lectures", () => {
    const service = readFileSync("services/season-draft.ts", "utf8");
    const status = readFileSync("app/api/season-draft/status/route.ts", "utf8");
    expect(service).not.toMatch(/rpc\("(?:process|advance|initialize)_/);
    expect(status).toContain("private, no-store");
  });
});
