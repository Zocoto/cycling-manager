import {
  buildNotablePerformanceLabels,
  shortlistNotablePerformances,
  type RiderNotablePerformance,
} from "@/lib/game/rider-notable-performances";

export type DevelopmentCareerSeason = {
  id: string;
  name: string;
  gameYear: number;
};

export type DevelopmentCareerTeam = {
  id: string;
  teamId: string;
  seasonId: string;
  displayName: string;
};

export type DevelopmentCareerEdition = {
  id: string;
  seasonId: string;
  name: string;
  raceFormat: "one_day" | "stage_race";
};

export type DevelopmentCareerResult = {
  raceEditionId: string;
  developmentTeamId: string | null;
  resultScope: "stage" | "general";
  rank: number;
  points: number;
};

export type JuniorDevelopmentCareerEntry = {
  seasonId: string;
  seasonName: string;
  gameYear: number;
  teamId: string;
  teamName: string;
  victories: number;
  points: number;
  juniorRaceCount: number;
  juniorPodiums: number;
  notablePerformances: RiderNotablePerformance[];
};

/**
 * Reconstruit le parcours junior depuis les résultats, qui restent conservés
 * après la suppression du coureur du roster actif lors de sa promotion.
 */
export function buildJuniorDevelopmentCareerHistory({
  seasons,
  teams,
  rosterTeamIds,
  editions,
  results,
}: {
  seasons: DevelopmentCareerSeason[];
  teams: DevelopmentCareerTeam[];
  rosterTeamIds: string[];
  editions: DevelopmentCareerEdition[];
  results: DevelopmentCareerResult[];
}): JuniorDevelopmentCareerEntry[] {
  const seasonById = new Map(seasons.map((season) => [season.id, season]));
  const editionById = new Map(
    editions.map((edition) => [edition.id, edition]),
  );
  const evidencedTeamIds = new Set(rosterTeamIds);
  const evidencedSeasonIds = new Set<string>();

  for (const result of results) {
    if (result.developmentTeamId) {
      evidencedTeamIds.add(result.developmentTeamId);
    }
    const edition = editionById.get(result.raceEditionId);
    if (edition) evidencedSeasonIds.add(edition.seasonId);
  }

  return teams
    .filter(
      (team) =>
        evidencedTeamIds.has(team.id) || evidencedSeasonIds.has(team.seasonId),
    )
    .flatMap((team) => {
      const season = seasonById.get(team.seasonId);
      if (!season) return [];

      const teamResults = results.filter((result) => {
        const edition = editionById.get(result.raceEditionId);
        if (!edition || edition.seasonId !== team.seasonId) return false;
        return (
          result.developmentTeamId === team.id ||
          result.developmentTeamId === null
        );
      });
      const generalResults = teamResults.filter(
        (result) => result.resultScope === "general",
      );
      const notablePerformances = generalResults.flatMap((result) => {
        const edition = editionById.get(result.raceEditionId);
        if (!edition) return [];
        const editionResults = teamResults.filter(
          (candidate) => candidate.raceEditionId === edition.id,
        );
        const stageWinCount =
          edition.raceFormat === "stage_race"
            ? editionResults.filter(
                (candidate) =>
                  candidate.resultScope === "stage" && candidate.rank === 1,
              ).length
            : 0;

        return [
          {
            raceEditionId: edition.id,
            raceName: edition.name,
            uciPoints: editionResults.reduce(
              (total, candidate) => total + candidate.points,
              0,
            ),
            labels: buildNotablePerformanceLabels({
              finalRank: result.rank,
              nationalChampionshipType: null,
              secondaryWins: [],
              stageWinCount,
              raceFormat: edition.raceFormat,
            }),
            finalRank: result.rank,
          },
        ];
      });

      return [
        {
          seasonId: season.id,
          seasonName: season.name,
          gameYear: season.gameYear,
          teamId: team.teamId,
          teamName: team.displayName,
          victories: generalResults.filter((result) => result.rank === 1)
            .length,
          points: teamResults.reduce(
            (total, result) => total + result.points,
            0,
          ),
          juniorRaceCount: new Set(
            generalResults.map((result) => result.raceEditionId),
          ).size,
          juniorPodiums: generalResults.filter((result) => result.rank <= 3)
            .length,
          notablePerformances: shortlistNotablePerformances(
            notablePerformances,
          ),
        },
      ];
    })
    .sort((left, right) => right.gameYear - left.gameYear);
}
