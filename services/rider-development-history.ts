import "server-only";

import { buildJuniorDevelopmentCareerHistory } from "@/lib/game/development-rider-career-history";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RiderDevelopmentHistorySeason = {
  id: string;
  name: string;
  gameYear: number;
};

export type RiderDevelopmentHistoryEntry = {
  seasonId: string;
  seasonName: string;
  gameYear: number;
  teamId: string;
  teamName: string;
  transferFee: null;
  currencyCode: "EUR";
  joinedDayNumber: 1;
  leftDayNumber: null;
  victories: number;
  points: number;
  uciRank: null;
  nationalTitles: [];
  worldTitles: [];
  continentalTitles: [];
  notablePerformances: ReturnType<
    typeof buildJuniorDevelopmentCareerHistory
  >[number]["notablePerformances"];
  careerLevel: "junior";
  juniorRaceCount: number;
  juniorPodiums: number;
};

type DevelopmentMembershipRow = {
  development_team_id: string | null;
  team_id: string;
  season_id: string;
  development_team_name: string;
};

type DevelopmentResultRow = {
  race_edition_id: string;
  development_team_id: string | null;
  result_scope: "stage" | "general";
  rank: number;
  points: number;
};

type DevelopmentEditionRow = {
  id: string;
  season_id: string;
  name: string;
  race_format: "one_day" | "stage_race";
};

/**
 * Charge la carrière junior depuis la mémoire d'affiliation durable. Les
 * résultats complètent les statistiques, mais ne décident plus à eux seuls si
 * un coureur a réellement appartenu à une Development Team.
 */
export async function getRiderDevelopmentHistory({
  supabase,
  riderId,
  seasons,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  riderId: string;
  seasons: RiderDevelopmentHistorySeason[];
}): Promise<RiderDevelopmentHistoryEntry[]> {
  const academyRiderResult = await supabase
    .from("youth_academy_riders")
    .select("id")
    .eq("promoted_rider_id", riderId)
    .maybeSingle<{ id: string }>();
  assertQuery(
    academyRiderResult.error,
    "le parcours junior du coureur professionnel",
  );
  if (!academyRiderResult.data) return [];

  const [membershipsResult, resultsResult] = await Promise.all([
    supabase
      .from("rider_development_team_history")
      .select(
        "development_team_id, team_id, season_id, development_team_name",
      )
      .eq("academy_rider_id", academyRiderResult.data.id)
      .returns<DevelopmentMembershipRow[]>(),
    supabase
      .from("development_race_results")
      .select(
        "race_edition_id, development_team_id, result_scope, rank, points",
      )
      .eq("academy_rider_id", academyRiderResult.data.id)
      .returns<DevelopmentResultRow[]>(),
  ]);
  assertQuery(
    membershipsResult.error,
    "les affiliations Development Team du coureur",
  );
  assertQuery(resultsResult.error, "le bilan de courses junior du coureur");

  const memberships = membershipsResult.data ?? [];
  if (!memberships.length) return [];

  const developmentResults = resultsResult.data ?? [];
  const editionIds = [
    ...new Set(developmentResults.map((result) => result.race_edition_id)),
  ];
  const editionsResult = editionIds.length
    ? await supabase
        .from("development_race_editions")
        .select("id, season_id, name, race_format")
        .in("id", editionIds)
        .returns<DevelopmentEditionRow[]>()
    : { data: [] as DevelopmentEditionRow[], error: null };
  assertQuery(
    editionsResult.error,
    "les épreuves Development Team du coureur",
  );

  return buildJuniorDevelopmentCareerHistory({
    seasons,
    teams: memberships.map((membership) => ({
      id:
        membership.development_team_id ??
        `${membership.team_id}:${membership.season_id}`,
      teamId: membership.team_id,
      seasonId: membership.season_id,
      displayName: membership.development_team_name,
    })),
    membershipTeamIds: memberships.map(
      (membership) =>
        membership.development_team_id ??
        `${membership.team_id}:${membership.season_id}`,
    ),
    editions: (editionsResult.data ?? []).map((edition) => ({
      id: edition.id,
      seasonId: edition.season_id,
      name: edition.name,
      raceFormat: edition.race_format,
    })),
    results: developmentResults.map((result) => ({
      raceEditionId: result.race_edition_id,
      developmentTeamId: result.development_team_id,
      resultScope: result.result_scope,
      rank: result.rank,
      points: result.points,
    })),
  }).map((entry) => ({
    ...entry,
    transferFee: null,
    currencyCode: "EUR" as const,
    joinedDayNumber: 1 as const,
    leftDayNumber: null,
    uciRank: null,
    nationalTitles: [] as [],
    worldTitles: [] as [],
    continentalTitles: [] as [],
    careerLevel: "junior" as const,
  }));
}

function assertQuery(
  error: { message: string } | null,
  resourceName: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resourceName} : ${error.message}`);
  }
}
