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
});