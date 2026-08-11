import { NATIONAL_CHAMPION_COUNTRY_COLORS } from "@/data/national-champion-country-metadata";
import type { AmateurJerseyConfig } from "@/lib/amateur-team";
import type { JerseyStyle, SponsorColors } from "@/types/sponsor";

export type RiderJerseyPattern =
  | "center"
  | "diagonal"
  | "hoops"
  | "solid"
  | "split"
  | "vertical"
  | "chevron"
  | "quarters"
  | "cross"
  | "shoulders"
  | "checkerboard"
  | "wave"
  | "pinstripes";

export type RiderJerseyAppearance = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  pattern: RiderJerseyPattern;
  status:
    | "amateur"
    | "free-agent"
    | "sponsored"
    | "national-team"
    | "national-champion"
    | "world-champion";
  imagePath?: string;
  countryCode?: string;
  championshipType?: "road" | "time_trial";
};

export type NationalChampionPalette = {
  primary: string;
  secondary: string;
  accent: string;
  pattern: RiderJerseyPattern;
  dominantColors: readonly [string, string, string];
};

const DEFAULT_NATIONAL_CHAMPION_COLORS = [
  "#FFFFFF",
  "#1F4E9D",
  "#D5303E",
] as const;

export const FREE_AGENT_RIDER_JERSEY: RiderJerseyAppearance = {
  primaryColor: "#7B8582",
  secondaryColor: "#AEB6B3",
  accentColor: "#DDE1DF",
  pattern: "solid",
  status: "free-agent",
};

export function createAmateurRiderJersey(
  jersey: AmateurJerseyConfig,
): RiderJerseyAppearance {
  return {
    primaryColor: jersey.primaryColor,
    secondaryColor: jersey.secondaryColor,
    accentColor: jersey.accentColor,
    pattern: jersey.pattern === "classic" ? "center" : jersey.pattern,
    status: "amateur",
  };
}

export function createSponsoredRiderJersey({
  colors,
  style,
  imagePath,
}: {
  colors: SponsorColors;
  style: JerseyStyle;
  imagePath?: string | null;
}): RiderJerseyAppearance {
  const normalizedImagePath = imagePath?.trim();

  return {
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    accentColor: colors.accent,
    pattern:
      style === "classic" ? "hoops" : style === "modern" ? "diagonal" : "split",
    status: "sponsored",
    ...(normalizedImagePath ? { imagePath: normalizedImagePath } : {}),
  };
}

export function getNationalChampionPalette(
  countryCode: string,
): NationalChampionPalette {
  const normalizedCountryCode = countryCode.trim().toUpperCase();
  const dominantColors =
    NATIONAL_CHAMPION_COUNTRY_COLORS[
      normalizedCountryCode as keyof typeof NATIONAL_CHAMPION_COUNTRY_COLORS
    ] ?? DEFAULT_NATIONAL_CHAMPION_COLORS;

  return {
    primary: dominantColors[0],
    secondary: dominantColors[1],
    accent: dominantColors[2],
    pattern: "solid",
    dominantColors,
  };
}

export function createNationalChampionRiderJersey({
  countryCode,
  championshipType,
}: {
  countryCode: string;
  championshipType: "road" | "time_trial";
}): RiderJerseyAppearance {
  const palette = getNationalChampionPalette(countryCode);

  return {
    primaryColor: palette.primary,
    secondaryColor: palette.secondary,
    accentColor: palette.accent,
    pattern: palette.pattern,
    status: "national-champion",
    countryCode: countryCode.toUpperCase(),
    championshipType,
  };
}

export function createNationalTeamRiderJersey(
  countryCode: string,
): RiderJerseyAppearance {
  const palette = getNationalChampionPalette(countryCode);

  return {
    primaryColor: palette.primary,
    secondaryColor: palette.secondary,
    accentColor: palette.accent,
    pattern: "solid",
    status: "national-team",
    countryCode: countryCode.toUpperCase(),
  };
}

export function createWorldChampionRiderJersey({
  championshipType,
}: {
  championshipType: "road" | "time_trial";
}): RiderJerseyAppearance {
  return {
    primaryColor: "#FFFFFF",
    secondaryColor: "#E32636",
    accentColor: "#2166B1",
    pattern: "hoops",
    status: "world-champion",
    championshipType,
  };
}
