import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import { simulateRaceStage, type RiderSimulationInput } from "./race-simulation";

describe("S5 championship fields still produce complete race results", () => {
  it.each([
    { competition: "CM", nations: 60, expected: 220, scenario: "sprint-littoral", quota: (rank: number) => rank <= 10 ? 8 : rank <= 30 ? 4 : 2 },
    { competition: "CC", nations: 51, expected: 212, scenario: "collines-ardennes", quota: (rank: number) => rank <= 5 ? 8 : rank <= 10 ? 6 : rank <= 20 ? 5 : rank <= 30 ? 4 : rank <= 40 ? 3 : 2 },
    { competition: "CM CLM", nations: 60, expected: 80, scenario: "chrono-algarve", quota: (rank: number) => rank <= 20 ? 2 : 1 },
  ] as const)("$competition: $nations nations, $expected riders", ({ competition, nations, expected, scenario, quota }) => {
    const base = createDemoSimulationInput(scenario, `s5-quota-field-${competition}`);
    const riders: RiderSimulationInput[] = Array.from({ length: nations }, (_, nation) =>
      Array.from({ length: quota(nation + 1) }, (_, slot) => ({
        ...base.riders[(nation + slot) % base.riders.length],
        id: `nation-${nation}-rider-${slot}`,
        name: `Rider ${nation}-${slot}`,
        teamId: `nation-${nation}`,
        teamName: `Nation ${nation}`,
        role: slot === 0 ? "leader" as const : "domestique" as const,
      })),
    ).flat();
    expect(riders).toHaveLength(expected);
    const result = simulateRaceStage({ ...base, isStageRace: false, riders });
    expect(result.results).toHaveLength(expected);
    expect(new Set(result.results.map(row => row.riderId)).size).toBe(expected);
    const finishers = result.results.filter(row => row.status === "finished");
    expect(finishers.length).toBeGreaterThan(0);
    expect(finishers.map(row => row.rank).sort((a,b)=>a!-b!)).toEqual(Array.from({length:finishers.length},(_,index)=>index+1));
    expect(result.results.every(row => Number.isFinite(row.elapsedTimeSeconds))).toBe(true);
  }, 20_000);
});
