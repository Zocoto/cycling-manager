export const STAGE_RACE_JERSEY_TYPES = [
  "general",
  "sprint",
  "mountain",
  "youth",
] as const;

export type StageRaceJerseyType =
  (typeof STAGE_RACE_JERSEY_TYPES)[number];

export type StageRaceJerseyStandings = {
  general: ReadonlyArray<{ riderId: string }>;
  sprint: ReadonlyArray<{ riderId: string }>;
  mountain: ReadonlyArray<{ riderId: string }>;
  youth: ReadonlyArray<{ riderId: string }>;
};

export type StageRaceJerseyAssignments = Partial<
  Record<StageRaceJerseyType, string>
>;

export type StageRaceJerseyVisual = {
  label: string;
  shortLabel: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  pattern: "solid" | "polka-dots";
};

export const STAGE_RACE_JERSEY_VISUALS: Record<
  StageRaceJerseyType,
  StageRaceJerseyVisual
> = {
  general: {
    label: "Leader du classement général",
    shortLabel: "Maillot jaune",
    primaryColor: "#F5D547",
    secondaryColor: "#F9E783",
    accentColor: "#3E3410",
    pattern: "solid",
  },
  sprint: {
    label: "Leader du classement par points",
    shortLabel: "Maillot vert",
    primaryColor: "#168C52",
    secondaryColor: "#43B978",
    accentColor: "#F3FFF7",
    pattern: "solid",
  },
  mountain: {
    label: "Leader du classement de la montagne",
    shortLabel: "Maillot à pois",
    primaryColor: "#FFFDF7",
    secondaryColor: "#FFFFFF",
    accentColor: "#D62839",
    pattern: "polka-dots",
  },
  youth: {
    label: "Leader du classement des jeunes",
    shortLabel: "Maillot blanc",
    primaryColor: "#FFFFFF",
    secondaryColor: "#F2F2ED",
    accentColor: "#777D78",
    pattern: "solid",
  },
};

/**
 * Respecte la priorité des maillots distinctifs. Quand un même coureur mène
 * plusieurs classements, le maillot suivant est porté par le premier coureur
 * encore disponible dans le classement concerné.
 */
export function assignStageRaceJerseys(
  standings: StageRaceJerseyStandings | null
): StageRaceJerseyAssignments {
  if (!standings) return {};

  const assignments: StageRaceJerseyAssignments = {};
  const assignedRiderIds = new Set<string>();
  const classifications: Array<{
    jersey: StageRaceJerseyType;
    rows: ReadonlyArray<{ riderId: string }>;
  }> = [
    { jersey: "general", rows: standings.general },
    { jersey: "sprint", rows: standings.sprint },
    { jersey: "mountain", rows: standings.mountain },
    { jersey: "youth", rows: standings.youth },
  ];

  for (const classification of classifications) {
    const wearer = classification.rows.find(
      (row) => !assignedRiderIds.has(row.riderId)
    );
    if (!wearer) continue;
    assignments[classification.jersey] = wearer.riderId;
    assignedRiderIds.add(wearer.riderId);
  }

  return assignments;
}

export function getStageRaceJerseyByRiderId(
  assignments: StageRaceJerseyAssignments
) {
  const byRiderId = new Map<string, StageRaceJerseyType>();
  for (const jersey of STAGE_RACE_JERSEY_TYPES) {
    const riderId = assignments[jersey];
    if (riderId) byRiderId.set(riderId, jersey);
  }
  return byRiderId;
}