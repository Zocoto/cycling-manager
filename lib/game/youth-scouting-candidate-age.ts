type CandidateStatus = "spotted" | "signed" | "expired";

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

export function getYouthScoutingCandidateStatus(status: CandidateStatus, age: number): CandidateStatus {
  // Keep historical recruitments and explicit unavailability unchanged.
  return status === "spotted" && age > 18 ? "expired" : status;
}
