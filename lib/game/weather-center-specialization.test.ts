import { describe, expect, it } from "vitest";

import {
  simulateRaceStageResultsOnly,
  type RiderSimulationRatings,
} from "./race-simulation";
import { createDemoSimulationInput } from "./race-simulation-demo";
import type { RaceWeather } from "./race-weather";
import {
  applyWeatherCenterEnergyCostReduction,
  applyWeatherCenterPerformanceBonus,
  getWeatherCenterConditionCategory,
  getWeatherCenterSpecializationEffects,
} from "./weather-center-specialization";

const normalWeather: RaceWeather = {
  condition: "clear",
  rainIntensity: "none",
  temperatureC: 21,
  windSpeedKph: 11,
  windDirection: "tailwind",
  windIntensity: "breeze",
  isWet: false,
};

const ratings: RiderSimulationRatings = {
  flat: 80,
  mountain: 70,
  hills: 75,
  cobbles: 65,
  downhill: 72,
  sprint: 78,
  acceleration: 76,
  timeTrial: 74,
  prologue: 73,
  endurance: 79,
  resistance: 77,
  recovery: 71,
  breakaway: 69,
};

describe("weather center specializations", () => {
  it("separates normal, rainy and extreme conditions", () => {
    expect(getWeatherCenterConditionCategory(normalWeather)).toBe("normal");
    expect(
      getWeatherCenterConditionCategory({
        ...normalWeather,
        condition: "rain",
        rainIntensity: "steady",
        isWet: true,
      }),
    ).toBe("rain");
    expect(
      getWeatherCenterConditionCategory({
        ...normalWeather,
        temperatureC: 34,
      }),
    ).toBe("extreme");
    expect(
      getWeatherCenterConditionCategory({
        ...normalWeather,
        condition: "wind",
        windSpeedKph: 38,
        windIntensity: "gale",
      }),
    ).toBe("extreme");
    expect(
      getWeatherCenterConditionCategory({
        ...normalWeather,
        condition: "storm",
        rainIntensity: "heavy",
        isWet: true,
      }),
    ).toBe("extreme");
  });

  it("keeps normal below rain and extreme weather at full power", () => {
    const normal = getWeatherCenterSpecializationEffects({
      specialization: {
        code: "normal_weather",
        infrastructureLevel: 5,
      },
      weather: normalWeather,
    });
    const rain = getWeatherCenterSpecializationEffects({
      specialization: { code: "wet_protocol", infrastructureLevel: 5 },
      weather: {
        ...normalWeather,
        condition: "rain",
        rainIntensity: "steady",
        isWet: true,
      },
    });
    const extreme = getWeatherCenterSpecializationEffects({
      specialization: {
        code: "extreme_weather",
        infrastructureLevel: 5,
      },
      weather: { ...normalWeather, temperatureC: 35 },
    });

    expect(normal).toMatchObject({
      active: true,
      performanceBonusPercentage: 0.5,
      energyCostReductionPercentage: 1,
    });
    expect(rain).toMatchObject({
      active: true,
      performanceBonusPercentage: 1,
      energyCostReductionPercentage: 3,
    });
    expect(extreme).toMatchObject({
      active: true,
      performanceBonusPercentage: 2,
      energyCostReductionPercentage: 5,
    });
  });

  it("scales effects with the infrastructure and only activates the matching orientation", () => {
    expect(
      getWeatherCenterSpecializationEffects({
        specialization: { code: "wet_protocol", infrastructureLevel: 3 },
        weather: {
          ...normalWeather,
          condition: "rain",
          rainIntensity: "light",
          isWet: true,
        },
      }),
    ).toMatchObject({
      active: true,
      performanceBonusPercentage: 0.6,
      energyCostReductionPercentage: 1.8,
    });
    expect(
      getWeatherCenterSpecializationEffects({
        specialization: { code: "wet_protocol", infrastructureLevel: 5 },
        weather: normalWeather,
      }),
    ).toMatchObject({
      active: false,
      performanceBonusPercentage: 0,
      energyCostReductionPercentage: 0,
    });
  });

  it("applies the performance gain and the secondary energy saving", () => {
    expect(applyWeatherCenterPerformanceBonus(ratings, 2).flat).toBe(81.6);
    expect(
      applyWeatherCenterPerformanceBonus({ ...ratings, flat: 99.5 }, 2).flat,
    ).toBe(100);
    expect(applyWeatherCenterEnergyCostReduction(20, 5)).toBe(19);
  });

  it("feeds both effects into an actual stage simulation", () => {
    const input = createDemoSimulationInput("sprint-littoral", 17);
    const riderId = input.riders[0]!.id;
    const weather = normalWeather;
    const baseline = simulateRaceStageResultsOnly({ ...input, weather });
    const specialized = simulateRaceStageResultsOnly({
      ...input,
      weather,
      riders: input.riders.map((rider) =>
        rider.id === riderId
          ? {
              ...rider,
              weatherCenterSpecialization: {
                code: "normal_weather",
                infrastructureLevel: 5,
              },
            }
          : rider,
      ),
    });
    const baselineRider = baseline.resolvedRiders.find(
      (rider) => rider.id === riderId,
    )!;
    const specializedRider = specialized.resolvedRiders.find(
      (rider) => rider.id === riderId,
    )!;
    const baselineResult = baseline.results.find(
      (result) => result.riderId === riderId,
    )!;
    const specializedResult = specialized.results.find(
      (result) => result.riderId === riderId,
    )!;

    expect(specializedRider.ratings.flat).toBeGreaterThan(
      baselineRider.ratings.flat,
    );
    expect(specializedResult.energyAfter).toBeGreaterThan(
      baselineResult.energyAfter,
    );
  });
});
