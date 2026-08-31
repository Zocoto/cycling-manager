export const NATIONAL_JERSEY_PATTERNS = [
  "classic",
  "horizontal-band",
  "diagonal-sash",
  "cross",
  "halves",
] as const;

export const NATIONAL_JERSEY_FLAG_MOTIFS = [
  "none",
  "full-flag",
  "central-roundel",
  "central-shield",
] as const;

export type NationalJerseyPattern =
  (typeof NATIONAL_JERSEY_PATTERNS)[number];
export type NationalJerseyFlagMotif =
  (typeof NATIONAL_JERSEY_FLAG_MOTIFS)[number];

export type NationalJerseyDraft = {
  pattern: NationalJerseyPattern;
  flagMotif: NationalJerseyFlagMotif;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  motifX: number;
  motifY: number;
  motifScale: number;
  motifRotation: number;
};

export const DEFAULT_NATIONAL_JERSEY_DRAFT: NationalJerseyDraft = {
  pattern: "horizontal-band",
  flagMotif: "central-roundel",
  primaryColor: "#F8FBF9",
  secondaryColor: "#123F36",
  accentColor: "#F2C94C",
  motifX: 60,
  motifY: 80,
  motifScale: 1,
  motifRotation: 0,
};

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function getNationalJerseyDraftStorageKey(countryCode: string): string {
  const normalizedCountryCode = countryCode.trim().toLowerCase();
  return `cyclostratege:federation-jersey-draft:v1:${normalizedCountryCode}`;
}

export function normalizeNationalJerseyDraft(
  candidate: Partial<NationalJerseyDraft> | null | undefined,
): NationalJerseyDraft {
  const draft = candidate ?? {};

  return {
    pattern: NATIONAL_JERSEY_PATTERNS.includes(
      draft.pattern as NationalJerseyPattern,
    )
      ? (draft.pattern as NationalJerseyPattern)
      : DEFAULT_NATIONAL_JERSEY_DRAFT.pattern,
    flagMotif: NATIONAL_JERSEY_FLAG_MOTIFS.includes(
      draft.flagMotif as NationalJerseyFlagMotif,
    )
      ? (draft.flagMotif as NationalJerseyFlagMotif)
      : DEFAULT_NATIONAL_JERSEY_DRAFT.flagMotif,
    primaryColor: normalizeColor(
      draft.primaryColor,
      DEFAULT_NATIONAL_JERSEY_DRAFT.primaryColor,
    ),
    secondaryColor: normalizeColor(
      draft.secondaryColor,
      DEFAULT_NATIONAL_JERSEY_DRAFT.secondaryColor,
    ),
    accentColor: normalizeColor(
      draft.accentColor,
      DEFAULT_NATIONAL_JERSEY_DRAFT.accentColor,
    ),
    motifX: clampNumber(draft.motifX, 25, 95, 60),
    motifY: clampNumber(draft.motifY, 30, 110, 80),
    motifScale: clampNumber(draft.motifScale, 0.6, 1.8, 1),
    motifRotation: clampNumber(draft.motifRotation, -45, 45, 0),
  };
}

export function decodeNationalJerseyDraft(
  serializedDraft: string | null,
): NationalJerseyDraft | null {
  if (!serializedDraft) {
    return null;
  }

  try {
    const parsed = JSON.parse(serializedDraft) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return normalizeNationalJerseyDraft(parsed as Partial<NationalJerseyDraft>);
  } catch {
    return null;
  }
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value)
    ? value.toUpperCase()
    : fallback;
}

function clampNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, value));
}
