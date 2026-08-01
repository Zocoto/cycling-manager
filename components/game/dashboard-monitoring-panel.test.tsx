import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DashboardMonitoringPanel } from "./dashboard-monitoring-panel";

vi.mock("@/app/jeu/actions", () => ({
  loadDashboardMonitoringAction: vi.fn(async () => ({
    ok: false,
    message: "test",
  })),
}));

describe("dashboard monitoring panel", () => {
  it("reste compact et fermé au premier rendu", () => {
    const markup = renderToStaticMarkup(
      <DashboardMonitoringPanel
        teamId="team-1"
        seasonName="Saison 1"
        actionCount={2}
      />,
    );

    expect(markup).toContain("Centre de monitoring");
    expect(markup).toContain("2 actions à suivre");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("À ne pas manquer");
    expect(markup).not.toContain("Temps forts");
  });
});
