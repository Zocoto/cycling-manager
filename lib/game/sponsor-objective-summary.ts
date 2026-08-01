export type SponsorObjectiveSummary = {
  completed: number;
  total: number;
};

export function summarizeSponsorObjectiveStatuses(
  statuses: readonly string[],
): SponsorObjectiveSummary {
  return {
    completed: statuses.filter((status) => status === "achieved").length,
    total: statuses.length,
  };
}
