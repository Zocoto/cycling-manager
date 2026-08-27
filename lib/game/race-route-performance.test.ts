import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const stageExperience = readFileSync(
  join(process.cwd(), "components/game/race-stage-experience.tsx"),
  "utf8",
);
const resultsDirectory = readFileSync(
  join(process.cwd(), "components/game/race-results-directory.tsx"),
  "utf8",
);
const resultsAction = readFileSync(
  join(process.cwd(), "app/jeu/resultats/actions.ts"),
  "utf8",
);

describe("race route performance", () => {
  it("loads the live, results and chat modules only when displayed", () => {
    expect(stageExperience).toContain('import dynamic from "next/dynamic"');
    expect(stageExperience).toContain('import("@/components/game/race-live-lab")');
    expect(stageExperience).toContain('import("@/components/game/race-official-results")');
    expect(stageExperience).toContain('import("@/components/game/race-live-chat")');
    expect(resultsDirectory).toContain('import("@/components/game/race-live-lab")');
    expect(resultsDirectory).toContain('import("@/components/game/race-official-results")');
  });

  it("settles only the race being watched", () => {
    expect(stageExperience).toContain(
      "settleOfficialRaceResultsAction(entry.edition.slug)",
    );
    expect(resultsDirectory).toContain(
      "settleOfficialRaceResultsAction(entry.edition.slug)",
    );
    expect(resultsAction).toContain(
      "settleDueOfficialRaceRewardsAction(normalizedRaceSlug)",
    );
  });
});
