export const YOUTH_SCOUTING_REPORT_ARCHIVE_DELAY_MS =
  3 * 24 * 60 * 60 * 1_000;

type YouthScoutingMissionArchiveCandidate = {
  status: "active" | "completed" | "cancelled";
  viewedAt: string | null;
};

export function isYouthScoutingMissionArchived(
  mission: YouthScoutingMissionArchiveCandidate,
  now: Date = new Date(),
): boolean {
  if (mission.status !== "completed" || !mission.viewedAt) {
    return false;
  }

  const viewedAtTimestamp = new Date(mission.viewedAt).getTime();
  const elapsedMs = now.getTime() - viewedAtTimestamp;

  return (
    Number.isFinite(viewedAtTimestamp) &&
    elapsedMs >= YOUTH_SCOUTING_REPORT_ARCHIVE_DELAY_MS
  );
}
