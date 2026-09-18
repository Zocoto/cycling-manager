type YouthScoutingMissionArchiveCandidate = {
  status: "active" | "completed" | "cancelled";
  viewedAt: string | null;
  candidates?: ReadonlyArray<{
    status: "spotted" | "signed" | "expired";
  }>;
};

export function areAllYouthScoutingCandidatesRecruited(
  mission: Pick<YouthScoutingMissionArchiveCandidate, "candidates">,
): boolean {
  const candidates = mission.candidates;

  return Boolean(candidates?.length) && candidates!.every(
    (candidate) => candidate.status === "signed",
  );
}

export function isYouthScoutingMissionArchived(
  mission: YouthScoutingMissionArchiveCandidate,
): boolean {
  if (mission.status !== "completed") {
    return false;
  }

  if (areAllYouthScoutingCandidatesRecruited(mission)) return true;

  return mission.viewedAt !== null;
}
