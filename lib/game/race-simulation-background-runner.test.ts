import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const runner = readFileSync(
  resolve(process.cwd(), "services/race-simulation-runner.ts"),
  "utf8",
);
const route = readFileSync(
  resolve(
    process.cwd(),
    "app/api/cron/race-simulations/[slot]/route.ts",
  ),
  "utf8",
);
const vercel = readFileSync(resolve(process.cwd(), "vercel.json"), "utf8");

describe("background official race simulations", () => {
  it("discovers live races cheaply before loading their full startlists", () => {
    expect(runner).toContain("includeEngagedRiders: false");
    expect(runner).toContain("targetedEditionIds");
    expect(runner).toContain("raceEditionIds: targetedEditionIds");
    expect(runner).toContain("ensureLockedOfficialRaceSimulations");
    expect(runner).toContain("precomputeRequestedOfficialRaceReplay");
  });

  it("runs at both Paris start slots with a resilience retry", () => {
    expect(vercel).toContain("/api/cron/race-simulations/early-summer-pre");
    expect(vercel).toContain("/api/cron/race-simulations/early-winter-02");
    expect(vercel).toContain("/api/cron/race-simulations/late-summer-pre");
    expect(vercel).toContain("/api/cron/race-simulations/late-winter-02");
    expect(runner).toContain("6 * 60 * 1_000");
    expect(route).toContain("official_race_simulations_precomputed");
    expect(runner).toContain("durationMs");
  });
});
