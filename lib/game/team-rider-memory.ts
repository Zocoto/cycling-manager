export type TeamRiderMemoryEntry = {
  id: string;
  firstName: string;
  lastName: string;
  countryName: string;
  countryCode: string;
  avatarProfileKey: string;
  avatarSeed: number | string;
  age: number | null;
  firstSeasonName: string;
  firstGameYear: number;
  lastSeasonName: string;
  lastGameYear: number;
  seasonsCount: number;
  isCurrent: boolean;
  isArchived: boolean;
  retirementSeasonName: string | null;
};

export type TeamRiderMemorySeason = {
  gameYear: number;
  seasonName: string;
  riders: TeamRiderMemoryEntry[];
};

export function groupFormerTeamRidersByDepartureSeason(
  riders: readonly TeamRiderMemoryEntry[],
  currentGameYear: number,
): TeamRiderMemorySeason[] {
  const seasons = new Map<number, TeamRiderMemorySeason>();

  for (const rider of riders) {
    if (rider.isCurrent || rider.lastGameYear >= currentGameYear) continue;

    const season = seasons.get(rider.lastGameYear) ?? {
      gameYear: rider.lastGameYear,
      seasonName: rider.lastSeasonName,
      riders: [],
    };
    season.riders.push(rider);
    seasons.set(rider.lastGameYear, season);
  }

  return [...seasons.values()]
    .map((season) => ({
      ...season,
      riders: [...season.riders].sort(
        (left, right) =>
          left.lastName.localeCompare(right.lastName, "fr") ||
          left.firstName.localeCompare(right.firstName, "fr"),
      ),
    }))
    .sort((left, right) => right.gameYear - left.gameYear);
}
