import { describe, expect, it } from "vitest";

import {
  applyRaceWeatherRatingAdjustments,
  getRaceClimatePerformanceAdjustment,
  getRaceCrosswindIncidentRisk,
  getRiderClimateProfile,
  getRaceWeather,
  getRaceWeatherCrashRiskBonus,
} from "./race-weather";
import type { RiderSimulationRatings } from "./race-simulation";

const ratings: RiderSimulationRatings = {
  mountain: 60,
  hills: 63,
  flat: 66,
  timeTrial: 61,
  cobbles: 78,
  sprint: 60,
  acceleration: 62,
  downhill: 72,
  endurance: 68,
  resistance: 74,
  recovery: 65,
  breakaway: 67,
  prologue: 59,
};

describe("race weather", () => {
  it("is deterministic for a race seed", () => {
    expect(getRaceWeather("stage:official")).toEqual(
      getRaceWeather("stage:official")
    );
  });

  it("keeps blue skies dominant and severe weather rare", () => {
    const counts = {
      clear: 0,
      cloudy: 0,
      wind: 0,
      rain: 0,
      storm: 0,
      snow: 0,
    };

    for (let index = 0; index < 10_000; index += 1) {
      counts[getRaceWeather(`weather-sample-${index}`).condition] += 1;
    }

    expect(counts.clear).toBeGreaterThan(5_200);
    expect(counts.clear).toBeLessThan(5_600);
    expect(counts.cloudy).toBeGreaterThan(2_000);
    expect(counts.cloudy).toBeLessThan(2_400);
    expect(counts.wind).toBeGreaterThan(1_100);
    expect(counts.wind).toBeLessThan(1_300);
    expect(counts.wind).toBeGreaterThan(counts.rain);
    expect(counts.rain).toBeGreaterThan(800);
    expect(counts.rain).toBeLessThan(1_100);
    expect(counts.storm).toBeGreaterThan(140);
    expect(counts.storm).toBeLessThan(260);
    expect(counts.snow).toBeGreaterThan(60);
    expect(counts.snow).toBeLessThan(140);
  });

  it("gives wet-road specialists a measured advantage in rain", () => {
    const wetWeather = {
      ...getRaceWeather("rain-test"),
      condition: "rain" as const,
      rainIntensity: "heavy" as const,
      isWet: true,
    };
    const adjusted = applyRaceWeatherRatingAdjustments(
      ratings,
      wetWeather
    );

    expect(adjusted.cobbles).toBeGreaterThan(ratings.cobbles);
    expect(adjusted.downhill).toBeGreaterThan(ratings.downhill);
    expect(adjusted.cobbles - ratings.cobbles).toBeLessThanOrEqual(3.75);
  });

  it("does not alter ratings on a dry road", () => {
    const dryWeather = {
      ...getRaceWeather("dry-test"),
      condition: "clear" as const,
      rainIntensity: "none" as const,
      isWet: false,
    };

    expect(
      applyRaceWeatherRatingAdjustments(ratings, dryWeather)
    ).toBe(ratings);
  });

  it("makes crashes more likely in rain, storms and snow", () => {
    const baseWeather = getRaceWeather("risk-test");
    const clear = {
      ...baseWeather,
      condition: "clear" as const,
      rainIntensity: "none" as const,
      isWet: false,
    };
    const rain = {
      ...baseWeather,
      condition: "rain" as const,
      rainIntensity: "steady" as const,
      isWet: true,
    };
    const storm = {
      ...baseWeather,
      condition: "storm" as const,
      rainIntensity: "heavy" as const,
      isWet: true,
    };
    const snow = {
      ...baseWeather,
      condition: "snow" as const,
      rainIntensity: "steady" as const,
      isWet: true,
    };

    expect(getRaceWeatherCrashRiskBonus(clear)).toBe(0);
    expect(getRaceWeatherCrashRiskBonus(rain)).toBeGreaterThan(0);
    expect(getRaceWeatherCrashRiskBonus(storm)).toBeGreaterThan(
      getRaceWeatherCrashRiskBonus(rain)
    );
    expect(getRaceWeatherCrashRiskBonus(snow)).toBeGreaterThan(
      getRaceWeatherCrashRiskBonus(storm)
    );
  });
  it("derives a Danish rider's cold strength and heat weakness", () => {
    const climateProfile = getRiderClimateProfile({
      riderId: "danish-climber",
      countryCode: "DK",
    });
    const baseWeather = getRaceWeather("danish-climate");
    const hotWeather = {
      ...baseWeather,
      condition: "clear" as const,
      temperatureC: 40,
      rainIntensity: "none" as const,
      isWet: false,
    };
    const coldWeather = {
      ...baseWeather,
      condition: "clear" as const,
      temperatureC: 3,
      rainIntensity: "none" as const,
      isWet: false,
    };

    expect(climateProfile).toEqual({
      strength: "cold",
      weakness: "heat",
    });
    expect(
      getRaceClimatePerformanceAdjustment(climateProfile, hotWeather)
    ).toBe(-1.25);
    expect(
      getRaceClimatePerformanceAdjustment(climateProfile, coldWeather)
    ).toBe(1.5);
    expect(
      applyRaceWeatherRatingAdjustments(
        ratings,
        hotWeather,
        false,
        climateProfile
      ).mountain
    ).toBeLessThan(ratings.mountain);
    expect(
      applyRaceWeatherRatingAdjustments(
        ratings,
        coldWeather,
        false,
        climateProfile
      ).mountain
    ).toBeGreaterThan(ratings.mountain);
  });

  it("only allows bordures in strong lateral wind on flat terrain", () => {
    const baseWeather = getRaceWeather("crosswind-risk");
    const windyWeather = {
      ...baseWeather,
      condition: "wind" as const,
      windDirection: "crosswind" as const,
      windSpeedKph: 38,
      windIntensity: "gale" as const,
      rainIntensity: "none" as const,
      isWet: false,
    };
    const clearWeather = {
      ...windyWeather,
      condition: "clear" as const,
    };

    expect(
      getRaceCrosswindIncidentRisk(windyWeather, true)
    ).toBeGreaterThan(0);
    expect(getRaceCrosswindIncidentRisk(windyWeather, false)).toBe(0);
    expect(getRaceCrosswindIncidentRisk(clearWeather, true)).toBe(0);
  });

});
