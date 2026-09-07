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
const stagePage = readFileSync(
  join(
    process.cwd(),
    "app/jeu/resultats/[slug]/[stageNumber]/page.tsx",
  ),
  "utf8",
);
const settlementRunner = readFileSync(
  join(process.cwd(), "services/race-settlement-runner.ts"),
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

  it("keeps the active results page read-only while background jobs compute", () => {
    expect(stageExperience).not.toContain("settleOfficialRaceResultsAction");
    expect(stageExperience).toContain("router.refresh()");
    expect(stagePage).toContain("getLockedOfficialRaceSimulations");
    expect(stagePage).not.toContain("ensureLockedOfficialRaceSimulations");
    expect(stagePage).toContain("precomputeRequestedOfficialRaceReplay");
    expect(stagePage).toContain("after(async () =>");
    expect(stagePage).toContain("settleDueStandardRaceResults");
    expect(stagePage).toContain("raceSlug: edition.slug");
    expect(stagePage).toContain("targeted_race_settlement_recovery_failed");
    expect(stagePage).toContain("export const maxDuration = 300");
    expect(settlementRunner).toContain("claim_race_editions_for_settlement");
    expect(stagePage).toContain("[stage.id]");
    expect(stageExperience).toContain("waitingForSimulation ? 15_000 : 5_000");
  });
});
