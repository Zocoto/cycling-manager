export const YOUTH_SCOUTING_REPORT_ARCHIVE_DELAY_MS =
  3 * 24 * 60 * 60 * 1_000;

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
  now: Date = new Date(),
): boolean {
  if (mission.status !== "completed") {
    return false;
  }

  if (areAllYouthScoutingCandidatesRecruited(mission)) return true;

  if (!mission.viewedAt) return false;

  const viewedAtTimestamp = new Date(mission.viewedAt).getTime();
  const elapsedMs = now.getTime() - viewedAtTimestamp;

  return (
    Number.isFinite(viewedAtTimestamp) &&
    elapsedMs >= YOUTH_SCOUTING_REPORT_ARCHIVE_DELAY_MS
  );
}
