export const FEDERATION_HOSTING_APPLICATION_CLOSE_DAY = 20;
export const FEDERATION_HOSTING_DECISION_DAY = 21;

export const FEDERATION_HOSTING_EVENTS = [
  {
    type: "world_championship_pro",
    riderCategory: "professional",
    label: "Championnats du monde professionnels",
    shortLabel: "CM Pro",
    hostingCost: 3_500_000,
    baseAttendance: 240_000,
    revenuePerAttendee: 18,
    prestigeGain: 60,
  },
  {
    type: "continental_championship_pro",
    riderCategory: "professional",
    label: "Championnats continentaux professionnels",
    shortLabel: "CC Pro",
    hostingCost: 1_800_000,
    baseAttendance: 130_000,
    revenuePerAttendee: 16,
    prestigeGain: 35,
  },
  {
    type: "nations_cup_pro",
    riderCategory: "professional",
    label: "Nations Cup professionnelle",
    shortLabel: "NC Pro",
    hostingCost: 2_400_000,
    baseAttendance: 180_000,
    revenuePerAttendee: 17,
    prestigeGain: 45,
  },
  {
    type: "world_championship_junior",
    riderCategory: "junior",
    label: "Championnats du monde juniors",
    shortLabel: "CM Junior",
    hostingCost: 1_200_000,
    baseAttendance: 90_000,
    revenuePerAttendee: 13,
    prestigeGain: 25,
  },
  {
    type: "continental_championship_junior",
    riderCategory: "junior",
    label: "Championnats continentaux juniors",
    shortLabel: "CC Junior",
    hostingCost: 700_000,
    baseAttendance: 50_000,
    revenuePerAttendee: 12,
    prestigeGain: 15,
  },
  {
    type: "nations_cup_junior",
    riderCategory: "junior",
    label: "Nations Cup juniors",
    shortLabel: "NC Junior",
    hostingCost: 550_000,
    baseAttendance: 45_000,
    revenuePerAttendee: 11,
    prestigeGain: 12,
  },
] as const;

export type FederationHostingEventType =
  (typeof FEDERATION_HOSTING_EVENTS)[number]["type"];

export type FederationHostingRiderCategory =
  (typeof FEDERATION_HOSTING_EVENTS)[number]["riderCategory"];

export type FederationHostingSelectionScore = {
  recencyPoints: number;
  rankingPoints: number;
  renownPoints: number;
  total: number;
};

export type FederationHostingAttendance = {
  attendance: number;
  grossRevenue: number;
  netReturn: number;
};

export function getFederationHostingEvent(
  type: FederationHostingEventType,
) {
  return FEDERATION_HOSTING_EVENTS.find((event) => event.type === type)!;
}

export function calculateFederationHostingSelectionScore({
  targetGameYear,
  lastHostedGameYear,
  nationRank,
  renown,
}: {
  targetGameYear: number;
  lastHostedGameYear: number | null;
  nationRank: number | null;
  renown: number;
}): FederationHostingSelectionScore {
  const seasonsSinceHosting =
    lastHostedGameYear == null
      ? 8
      : Math.max(0, targetGameYear - lastHostedGameYear - 1);
  const recencyPoints = Math.min(600, seasonsSinceHosting * 75);
  const normalizedRank = Math.max(1, Math.min(173, nationRank ?? 173));
  const rankingPoints = Math.round(((174 - normalizedRank) / 173) * 250);
  const renownPoints = Math.round(
    (Math.max(0, Math.min(1_000, renown)) / 1_000) * 150,
  );
  return {
    recencyPoints,
    rankingPoints,
    renownPoints,
    total: recencyPoints + rankingPoints + renownPoints,
  };
}

export function calculateFederationHostingAttendance({
  eventType,
  participationRate,
  renown,
}: {
  eventType: FederationHostingEventType;
  participationRate: number;
  renown: number;
}): FederationHostingAttendance {
  const event = getFederationHostingEvent(eventType);
  const participationMultiplier =
    0.6 + Math.max(0, Math.min(1, participationRate)) * 0.4;
  const renownMultiplier =
    0.75 + (Math.max(0, Math.min(1_000, renown)) / 1_000) * 0.5;
  const attendance = Math.round(
    event.baseAttendance * participationMultiplier * renownMultiplier,
  );
  const grossRevenue = attendance * event.revenuePerAttendee;
  return {
    attendance,
    grossRevenue,
    netReturn: grossRevenue - event.hostingCost,
  };
}

export function calculateFederationRaceReturn({
  categoryCode,
  completedStageCount,
  starterCount,
  officeLevel,
}: {
  categoryCode: string;
  completedStageCount: number;
  starterCount: number;
  officeLevel: number;
}): { money: number; prestige: number; kind: "money" | "mixed" } {
  const stageValue =
    categoryCode === "elite"
      ? 14_000
      : categoryCode === "world"
        ? 10_000
        : categoryCode === "continental"
          ? 7_000
          : categoryCode === "national"
            ? 4_000
            : 2_500;
  const prestigePerStage =
    categoryCode === "elite"
      ? 10
      : categoryCode === "world"
        ? 6
        : categoryCode === "continental"
          ? 3
          : 0;
  const fillMultiplier = 0.55 + Math.min(1, Math.max(0, starterCount) / 160) * 0.45;
  const officeMultiplier = 1 + Math.max(0, Math.min(5, officeLevel)) * 0.05;
  const stages = Math.max(0, Math.trunc(completedStageCount));
  const money = Math.round(
    (stages * stageValue * fillMultiplier * officeMultiplier) / 1_000,
  ) * 1_000;
  const prestige = stages * prestigePerStage;
  return {
    money,
    prestige,
    kind: prestige > 0 ? "mixed" : "money",
  };
}

export function getFederationRenownLabel(score: number): string {
  if (score >= 800) return "Nation mythique";
  if (score >= 600) return "Grande nation cycliste";
  if (score >= 400) return "Nation reconnue";
  if (score >= 200) return "Tradition émergente";
  return "Rayonnement local";
}
