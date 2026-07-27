export type RiderArchiveReason =
  | "no_team"
  | "no_race"
  | "no_team_and_no_race";

export const RIDER_ARCHIVE_REASON_LABELS: Record<RiderArchiveReason, string> = {
  no_team: "Saison complète sans équipe",
  no_race: "Saison complète sans course disputée",
  no_team_and_no_race: "Saison complète sans équipe ni course disputée",
};

export function getRiderArchiveReason({
  existedAtSeasonStart,
  hasTeam,
  hasRaceParticipation,
}: {
  existedAtSeasonStart: boolean;
  hasTeam: boolean;
  hasRaceParticipation: boolean;
}): RiderArchiveReason | null {
  if (!existedAtSeasonStart || (hasTeam && hasRaceParticipation)) {
    return null;
  }

  if (!hasTeam && !hasRaceParticipation) {
    return "no_team_and_no_race";
  }

  return hasTeam ? "no_race" : "no_team";
}

export function isRiderArchiveReason(
  value: string,
): value is RiderArchiveReason {
  return value === "no_team" ||
    value === "no_race" ||
    value === "no_team_and_no_race";
}