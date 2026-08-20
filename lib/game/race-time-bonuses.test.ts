import { describe, expect, it } from "vitest";

import type { StageSimulationResult } from "./race-simulation";
import {
  calculateStageRaceTimeBonuses,
  UCI_INTERMEDIATE_SPRINT_BONUS_SECONDS,
  UCI_STAGE_FINISH_BONUS_SECONDS,
} from "./race-time-bonuses";

const results: StageSimulationResult["results"] = [
  {
    riderId: "winner",
    rank: 1,
    status: "finished",
    elapsedTimeSeconds: 10_000,
    gapToWinnerSeconds: 0,
    energyAfter: 40,
    injury: null,
    abandonment: null,
  },
  {
    riderId: "second",
    rank: 2,
    status: "finished",
    elapsedTimeSeconds: 10_000,
    gapToWinnerSeconds: 0,
    energyAfter: 35,
    injury: null,
    abandonment: null,
  },
  {
    riderId: "third",
    rank: 3,
    status: "finished",
    elapsedTimeSeconds: 10_000,
    gapToWinnerSeconds: 0,
    energyAfter: 30,
    injury: null,
    abandonment: null,
  },
  {
    riderId: "fourth",
    rank: 4,
    status: "finished",
    elapsedTimeSeconds: 10_001,
    gapToWinnerSeconds: 1,
    energyAfter: 25,
    injury: null,
    abandonment: null,
  },
];

const intermediateSprint = {
  segmentNumber: 6,
  prime: {
    type: "intermediate_sprint" as const,
    category: null,
    pointsScale: [20, 17, 15],
  },
  classification: [
    { riderId: "second", rank: 1, points: 20 },
    { riderId: "winner", rank: 2, points: 17 },
    { riderId: "fourth", rank: 3, points: 15 },
  ],
};

describe("calculateStageRaceTimeBonuses", () => {
  it("applique 10-6-4 à l'arrivée et 3-2-1 au sprint intermédiaire", () => {
    expect(
      calculateStageRaceTimeBonuses({
        raceFormat: "stage_race",
        stageType: "road",
        simulation: { results, primes: [intermediateSprint] },
      }),
    ).toEqual({ winner: 12, second: 9, third: 4, fourth: 1 });
    expect(UCI_STAGE_FINISH_BONUS_SECONDS).toEqual([10, 6, 4]);
    expect(UCI_INTERMEDIATE_SPRINT_BONUS_SECONDS).toEqual([3, 2, 1]);
  });

  it("ignore les GPM", () => {
    const bonuses = calculateStageRaceTimeBonuses({
      raceFormat: "stage_race",
      stageType: "road",
      simulation: {
        results,
        primes: [
          {
            segmentNumber: 4,
            prime: {
              type: "mountain",
              category: "1",
              pointsScale: [10, 8, 6],
            },
            classification: [
              { riderId: "fourth", rank: 1, points: 10 },
            ],
          },
        ],
      },
    });

    expect(bonuses.fourth).toBeUndefined();
    expect(bonuses.winner).toBe(10);
  });

  it.each([
    "individual_time_trial",
    "team_time_trial",
    "prologue",
  ] as const)("n'accorde rien sur une étape %s", (stageType) => {
    expect(
      calculateStageRaceTimeBonuses({
        raceFormat: "stage_race",
        stageType,
        simulation: { results, primes: [intermediateSprint] },
      }),
    ).toEqual({});
  });

  it("n'accorde rien sur une course d'un jour", () => {
    expect(
      calculateStageRaceTimeBonuses({
        raceFormat: "one_day",
        stageType: "road",
        simulation: { results, primes: [intermediateSprint] },
      }),
    ).toEqual({});
  });
});
