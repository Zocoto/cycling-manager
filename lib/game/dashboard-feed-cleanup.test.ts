import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

  it("scinde la tuile fédération avec la Nations Cup à J24 et J25", () => {
    expect(dashboard).toContain(
      "teamSummary?.season_day_number === 24\n                || teamSummary?.season_day_number === 25",
    );
    expect(dashboard).toContain('data-dashboard-nations-cup="j24-j25"');
    expect(dashboard).toContain(
      'href="/jeu/nations-cup#classement-de-ma-federation"',
    );
    expect(dashboard).toContain("J25 · résultats officiels");
    expect(dashboard).toContain("Classements, divisions et mouvements.");
  });
});
