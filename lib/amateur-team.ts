export const AMATEUR_JERSEY_PATTERNS = [
  "classic",
  "diagonal",
  "hoops",
  "split",
] as const;

export type AmateurJerseyPattern =
  (typeof AMATEUR_JERSEY_PATTERNS)[number];

export type AmateurJerseyConfig = {
  pattern: AmateurJerseyPattern;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export const DEFAULT_AMATEUR_JERSEY: AmateurJerseyConfig = {
  pattern: "classic",
  primaryColor: "#176951",
  secondaryColor: "#FFFDF4",
  accentColor: "#F2C94C",
};

export const AMATEUR_JERSEY_PATTERN_LABELS: Record<
  AmateurJerseyPattern,
  string
> = {
  classic: "Bande centrale",
  diagonal: "Diagonale",
  hoops: "Bandes horizontales",
  split: "Bicolore",
};

export function isAmateurJerseyPattern(
  value: string
): value is AmateurJerseyPattern {
  return AMATEUR_JERSEY_PATTERNS.some(
    (pattern) => pattern === value
  );
}

export function normalizeHexColor(
  value: string
): string | null {
  const normalizedValue = value.trim().toUpperCase();

  if (!/^#[0-9A-F]{6}$/.test(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

export function hasDistinctJerseyColors(
  jersey: AmateurJerseyConfig
): boolean {
  return (
    new Set([
      jersey.primaryColor.toUpperCase(),
      jersey.secondaryColor.toUpperCase(),
      jersey.accentColor.toUpperCase(),
    ]).size >= 2
  );
}
