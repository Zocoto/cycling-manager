import { describe, expect, it } from "vitest";

import { EMPTY_EQUIPMENT_EFFECTS } from "./equipment";
import { buildRaceSegments } from "./race-profiles";
import { DEFAULT_RACE_TEAM_STRATEGY } from "./race-strategy";
import type { TimeTrialRiderPlan } from "./time-trial-preparation";
import {
  simulateRaceStage,
  simulateRaceStageResultsOnly,
  type RiderSimulationInput,
  type SimulationStageType,
  type StageSimulationInput,
} from "./race-simulation";

const DAY = 4 * 28 + 12;
const BONUS = 3.3; // Includes the maximum existing architect multiplier.
const PREPARATION_STATS = [
  "sprint", "acceleration", "timeTrial", "prologue", "endurance",
] as const;
const ROLES = ["leader", "leadout", "domestique"] as const;

function createInput(stageType: SimulationStageType): StageSimulationInput {
  const riders = ["team-a", "team-b"].flatMap((teamId, teamIndex) =>
    ROLES.map((role, index): RiderSimulationInput => ({
      id: `${teamId}-${index}`, name: `${teamId} rider ${index}`,
      teamId, teamName: teamId, teamPrimaryColor: "#176951", teamSecondaryColor: "#fffdf4",
      age: 27, form: 88 - index, morale: 75, role,
      ratings: {
        mountain: 69 + teamIndex, hills: 72, flat: 78 - index,
        // Exercise the 100 ceiling as well as ordinary decimal bonuses.
        timeTrial: index === 0 ? 98 : 76 - index,
        cobbles: 71, sprint: index === 0 ? 98 : 80 - index,
        acceleration: 79 - index, downhill: 74, endurance: 81 - index,
        resistance: 77, recovery: 75, breakaway: 70, prologue: 78 - index,
      },
      countryCode: index === 0 ? "FR" : "BE",
      teamRegistrationCountryCode: "FR", localRaceCountryCodes: ["FR"],
      careerRaceDays: 80,
      climateProfile: { strength: "rain", weakness: "snow" },
      // Deliberately fixed: changing permanent base ratings must not change
      // natural-profile inference in this modifier-composition comparison.
      ...(index < 2 ? { physiology: {
        heightCm: 181, weightKg: 76, baselineWeightKg: 77,
        physiologyVersion: 1, naturalProfile: "sprinter" as const,
      } } : {}),
      reconnaissanceBonus: 2.5,
      fanClubSupport: { mobilizedSupporters: 30, fervor: 65, ratingBoost: 0.4 },
      favoriteRaceBonus: 0.3,
      equipmentEffects: {
        ...EMPTY_EQUIPMENT_EFFECTS,
        ratingBonuses: { sprint: 0.7, acceleration: 0.4, endurance: 0.5, flat: 0.4 },
        timeTrialRatingBonuses: { timeTrial: 1.2, prologue: 1.1, endurance: 0.6 },
        ownResearchRatingBonuses: { sprint: 0.2, timeTrial: 0.3 },
        injuryRiskReductionPct: 5,
      },
      indoorTrackSpecialization: {
        code: index === 0 ? "pure_speed" : index === 1 ? "leadout_school" : "explosiveness",
        infrastructureLevel: 5,
      },
      windTunnelSpecialization: {
        code: stageType === "road" ? "versatile_aero"
          : stageType === "team_time_trial" ? "team_aero" : "solo_aero",
        infrastructureLevel: 5,
      },
      welcomeCenterSpecialization: { code: "sporting_integration", infrastructureLevel: 5 },
      weatherCenterSpecialization: { code: "wet_protocol", infrastructureLevel: 5 },
      performancePreparations: ["indoor_track", "wind_tunnel"].map((type) => ({
        type: type as "indoor_track" | "wind_tunnel",
        bonusStartGameDay: DAY, bonusEndGameDay: DAY + 5, ratingBonus: BONUS,
      })),
    })),
  );
  const profileType = stageType === "road" ? "sprint" : "time_trial";
  return {
    id: `modifier-composition-${stageType}`, name: "Modifier composition regression",
    stageType, profileType, gameDayIndex: DAY, isStageRace: false,
    raceCountryCode: "FR", federationHomeAdvantageBonus: 1,
    seed: `preparation-modifiers:${stageType}`,
    weather: {
      condition: "rain", rainIntensity: "steady", temperatureC: 13,
      windSpeedKph: 24, windDirection: "crosswind", windIntensity: "strong", isWet: true,
    },
    segments: buildRaceSegments({
      profileType, distanceKm: stageType === "road" ? 80 : stageType === "prologue" ? 8 : 30,
      seed: `preparation-modifier-route:${stageType}`,
    }),
    riders,
    teamStrategies: ["team-a", "team-b"].map((teamId) => ({
      ...DEFAULT_RACE_TEAM_STRATEGY, teamId,
      breakawayPolicy: "avoid" as const, chasePolicy: "never" as const,
      protectorRiderId: `${teamId}-2`, attackOrders: [],
    })),
    ...(stageType !== "road" ? {
      timeTrialPlans: Object.fromEntries(riders.map((rider, index): [string, TimeTrialRiderPlan] => [rider.id, {
        effortMode: index % 3 === 0 ? "all_in" : index % 3 === 1 ? "normal" : "conserve",
        relaySharePct: [50, 30, 20][index % 3],
      }])),
    } : {}),
  };
}

function manuallyAdjustedInput(input: StageSimulationInput): StageSimulationInput {
  const reference = structuredClone(input);
  reference.riders = reference.riders.map((rider) => {
    const ratings = { ...rider.ratings };
    for (const stat of PREPARATION_STATS) ratings[stat] = Math.min(100, ratings[stat] + BONUS);
    // No preparation can execute on this reference path: it starts with the
    // same five adjusted ratings before any equipment/weather/infrastructure.
    const { performancePreparations, ...withoutPreparations } = rider;
    void performancePreparations;
    return { ...withoutPreparations, ratings };
  });
  return reference;
}

describe.each([
  { name: "live", simulate: simulateRaceStage },
  { name: "results-only", simulate: simulateRaceStageResultsOnly },
])("performance preparation modifier composition — $name", ({ simulate }) => {
  it.each(["road", "individual_time_trial", "prologue", "team_time_trial"] as const)(
    "matches exactly the same temporary ratings before all modifiers in %s",
    (stageType) => {
      const preparedInput = createInput(stageType);
      const referenceInput = manuallyAdjustedInput(preparedInput);
      const preparedBefore = structuredClone(preparedInput);
      const referenceBefore = structuredClone(referenceInput);
      const prepared = simulate(preparedInput);
      const reference = simulate(referenceInput);

      expect(prepared.resolvedRiders.map((rider) => ({ id: rider.id, ratings: rider.ratings,
        role: rider.role, duty: rider.raceDuty }))).toEqual(
        reference.resolvedRiders.map((rider) => ({ id: rider.id, ratings: rider.ratings,
          role: rider.role, duty: rider.raceDuty })),
      );
      // Only input provenance differs. Compare every other resolved modifier,
      // sporting result, report, incident, prime and live/replay frame exactly.
      const stripProvenance = (result: typeof prepared) => ({
        ...result,
        resolvedRiders: result.resolvedRiders.map(({ performancePreparations, ...rider }) => {
          void performancePreparations;
          return rider;
        }),
      });
      expect(stripProvenance(prepared)).toEqual(stripProvenance(reference));
      expect(prepared.resolvedRiders.map((rider) => rider.role)).toEqual(preparedInput.riders.map((rider) => rider.role));
      expect(preparedInput).toEqual(preparedBefore);
      expect(referenceInput).toEqual(referenceBefore);
    },
  );
});
