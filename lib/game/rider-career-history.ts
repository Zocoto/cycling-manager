import { shortlistNotablePerformances } from "@/lib/game/rider-notable-performances";
import type { PublicRiderProfile } from "@/services/public-rider-profile";

type RiderCareerHistoryEntry = PublicRiderProfile["history"][number];

export type RiderCareerTeamPeriod = Pick<
  RiderCareerHistoryEntry,
  | "teamId"
  | "teamName"
  | "transferFee"
  | "currencyCode"
  | "joinedDayNumber"
  | "leftDayNumber"
>;

export type RiderCareerSeasonHistory = Omit<
  RiderCareerHistoryEntry,
  | "teamId"
  | "teamName"
  | "transferFee"
  | "currencyCode"
  | "joinedDayNumber"
  | "leftDayNumber"
> & {
  teams: RiderCareerTeamPeriod[];
};

/**
 * Les récompenses sont ventilées par équipe en cas de transfert. Cette vue les
 * réunit à nouveau afin que la carrière conserve une seule ligne par saison.
 */
export function groupRiderCareerHistoryBySeason(
  history: PublicRiderProfile["history"],
): RiderCareerSeasonHistory[] {
  const entriesBySeason = new Map<string, RiderCareerHistoryEntry[]>();

  for (const entry of history) {
    const entries = entriesBySeason.get(entry.seasonId) ?? [];
    entries.push(entry);
    entriesBySeason.set(entry.seasonId, entries);
  }

  return [...entriesBySeason.values()]
    .map((entries) => mergeSeasonEntries(entries))
    .sort((left, right) => right.gameYear - left.gameYear);
}

function mergeSeasonEntries(
  entries: RiderCareerHistoryEntry[],
): RiderCareerSeasonHistory {
  const first = entries[0]!;
  const professionalEntry = entries.find(
    (entry) => entry.careerLevel === "professional",
  );
  const affiliations = new Map<string, RiderCareerTeamPeriod>();

  for (const entry of entries) {
    const key = entry.teamId ?? `free-agent:${entry.teamName}`;
    const current = affiliations.get(key);
    const team = toTeamPeriod(entry);

    if (!current) {
      affiliations.set(key, team);
      continue;
    }

    affiliations.set(key, {
      ...current,
      transferFee: current.transferFee ?? team.transferFee,
      currencyCode:
        current.transferFee !== null ? current.currencyCode : team.currencyCode,
      joinedDayNumber: earliestDay(
        current.joinedDayNumber,
        team.joinedDayNumber,
      ),
      leftDayNumber: latestDay(current.leftDayNumber, team.leftDayNumber),
    });
  }

  return {
    seasonId: first.seasonId,
    seasonName: first.seasonName,
    gameYear: first.gameYear,
    teams: [...affiliations.values()].sort(compareTeamPeriods),
    victories: sumNullable(entries.map((entry) => entry.victories)),
    points: sumNullable(entries.map((entry) => entry.points)),
    uciRank:
      professionalEntry?.uciRank ??
      entries.find((entry) => entry.uciRank !== null)?.uciRank ??
      null,
    nationalTitles: uniqueBy(
      entries.flatMap((entry) => entry.nationalTitles),
      (title) => `${title.type}:${title.countryCode}`,
    ),
    worldTitles: uniqueBy(
      entries.flatMap((entry) => entry.worldTitles),
      (title) => title.type,
    ),
    continentalTitles: uniqueBy(
      entries.flatMap((entry) => entry.continentalTitles),
      (title) => `${title.type}:${title.continentCode}`,
    ),
    notablePerformances: shortlistNotablePerformances(
      uniqueBy(
        entries.flatMap((entry) => entry.notablePerformances),
        (performance) => performance.raceEditionId,
      ),
    ),
    careerLevel: professionalEntry ? "professional" : "junior",
    juniorRaceCount: sumNullable(
      entries.map((entry) => entry.juniorRaceCount),
    ),
    juniorPodiums: sumNullable(entries.map((entry) => entry.juniorPodiums)),
  };
}

function toTeamPeriod(entry: RiderCareerHistoryEntry): RiderCareerTeamPeriod {
  return {
    teamId: entry.teamId,
    teamName: entry.teamName,
    transferFee: entry.transferFee,
    currencyCode: entry.currencyCode,
    joinedDayNumber: entry.joinedDayNumber,
    leftDayNumber: entry.leftDayNumber,
  };
}

function compareTeamPeriods(
  left: RiderCareerTeamPeriod,
  right: RiderCareerTeamPeriod,
) {
  return (
    (left.joinedDayNumber ?? 1) - (right.joinedDayNumber ?? 1) ||
    (left.leftDayNumber ?? Number.MAX_SAFE_INTEGER) -
      (right.leftDayNumber ?? Number.MAX_SAFE_INTEGER) ||
    left.teamName.localeCompare(right.teamName, "fr")
  );
}

function sumNullable(values: Array<number | null>) {
  const numericValues = values.filter((value): value is number => value !== null);
  return numericValues.length > 0
    ? numericValues.reduce((total, value) => total + value, 0)
    : null;
}

function earliestDay(left: number | null, right: number | null) {
  if (left === null) return right;
  if (right === null) return left;
  return Math.min(left, right);
}

function latestDay(left: number | null, right: number | null) {
  if (left === null) return right;
  if (right === null) return left;
  return Math.max(left, right);
}

function uniqueBy<T>(values: T[], getKey: (value: T) => string) {
  return [...new Map(values.map((value) => [getKey(value), value])).values()];
}
