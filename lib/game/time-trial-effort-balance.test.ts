import { describe, expect, it } from "vitest";

import type { RaceStageSegment } from "./race-profiles";
import {
  simulateRaceStage,
  type RiderSimulationInput,
  type SimulationStageType,
  type StageSimulationInput,
} from "./race-simulation";
import {
  TIME_TRIAL_EFFORT_EFFECTS,
  type TimeTrialEffortMode,
} from "./time-trial-preparation";

type ChronoCase = {
  name: string;
  stageType: SimulationStageType;
  distanceKm: number;
  terrain: RaceStageSegment["terrain"];
};

const CASES: ChronoCase[] = [
  { name: "5 km prologue", stageType: "prologue", distanceKm: 5, terrain: "flat" },
  { name: "12 km flat", stageType: "individual_time_trial", distanceKm: 12, terrain: "flat" },
  { name: "25 km flat", stageType: "individual_time_trial", distanceKm: 25, terrain: "flat" },
  { name: "40 km flat", stageType: "individual_time_trial", distanceKm: 40, terrain: "flat" },
  { name: "60 km flat", stageType: "individual_time_trial", distanceKm: 60, terrain: "flat" },
  { name: "20 km uphill", stageType: "individual_time_trial", distanceKm: 20, terrain: "climb" },
];

function rider(id = "chrono", chronoRating = 75, teamId = "team-a"): RiderSimulationInput {
  return {
    id,
    name: id,
    teamId,
    teamName: teamId,
    teamPrimaryColor: "#123456",
    teamSecondaryColor: "#ffffff",
    age: 27,
    form: 95,
    morale: 50,
    role: "leader",
    ratings: {
      flat: 70,
      mountain: 70,
      hills: 70,
      cobbles: 70,
      downhill: 70,
      sprint: 70,
      acceleration: 70,
      timeTrial: chronoRating,
      prologue: chronoRating,
      endurance: 70,
      resistance: 70,
      recovery: 70,
      breakaway: 70,
    },
  };
}

function input(chrono: ChronoCase, seed: number | string = 17): StageSimulationInput {
  const segmentCount = Math.ceil(chrono.distanceKm / 5);
  return {
    id: `effort-balance-${chrono.name}`,
    name: chrono.name,
    stageType: chrono.stageType,
    profileType: "time_trial",
    isStageRace: true,
    seed,
    weather: {
      condition: "clear",
      rainIntensity: "none",
      temperatureC: 20,
      windSpeedKph: 0,
      windDirection: "headwind",
      windIntensity: "calm",
      isWet: false,
    },
    segments: Array.from({ length: segmentCount }, (_, index) => ({
      segmentNumber: index + 1,
      distanceKm: Math.min(5, chrono.distanceKm - index * 5),
      terrain: chrono.terrain,
      averageGradientPct: chrono.terrain === "climb" ? 5 : 0,
      surface: "asphalt",
      prime: null,
    })),
    riders: [rider()],
  };
}

function withEffort(source: StageSimulationInput, mode: TimeTrialEffortMode): StageSimulationInput {
  return {
    ...source,
    timeTrialPlans: Object.fromEntries(source.riders.map((row) => [row.id, {
      effortMode: mode,
      relaySharePct: source.stageType === "team_time_trial" ? 100 / source.riders.length : null,
    }])),
  };
}

function exactElapsed(result: ReturnType<typeof simulateRaceStage>, riderId: string) {
  return result.timeline.at(-1)!.groups.find((group) => group.riderIds.includes(riderId))!.elapsedTimeSeconds;
}

describe("bounded time-trial all-in advantage", () => {
  it.each(CASES)("keeps all-in useful but below a 0.8% time advantage on $name", (chrono) => {
    const source = input(chrono);
    const original = structuredClone(source);
    const normal = simulateRaceStage(withEffort(source, "normal"));
    const allIn = simulateRaceStage(withEffort(source, "all_in"));
    const normalElapsed = exactElapsed(normal, "chrono");
    const allInElapsed = exactElapsed(allIn, "chrono");
    const timeGainRatio = 1 - allInElapsed / normalElapsed;

    if (process.env.TIME_TRIAL_BALANCE_REPORT === "1") {
      console.info(JSON.stringify({
        scenario: chrono.name,
        gainSeconds: Number((normalElapsed - allInElapsed).toFixed(3)),
        gainPct: Number((timeGainRatio * 100).toFixed(3)),
        energyNormal: normal.results[0].energyAfter,
        energyAllIn: allIn.results[0].energyAfter,
      }));
    }

    expect(timeGainRatio).toBeGreaterThan(0.002);
    expect(timeGainRatio).toBeLessThan(0.008);
    expect(allIn.results[0].energyAfter).toBeLessThan(normal.results[0].energyAfter);
    expect(source).toEqual(original);
  });

  it.each(CASES)("does not let all-in alone erase a 61 versus 75 chrono gap on $name", (chrono) => {
    for (let seed = 0; seed < 32; seed += 1) {
      for (const reverseStartOrder of [false, true]) {
        const riders = [rider("weaker", 61), rider("stronger", 75, "team-b")];
        if (reverseStartOrder) riders.reverse();
        const result = simulateRaceStage({
          ...input(chrono, seed),
          riders,
          timeTrialPlans: {
            weaker: { effortMode: "all_in", relaySharePct: null },
            stronger: { effortMode: "normal", relaySharePct: null },
          },
        });

        if (process.env.TIME_TRIAL_BALANCE_REPORT === "1" && result.results[0].riderId !== "stronger") {
          console.info(JSON.stringify({ scenario: chrono.name, seed, reverseStartOrder, weakerWins: true }));
        }
        expect(result.results[0].riderId).toBe("stronger");
        expect(exactElapsed(result, "weaker")).toBeGreaterThan(exactElapsed(result, "stronger"));
      }
    }
  });

  it.each(CASES)("keeps a missing effort plan identical to normal on $name", (chrono) => {
    const source = input(chrono);
    expect(simulateRaceStage(source)).toEqual(simulateRaceStage(withEffort(source, "normal")));
  });

  it("does not change the normal or conservation coefficients and doubles the all-in form cost", () => {
    expect(TIME_TRIAL_EFFORT_EFFECTS.normal).toEqual({ paceMultiplier: 1, energyCostMultiplier: 1, formCostMultiplier: 1 });
    expect(TIME_TRIAL_EFFORT_EFFECTS.conserve).toEqual({ paceMultiplier: 0.975, energyCostMultiplier: 0.7, formCostMultiplier: 0.7 });
    expect(TIME_TRIAL_EFFORT_EFFECTS.all_in).toEqual({ paceMultiplier: 1.006, energyCostMultiplier: 1.4, formCostMultiplier: 2 });
  });

  it("preserves the distinction between the CLM and prologue skills", () => {
    const specialist = rider("specialist", 61);
    specialist.ratings.prologue = 85;
    const rival = rider("rival", 75, "team-b");
    const prologue = simulateRaceStage({ ...input(CASES[0]), riders: [specialist, rival] });
    const itt = simulateRaceStage({ ...input(CASES[2]), riders: [specialist, rival] });
    expect(prologue.results[0].riderId).toBe("specialist");
    expect(itt.results[0].riderId).toBe("rival");
  });

  it("does not impose an artificial skill-only ranking when form differs substantially", () => {
    const fresh = rider("fresh-61", 61);
    const fatigued = { ...rider("fatigued-75", 75, "team-b"), form: 25 };
    const result = simulateRaceStage({ ...input(CASES[3]), riders: [fresh, fatigued] });
    expect(result.results[0].riderId).toBe("fresh-61");
  });

  it("remains deterministic with a full startlist without adding timeline payload", () => {
    const source = withEffort({
      ...input(CASES[4]),
      riders: Array.from({ length: 144 }, (_, index) => ({ ...rider(`rider-${index}`, 61 + index % 20, `team-${Math.floor(index / 6)}`), role: "domestique" as const })),
    }, "all_in");
    const before = structuredClone(source);
    const first = simulateRaceStage(source);
    const second = simulateRaceStage(source);
    expect(first).toEqual(second);
    expect(source).toEqual(before);
    expect(first.results).toHaveLength(144);
    expect(first.timeline).toHaveLength(source.segments.length);
    for (const frame of first.timeline) {
      expect(frame.groups).toHaveLength(144);
      expect(frame.groups.reduce((sum, group) => sum + group.riderIds.length, 0)).toBe(144);
    }
  });
});

describe("team time-trial non-regressions", () => {
  function teamInput() {
    return {
      ...input(CASES[3]),
      stageType: "team_time_trial" as const,
      riders: Array.from({ length: 6 }, (_, index) => ({ ...rider(`chrono-${index}`), role: "domestique" as const })),
    };
  }

  it("keeps the team together with a modest all-in gain and unchanged relay-load energy tradeoff", () => {
    const source = teamInput();
    const normal = simulateRaceStage(withEffort(source, "normal"));
    const allIn = simulateRaceStage(withEffort(source, "all_in"));
    const gain = 1 - exactElapsed(allIn, "chrono-0") / exactElapsed(normal, "chrono-0");
    expect(gain).toBeGreaterThan(0);
    expect(gain).toBeLessThan(0.008);
    expect(new Set(allIn.results.map((row) => row.elapsedTimeSeconds)).size).toBe(1);
    expect(allIn.results.every((row) => row.status === "finished")).toBe(true);
    for (const row of allIn.results) {
      expect(row.energyAfter).toBeLessThan(normal.results.find((normalRow) => normalRow.riderId === row.riderId)!.energyAfter);
    }
    if (process.env.TIME_TRIAL_BALANCE_REPORT === "1") {
      console.info(JSON.stringify({ scenario: "40 km team TT", gainPct: Number((gain * 100).toFixed(3)), energyNormal: normal.results[0].energyAfter, energyAllIn: allIn.results[0].energyAfter }));
    }
  });

  it("still favors six identical 75 specialists over six 61 all-in riders", () => {
    for (let seed = 0; seed < 32; seed += 1) {
      const source = teamInput();
      const stronger = source.riders.map((row) => ({ ...row, id: `${row.id}-strong`, teamId: "team-b", teamName: "team-b" }));
      const weaker = source.riders.map((row) => ({ ...row, ratings: { ...row.ratings, timeTrial: 61 } }));
      const result = simulateRaceStage({
        ...source,
        seed,
        riders: [...weaker, ...stronger],
        timeTrialPlans: Object.fromEntries([...weaker, ...stronger].map((row) => [row.id, {
          effortMode: row.teamId === "team-a" ? "all_in" : "normal",
          relaySharePct: 100 / 6,
        }])),
      });
      expect(result.results[0].riderId).toContain("-strong");
    }
  });
});
