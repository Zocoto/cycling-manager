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
  status: "amateur" | "free-agent" | "sponsored";
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
