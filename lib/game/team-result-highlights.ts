import type {
  RaceCategoryCode,
  RaceCompetitionType,
  RaceFormat,
} from "@/lib/game/race-calendar";

export type TeamResultKind = "race" | "stage" | "classification";

export type TeamSecondaryClassificationType =
  | "mountain"
  | "sprint"
  | "youth"
  | "team";

export type TeamResultCandidate = {
  id: string;
  kind: TeamResultKind;
  seasonId: string;
  dayNumber: number;
  calendarDate: string;
  raceName: string;
  raceSlug: string;
  raceFormat: RaceFormat;
  categoryCode: RaceCategoryCode;
  prestigeRank: number;
  competitionType: RaceCompetitionType;
  rank: number;
  riderName: string | null;
  stageNumber: number | null;
  stageName: string | null;
  classificationType: TeamSecondaryClassificationType | null;
};

export function isMajorTeamResult(result: TeamResultCandidate): boolean {
  const isChampionship = result.competitionType !== "standard";

  if (result.kind === "race") {
    if (result.rank === 1) return true;
    if (isChampionship) return result.rank <= 3;
    if (result.categoryCode === "elite") return result.rank <= 5;
    if (result.categoryCode === "world") return result.rank <= 3;
    return false;
  }

  if (result.kind === "stage") {
    return (
      result.rank === 1 &&
      (result.categoryCode === "elite" || result.categoryCode === "world")
    );
  }

  return (
    result.rank === 1 &&
    (result.categoryCode === "elite" || result.categoryCode === "world")
  );
}

export function selectSeasonTeamPalmares(
  candidates: TeamResultCandidate[],
  limit = 5
): TeamResultCandidate[] {
  return candidates
    .filter(isMajorTeamResult)
    .sort(compareByImportance)
    .slice(0, Math.max(0, limit));
}

export function selectRecentMajorTeamResults({
  candidates,
  activeSeasonId,
  currentDayNumber,
  windowDays = 7,
  limit = 10,
}: {
  candidates: TeamResultCandidate[];
  activeSeasonId: string;
  currentDayNumber: number;
  windowDays?: number;
  limit?: number;
}): TeamResultCandidate[] {
  const firstDayNumber = Math.max(1, currentDayNumber - windowDays + 1);

  return candidates
    .filter(
      (candidate) =>
        candidate.seasonId === activeSeasonId &&
        candidate.dayNumber >= firstDayNumber &&
        candidate.dayNumber <= currentDayNumber &&
        isMajorTeamResult(candidate)
    )
    .sort(
      (left, right) =>
        right.dayNumber - left.dayNumber || compareByImportance(left, right)
    )
    .slice(0, Math.max(0, limit));
}

export function countTeamVictories(candidates: TeamResultCandidate[]): number {
  return candidates.filter(
    (candidate) =>
      candidate.rank === 1 &&
      (candidate.kind === "race" || candidate.kind === "stage")
  ).length;
}

function compareByImportance(
  left: TeamResultCandidate,
  right: TeamResultCandidate
): number {
  return (
    getResultImportance(right) - getResultImportance(left) ||
    right.dayNumber - left.dayNumber ||
    left.raceName.localeCompare(right.raceName, "fr")
  );
}

function getResultImportance(result: TeamResultCandidate): number {
  const kindScore =
    result.kind === "race" ? 30 : result.kind === "stage" ? 20 : 10;
  const rankScore = result.rank === 1 ? 80 : Math.max(0, 55 - result.rank * 5);
  const prestigeScore = Math.max(0, 5 - result.prestigeRank) * 12;
  const championshipScore = result.competitionType === "standard" ? 0 : 18;
  const tourScore = result.raceFormat === "stage_race" ? 4 : 0;

  return kindScore + rankScore + prestigeScore + championshipScore + tourScore;
}
