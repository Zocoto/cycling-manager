import type {
  RaceCategoryCode,
  RaceCompetitionType,
} from "@/lib/game/race-calendar";

export const CAREER_PALMARES_CATEGORIES = [
  "grand_tour_monument",
  "elite",
  "world",
  "continental",
  "national",
  "regional",
  "junior",
] as const;

export type CareerPalmaresCategory =
  (typeof CAREER_PALMARES_CATEGORIES)[number];

export type CareerPalmaresEntry = {
  resultId: string;
  raceKey: string;
  raceName: string;
  seasonId: string;
  seasonName: string;
  gameYear: number;
  rank: number;
  categoryCode: RaceCategoryCode | null;
  competitionType: RaceCompetitionType | null;
  prestigeRank: number;
  isGrandTour: boolean;
  isMonument: boolean;
  isJunior: boolean;
};

export type CareerPalmaresAchievement = {
  id: string;
  raceKey: string;
  raceName: string;
  rank: 1 | 2 | 3;
  count: number;
  seasonLabels: string[];
};

export type CareerPalmaresSection = {
  category: CareerPalmaresCategory;
  achievements: CareerPalmaresAchievement[];
};

export type CareerPalmaresSupplementEntry = {
  resultId: string;
  raceKey: string;
  raceName: string;
  seasonId: string;
  seasonName: string;
  gameYear: number;
  prestigeRank: number;
};

export type CareerDistinctiveJerseyType = "mountain" | "sprint" | "youth";

export type CareerDistinctiveJerseyEntry = CareerPalmaresSupplementEntry & {
  classificationType: CareerDistinctiveJerseyType;
};

export type CareerStageVictoryAchievement = {
  id: string;
  raceKey: string;
  raceName: string;
  count: number;
  seasonLabels: string[];
};

export type CareerDistinctiveJerseyAchievement =
  CareerStageVictoryAchievement & {
    classificationType: CareerDistinctiveJerseyType;
  };

export type CareerPalmaresSupplements = {
  stageVictories?: readonly CareerPalmaresSupplementEntry[];
  distinctiveJerseys?: readonly CareerDistinctiveJerseyEntry[];
};

export type CareerPalmares = {
  victoryCount: number;
  podiumCount: number;
  stageVictoryCount: number;
  distinctiveJerseyCount: number;
  sections: CareerPalmaresSection[];
  stageVictories: CareerStageVictoryAchievement[];
  distinctiveJerseys: CareerDistinctiveJerseyAchievement[];
};

type AggregatedAchievement = CareerPalmaresAchievement & {
  prestigeRank: number;
  seasons: Map<string, { label: string; gameYear: number }>;
};

export function buildCareerPalmares(
  entries: readonly CareerPalmaresEntry[],
  supplements: CareerPalmaresSupplements = {},
): CareerPalmares {
  const podiumEntries = entries.filter(
    (entry): entry is CareerPalmaresEntry & { rank: 1 | 2 | 3 } =>
      entry.rank === 1 || entry.rank === 2 || entry.rank === 3,
  );
  const achievementsByCategory = new Map<
    CareerPalmaresCategory,
    Map<string, AggregatedAchievement>
  >();

  for (const entry of podiumEntries) {
    const category = resolveCareerPalmaresCategory(entry);
    if (!category) continue;

    const categoryAchievements =
      achievementsByCategory.get(category) ??
      new Map<string, AggregatedAchievement>();
    const achievementKey = `${entry.raceKey}:${entry.rank}`;
    const achievement = categoryAchievements.get(achievementKey) ?? {
      id: `${category}:${achievementKey}`,
      raceKey: entry.raceKey,
      raceName: entry.raceName,
      rank: entry.rank,
      count: 0,
      seasonLabels: [],
      prestigeRank: entry.prestigeRank,
      seasons: new Map<string, { label: string; gameYear: number }>(),
    };

    achievement.count += 1;
    achievement.prestigeRank = Math.min(
      achievement.prestigeRank,
      entry.prestigeRank,
    );
    achievement.seasons.set(entry.seasonId, {
      label: getCareerSeasonLabel(entry.seasonName, entry.gameYear),
      gameYear: entry.gameYear,
    });
    categoryAchievements.set(achievementKey, achievement);
    achievementsByCategory.set(category, categoryAchievements);
  }

  const sections = CAREER_PALMARES_CATEGORIES.flatMap<CareerPalmaresSection>(
    (category) => {
      const categoryAchievements = achievementsByCategory.get(category);
      if (!categoryAchievements?.size) return [];

      const achievements = [...categoryAchievements.values()]
        .map((achievement) => ({
          id: achievement.id,
          raceKey: achievement.raceKey,
          raceName: achievement.raceName,
          rank: achievement.rank,
          count: achievement.count,
          seasonLabels: [...achievement.seasons.values()]
            .sort(
              (left, right) =>
                left.gameYear - right.gameYear ||
                left.label.localeCompare(right.label, "fr"),
            )
            .map((season) => season.label),
        }))
        .sort((left, right) => {
          const leftSource = categoryAchievements.get(
            `${left.raceKey}:${left.rank}`,
          );
          const rightSource = categoryAchievements.get(
            `${right.raceKey}:${right.rank}`,
          );

          return (
            left.rank - right.rank ||
            (leftSource?.prestigeRank ?? 99) -
              (rightSource?.prestigeRank ?? 99) ||
            right.count - left.count ||
            left.raceName.localeCompare(right.raceName, "fr")
          );
        });

      return [{ category, achievements }];
    },
  );

  const stageVictories = aggregateSupplementEntries(
    supplements.stageVictories ?? [],
    (entry) => entry.raceKey,
  );
  const distinctiveJerseys = aggregateSupplementEntries(
    supplements.distinctiveJerseys ?? [],
    (entry) => `${entry.raceKey}:${entry.classificationType}`,
  );

  return {
    victoryCount: podiumEntries.filter((entry) => entry.rank === 1).length,
    podiumCount: podiumEntries.length,
    stageVictoryCount: supplements.stageVictories?.length ?? 0,
    distinctiveJerseyCount: supplements.distinctiveJerseys?.length ?? 0,
    sections,
    stageVictories: stageVictories.map(toStageVictoryAchievement),
    distinctiveJerseys: distinctiveJerseys.map((achievement) => ({
      ...toStageVictoryAchievement(achievement),
      classificationType: achievement.source.classificationType,
    })),
  };
}

type AggregatedSupplement<T extends CareerPalmaresSupplementEntry> =
  CareerStageVictoryAchievement & {
    prestigeRank: number;
    source: T;
    seasons: Map<string, { label: string; gameYear: number }>;
  };

function aggregateSupplementEntries<T extends CareerPalmaresSupplementEntry>(
  entries: readonly T[],
  getKey: (entry: T) => string,
): AggregatedSupplement<T>[] {
  const achievements = new Map<string, AggregatedSupplement<T>>();

  for (const entry of entries) {
    const key = getKey(entry);
    const achievement = achievements.get(key) ?? {
      id: key,
      raceKey: entry.raceKey,
      raceName: entry.raceName,
      count: 0,
      seasonLabels: [],
      prestigeRank: entry.prestigeRank,
      source: entry,
      seasons: new Map<string, { label: string; gameYear: number }>(),
    };

    achievement.count += 1;
    achievement.prestigeRank = Math.min(
      achievement.prestigeRank,
      entry.prestigeRank,
    );
    achievement.seasons.set(entry.seasonId, {
      label: getCareerSeasonLabel(entry.seasonName, entry.gameYear),
      gameYear: entry.gameYear,
    });
    achievements.set(key, achievement);
  }

  return [...achievements.values()]
    .map((achievement) => ({
      ...achievement,
      seasonLabels: [...achievement.seasons.values()]
        .sort(
          (left, right) =>
            left.gameYear - right.gameYear ||
            left.label.localeCompare(right.label, "fr"),
        )
        .map((season) => season.label),
    }))
    .sort(
      (left, right) =>
        left.prestigeRank - right.prestigeRank ||
        right.count - left.count ||
        left.raceName.localeCompare(right.raceName, "fr"),
    );
}

function toStageVictoryAchievement(
  achievement: AggregatedSupplement<CareerPalmaresSupplementEntry>,
): CareerStageVictoryAchievement {
  return {
    id: achievement.id,
    raceKey: achievement.raceKey,
    raceName: achievement.raceName,
    count: achievement.count,
    seasonLabels: achievement.seasonLabels,
  };
}

export function getCareerSeasonLabel(
  seasonName: string,
  gameYear: number,
): string {
  const match = seasonName.match(/(\d+)\s*$/);
  return match ? `S${match[1]}` : `S${gameYear}`;
}

function resolveCareerPalmaresCategory(
  entry: CareerPalmaresEntry,
): CareerPalmaresCategory | null {
  if (entry.isJunior) return "junior";
  if (entry.isGrandTour || entry.isMonument) {
    return "grand_tour_monument";
  }

  if (entry.competitionType === "world_championship") return "world";
  if (entry.competitionType === "continental_championship") {
    return "continental";
  }
  if (
    entry.competitionType === "national_road" ||
    entry.competitionType === "national_time_trial"
  ) {
    return "national";
  }

  if (!entry.categoryCode) return null;
  return entry.categoryCode;
}
