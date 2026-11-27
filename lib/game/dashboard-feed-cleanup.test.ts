import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isDashboardNationsCupVisible } from "./dashboard-nations-cup";

const dashboard = readFileSync(join(process.cwd(), "app/jeu/page.tsx"), "utf8");
const tutorial = readFileSync(join(process.cwd(), "lib/tutorial/catalog.ts"), "utf8");

describe("Bureau du Directeur Sportif allégé", () => {
  it("retire le panneau déroulant des fils et classements", () => {
    expect(dashboard).not.toContain("DashboardMonitoringPanel");
    expect(dashboard).not.toContain("dashboard-news-feed");
  });

  it("oriente le tutoriel vers la boîte mail du Directeur Sportif", () => {
    expect(tutorial).toContain('targetId: "dashboard-overview"');
    expect(tutorial).toContain("boîte mail du Directeur Sportif");
    expect(tutorial).not.toContain('targetId: "dashboard-news-feed"');
  });

  it("place la fédération avant l’assistant, puis les tuiles de gestion", () => {
    const federationIndex = dashboard.indexOf("data-dashboard-federation");
    const assistantIndex = dashboard.indexOf("<DashboardAssistant");
    const profileIndex = dashboard.indexOf("<DirectorProfileCard");
    const raceOperationsIndex = dashboard.indexOf("<RaceOperationsCard");

    expect(federationIndex).toBeGreaterThan(-1);
    expect(assistantIndex).toBeGreaterThan(-1);
    expect(federationIndex).toBeLessThan(assistantIndex);
    expect(assistantIndex).toBeLessThan(profileIndex);
    expect(assistantIndex).toBeLessThan(raceOperationsIndex);
  });

  it("ouvre le raccourci à J22 à 14 h 10 heure de Paris, en hiver et en été", () => {
    expect(isDashboardNationsCupVisible(22, new Date("2026-11-27T13:09:59Z"))).toBe(false);
    expect(isDashboardNationsCupVisible(22, new Date("2026-11-27T13:10:00Z"))).toBe(true);
    expect(isDashboardNationsCupVisible(22, new Date("2026-07-03T12:09:59Z"))).toBe(false);
    expect(isDashboardNationsCupVisible(22, new Date("2026-07-03T12:10:00Z"))).toBe(true);
  });

  it("affiche la Nations Cup à droite jusqu’aux résultats officiels", () => {
    const now = new Date("2026-11-28T00:00:00+01:00");
    expect([null, 21, 23, 24, 25, 26].map((day) => isDashboardNationsCupVisible(day, now)))
      .toEqual([false, false, true, true, true, false]);
    expect(dashboard).toContain("isDashboardNationsCupVisible(nationsCupDay, now)");
    expect(dashboard).toContain('data-dashboard-nations-cup="true"');
    expect(dashboard).toContain(
      'href={beforeRace ? "/jeu/nations-cup" : "/jeu/nations-cup#classement-de-ma-federation"}',
    );
    expect(dashboard).toContain("J25 · résultats officiels");
    expect(dashboard).toContain("Classements, divisions et mouvements.");
  });
});
