import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readSource = (path: string) =>
  readFileSync(join(root, ...path.split("/")), "utf8");

describe("runtime performance guards", () => {
  it("does not render every hidden training report on first load", () => {
    const popover = readSource(
      "components/game/training-report-popover.tsx",
    );
    expect(popover).toContain("hasLoadedPanel ? (");
    expect(popover).toContain("onMouseEnter={() => setHasLoadedPanel(true)}");
  });

  it("loads rider progression one authorized rider at a time", () => {
    const page = readSource("app/jeu/entrainement/page.tsx");
    const action = readSource(
      "app/jeu/entrainement/progression-actions.ts",
    );
    expect(page).not.toContain("getRiderProgressionHistories({");
    expect(action).toContain("get_current_team_roster_with_potential");
    expect(action).toContain("riderIds: [riderId]");
  });

  it("keeps simulation data out of the lightweight calendar grid", () => {
    const page = readSource("app/jeu/calendrier/page.tsx");
    expect(page).toContain("includeSimulationEnhancements: false");
    expect(page).toContain("includeStageSegments: false");
  });

  it("throttles heavyweight international selection retries", () => {
    const route = readSource(
      "app/api/cron/race-settlements/[slot]/route.ts",
    );
    expect(route).toContain('now.getUTCMinutes() === 15');
    expect(route).toContain("international_selection_retry_throttled");
  });
});
