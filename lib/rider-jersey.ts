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
  status: "amateur" | "free-agent" | "sponsored" | "national-champion";
  countryCode?: string;
  championshipType?: "road" | "time_trial";
};

type NationalChampionPalette = {
  primary: string;
  secondary: string;
  accent: string;
  pattern: RiderJerseyPattern;
};

const NATIONAL_CHAMPION_PALETTES: Record<string, NationalChampionPalette> = {
  AT: { primary: "#D81E2A", secondary: "#FFFFFF", accent: "#D81E2A", pattern: "hoops" },
  AU: { primary: "#007A4D", secondary: "#FFCD00", accent: "#FFFFFF", pattern: "shoulders" },
  BE: { primary: "#111111", secondary: "#FFD90C", accent: "#E21B2D", pattern: "vertical" },
  BR: { primary: "#159447", secondary: "#FFDF00", accent: "#21468B", pattern: "chevron" },
  CA: { primary: "#D80621", secondary: "#FFFFFF", accent: "#D80621", pattern: "center" },
  CH: { primary: "#D52B1E", secondary: "#FFFFFF", accent: "#D52B1E", pattern: "cross" },
  CL: { primary: "#D52B1E", secondary: "#FFFFFF", accent: "#0039A6", pattern: "quarters" },
  CN: { primary: "#DE2910", secondary: "#FFDE00", accent: "#FFFFFF", pattern: "shoulders" },
  CO: { primary: "#FCD116", secondary: "#003893", accent: "#CE1126", pattern: "hoops" },
  CZ: { primary: "#FFFFFF", secondary: "#D7141A", accent: "#11457E", pattern: "split" },
  DE: { primary: "#111111", secondary: "#DD0000", accent: "#FFCE00", pattern: "hoops" },
  DK: { primary: "#C8102E", secondary: "#FFFFFF", accent: "#C8102E", pattern: "cross" },
  EE: { primary: "#4891D9", secondary: "#111111", accent: "#FFFFFF", pattern: "hoops" },
  ES: { primary: "#AA151B", secondary: "#F1BF00", accent: "#AA151B", pattern: "hoops" },
  FI: { primary: "#FFFFFF", secondary: "#003580", accent: "#FFFFFF", pattern: "cross" },
  FR: { primary: "#002395", secondary: "#FFFFFF", accent: "#ED2939", pattern: "vertical" },
  GB: { primary: "#012169", secondary: "#FFFFFF", accent: "#C8102E", pattern: "cross" },
  GR: { primary: "#0D5EAF", secondary: "#FFFFFF", accent: "#0D5EAF", pattern: "hoops" },
  HR: { primary: "#FF0000", secondary: "#FFFFFF", accent: "#171796", pattern: "checkerboard" },
  HU: { primary: "#CE2939", secondary: "#FFFFFF", accent: "#477050", pattern: "hoops" },
  IE: { primary: "#169B62", secondary: "#FFFFFF", accent: "#FF883E", pattern: "vertical" },
  IT: { primary: "#008C45", secondary: "#FFFFFF", accent: "#CD212A", pattern: "vertical" },
  JP: { primary: "#FFFFFF", secondary: "#BC002D", accent: "#FFFFFF", pattern: "center" },
  KZ: { primary: "#00AFCA", secondary: "#FEC50C", accent: "#FFFFFF", pattern: "shoulders" },
  KR: { primary: "#FFFFFF", secondary: "#CD2E3A", accent: "#0047A0", pattern: "split" },
  LU: { primary: "#ED2939", secondary: "#FFFFFF", accent: "#00A1DE", pattern: "hoops" },
  MA: { primary: "#C1272D", secondary: "#006233", accent: "#FFFFFF", pattern: "center" },
  MX: { primary: "#006847", secondary: "#FFFFFF", accent: "#CE1126", pattern: "vertical" },
  NL: { primary: "#AE1C28", secondary: "#FFFFFF", accent: "#21468B", pattern: "hoops" },
  NO: { primary: "#BA0C2F", secondary: "#FFFFFF", accent: "#00205B", pattern: "cross" },
  NZ: { primary: "#00247D", secondary: "#CC142B", accent: "#FFFFFF", pattern: "shoulders" },
  PL: { primary: "#FFFFFF", secondary: "#DC143C", accent: "#FFFFFF", pattern: "hoops" },
  PT: { primary: "#046A38", secondary: "#DA291C", accent: "#FFE900", pattern: "split" },
  RO: { primary: "#002B7F", secondary: "#FCD116", accent: "#CE1126", pattern: "vertical" },
  RS: { primary: "#C6363C", secondary: "#0C4076", accent: "#FFFFFF", pattern: "hoops" },
  RU: { primary: "#FFFFFF", secondary: "#0039A6", accent: "#D52B1E", pattern: "hoops" },
  SE: { primary: "#006AA7", secondary: "#FECC02", accent: "#FFFFFF", pattern: "cross" },
  SI: { primary: "#FFFFFF", secondary: "#005DA4", accent: "#ED1C24", pattern: "hoops" },
  SK: { primary: "#FFFFFF", secondary: "#0B4EA2", accent: "#EE1C25", pattern: "hoops" },
  TR: { primary: "#E30A17", secondary: "#FFFFFF", accent: "#E30A17", pattern: "center" },
  UA: { primary: "#0057B7", secondary: "#FFD700", accent: "#FFFFFF", pattern: "hoops" },
  US: { primary: "#B31942", secondary: "#FFFFFF", accent: "#0A3161", pattern: "pinstripes" },
  ZA: { primary: "#007749", secondary: "#FFB81C", accent: "#DE3831", pattern: "chevron" },
};

const DEFAULT_NATIONAL_CHAMPION_PALETTE: NationalChampionPalette = {
  primary: "#FFFFFF",
  secondary: "#1F4E9D",
  accent: "#D5303E",
  pattern: "vertical",
};

export const FREE_AGENT_RIDER_JERSEY: RiderJerseyAppearance = {
  primaryColor: "#7B8582",
  secondaryColor: "#AEB6B3",
  accentColor: "#DDE1DF",
  pattern: "solid",
  status: "free-agent",
};

export function createAmateurRiderJersey(
  jersey: AmateurJerseyConfig
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
}: {
  colors: SponsorColors;
  style: JerseyStyle;
}): RiderJerseyAppearance {
  return {
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    accentColor: colors.accent,
    pattern:
      style === "classic"
        ? "hoops"
        : style === "modern"
          ? "diagonal"
          : "split",
    status: "sponsored",
  };
}

export function getNationalChampionPalette(
  countryCode: string
): NationalChampionPalette {
  return (
    NATIONAL_CHAMPION_PALETTES[countryCode.trim().toUpperCase()] ??
    DEFAULT_NATIONAL_CHAMPION_PALETTE
  );
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
    pattern: championshipType === "time_trial" ? "pinstripes" : palette.pattern,
    status: "national-champion",
    countryCode: countryCode.toUpperCase(),
    championshipType,
  };
}
