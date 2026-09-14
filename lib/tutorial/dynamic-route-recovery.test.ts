import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const tutorialActions = readFileSync(
  join(process.cwd(), "app/jeu/tutorial-actions.ts"),
  "utf8",
);

describe("tutorial dynamic route recovery", () => {
  it("resolves a stale roster placeholder with a current rider", () => {
    expect(tutorialActions).toContain(
      "resolveTutorialStepRouteForDirector",
    );
    expect(tutorialActions).toContain(
      'supabase.rpc("get_current_team_roster")',
    );
    expect(tutorialActions).toContain(
      "routePattern: step.route",
    );
    expect(tutorialActions).toContain(
      "segmentValues: { identifiant: riderId }",
    );
  });
});
