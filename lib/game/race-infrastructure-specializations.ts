import { getInfrastructureSpecializationPowerPercentage } from "./infrastructure-specializations";
import type { RaceWeather } from "./race-weather";

export const INDOOR_TRACK_SPECIALIZATION_CODES = [
  "pure_speed",
  "explosiveness",
  "leadout_school",
] as const;
export type IndoorTrackSpecializationCode =
  (typeof INDOOR_TRACK_SPECIALIZATION_CODES)[number];

export const WIND_TUNNEL_SPECIALIZATION_CODES = [
  "solo_aero",
  "team_aero",
  "versatile_aero",
] as const;
export type WindTunnelSpecializationCode =
  (typeof WIND_TUNNEL_SPECIALIZATION_CODES)[number];

export const WELCOME_CENTER_SPECIALIZATION_CODES = [
  "administrative_path",
  "sporting_integration",
  "youth_gateway",
] as const;
export type WelcomeCenterSpecializationCode =
  (typeof WELCOME_CENTER_SPECIALIZATION_CODES)[number];

export type RaceInfrastructureSpecialization<Code extends string> = {
  code: Code;
  infrastructureLevel: number;
};

export type IndoorTrackSpecialization =
  RaceInfrastructureSpecialization<IndoorTrackSpecializationCode>;
export type WindTunnelSpecialization =
  RaceInfrastructureSpecialization<WindTunnelSpecializationCode>;
export type WelcomeCenterSpecialization =
  RaceInfrastructureSpecialization<WelcomeCenterSpecializationCode>;

export function isIndoorTrackSpecializationCode(
  value: string | null | undefined,
): value is IndoorTrackSpecializationCode {
  return INDOOR_TRACK_SPECIALIZATION_CODES.includes(
    value as IndoorTrackSpecializationCode,
  );
}

export function isWindTunnelSpecializationCode(
  value: string | null | undefined,
): value is WindTunnelSpecializationCode {
  return WIND_TUNNEL_SPECIALIZATION_CODES.includes(
    value as WindTunnelSpecializationCode,
  );
}

export function isWelcomeCenterSpecializationCode(
  value: string | null | undefined,
): value is WelcomeCenterSpecializationCode {
  return WELCOME_CENTER_SPECIALIZATION_CODES.includes(
    value as WelcomeCenterSpecializationCode,
  );
}

export function getSpecializationScaledPercentage(
  specialization: { infrastructureLevel: number } | null | undefined,
  fullPowerPercentage: number,
) {
  if (!specialization) return 0;
  return (
    (fullPowerPercentage *
      getInfrastructureSpecializationPowerPercentage(
        specialization.infrastructureLevel,
      )) /
    100
  );
}

export function isDifficultAeroWeather(weather: RaceWeather) {
  return (
    weather.isWet ||
    weather.windIntensity === "strong" ||
    weather.windIntensity === "gale" ||
    weather.condition === "storm" ||
    weather.condition === "snow" ||
    weather.temperatureC >= 32 ||
    weather.temperatureC <= 7
  );
}

export function applyPercentageToRating(
  value: number,
  percentage: number,
) {
  return Math.min(100, value * (1 + Math.max(0, percentage) / 100));
}
