import { getInfrastructureSpecializationPowerPercentage } from "./infrastructure-specializations";
import type { RiderSimulationRatings } from "./race-simulation";
import type { RaceWeather } from "./race-weather";

export const WEATHER_CENTER_SPECIALIZATION_CODES = [
  "normal_weather",
  "wet_protocol",
  "extreme_weather",
] as const;

export type WeatherCenterSpecializationCode =
  (typeof WEATHER_CENTER_SPECIALIZATION_CODES)[number];

export type WeatherCenterSpecialization = {
  code: WeatherCenterSpecializationCode;
  infrastructureLevel: number;
};

export type WeatherCenterConditionCategory =
  | "normal"
  | "rain"
  | "extreme";

export type WeatherCenterSpecializationEffects = {
  active: boolean;
  conditionCategory: WeatherCenterConditionCategory;
  performanceBonusPercentage: number;
  energyCostReductionPercentage: number;
};

const FULL_POWER_EFFECTS: Record<
  WeatherCenterSpecializationCode,
  {
    category: WeatherCenterConditionCategory;
    performanceBonusPercentage: number;
    energyCostReductionPercentage: number;
  }
> = {
  normal_weather: {
    category: "normal",
    performanceBonusPercentage: 0.5,
    energyCostReductionPercentage: 1,
  },
  wet_protocol: {
    category: "rain",
    performanceBonusPercentage: 1,
    energyCostReductionPercentage: 3,
  },
  extreme_weather: {
    category: "extreme",
    performanceBonusPercentage: 2,
    energyCostReductionPercentage: 5,
  },
};

export function isWeatherCenterSpecializationCode(
  value: string | null | undefined,
): value is WeatherCenterSpecializationCode {
  return WEATHER_CENTER_SPECIALIZATION_CODES.includes(
    value as WeatherCenterSpecializationCode,
  );
}

export function getWeatherCenterConditionCategory(
  weather: RaceWeather,
): WeatherCenterConditionCategory {
  if (
    weather.condition === "storm" ||
    weather.condition === "snow" ||
    weather.temperatureC >= 32 ||
    weather.temperatureC <= 7 ||
    weather.windIntensity === "gale"
  ) {
    return "extreme";
  }

  if (weather.condition === "rain") return "rain";
  return "normal";
}

export function getWeatherCenterSpecializationEffects({
  specialization,
  weather,
}: {
  specialization?: WeatherCenterSpecialization | null;
  weather: RaceWeather;
}): WeatherCenterSpecializationEffects {
  const conditionCategory = getWeatherCenterConditionCategory(weather);
  if (!specialization) {
    return {
      active: false,
      conditionCategory,
      performanceBonusPercentage: 0,
      energyCostReductionPercentage: 0,
    };
  }

  const fullPowerEffects = FULL_POWER_EFFECTS[specialization.code];
  const powerMultiplier =
    getInfrastructureSpecializationPowerPercentage(
      specialization.infrastructureLevel,
    ) / 100;
  const active =
    powerMultiplier > 0 && fullPowerEffects.category === conditionCategory;

  return {
    active,
    conditionCategory,
    performanceBonusPercentage: active
      ? roundPercentage(
          fullPowerEffects.performanceBonusPercentage * powerMultiplier,
        )
      : 0,
    energyCostReductionPercentage: active
      ? roundPercentage(
          fullPowerEffects.energyCostReductionPercentage * powerMultiplier,
        )
      : 0,
  };
}

function roundPercentage(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

export function applyWeatherCenterPerformanceBonus(
  ratings: RiderSimulationRatings,
  bonusPercentage: number,
): RiderSimulationRatings {
  if (bonusPercentage <= 0) return ratings;

  const multiplier = 1 + bonusPercentage / 100;
  return Object.fromEntries(
    (Object.entries(ratings) as Array<
      [keyof RiderSimulationRatings, number]
    >).map(([rating, value]) => [rating, Math.min(100, value * multiplier)]),
  ) as RiderSimulationRatings;
}

export function applyWeatherCenterEnergyCostReduction(
  energyCost: number,
  reductionPercentage: number,
): number {
  const boundedReduction = Math.max(0, Math.min(100, reductionPercentage));
  return Math.max(0, energyCost) * (1 - boundedReduction / 100);
}
