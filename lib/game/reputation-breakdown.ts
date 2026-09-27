import {
  getAvailableReputation,
  getNextReputationTier,
  getReputationTier,
} from "@/lib/game/reputation";

export type ReputationGainRow = {
  source_type: string;
  reputation_points: number | string;
  description: string;
  created_at: string;
};

export type ReputationBreakdownItem = {
  key: string;
  label: string;
  points: number;
};

export type ReputationRecentGain = {
  description: string;
  points: number;
};

export type SportingDirectorReputationBreakdown = {
  items: ReputationBreakdownItem[];
  recentGains: ReputationRecentGain[];
  totalGains: number;
  totalLosses: number;
  currentPoints: number;
  committedPoints: number;
  availablePoints: number;
  peakPoints: number;
  tierLabel: string;
  nextTierLabel: string | null;
  nextTierMinimum: number | null;
};

const REPUTATION_SOURCE_CATEGORIES: Record<
  string,
  { key: string; label: string; order: number }
> = {
  race_result: {
    key: "race-results",
    label: "R\u00e9sultats en course",
    order: 10,
  },
  stage_result: {
    key: "race-results",
    label: "R\u00e9sultats en course",
    order: 10,
  },
  mountain_prime: {
    key: "race-results",
    label: "R\u00e9sultats en course",
    order: 10,
  },
  intermediate_sprint: {
    key: "race-results",
    label: "R\u00e9sultats en course",
    order: 10,
  },
  secondary_classification: {
    key: "race-results",
    label: "R\u00e9sultats en course",
    order: 10,
  },
  game_objective: {
    key: "career-objectives",
    label: "Objectifs de carri\u00e8re",
    order: 20,
  },
  sponsor_objective: {
    key: "sponsor-objectives",
    label: "Objectifs sponsor",
    order: 30,
  },
  division_bonus: {
    key: "division-bonuses",
    label: "Bonus de division",
    order: 40,
  },
  special_ability: {
    key: "race-actions",
    label: "Actions en course",
    order: 50,
  },
  pre_race_press: {
    key: "public-commitments",
    label: "Engagements publics",
    order: 60,
  },
  reputation_commitment: {
    key: "public-commitments",
    label: "Engagements publics",
    order: 60,
  },
  reputation_spend: {
    key: "reputation-investments",
    label: "Investissements de réputation",
    order: 70,
  },
  season_maintenance: {
    key: "reputation-maintenance",
    label: "Maintien de la notoriété",
    order: 80,
  },
};

const OTHER_GAINS_CATEGORY = {
  key: "other-gains",
  label: "Autres gains",
  order: 90,
};

export function buildSportingDirectorReputationBreakdown(
  rows: ReputationGainRow[],
  currentPoints: number,
  options: {
    committedPoints?: number;
    peakPoints?: number;
  } = {},
): SportingDirectorReputationBreakdown {
  const categoryTotals = new Map<
    string,
    { key: string; label: string; order: number; points: number }
  >();

  const normalizedRows = rows
    .map((row) => ({
      ...row,
      points: normalizePoints(row.reputation_points),
    }))
    .filter((row) => row.points !== 0);

  for (const row of normalizedRows) {
    const category =
      REPUTATION_SOURCE_CATEGORIES[row.source_type] ?? OTHER_GAINS_CATEGORY;
    const currentCategory = categoryTotals.get(category.key);

    categoryTotals.set(category.key, {
      ...category,
      points: roundPoints((currentCategory?.points ?? 0) + row.points),
    });
  }

  const totalGains = roundPoints(
    normalizedRows.reduce(
      (total, row) => total + (row.points > 0 ? row.points : 0),
      0,
    ),
  );
  const totalLosses = roundPoints(
    normalizedRows.reduce(
      (total, row) => total + (row.points < 0 ? Math.abs(row.points) : 0),
      0,
    ),
  );
  const safeCurrentPoints = roundPoints(Math.max(0, currentPoints));
  const recordedNet = roundPoints(totalGains - totalLosses);
  const adjustment = roundPoints(safeCurrentPoints - recordedNet);
  const committedPoints = roundPoints(Math.max(0, options.committedPoints ?? 0));
  const peakPoints = roundPoints(
    Math.max(safeCurrentPoints, options.peakPoints ?? safeCurrentPoints),
  );
  const tier = getReputationTier(safeCurrentPoints);
  const nextTier = getNextReputationTier(safeCurrentPoints);

  if (adjustment !== 0) {
    categoryTotals.set("adjustments", {
      key: "adjustments",
      label:
        adjustment < 0
          ? "P\u00e9nalit\u00e9s et ajustements"
          : "R\u00e9putation initiale et ajustements",
      order: 100,
      points: adjustment,
    });
  }

  return {
    items: [...categoryTotals.values()]
      .sort(
        (left, right) =>
          left.order - right.order ||
          left.label.localeCompare(right.label, "fr"),
      )
      .map(({ key, label, points }) => ({ key, label, points })),
    recentGains: normalizedRows.slice(0, 4).map((row) => ({
      description: row.description,
      points: row.points,
    })),
    totalGains,
    totalLosses,
    currentPoints: safeCurrentPoints,
    committedPoints,
    availablePoints: getAvailableReputation(safeCurrentPoints, committedPoints),
    peakPoints,
    tierLabel: tier.label,
    nextTierLabel: nextTier?.label ?? null,
    nextTierMinimum: nextTier?.minimum ?? null,
  };
}

function normalizePoints(value: number | string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? roundPoints(parsed) : 0;
}

function roundPoints(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
