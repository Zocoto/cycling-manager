export type RiderSecondaryPerformance =
  | "mountain"
  | "sprint"
  | "youth"
  | "team";

export type RiderNotablePerformance = {
  raceEditionId: string;
  raceName: string;
  uciPoints: number;
  labels: string[];
  finalRank: number | null;
};

export function buildNotablePerformanceLabels({
  finalRank,
  nationalChampionshipType,
  secondaryWins,
}: {
  finalRank: number | null;
  nationalChampionshipType: "road" | "time_trial" | null;
  secondaryWins: RiderSecondaryPerformance[];
}) {
  const labels: string[] = [];

  if (finalRank === 1 && nationalChampionshipType === "road") {
    labels.push("Champion national");
  } else if (
    finalRank === 1 &&
    nationalChampionshipType === "time_trial"
  ) {
    labels.push("Champion national CLM");
  } else if (finalRank === 1) {
    labels.push("Victoire");
  } else if (finalRank !== null && finalRank <= 3) {
    labels.push(`${finalRank}e place`);
  } else if (finalRank !== null && finalRank <= 5) {
    labels.push(`Top 5 · ${finalRank}e`);
  } else if (finalRank !== null && finalRank <= 10) {
    labels.push(`Top 10 · ${finalRank}e`);
  } else if (finalRank !== null) {
    labels.push(`${finalRank}e place`);
  }

  const secondaryLabels: Record<RiderSecondaryPerformance, string> = {
    mountain: "Meilleur grimpeur",
    sprint: "Classement par points",
    youth: "Meilleur jeune",
    team: "Classement par équipes",
  };

  for (const classification of secondaryWins) {
    const label = secondaryLabels[classification];
    if (!labels.includes(label)) labels.push(label);
  }

  return labels.length > 0 ? labels : ["Performance classée"];
}

export function shortlistNotablePerformances(
  performances: RiderNotablePerformance[],
  limit = 5
) {
  return [...performances]
    .sort(
      (left, right) =>
        right.uciPoints - left.uciPoints ||
        normalizeRank(left.finalRank) - normalizeRank(right.finalRank) ||
        left.raceName.localeCompare(right.raceName, "fr")
    )
    .slice(0, Math.max(0, limit));
}

export function formatSeasonPerformanceButtonLabel({
  seasonName,
  gameYear,
}: {
  seasonName: string;
  gameYear: number;
}) {
  const seasonNumber = seasonName.match(/\d+/)?.[0] ?? String(gameYear);
  return `Performances S${seasonNumber}`;
}

function normalizeRank(rank: number | null) {
  return rank ?? Number.MAX_SAFE_INTEGER;
}
