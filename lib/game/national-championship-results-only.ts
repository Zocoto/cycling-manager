import type { RaceCompetitionType } from "./race-calendar";

export const NATIONAL_CHAMPIONSHIP_RESULTS_ONLY_FROM_GAME_YEAR = 2;
export const NATIONAL_CHAMPIONSHIP_RESULTS_ONLY_ENGINE_VERSION =
  "2026.08-national-championship-results-only-v1";

export function isNationalChampionshipCompetitionType(
  competitionType: RaceCompetitionType,
) {
  return (
    competitionType === "national_road" ||
    competitionType === "national_time_trial"
  );
}

export function shouldUseNationalChampionshipResultsOnly({
  gameYear,
  competitionType,
}: {
  gameYear: number;
  competitionType: RaceCompetitionType;
}) {
  return (
    gameYear >= NATIONAL_CHAMPIONSHIP_RESULTS_ONLY_FROM_GAME_YEAR &&
    isNationalChampionshipCompetitionType(competitionType)
  );
}
