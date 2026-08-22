import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const route = readFileSync(
  resolve(process.cwd(), "app/api/cron/race-settlements/[slot]/route.ts"),
  "utf8",
);

describe("race settlement cron resilience", () => {
  it("isolates pre-settlement failures instead of aborting race results", () => {
    expect(route).toContain("runPreSettlementTask");
    expect(route).toMatch(
      /runPreSettlementTask\(\s*"sélections internationales"/,
    );
    expect(route).not.toContain("syncNationalChampionshipRegistrations");
    expect(route).toContain("const settlement = await settleFinishedRaceResults");
    expect(route).toContain("preSettlementFailures");
    expect(route).toContain("raceSlug: requestedRaceSlug ?? undefined");
  });
});
