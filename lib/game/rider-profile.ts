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

export type RiderSpecialtyProfile =
  | "Grimpeur"
  | "Puncheur"
  | "Rouleur / CLM"
  | "Sprinteur"
  | "Spécialiste des pavés"
  | "Baroudeur";

export type RiderSportingProfile =
  | RiderSpecialtyProfile
  | `${RiderSpecialtyProfile} / ${RiderSpecialtyProfile}`
  | `${RiderSpecialtyProfile} / ${RiderSpecialtyProfile} / ${RiderSpecialtyProfile}`
  | "Coureur complet"
  | "Équipier polyvalent";

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

export function getRiderSportingProfile(
  ratings: RiderRatings
): RiderSportingProfile {
  const profiles = [
    {
      label: "Grimpeur",
      qualifies: ratings.mountain >= 62,
      score: ratings.mountain,
    },
    {
      label: "Puncheur",
      qualifies: ratings.hills >= 62 && ratings.acceleration >= 60,
      score: ratings.hills,
    },
    {
      label: "Rouleur / CLM",
      qualifies: ratings.timeTrial >= 62 && ratings.flat >= 60,
      score: Math.max(ratings.timeTrial, ratings.flat),
    },
    {
      label: "Sprinteur",
      qualifies: ratings.sprint >= 62 && ratings.acceleration >= 60,
      score: ratings.sprint,
    },
    {
      label: "Spécialiste des pavés",
      qualifies: ratings.cobbles >= 62 && ratings.resistance >= 58,
      score: ratings.cobbles,
    },
    {
      label: "Baroudeur",
      qualifies: ratings.breakaway >= 62 && ratings.endurance >= 58,
      score: ratings.breakaway,
    },
  ] satisfies Array<{
    label: RiderSpecialtyProfile;
    qualifies: boolean;
    score: number;
  }>;

  const qualifiedProfiles = profiles
    .filter((profile) => profile.qualifies)
    .sort((left, right) => right.score - left.score);

  if (qualifiedProfiles.length === 0) return "Équipier polyvalent";
  if (qualifiedProfiles.length > 3) return "Coureur complet";

  return qualifiedProfiles
    .map((profile) => profile.label)
    .join(" / ") as RiderSportingProfile;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
