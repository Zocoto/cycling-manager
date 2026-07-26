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

export function isSeasonPartOfRiderHistory(status: string): boolean {
  return status === "active" || status === "completed";
}

export function resolvePublicTeamName({
  seasonDisplayName,
  amateurName,
  internalName,
}: {
  seasonDisplayName?: string | null;
  amateurName?: string | null;
  internalName?: string | null;
}): string {
  for (const candidate of [seasonDisplayName, amateurName, internalName]) {
    const publicName = normalizePublicTeamName(candidate);

    if (publicName) {
      return publicName;
    }
  }

  return "Équipe inconnue";
}

function normalizePublicTeamName(value?: string | null): string | null {
  const normalized = value?.trim();

  if (!normalized || /^initial_team_[a-f0-9]+$/i.test(normalized)) {
    return null;
  }

  return normalized.replace(/\s+\u00b7\s+[a-f0-9]{4}$/i, "").trim();
}

export type RiderSpecialtyProfile =
  | "Grimpeur"
  | "Puncheur"
  | "Coureur de tour"
  | "Sprinteur"
  | "Coureur de pavés"
  | "Baroudeur";

export type RiderSportingProfile =
  | RiderSpecialtyProfile
  | `${RiderSpecialtyProfile} / ${RiderSpecialtyProfile}`
  | "Coureur équilibré";

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
  const isTourRider =
    ratings.mountain >= RIDER_PROFILE_MINIMUM_RATING &&
    ratings.timeTrial >= RIDER_PROFILE_MINIMUM_RATING;

  const profiles = [
    {
      label: "Coureur de tour",
      qualifies: isTourRider,
      score: (ratings.mountain + ratings.timeTrial) / 2,
    },
    {
      label: "Grimpeur",
      qualifies:
        !isTourRider &&
        ratings.mountain >= RIDER_PROFILE_MINIMUM_RATING,
      score: ratings.mountain,
    },
    {
      label: "Puncheur",
      qualifies: ratings.hills >= RIDER_PROFILE_MINIMUM_RATING,
      score: ratings.hills,
    },
    {
      label: "Sprinteur",
      qualifies: ratings.sprint >= RIDER_PROFILE_MINIMUM_RATING,
      score: ratings.sprint,
    },
    {
      label: "Coureur de pavés",
      qualifies: ratings.cobbles >= RIDER_PROFILE_MINIMUM_RATING,
      score: ratings.cobbles,
    },
    {
      label: "Baroudeur",
      qualifies: ratings.breakaway >= RIDER_PROFILE_MINIMUM_RATING,
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

  const primaryProfile = qualifiedProfiles[0];

  if (!primaryProfile) {
    return "Coureur équilibré";
  }

  const secondaryProfile = qualifiedProfiles[1];

  if (
    !secondaryProfile ||
    primaryProfile.score - secondaryProfile.score >
      RIDER_PROFILE_HYBRID_MAX_GAP
  ) {
    return primaryProfile.label;
  }

  return `${primaryProfile.label} / ${secondaryProfile.label}`;
}

const RIDER_PROFILE_MINIMUM_RATING = 62;
const RIDER_PROFILE_HYBRID_MAX_GAP = 4;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
