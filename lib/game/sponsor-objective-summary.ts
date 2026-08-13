export type SponsorObjectiveSummary = {
  completed: number;
  total: number;
  satisfactionScore: number;
  satisfactionMaximum: number;
};

export type SponsorObjectiveSummaryEntry = {
  status: string;
  satisfactionPoints: number;
};

export function summarizeSponsorObjectives(
  objectives: readonly SponsorObjectiveSummaryEntry[],
): SponsorObjectiveSummary {
  return {
    completed: objectives.filter(
      (objective) => objective.status === "achieved",
    ).length,
    total: objectives.length,
    satisfactionScore: objectives.reduce(
      (total, objective) =>
        total +
        (objective.status === "achieved"
          ? objective.satisfactionPoints
          : 0),
      0,
    ),
    satisfactionMaximum: objectives.reduce(
      (total, objective) => total + objective.satisfactionPoints,
      0,
    ),
  };
}

export function summarizeSponsorObjectiveStatuses(
  statuses: readonly string[],
): SponsorObjectiveSummary {
  return summarizeSponsorObjectives(
    statuses.map((status) => ({
      status,
      satisfactionPoints: 0,
    })),
  );
}
