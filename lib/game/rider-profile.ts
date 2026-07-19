export type RiderRatingKey =
  | "mountain"
  | "hills"
  | "recovery"
  | "endurance"
  | "resistance"
  | "breakaway"
  | "downhill"
  | "acceleration"
  | "sprint"
  | "flat"
  | "cobbles"
  | "prologue"
  | "timeTrial";

export type RiderRatings = Record<RiderRatingKey, number>;

export const RIDER_RATING_AXES: ReadonlyArray<{
  key: RiderRatingKey;
  shortLabel: string;
  label: string;
}> = [
  { key: "mountain", shortLabel: "MON", label: "Montagne" },
  { key: "hills", shortLabel: "VAL", label: "Vallon" },
  { key: "recovery", shortLabel: "REC", label: "Récupération" },
  { key: "endurance", shortLabel: "END", label: "Endurance" },
  { key: "resistance", shortLabel: "RES", label: "Résistance" },
  { key: "breakaway", shortLabel: "BAR", label: "Baroudeur" },
  { key: "downhill", shortLabel: "DES", label: "Descente" },
  { key: "acceleration", shortLabel: "ACC", label: "Accélération" },
  { key: "sprint", shortLabel: "SPR", label: "Sprint" },
  { key: "flat", shortLabel: "PLA", label: "Plaine" },
  { key: "cobbles", shortLabel: "PAV", label: "Pavés" },
  { key: "prologue", shortLabel: "PRO", label: "Prologue" },
  { key: "timeTrial", shortLabel: "CLM", label: "Contre-la-montre" },
] as const;

export type RadarPoint = {
  x: number;
  y: number;
};

export function createRadarPoints({
  values,
  center,
  radius,
}: {
  values: readonly number[];
  center: number;
  radius: number;
}): RadarPoint[] {
  if (values.length < 3) {
    return [];
  }

  return values.map((value, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / values.length;
    const normalizedValue = clamp(value, 0, 100) / 100;

    return {
      x: center + Math.cos(angle) * radius * normalizedValue,
      y: center + Math.sin(angle) * radius * normalizedValue,
    };
  });
}

export function serializeRadarPoints(points: readonly RadarPoint[]): string {
  return points
    .map((point) => `${round(point.x)},${round(point.y)}`)
    .join(" ");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
