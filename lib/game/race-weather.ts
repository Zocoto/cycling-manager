import type { RiderSimulationRatings } from "./race-simulation";

export const RACE_WEATHER_CONDITIONS = ["dry", "rain"] as const;
export type RaceWeatherCondition =
  (typeof RACE_WEATHER_CONDITIONS)[number];

export const RACE_WIND_DIRECTIONS = [
  "headwind",
  "tailwind",
  "crosswind",
] as const;
export type RaceWindDirection =
  (typeof RACE_WIND_DIRECTIONS)[number];

export type RaceWeather = {
  condition: RaceWeatherCondition;
  rainIntensity: "none" | "light" | "steady" | "heavy";
  temperatureC: number;
  windSpeedKph: number;
  windDirection: RaceWindDirection;
  isWet: boolean;
};

export function getRaceWeather(seed: string | number): RaceWeather {
  const hash = stableWeatherHash(String(seed));
  const rainRoll = hash % 100;
  const condition: RaceWeatherCondition =
    rainRoll < 36 ? "rain" : "dry";
  const rainIntensity =
    condition === "dry"
      ? "none"
      : rainRoll < 9
        ? "heavy"
        : rainRoll < 23
          ? "steady"
          : "light";

  return {
    condition,
    rainIntensity,
    temperatureC: 9 + ((hash >>> 5) % 19),
    windSpeedKph: 7 + ((hash >>> 10) % 30),
    windDirection:
      RACE_WIND_DIRECTIONS[
        (hash >>> 15) % RACE_WIND_DIRECTIONS.length
      ],
    isWet: condition === "rain",
  };
}

export function applyRaceWeatherRatingAdjustments(
  ratings: RiderSimulationRatings,
  weather: RaceWeather,
  hasNorthernClassicAbility = false
): RiderSimulationRatings {
  if (!weather.isWet) return ratings;

  const wetRoadAffinity =
    ratings.cobbles * 0.56 +
    ratings.resistance * 0.24 +
    ratings.downhill * 0.2;
  const intensityFactor = {
    none: 0,
    light: 0.72,
    steady: 1,
    heavy: 1.25,
  }[weather.rainIntensity];
  const handlingAdjustment = clamp(
    (wetRoadAffinity - 64) * 0.14 * intensityFactor +
      (hasNorthernClassicAbility ? 1.25 : 0),
    -2.75,
    3.75
  );

  return {
    ...ratings,
    flat: clampRating(ratings.flat + handlingAdjustment * 0.52),
    hills: clampRating(ratings.hills + handlingAdjustment * 0.36),
    cobbles: clampRating(ratings.cobbles + handlingAdjustment),
    downhill: clampRating(ratings.downhill + handlingAdjustment * 0.68),
    resistance: clampRating(
      ratings.resistance + Math.max(0, handlingAdjustment) * 0.25
    ),
  };
}

export function getRaceWeatherLabel(weather: RaceWeather) {
  if (weather.condition === "dry") return "Route sèche";
  return {
    light: "Pluie légère",
    steady: "Pluie continue",
    heavy: "Forte pluie",
    none: "Route sèche",
  }[weather.rainIntensity];
}

export function getRaceWindLabel(direction: RaceWindDirection) {
  return {
    headwind: "vent de face",
    tailwind: "vent favorable",
    crosswind: "vent latéral",
  }[direction];
}

function stableWeatherHash(value: string) {
  return [...value].reduce(
    (total, character) =>
      (total * 33 + character.charCodeAt(0)) >>> 0,
    23
  );
}

function clampRating(value: number) {
  return Math.round(clamp(value, 1, 99) * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
