/** Whether a historical title can still provide a current champion jersey. */
export function isChampionshipTitleEligibleForCurrentNationality({
  championshipType,
  titleCountryId,
  riderCountryId,
  riderContinentCode,
}: {
  championshipType: string;
  titleCountryId?: string | null;
  riderCountryId?: string | null;
  riderContinentCode?: string | null;
}): boolean {
  if (championshipType === "road" || championshipType === "time_trial") {
    return Boolean(titleCountryId && riderCountryId === titleCountryId);
  }

  const continental =
    /^continental_(africa|america|asia|europe|oceania)_(road|time_trial)$/.exec(
      championshipType,
    );
  return continental ? continental[1] === riderContinentCode : true;
}

/** Embedded by current-title queries; never use this for frozen race snapshots. */
export type CurrentChampionshipRider = {
  country_id: string;
  country: { continent_code: string } | null;
} | null;
