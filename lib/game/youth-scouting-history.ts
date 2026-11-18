import type { YouthScoutingCandidateStatus } from "./youth-scouting-candidate-age";

type YouthScoutingMissionArchiveCandidate = {
  status: "active" | "completed" | "cancelled";
  viewedAt: string | null;
  candidates: ReadonlyArray<{ status: YouthScoutingCandidateStatus }>;
};

export function isYouthScoutingCandidateReviewed(status: YouthScoutingCandidateStatus) {
  return status === "signed" || status === "rejected";
}

export function isYouthScoutingMissionArchived(
  mission: YouthScoutingMissionArchiveCandidate,
): boolean {
  if (mission.status !== "completed") {
    return false;
  }

  return mission.candidates.length
    ? mission.candidates.every(({ status }) => isYouthScoutingCandidateReviewed(status))
    : mission.viewedAt !== null;
}
