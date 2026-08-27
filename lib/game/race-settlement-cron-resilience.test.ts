import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const route = readFileSync(
  resolve(process.cwd(), "app/api/cron/race-settlements/[slot]/route.ts"),
  "utf8",
);
const runner = readFileSync(
  resolve(process.cwd(), "services/race-settlement-runner.ts"),
  "utf8",
);

describe("race settlement cron resilience", () => {
  it("isolates pre-settlement failures instead of aborting race results", () => {
    expect(route).toContain("runPreSettlementTask");
    expect(route).toMatch(
      /runPreSettlementTask\(\s*"sélections internationales"/,
    );
    expect(route).not.toContain("syncNationalChampionshipRegistrations");
    expect(route).toContain("settleDueStandardRaceResults");
    expect(route).toContain("preSettlementFailures");
    expect(route).toContain("raceSlug: requestedRaceSlug ?? undefined");
  });

  it("discovers cheaply and loads only editions that can be settled", () => {
    expect(runner).toContain("includeEngagedCounts: false");
    expect(runner).toContain("includeEngagedRiders: false");
    expect(runner).toContain("isRaceEditionSettlementCandidate");
    expect(runner).toContain("claim_race_editions_for_settlement");
    expect(runner).toContain("raceEditionIds: claimedEditionIds");
    expect(runner).toContain("repairableCompletedEditionIds");
  });
});
