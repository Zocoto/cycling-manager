export type YouthScoutingCandidateStatus = "spotted" | "signed" | "rejected" | "expired";

/** The stored age belongs to the mission's season, not the season of reading. */
export function getYouthScoutingCandidateAge({
  reportedAge,
  reportGameYear,
  currentGameYear,
}: {
  reportedAge: number;
  reportGameYear: number;
  currentGameYear: number;
}): number {
  return reportedAge + currentGameYear - reportGameYear;
}

export function getYouthScoutingCandidateStatus(
  status: YouthScoutingCandidateStatus,
  age: number,
): YouthScoutingCandidateStatus {
  return status === "spotted" && age > 18 ? "expired" : status;
}
