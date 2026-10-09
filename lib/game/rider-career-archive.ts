export type RiderArchiveReason =
  | "no_team"
  | "no_race"
  | "no_team_and_no_race"
  | "two_seasons_without_team";

export const RIDER_ARCHIVE_REASON_LABELS: Record<RiderArchiveReason, string> = {
  no_team: "Saison complète sans équipe",
  no_race: "Saison complète sans course disputée",
  no_team_and_no_race: "Saison complète sans équipe ni course disputée",
  two_seasons_without_team: "Deux saisons complètes consécutives sans équipe",
};

export function getRiderArchiveReason({
  existedAtSeasonStart,
  hasTeam,
  hasRaceParticipation,
  consecutiveFullSeasonsWithoutTeam = 0,
  hasFreeAgentUciPoints = false,
}: {
  existedAtSeasonStart: boolean;
  hasTeam: boolean;
  hasRaceParticipation: boolean;
  consecutiveFullSeasonsWithoutTeam?: number;
  hasFreeAgentUciPoints?: boolean;
}): RiderArchiveReason | null {
  // Race participation alone never retires a contracted rider. The legacy
  // labels remain available only to describe archives created under old rules.
  void hasRaceParticipation;
  if (!existedAtSeasonStart || hasTeam || hasFreeAgentUciPoints ||
    consecutiveFullSeasonsWithoutTeam < 2) {
    return null;
  }
  return "two_seasons_without_team";
}

export function isRiderArchiveReason(
  value: string,
): value is RiderArchiveReason {
  return value === "no_team" ||
    value === "no_race" ||
    value === "no_team_and_no_race" ||
    value === "two_seasons_without_team";
}
