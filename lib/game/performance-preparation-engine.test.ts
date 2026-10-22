import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import {
  simulateRaceStage,
  simulateRaceStageResultsOnly,
  type RiderSimulationInput,
  type SimulationStageType,
  type StageSimulationInput,
} from "./race-simulation";

type Preparation = NonNullable<
  RiderSimulationInput["performancePreparations"]
>[number];

const BONUS_START = 138;
const BONUS_END = BONUS_START + 5; // Six jours, y compris le passage de saison.
const PREPARATION_STATS = {
  indoor_track: ["sprint", "acceleration"],
  wind_tunnel: ["timeTrial", "prologue", "endurance"],
  cobbles_center: ["cobbles"],
  hills_circuit: ["hills"],
  mountain_base: ["mountain"],
} as const;

function createRider(id: string): RiderSimulationInput {
  return {
    id,
    name: id,
    teamId: "team-preparation",
    teamName: "Équipe préparation",
    teamPrimaryColor: "#176951",
    teamSecondaryColor: "#FFFDF4",
    age: 26,
    form: 85,
    role: "domestique",
    climateProfile: { strength: "rain", weakness: "snow" },
    ratings: {
      mountain: 75,
      hills: 75,
      flat: 75,
      timeTrial: 75,
      cobbles: 75,
      sprint: 75,
      acceleration: 75,
      downhill: 75,
      endurance: 75,
      resistance: 75,
      recovery: 75,
      breakaway: 75,
      prologue: 75,
    },
  };
}

function preparation(
  type: Preparation["type"],
  ratingBonus: number,
): Preparation {
  return {
    type,
    ratingBonus,
    bonusStartGameDay: BONUS_START,
    bonusEndGameDay: BONUS_END,
  };
}

function createInput(
  preparations: Preparation[],
  stageType: SimulationStageType = "road",
): StageSimulationInput {
  const input = createDemoSimulationInput(
    stageType === "road" ? "sprint-littoral" : "chrono-algarve",
    "performance-preparation-regression",
  );
  return {
    ...input,
    stageType,
    gameDayIndex: BONUS_START,
    weather: {
      condition: "clear",
      rainIntensity: "none",
      temperatureC: 20,
      windSpeedKph: 8,
      windDirection: "headwind",
      windIntensity: "calm",
      isWet: false,
    },
    riders: [
      { ...createRider("leader"), role: "leader" },
      {
        ...createRider("prepared-helper"),
        performancePreparations: preparations,
      },
      createRider("unprepared-helper"),
    ],
  };
}

describe.each([
  { name: "moteur live", simulate: simulateRaceStage },
  { name: "moteur résultats seuls", simulate: simulateRaceStageResultsOnly },
])("préparations de performance — $name", ({ simulate }) => {
  for (const type of Object.keys(PREPARATION_STATS) as Preparation["type"][]) {
    it.each(type === "indoor_track" || type === "wind_tunnel" ? [1.5, 2.5, 3.3] : [1.5, 2.5, 3.3, 3.85])(
      `conserve le bonus décimal de %s point en ${type}, y compris l’architecte`,
      (bonus) => {
        const input = createInput([preparation(type, bonus)]);
        const result = simulate(input);
        const prepared = result.resolvedRiders.find(
          (rider) => rider.id === "prepared-helper",
        )!;
        const witness = result.resolvedRiders.find(
          (rider) => rider.id === "unprepared-helper",
        )!;

        for (const stat of PREPARATION_STATS[type]) {
          expect(prepared.ratings[stat] - witness.ratings[stat]).toBeCloseTo(
            bonus,
            8,
          );
        }
        for (const stat of Object.keys(witness.ratings) as Array<keyof typeof witness.ratings>) {
          if (!(PREPARATION_STATS[type] as readonly string[]).includes(stat)) {
            expect(prepared.ratings[stat]).toBe(witness.ratings[stat]);
          }
        }
        expect(prepared.role).toBe("domestique");
      },
    );
  }

  it("respecte les six jours inclusifs et la fin de saison, sans bonus avant ou après", () => {
    const input = createInput([
      preparation("indoor_track", 2.5),
      preparation("wind_tunnel", 3.3),
      preparation("cobbles_center", 3.85),
      preparation("hills_circuit", 3.85),
      preparation("mountain_base", 3.85),
    ]);

    for (let day = BONUS_START - 1; day <= BONUS_END + 1; day += 1) {
      const result = simulate({ ...input, gameDayIndex: day });
      const prepared = result.resolvedRiders.find(
        (rider) => rider.id === "prepared-helper",
      )!;
      const witness = result.resolvedRiders.find(
        (rider) => rider.id === "unprepared-helper",
      )!;
      const active = day >= BONUS_START && day <= BONUS_END;

      for (const type of Object.keys(PREPARATION_STATS) as Preparation["type"][]) {
        for (const stat of PREPARATION_STATS[type]) {
          expect(prepared.ratings[stat] - witness.ratings[stat]).toBeCloseTo(
            active ? (type === "indoor_track" ? 2.5 : type === "wind_tunnel" ? 3.3 : 3.85) : 0,
            8,
          );
        }
      }
    }

    const undated = simulate({ ...input, gameDayIndex: undefined });
    expect(undated.resolvedRiders[1].ratings).toEqual(
      undated.resolvedRiders[2].ratings,
    );
  });

  it.each([
    "individual_time_trial",
    "prologue",
    "team_time_trial",
  ] as const)("applique CLM, PRO et END aux équipiers en %s", (stageType) => {
    const result = simulate(
      createInput([preparation("wind_tunnel", 2.5)], stageType),
    );
    const prepared = result.resolvedRiders.find(
      (rider) => rider.id === "prepared-helper",
    )!;
    const witness = result.resolvedRiders.find(
      (rider) => rider.id === "unprepared-helper",
    )!;

    for (const stat of PREPARATION_STATS.wind_tunnel) {
      expect(prepared.ratings[stat] - witness.ratings[stat]).toBeCloseTo(2.5);
    }
    expect(prepared.role).toBe("domestique");
  });

  it("prépare aussi les lanceurs, plafonne les notes à 100 et ne modifie aucune note permanente", () => {
    const input = createInput([
      preparation("indoor_track", 3.3),
      preparation("wind_tunnel", 3.3),
    ]);
    const helper = input.riders[1];
    helper.role = "leadout";
    for (const stat of [
      ...PREPARATION_STATS.indoor_track,
      ...PREPARATION_STATS.wind_tunnel,
    ]) {
      helper.ratings[stat] = 99;
    }
    const before = structuredClone(input);
    Object.freeze(helper.ratings);
    helper.performancePreparations!.forEach(Object.freeze);
    Object.freeze(helper.performancePreparations);

    const result = simulate(input);
    const prepared = result.resolvedRiders.find(
      (rider) => rider.id === helper.id,
    )!;

    for (const stat of [
      ...PREPARATION_STATS.indoor_track,
      ...PREPARATION_STATS.wind_tunnel,
    ]) {
      expect(prepared.ratings[stat]).toBe(100);
    }
    expect(prepared.role).toBe("leadout");
    expect(input).toEqual(before);

    const expired = simulate({ ...input, gameDayIndex: BONUS_END + 1 });
    expect(
      expired.resolvedRiders.find((rider) => rider.id === helper.id)!.ratings,
    ).toEqual(before.riders[1].ratings);
    expect(input).toEqual(before);
  });
});
