import type { RiderSimulationRatings } from "./race-simulation";

export const RACE_WEATHER_CONDITIONS = [
  "clear",
  "cloudy",
  "rain",
  "storm",
  "snow",
] as const;
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
  const weatherRoll = hash % 100;
  const condition = getWeatherCondition(weatherRoll);
  const rainIntensity = getPrecipitationIntensity(
    condition,
    (hash >>> 20) % 100
  );

  return {
    condition,
    rainIntensity,
    temperatureC: getWeatherTemperature(condition, hash),
    windSpeedKph: 7 + ((hash >>> 10) % 30),
    windDirection:
      RACE_WIND_DIRECTIONS[
        (hash >>> 15) % RACE_WIND_DIRECTIONS.length
      ],
    isWet:
      condition === "rain" ||
      condition === "storm" ||
      condition === "snow",
  };
}

export function getRaceWeatherCrashRiskBonus(weather: RaceWeather) {
  if (!weather.isWet) return 0;

  if (weather.condition === "snow") return 0.075;
  if (weather.condition === "storm") return 0.06;

  return {
    none: 0,
    light: 0.012,
    steady: 0.025,
    heavy: 0.04,
  }[weather.rainIntensity];
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
  if (weather.condition === "clear") return "Ciel bleu";
  if (weather.condition === "cloudy") return "Quelques nuages";
  if (weather.condition === "storm") return "Orage";
  if (weather.condition === "snow") return "Neige";

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

function getWeatherCondition(
  weatherRoll: number
): RaceWeatherCondition {
  if (weatherRoll < 62) return "clear";
  if (weatherRoll < 87) return "cloudy";
  if (weatherRoll < 97) return "rain";
  if (weatherRoll < 99) return "storm";
  return "snow";
}

function getPrecipitationIntensity(
  condition: RaceWeatherCondition,
  intensityRoll: number
): RaceWeather["rainIntensity"] {
  if (condition === "storm") return "heavy";
  if (condition === "snow") return "steady";
  if (condition !== "rain") return "none";
  if (intensityRoll < 20) return "heavy";
  if (intensityRoll < 60) return "steady";
  return "light";
}

function getWeatherTemperature(
  condition: RaceWeatherCondition,
  hash: number
) {
  const temperatureRoll = (hash >>> 5) % 100;
  const [minimum, range] = {
    clear: [14, 17],
    cloudy: [10, 16],
    rain: [8, 15],
    storm: [12, 13],
    snow: [-4, 7],
  }[condition];

  return minimum + (temperatureRoll % range);
}

function clampRating(value: number) {
  return Math.round(clamp(value, 1, 99) * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
