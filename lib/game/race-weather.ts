import type { RiderSimulationRatings } from "./race-simulation";
import type { RaceProfileType } from "./race-calendar";

export const RACE_WEATHER_CONDITIONS = [
  "clear",
  "cloudy",
  "wind",
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

export const RIDER_CLIMATE_PREFERENCES = [
  "sun",
  "heat",
  "cold",
  "rain",
  "snow",
  "storm",
] as const;
export type RiderClimatePreference =
  (typeof RIDER_CLIMATE_PREFERENCES)[number];

export type RaceClimateCondition =
  | RiderClimatePreference
  | "temperate";

export type RiderClimateProfile = {
  strength: RiderClimatePreference;
  weakness: RiderClimatePreference;
};

export type RaceWeatherGenerationOptions = {
  countryCode?: string | null;
  profileType?: RaceProfileType;
};

export type RaceWeather = {
  condition: RaceWeatherCondition;
  rainIntensity: "none" | "light" | "steady" | "heavy";
  temperatureC: number;
  windSpeedKph: number;
  windDirection: RaceWindDirection;
  windIntensity: "calm" | "breeze" | "strong" | "gale";
  isWet: boolean;
};

export function getRaceWeather(
  seed: string | number,
  options: RaceWeatherGenerationOptions = {}
): RaceWeather {
  const hash = stableWeatherHash(String(seed));
  const weatherRoll = hash % 100;
  const condition = getWeatherCondition(weatherRoll, options);
  const rainIntensity = getPrecipitationIntensity(
    condition,
    (hash >>> 20) % 100
  );
  const windSpeedKph = getWeatherWindSpeed(condition, hash);

  return {
    condition,
    rainIntensity,
    temperatureC: getWeatherTemperature(
      condition,
      hash,
      options.countryCode
    ),
    windSpeedKph,
    windDirection: getWeatherWindDirection(condition, hash),
    windIntensity: getRaceWindIntensity(windSpeedKph),
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
  hasNorthernClassicAbility = false,
  climateProfile?: RiderClimateProfile | null
): RiderSimulationRatings {
  const climateAdjustment = getRaceClimatePerformanceAdjustment(
    climateProfile,
    weather
  );
  if (!weather.isWet && climateAdjustment === 0) return ratings;

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
  const handlingAdjustment = weather.isWet
    ? clamp(
        (wetRoadAffinity - 64) * 0.14 * intensityFactor +
          (hasNorthernClassicAbility ? 1.25 : 0),
        -2.75,
        3.75
      )
    : 0;

  return {
    ...ratings,
    flat: clampRating(
      ratings.flat + handlingAdjustment * 0.52 + climateAdjustment
    ),
    mountain: clampRating(ratings.mountain + climateAdjustment),
    hills: clampRating(
      ratings.hills + handlingAdjustment * 0.36 + climateAdjustment
    ),
    cobbles: clampRating(
      ratings.cobbles + handlingAdjustment + climateAdjustment
    ),
    downhill: clampRating(
      ratings.downhill +
        handlingAdjustment * 0.68 +
        climateAdjustment * 0.75
    ),
    sprint: clampRating(
      ratings.sprint + climateAdjustment * 0.65
    ),
    acceleration: clampRating(
      ratings.acceleration + climateAdjustment * 0.7
    ),
    timeTrial: clampRating(
      ratings.timeTrial + climateAdjustment * 0.8
    ),
    prologue: clampRating(
      ratings.prologue + climateAdjustment * 0.75
    ),
    endurance: clampRating(ratings.endurance + climateAdjustment),
    resistance: clampRating(
      ratings.resistance +
        Math.max(0, handlingAdjustment) * 0.25 +
        climateAdjustment
    ),
    recovery: clampRating(
      ratings.recovery + climateAdjustment * 0.55
    ),
    breakaway: clampRating(
      ratings.breakaway + climateAdjustment * 0.75
    ),
  };
}

export function getRiderClimateProfile({
  riderId,
  countryCode,
}: {
  riderId: string;
  countryCode?: string | null;
}): RiderClimateProfile {
  const normalizedCountryCode = countryCode?.trim().toUpperCase() ?? "";
  const hash = stableWeatherHash(
    normalizedCountryCode + ":" + riderId + ":climate"
  );
  const tendency = getCountryClimateTendency(normalizedCountryCode);
  const strength = tendency.strengths[hash % tendency.strengths.length];
  const weaknesses = tendency.weaknesses.filter(
    (preference) => preference !== strength
  );

  return {
    strength,
    weakness:
      weaknesses[(hash >>> 8) % weaknesses.length] ??
      getFallbackWeakness(strength),
  };
}

export function getRaceClimateCondition(
  weather: RaceWeather
): RaceClimateCondition {
  if (weather.condition === "snow") return "snow";
  if (weather.condition === "storm") return "storm";
  if (weather.condition === "rain") return "rain";
  if (weather.temperatureC >= 32) return "heat";
  if (weather.temperatureC <= 7) return "cold";
  if (weather.condition === "clear") return "sun";
  return "temperate";
}

export function getRaceClimatePerformanceAdjustment(
  climateProfile: RiderClimateProfile | null | undefined,
  weather: RaceWeather
) {
  if (!climateProfile) return 0;

  const condition = getRaceClimateCondition(weather);
  if (condition === "temperate") return 0;
  if (condition === climateProfile.strength) return 1.5;
  if (condition === climateProfile.weakness) return -1.25;
  return 0;
}

export function getRaceWindIntensity(windSpeedKph: number) {
  if (windSpeedKph < 12) return "calm" as const;
  if (windSpeedKph < 24) return "breeze" as const;
  if (windSpeedKph < 35) return "strong" as const;
  return "gale" as const;
}

export function getRaceCrosswindIncidentRisk(
  weather: RaceWeather,
  isFlatTerrain: boolean
) {
  if (
    !isFlatTerrain ||
    weather.windDirection !== "crosswind" ||
    weather.windSpeedKph < 24 ||
    (weather.condition !== "wind" && weather.condition !== "storm")
  ) {
    return 0;
  }

  return clamp(
    0.035 + (weather.windSpeedKph - 24) * 0.002,
    0.035,
    0.075
  );
}

export function getRaceWeatherLabel(weather: RaceWeather) {
  if (weather.condition === "clear") return "Ciel bleu";
  if (weather.condition === "cloudy") return "Quelques nuages";
  if (weather.condition === "wind") return "Vent soutenu";
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
  weatherRoll: number,
  options: RaceWeatherGenerationOptions
): RaceWeatherCondition {
  const normalizedCountryCode =
    options.countryCode?.trim().toUpperCase() ?? "";
  const windyShare =
    options.profileType === "flat" || options.profileType === "sprint"
      ? 16
      : options.profileType === "cobbles"
        ? 15
        : options.profileType === "mountain"
          ? 7
          : options.profileType === "hilly"
            ? 10
            : 12;
  const rainyCountry = WET_MARITIME_COUNTRIES.has(normalizedCountryCode);
  const snowyCountry = COLD_COUNTRIES.has(normalizedCountryCode);
  const rainShare = rainyCountry ? 12 : 9;
  const snowShare = snowyCountry ? 2 : 1;
  const stormShare = 2;
  const cloudyShare = rainyCountry ? 24 : 22;
  const clearShare =
    100 - windyShare - rainShare - snowShare - stormShare - cloudyShare;
  const thresholds = [
    ["clear", clearShare],
    ["cloudy", cloudyShare],
    ["wind", windyShare],
    ["rain", rainShare],
    ["storm", stormShare],
    ["snow", snowShare],
  ] as const;
  let cumulative = 0;

  for (const [condition, share] of thresholds) {
    cumulative += share;
    if (weatherRoll < cumulative) return condition;
  }

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
  hash: number,
  countryCode?: string | null
) {
  const temperatureRoll = (hash >>> 5) % 100;
  const [minimum, range] = {
    clear: [13, 30],
    cloudy: [9, 20],
    wind: [8, 23],
    rain: [8, 15],
    storm: [12, 16],
    snow: [-4, 7],
  }[condition];
  const normalizedCountryCode = countryCode?.trim().toUpperCase() ?? "";
  const countryAdjustment = HOT_COUNTRIES.has(normalizedCountryCode)
    ? 4
    : COLD_COUNTRIES.has(normalizedCountryCode)
      ? -4
      : 0;

  return clamp(
    minimum + (temperatureRoll % range) + countryAdjustment,
    -8,
    44
  );
}

function getWeatherWindSpeed(
  condition: RaceWeatherCondition,
  hash: number
) {
  if (condition === "wind") return 25 + ((hash >>> 10) % 20);
  if (condition === "storm") return 22 + ((hash >>> 10) % 18);
  return 5 + ((hash >>> 10) % 22);
}

function getWeatherWindDirection(
  condition: RaceWeatherCondition,
  hash: number
): RaceWindDirection {
  const directionRoll = (hash >>> 15) % 100;
  if (condition === "wind") {
    if (directionRoll < 55) return "crosswind";
    if (directionRoll < 78) return "headwind";
    return "tailwind";
  }
  if (condition === "storm" && directionRoll < 42) {
    return "crosswind";
  }
  return RACE_WIND_DIRECTIONS[
    directionRoll % RACE_WIND_DIRECTIONS.length
  ];
}

type CountryClimateTendency = {
  strengths: RiderClimatePreference[];
  weaknesses: RiderClimatePreference[];
};

const COLD_COUNTRIES = new Set([
  "AT", "CA", "CH", "CZ", "DE", "DK", "EE", "FI", "IS", "LT",
  "LV", "NO", "PL", "RU", "SE", "SI", "SK",
]);
const WET_MARITIME_COUNTRIES = new Set([
  "BE", "DK", "FR", "GB", "IE", "LU", "NL",
]);
const HOT_COUNTRIES = new Set([
  "AE", "AR", "AU", "BR", "CL", "CO", "DZ", "EG", "ES", "GR",
  "IL", "IN", "IR", "IT", "MA", "MX", "OM", "PE", "PT", "QA",
  "SA", "TN", "TR", "UY", "ZA",
]);
const TROPICAL_COUNTRIES = new Set([
  "BD", "BR", "CO", "CR", "CU", "DO", "EC", "ID", "IN", "JM",
  "KE", "KH", "LA", "LK", "MY", "PA", "PH", "SG", "TH", "VN",
]);
const ALPINE_COUNTRIES = new Set([
  "AT", "CA", "CH", "FI", "IS", "NO", "SE", "SI", "SK",
]);
const MEDITERRANEAN_COUNTRIES = new Set([
  "CY", "ES", "GR", "HR", "IL", "IT", "MA", "MT", "PT", "TN", "TR",
]);

function getCountryClimateTendency(
  countryCode: string
): CountryClimateTendency {
  if (countryCode === "DK") {
    return { strengths: ["cold"], weaknesses: ["heat"] };
  }
  if (TROPICAL_COUNTRIES.has(countryCode)) {
    return {
      strengths: ["heat", "rain", "storm"],
      weaknesses: ["cold", "snow"],
    };
  }
  if (ALPINE_COUNTRIES.has(countryCode)) {
    return {
      strengths: ["cold", "snow"],
      weaknesses: ["heat"],
    };
  }
  if (WET_MARITIME_COUNTRIES.has(countryCode)) {
    return {
      strengths: ["rain", "cold"],
      weaknesses: ["heat", "snow"],
    };
  }
  if (MEDITERRANEAN_COUNTRIES.has(countryCode)) {
    return {
      strengths: ["sun", "heat"],
      weaknesses: ["cold", "snow", "rain"],
    };
  }
  if (HOT_COUNTRIES.has(countryCode)) {
    return {
      strengths: ["heat", "sun"],
      weaknesses: ["cold", "snow"],
    };
  }
  if (COLD_COUNTRIES.has(countryCode)) {
    return {
      strengths: ["cold"],
      weaknesses: ["heat"],
    };
  }
  return {
    strengths: ["sun", "rain", "cold"],
    weaknesses: ["heat", "snow", "storm"],
  };
}

function getFallbackWeakness(
  strength: RiderClimatePreference
): RiderClimatePreference {
  const fallbackByStrength: Record<
    RiderClimatePreference,
    RiderClimatePreference
  > = {
    sun: "snow",
    heat: "cold",
    cold: "heat",
    rain: "heat",
    snow: "heat",
    storm: "cold",
  };

  return fallbackByStrength[strength];
}

function clampRating(value: number) {
  return Math.round(clamp(value, 1, 99) * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
