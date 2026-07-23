import { describe, expect, it } from "vitest";

import {
  applyRaceWeatherRatingAdjustments,
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
      rain: 0,
      storm: 0,
      snow: 0,
    };

    for (let index = 0; index < 10_000; index += 1) {
      counts[getRaceWeather(`weather-sample-${index}`).condition] += 1;
    }

    expect(counts.clear).toBeGreaterThan(6_000);
    expect(counts.clear).toBeLessThan(6_400);
    expect(counts.cloudy).toBeGreaterThan(2_300);
    expect(counts.cloudy).toBeLessThan(2_700);
    expect(counts.rain).toBeGreaterThan(850);
    expect(counts.rain).toBeLessThan(1_150);
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
});
