export const NATIONAL_JERSEY_ELEMENT_KINDS = [
  "flag",
  "emblem",
  "band",
  "shape",
] as const;

export const NATIONAL_JERSEY_ELEMENT_SHAPES = [
  "rectangle",
  "roundel",
  "shield",
  "diamond",
  "hexagon",
] as const;

export type NationalJerseyElementKind =
  (typeof NATIONAL_JERSEY_ELEMENT_KINDS)[number];
export type NationalJerseyElementShape =
  (typeof NATIONAL_JERSEY_ELEMENT_SHAPES)[number];

export type NationalJerseyElement = {
  id: string;
  kind: NationalJerseyElementKind;
  shape: NationalJerseyElementShape;
  color: string;
  secondaryColor: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
};

export type NationalJerseyDraft = {
  schemaVersion: 2;
  baseColor: string;
  elements: NationalJerseyElement[];
};

export type PublishedNationalJersey = {
  design: NationalJerseyDraft;
  version: number;
  publishedAt: string;
};

export const DEFAULT_NATIONAL_JERSEY_DRAFT: NationalJerseyDraft = {
  schemaVersion: 2,
  baseColor: "#FFFFFF",
  elements: [],
};

export const NATIONAL_JERSEY_MAX_ELEMENTS = 16;

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const ELEMENT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,48}$/;

export function getNationalJerseyDraftStorageKey(countryCode: string): string {
  const normalizedCountryCode = countryCode.trim().toLowerCase();
  return `cyclostratege:federation-jersey-draft:v2:${normalizedCountryCode}`;
}

export function normalizeNationalJerseyDraft(
  candidate: Partial<NationalJerseyDraft> | null | undefined,
): NationalJerseyDraft {
  const draft = candidate ?? {};
  const rawElements = Array.isArray(draft.elements) ? draft.elements : [];

  return {
    schemaVersion: 2,
    baseColor: normalizeColor(draft.baseColor, "#FFFFFF"),
    elements: rawElements
      .slice(0, NATIONAL_JERSEY_MAX_ELEMENTS)
      .flatMap((element, index) => {
        const normalized = normalizeNationalJerseyElement(element, index);
        return normalized ? [normalized] : [];
      }),
  };
}

export function decodeNationalJerseyDraft(
  serializedDraft: string | null,
): NationalJerseyDraft | null {
  if (!serializedDraft) return null;

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

export function getNationalJerseyPalette(
  candidate: NationalJerseyDraft | null | undefined,
): {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
} {
  const design = normalizeNationalJerseyDraft(candidate);
  const elementColors = design.elements.flatMap((element) => [
    element.color,
    element.secondaryColor,
  ]);
  const distinctColors = elementColors.filter(
    (color, index) =>
      color !== design.baseColor && elementColors.indexOf(color) === index,
  );

  return {
    primaryColor: design.baseColor,
    secondaryColor: distinctColors[0] ?? "#111111",
    accentColor: distinctColors[1] ?? "#F2C94C",
  };
}

function normalizeNationalJerseyElement(
  candidate: unknown,
  index: number,
): NationalJerseyElement | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const element = candidate as Partial<NationalJerseyElement>;
  const kind = NATIONAL_JERSEY_ELEMENT_KINDS.includes(
    element.kind as NationalJerseyElementKind,
  )
    ? (element.kind as NationalJerseyElementKind)
    : null;
  if (!kind) return null;

  const defaultShape: NationalJerseyElementShape =
    kind === "band"
      ? "rectangle"
      : kind === "emblem"
        ? "shield"
        : "rectangle";
  const shape = NATIONAL_JERSEY_ELEMENT_SHAPES.includes(
    element.shape as NationalJerseyElementShape,
  )
    ? (element.shape as NationalJerseyElementShape)
    : defaultShape;

  return {
    id:
      typeof element.id === "string" && ELEMENT_ID_PATTERN.test(element.id)
        ? element.id
        : `element-${index + 1}`,
    kind,
    shape,
    color: normalizeColor(element.color, "#111111"),
    secondaryColor: normalizeColor(element.secondaryColor, "#F2C94C"),
    x: clampNumber(element.x, -60, 180, 60),
    y: clampNumber(element.y, -60, 190, 76),
    width: clampNumber(element.width, 4, 220, kind === "band" ? 160 : 54),
    height: clampNumber(element.height, 4, 220, kind === "band" ? 18 : 54),
    rotation: clampNumber(element.rotation, -180, 180, 0),
    opacity: clampNumber(element.opacity, 0.15, 1, 1),
  };
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
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}
