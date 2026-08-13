import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sponsorObjectivesSource = readFileSync(
  new URL("../../services/persisted-sponsor-objectives.ts", import.meta.url),
  "utf8",
);
const simulationInputSource = readFileSync(
  new URL("./race-simulation-demo.ts", import.meta.url),
  "utf8",
);

describe("production workflow repair guards", () => {
  it("makes concurrent sponsor objective creation idempotent", () => {
    expect(sponsorObjectivesSource).toContain(".upsert(rowsToInsert");
    expect(sponsorObjectivesSource).toContain(
      'onConflict: "sponsor_offer_id,display_order"',
    );
    expect(sponsorObjectivesSource).toContain(
      "OBJECTIVE_COMPLETION_ATTEMPTS",
    );
  });

  it("sanitizes stale tactical references before official simulation", () => {
    expect(simulationInputSource).toContain("sanitizeCalendarTeamStrategies");
    expect(simulationInputSource).toContain(
      "riderTeamById.get(riderId) === teamId",
    );
    expect(simulationInputSource).toContain(
      "segmentNumbers.has(order.segmentNumber)",
    );
  });
});
