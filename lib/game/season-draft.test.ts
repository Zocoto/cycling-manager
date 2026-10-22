import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { draftSalary, isDraftBannerVisible, reorderDraftPreferences, type SeasonDraftRider, type SeasonDraftView } from "./season-draft";

const view = { enabled: true, serverNow: "2026-11-05T12:00:00+01:00", edition: { status: "scheduled", announcementAt: "2026-11-05T00:00:00+01:00", startsAt: "2026-11-06T14:00:00+01:00" } } as SeasonDraftView;

describe("draft de début de saison", () => {
  it("annonce dès J28, sans exposition permanente dans le bureau", () => {
    expect(isDraftBannerVisible(view)).toBe(true);
    expect(isDraftBannerVisible({ ...view, serverNow: "2026-11-04T23:59:00+01:00" })).toBe(false);
    expect(isDraftBannerVisible({ ...view, serverNow: "2026-11-07T00:00:00+01:00" })).toBe(false);
    expect(isDraftBannerVisible({ ...view, enabled: false })).toBe(false);
    expect(isDraftBannerVisible({ ...view, edition: { ...view.edition!, status: "running" }, enabled: false })).toBe(true);
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
    const banner = readFileSync("components/game/dashboard-draft-shortcut.tsx", "utf8");
    expect(banner.indexOf("[1, 28]")).toBeLessThan(banner.indexOf("await getSeasonDraftView"));
  });
});
