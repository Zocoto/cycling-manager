import { describe, expect, it } from "vitest";

import { combineEquipmentEffects, normalizeEquipmentEffects, scaleEquipmentEffect } from "./equipment";
import { buildRaceSegments } from "./race-profiles";
import { createDemoSimulationInput } from "./race-simulation-demo";
import {
  getRoadCrashRiskProfile,
  simulateRaceStage,
  simulateRaceStageResultsOnly,
  type RiderSimulationRatings,
} from "./race-simulation";
import {
  applyRaceWeatherRatingAdjustments,
  getRaceClimateCondition,
  getRaceCrosswindIncidentRisk,
  type RaceWeather,
} from "./race-weather";

const ratings: RiderSimulationRatings = {
  mountain: 55, hills: 55, flat: 55, timeTrial: 55, cobbles: 55,
  sprint: 55, acceleration: 55, downhill: 55, endurance: 55,
  resistance: 55, recovery: 55, breakaway: 55, prologue: 55,
};
const rain: RaceWeather = {
  condition: "rain", rainIntensity: "heavy", temperatureC: 14,
  windSpeedKph: 38, windDirection: "crosswind", windIntensity: "gale", isWet: true,
};

describe("individual weather protection from equipment", () => {
  it("requires a strict boolean and combines protection without multiplying it", () => {
    const legacy = normalizeEquipmentEffects(null);
    for (const invalid of [undefined, false, null, 0, 1, "true", {}, []]) {
      expect(normalizeEquipmentEffects({ ignoreWeatherPenalties: invalid })).toEqual(legacy);
    }
    const protectedEffects = normalizeEquipmentEffects({ ignoreWeatherPenalties: true });
    expect(protectedEffects.ignoreWeatherPenalties).toBe(true);
    expect(combineEquipmentEffects([legacy, protectedEffects, protectedEffects])).toEqual(protectedEffects);
    expect(combineEquipmentEffects([legacy, { ignoreWeatherPenalties: false }])).toEqual(legacy);
    expect(normalizeEquipmentEffects(JSON.parse(JSON.stringify(protectedEffects)))).toEqual(protectedEffects);
    expect(scaleEquipmentEffect(protectedEffects, 0)).toEqual(protectedEffects);
    expect(scaleEquipmentEffect(protectedEffects, 25)).toEqual(protectedEffects);
  });

  it.each([
    ["clear", "none", 40], ["clear", "none", 3], ["clear", "none", 20],
    ["cloudy", "none", 18], ["wind", "none", 40],
    ["rain", "light", 13], ["rain", "steady", 13], ["rain", "heavy", 13],
    ["storm", "heavy", 16], ["snow", "steady", -4],
  ] as const)("cancels negative rating components for %s / %s at %s°C", (condition, rainIntensity, temperatureC) => {
    const weather: RaceWeather = { ...rain, condition, rainIntensity, temperatureC,
      isWet: ["rain", "storm", "snow"].includes(condition) };
    const climate = getRaceClimateCondition(weather);
    const profile = { strength: climate === "sun" ? "cold" as const : "sun" as const,
      weakness: climate === "temperate" ? "heat" as const : climate };
    const protectedRatings = applyRaceWeatherRatingAdjustments(ratings, weather, false, profile, true);
    expect(protectedRatings).toEqual(ratings);
    const ordinary = applyRaceWeatherRatingAdjustments(ratings, weather, false, profile);
    expect(applyRaceWeatherRatingAdjustments(ratings, weather, false, profile, false)).toEqual(ordinary);
    if (climate !== "temperate" || weather.isWet) {
      expect(Object.values(ordinary).some((value) => value < 55)).toBe(true);
    }
  });

  it("keeps favorable wet handling even when it offsets an unfavorable climate", () => {
    const specialist = { ...ratings, cobbles: 80, resistance: 76, downhill: 72 };
    const weakness = { strength: "sun" as const, weakness: "rain" as const };
    const protectedRatings = applyRaceWeatherRatingAdjustments(specialist, rain, false, weakness, true);
    expect(protectedRatings).toEqual(applyRaceWeatherRatingAdjustments(specialist, rain));
    expect(protectedRatings.cobbles).toBeGreaterThan(specialist.cobbles);
  });

  it("preserves Flahute and favorable climate bonuses separately from poor wet handling", () => {
    const weakness = { strength: "sun" as const, weakness: "rain" as const };
    const flahute = applyRaceWeatherRatingAdjustments(ratings, rain, true, weakness, true);
    expect(flahute.cobbles).toBe(56.25);
    expect(flahute.flat).toBe(55.65);
    expect(flahute.mountain).toBe(55);
    const strength = { strength: "rain" as const, weakness: "heat" as const };
    const favorable = applyRaceWeatherRatingAdjustments(ratings, rain, true, strength, true);
    expect(favorable.cobbles).toBe(57.75);
    expect(favorable.mountain).toBe(56.5);
    expect(favorable.resistance).toBe(56.81);
  });

  it("never lowers ratings already at 100 or above, nor mutates input or weather", () => {
    const capped = { ...ratings, mountain: 100, cobbles: 109, recovery: 100 };
    const beforeRatings = structuredClone(capped), beforeWeather = structuredClone(rain);
    const protectedRatings = applyRaceWeatherRatingAdjustments(capped, rain, false,
      { strength: "sun", weakness: "rain" }, true);
    for (const key of Object.keys(capped) as (keyof RiderSimulationRatings)[]) {
      expect(protectedRatings[key]).toBeGreaterThanOrEqual(capped[key]);
    }
    expect(capped).toEqual(beforeRatings); expect(rain).toEqual(beforeWeather);
  });

  it.each([
    { name: "live", simulate: simulateRaceStage },
    { name: "results only", simulate: simulateRaceStageResultsOnly },
  ])("applies only to the equipped rider and disappears on removal in $name", ({ simulate }) => {
    const input = createDemoSimulationInput("sprint-littoral", "exclusive-weather-protection");
    const context = { ...input, weather: rain,
      segments: buildRaceSegments({ profileType: "flat", distanceKm: 40, seed: "weather-protection" }),
      riders: input.riders.slice(0, 4).map((rider) => ({ ...rider, ratings: { ...ratings },
        climateProfile: { strength: "sun" as const, weakness: "rain" as const },
        specialAbility: null, specialAbilities: [], equipmentEffects: normalizeEquipmentEffects(null) })) };
    const before = structuredClone(context);
    const baseline = simulate(context);
    const equipped = simulate({ ...context, riders: context.riders.map((rider, index) => ({ ...rider,
      equipmentEffects: normalizeEquipmentEffects(index === 0 ? { ignoreWeatherPenalties: true } : null) })) });
    const first = equipped.resolvedRiders[0], ordinary = baseline.resolvedRiders[0];
    for (const key of Object.keys(ratings) as (keyof RiderSimulationRatings)[]) {
      expect(first.ratings[key]).toBeGreaterThanOrEqual(ordinary.ratings[key]);
    }
    expect(first.ratings.mountain).toBeGreaterThan(ordinary.ratings.mountain);
    expect(equipped.resolvedRiders.slice(1).map((rider) => rider.ratings)).toEqual(
      baseline.resolvedRiders.slice(1).map((rider) => rider.ratings));
    const removed = simulate({ ...context, riders: context.riders.map((rider) => ({ ...rider,
      equipmentEffects: normalizeEquipmentEffects({ ignoreWeatherPenalties: false }) })) });
    expect(removed).toEqual(baseline);
    expect(context).toEqual(before);
    // The same race conditions still produce rain crash risk and lateral wind.
    expect(getRoadCrashRiskProfile({ segment: { terrain: "flat", surface: "asphalt" }, weather: rain })
      .individualCrashProbability).toBeGreaterThan(0);
    expect(getRaceCrosswindIncidentRisk({ ...rain, condition: "wind" }, true)).toBeGreaterThan(0);
  });
});
