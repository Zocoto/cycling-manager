import type { NationalJerseyDraft } from "@/lib/game/national-jersey-preview";
import { getNationalJerseyPalette } from "@/lib/game/national-jersey-preview";

export type FederationNationTheme = {
  primary: string;
  secondary: string;
  accent: string;
  soft: string;
  ink: string;
};

const COUNTRY_THEMES: Record<string, FederationNationTheme> = {
  AR: theme("#173B70", "#75BDEB", "#FFFFFF"),
  AT: theme("#8F1722", "#D72638", "#FFFFFF"),
  AU: theme("#073C2B", "#0B6B48", "#F4C430"),
  BE: theme("#181716", "#C92A32", "#F6D02F"),
  BR: theme("#075A39", "#11864F", "#F7D117"),
  BG: theme("#164F3C", "#2F8F67", "#D62839"),
  CA: theme("#7F111B", "#D52231", "#FFFFFF"),
  CH: theme("#8E101B", "#D62232", "#FFFFFF"),
  CN: theme("#86121D", "#D92332", "#FFD84D"),
  CO: theme("#123D7A", "#F2CB2F", "#D72638"),
  CZ: theme("#153F78", "#2B65A6", "#D62D3A"),
  DE: theme("#171717", "#BE2634", "#F2C94C"),
  DK: theme("#8E1621", "#D72638", "#FFFFFF"),
  DZ: theme("#17543D", "#2E8B62", "#D52B3A"),
  EC: theme("#153F78", "#F2CB2F", "#D72638"),
  ER: theme("#174D42", "#2C8C65", "#D52B3A"),
  ES: theme("#8E1723", "#C92A32", "#F5C843"),
  FI: theme("#173E78", "#2F65A6", "#FFFFFF"),
  FR: theme("#142D63", "#2854A6", "#D7283F"),
  GB: theme("#172D57", "#294B87", "#D62D3A"),
  GR: theme("#17467D", "#2D75B7", "#FFFFFF"),
  HR: theme("#173B70", "#2F65A6", "#D52B3A"),
  IE: theme("#14533C", "#2D8A61", "#E9852D"),
  IT: theme("#114D3A", "#24845C", "#D52B3A"),
  JP: theme("#6F1723", "#C6263A", "#FFFFFF"),
  MA: theme("#831622", "#C92735", "#2F8A5D"),
  MX: theme("#14513C", "#2B865F", "#C92735"),
  NL: theme("#172E63", "#EA6E24", "#FFFFFF"),
  NO: theme("#781522", "#C72535", "#234B87"),
  NZ: theme("#142D59", "#284D85", "#D72B3A"),
  PL: theme("#791725", "#D52C40", "#FFFFFF"),
  PT: theme("#12503A", "#287E59", "#C92A32"),
  RO: theme("#173C78", "#2D62A5", "#F2CA35"),
  RS: theme("#173B70", "#2D61A1", "#C92735"),
  SE: theme("#17467B", "#2D72AD", "#F2CB35"),
  SI: theme("#17457D", "#2D6EB0", "#3B9A66"),
  SK: theme("#173F78", "#2D68A9", "#D32D3C"),
  TN: theme("#831622", "#C92735", "#FFFFFF"),
  TR: theme("#831622", "#C92735", "#FFFFFF"),
  US: theme("#142D59", "#294D86", "#C92735"),
  VE: theme("#6E1E3E", "#9A3159", "#F2C94C"),
  ZA: theme("#104D3A", "#257C5B", "#F2C94C"),
};

const DEFAULT_THEME = theme("#173E56", "#26738A", "#F2C94C");

export function getFederationNationTheme(
  countryCode: string,
  jerseyDesign?: NationalJerseyDraft | null,
): FederationNationTheme {
  if (jerseyDesign) {
    const palette = getNationalJerseyPalette(jerseyDesign);
    if (palette.primaryColor !== "#FFFFFF") {
      return theme(
        darken(palette.primaryColor, 0.48),
        darken(palette.primaryColor, 0.18),
        palette.accentColor === "#FFFFFF"
          ? palette.secondaryColor
          : palette.accentColor,
      );
    }
  }

  return COUNTRY_THEMES[countryCode.trim().toUpperCase()] ?? DEFAULT_THEME;
}

function theme(
  primary: string,
  secondary: string,
  accent: string,
): FederationNationTheme {
  return {
    primary,
    secondary,
    accent,
    soft: mixWithWhite(secondary, 0.82),
    ink: primary,
  };
}

function darken(color: string, amount: number): string {
  const channels = parseHex(color);
  if (!channels) return color;
  return toHex(channels.map((channel) => channel * (1 - amount)));
}

function mixWithWhite(color: string, amount: number): string {
  const channels = parseHex(color);
  if (!channels) return "#EAF2F5";
  return toHex(
    channels.map((channel) => channel + (255 - channel) * amount),
  );
}

function parseHex(color: string): [number, number, number] | null {
  const match = /^#([0-9A-F]{6})$/i.exec(color);
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(channels: number[]): string {
  return `#${channels
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}
