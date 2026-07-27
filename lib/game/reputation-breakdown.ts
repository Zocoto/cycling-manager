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
  currentPoints: number;
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
};

const OTHER_GAINS_CATEGORY = {
  key: "other-gains",
  label: "Autres gains",
  order: 90,
};

export function buildSportingDirectorReputationBreakdown(
  rows: ReputationGainRow[],
  currentPoints: number,
): SportingDirectorReputationBreakdown {
  const categoryTotals = new Map<
    string,
    { key: string; label: string; order: number; points: number }
  >();

  const positiveRows = rows
    .map((row) => ({
      ...row,
      points: normalizePoints(row.reputation_points),
    }))
    .filter((row) => row.points > 0);

  for (const row of positiveRows) {
    const category =
      REPUTATION_SOURCE_CATEGORIES[row.source_type] ?? OTHER_GAINS_CATEGORY;
    const currentCategory = categoryTotals.get(category.key);

    categoryTotals.set(category.key, {
      ...category,
      points: roundPoints((currentCategory?.points ?? 0) + row.points),
    });
  }

  const totalGains = roundPoints(
    positiveRows.reduce((total, row) => total + row.points, 0),
  );
  const safeCurrentPoints = roundPoints(Math.max(0, currentPoints));
  const adjustment = roundPoints(safeCurrentPoints - totalGains);

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
    recentGains: positiveRows.slice(0, 3).map((row) => ({
      description: row.description,
      points: row.points,
    })),
    totalGains,
    currentPoints: safeCurrentPoints,
  };
}

function normalizePoints(value: number | string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? roundPoints(parsed) : 0;
}

function roundPoints(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
