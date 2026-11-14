import "server-only";

import { compactDataCache } from "@/lib/performance/compact-data-cache";

import { getFederationJuniorBirthYearRange } from "@/lib/game/federation-junior-eligibility";
import { projectYouthRating } from "@/lib/game/youth-training";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  collectChunkedPaginatedRows,
  collectPaginatedRows,
} from "@/lib/supabase/pagination";

export type FederationSelectionRider = {
  id: string;
  teamId: string | null;
  name: string;
  category: "professional" | "junior";
  juniorAffiliation: "cycling_school" | "development_team" | null;
  teamName: string;
  age: number;
  profile: "Montagne" | "Vallons" | "Sprint" | "Pavés" | "Chrono" | "Polyvalent";
  overall: number;
  ratings: {
    mountain: number;
    hills: number;
    flat: number;
    timeTrial: number;
    cobbles: number;
    sprint: number;
    acceleration: number;
    downhill: number;
    endurance: number;
    resistance: number;
    recovery: number;
    breakaway: number;
    prologue: number;
  };
};

type RiderRow = {
  id: string;
  first_name: string;
  last_name: string;
};
type RatingRow = {
  rider_id: string;
  age: number;
  mountain: number;
  hills: number;
  flat: number;
  time_trial: number;
  cobbles: number;
  sprint: number;
  acceleration: number;
  downhill: number;
  endurance: number;
  resistance: number;
  recovery: number;
  breakaway: number;
  prologue: number;
};
type ContractRow = { rider_id: string; team_id: string };
type TeamSeasonRow = { team_id: string; display_name: string };
type DevelopmentTeamRow = {
  id: string;
  team_id: string;
  display_name: string;
};
type DevelopmentRosterRow = {
  development_team_id: string;
  academy_rider_id: string;
};
type JuniorRow = {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  birth_game_year: number;
  mountain: number | string;
  hills: number | string;
  flat: number | string;
  time_trial: number | string;
  cobbles: number | string;
  sprint: number | string;
  acceleration: number | string;
  downhill: number | string;
  endurance: number | string;
  resistance: number | string;
  recovery: number | string;
  breakaway: number | string;
  prologue: number | string;
};

const SELECTION_PAGE_SIZE = 250;
const SELECTION_LOOKUP_OPTIONS = { chunkSize: 150, maxConcurrency: 3 };

const getCachedFederationSelectionPool = compactDataCache(
  (
    countryId: string,
    seasonId: string,
    gameYear: number,
  ) =>
    loadFederationSelectionPool({ countryId, seasonId, gameYear }),
  ["federation-selection-pool-v2"],
  { revalidate: 60, tags: ["federation-selection-pool"] },
);

export async function getFederationSelectionPool({
  countryId,
  seasonId,
  gameYear,
}: {
  countryId: string;
  seasonId: string;
  gameYear: number;
}): Promise<FederationSelectionRider[]> {
  return getCachedFederationSelectionPool(countryId, seasonId, gameYear);
}

async function loadFederationSelectionPool({
  countryId,
  seasonId,
  gameYear,
}: {
  countryId: string;
  seasonId: string;
  gameYear: number;
}): Promise<FederationSelectionRider[]> {
  const admin = createSupabaseAdminClient();
  const { minBirthGameYear, maxBirthGameYear } =
    getFederationJuniorBirthYearRange(gameYear);
  const [ridersResult, juniorsResult] = await Promise.all([
    collectPaginatedRows({
      pageSize: SELECTION_PAGE_SIZE,
      fetchPage: async (from, to) =>
        admin
          .from("riders")
          .select("id, first_name, last_name")
          .eq("country_id", countryId)
          .in("status", ["active", "free_agent"])
          .order("id")
          .range(from, to)
          .returns<RiderRow[]>(),
    }),
    collectPaginatedRows({
      pageSize: SELECTION_PAGE_SIZE,
      fetchPage: async (from, to) =>
        admin
          .from("youth_academy_riders")
          .select(
            "id, team_id, first_name, last_name, birth_game_year, mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue",
          )
          .eq("country_id", countryId)
          .in("status", ["active", "recruited"])
          .gte("birth_game_year", minBirthGameYear)
          .lte("birth_game_year", maxBirthGameYear)
          .order("id")
          .range(from, to)
          .returns<JuniorRow[]>(),
    }),
  ]);

  assertSelectionQuery(ridersResult.error, "les coureurs professionnels");
  assertSelectionQuery(juniorsResult.error, "les coureurs juniors");
  const riders = ridersResult.data;
  const juniors = juniorsResult.data;
  const riderIds = riders.map((rider) => rider.id);
  const juniorTeamIds = [...new Set(juniors.map((junior) => junior.team_id))];
  const juniorIds = juniors.map((junior) => junior.id);

  const [ratingsResult, contractsResult, developmentTeamsResult, developmentRosterResult] =
    await Promise.all([
      collectChunkedPaginatedRows({
        ...SELECTION_LOOKUP_OPTIONS,
        values: riderIds,
        fetchPage: async (ids, from, to) =>
          admin
            .from("rider_season_ratings")
            .select(
              "rider_id, age, mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue",
            )
            .eq("season_id", seasonId)
            .in("rider_id", ids)
            .order("rider_id")
            .range(from, to)
            .returns<RatingRow[]>(),
      }),
      collectChunkedPaginatedRows({
        ...SELECTION_LOOKUP_OPTIONS,
        values: riderIds,
        fetchPage: async (ids, from, to) =>
          admin
            .from("rider_contracts")
            .select("rider_id, team_id")
            .eq("status", "active")
            .in("rider_id", ids)
            .order("id")
            .range(from, to)
            .returns<ContractRow[]>(),
      }),
      collectChunkedPaginatedRows({
        ...SELECTION_LOOKUP_OPTIONS,
        values: juniorTeamIds,
        fetchPage: async (ids, from, to) =>
          admin
            .from("development_teams")
            .select("id, team_id, display_name")
            .eq("season_id", seasonId)
            .eq("status", "active")
            .in("team_id", ids)
            .order("id")
            .range(from, to)
            .returns<DevelopmentTeamRow[]>(),
      }),
      collectChunkedPaginatedRows({
        ...SELECTION_LOOKUP_OPTIONS,
        values: juniorIds,
        fetchPage: async (ids, from, to) =>
          admin
            .from("development_team_roster")
            .select("development_team_id, academy_rider_id")
            .in("academy_rider_id", ids)
            .order("academy_rider_id")
            .order("development_team_id")
            .range(from, to)
            .returns<DevelopmentRosterRow[]>(),
      }),
    ]);

  assertSelectionQuery(ratingsResult.error, "les statistiques professionnelles");
  assertSelectionQuery(contractsResult.error, "les équipes des professionnels");
  assertSelectionQuery(
    developmentTeamsResult.error,
    "les équipes de développement des juniors",
  );
  assertSelectionQuery(
    developmentRosterResult.error,
    "les affectations en équipe de développement",
  );
  const contracts = contractsResult.data;
  const developmentTeams = developmentTeamsResult.data;
  const teamIds = [
    ...new Set([
      ...contracts.map((contract) => contract.team_id),
      ...juniorTeamIds,
    ]),
  ];
  const teamsResult = await collectChunkedPaginatedRows({
    ...SELECTION_LOOKUP_OPTIONS,
    values: teamIds,
    fetchPage: async (ids, from, to) =>
      admin
        .from("team_seasons")
        .select("team_id, display_name")
        .eq("season_id", seasonId)
        .in("team_id", ids)
        .order("team_id")
        .range(from, to)
        .returns<TeamSeasonRow[]>(),
  });

  assertSelectionQuery(teamsResult.error, "les noms des équipes");
  const ratingByRiderId = new Map(
    ratingsResult.data.map((rating) => [rating.rider_id, rating]),
  );
  const teamIdByRiderId = new Map(
    contracts.map((contract) => [contract.rider_id, contract.team_id]),
  );
  const teamNameById = new Map(
    teamsResult.data.map((team) => [team.team_id, team.display_name]),
  );
  const developmentTeamById = new Map(
    developmentTeams.map((team) => [team.id, team]),
  );
  const developmentTeamByJuniorId = new Map(
    developmentRosterResult.data.flatMap((roster) => {
      const developmentTeam = developmentTeamById.get(
        roster.development_team_id,
      );
      return developmentTeam
        ? [[roster.academy_rider_id, developmentTeam] as const]
        : [];
    }),
  );

  const professionals = riders.flatMap((rider) => {
    const rating = ratingByRiderId.get(rider.id);
    if (!rating) return [];
    const ratings = {
      mountain: rating.mountain,
      hills: rating.hills,
      flat: rating.flat,
      timeTrial: rating.time_trial,
      cobbles: rating.cobbles,
      sprint: rating.sprint,
      acceleration: rating.acceleration,
      downhill: rating.downhill,
      endurance: rating.endurance,
      resistance: rating.resistance,
      recovery: rating.recovery,
      breakaway: rating.breakaway,
      prologue: rating.prologue,
    };
    const teamId = teamIdByRiderId.get(rider.id);
    return [
      {
        id: rider.id,
        teamId: teamId ?? null,
        name: `${rider.first_name} ${rider.last_name}`.trim(),
        category: "professional" as const,
        juniorAffiliation: null,
        teamName: teamId
          ? teamNameById.get(teamId) ?? "Équipe non active"
          : "Agent libre",
        age: rating.age,
        profile: getProfile(ratings),
        overall: getOverall(ratings),
        ratings,
      },
    ];
  });
  const youth = juniors.map((junior) => {
    const developmentTeam = developmentTeamByJuniorId.get(junior.id);
    const academyName =
      teamNameById.get(junior.team_id) ?? "Équipe formatrice";
    const ratings = {
      mountain: projectFederationYouthRating(junior.mountain),
      hills: projectFederationYouthRating(junior.hills),
      flat: projectFederationYouthRating(junior.flat),
      timeTrial: projectFederationYouthRating(junior.time_trial),
      cobbles: projectFederationYouthRating(junior.cobbles),
      sprint: projectFederationYouthRating(junior.sprint),
      acceleration: projectFederationYouthRating(junior.acceleration),
      downhill: projectFederationYouthRating(junior.downhill),
      endurance: projectFederationYouthRating(junior.endurance),
      resistance: projectFederationYouthRating(junior.resistance),
      recovery: projectFederationYouthRating(junior.recovery),
      breakaway: projectFederationYouthRating(junior.breakaway),
      prologue: projectFederationYouthRating(junior.prologue),
    };
    return {
      id: junior.id,
      teamId: junior.team_id,
      name: `${junior.first_name} ${junior.last_name}`.trim(),
      category: "junior" as const,
      juniorAffiliation: developmentTeam
        ? ("development_team" as const)
        : ("cycling_school" as const),
      teamName: developmentTeam
        ? developmentTeam.display_name
        : `${academyName} · École de cyclisme`,
      age: gameYear - junior.birth_game_year,
      profile: getProfile(ratings),
      overall: getOverall(ratings),
      ratings,
    };
  });

  return [...professionals, ...youth].sort(
    (left, right) =>
      right.overall - left.overall || left.name.localeCompare(right.name, "fr"),
  );
}

export function projectFederationYouthRating(value: number | string): number {
  return Math.round(projectYouthRating(Number(value)));
}

function getProfile(
  ratings: FederationSelectionRider["ratings"],
): FederationSelectionRider["profile"] {
  const entries: Array<[FederationSelectionRider["profile"], number]> = [
    ["Montagne", ratings.mountain],
    ["Vallons", ratings.hills],
    ["Sprint", ratings.sprint],
    ["Pavés", ratings.cobbles],
    ["Chrono", ratings.timeTrial],
    ["Polyvalent", ratings.flat],
  ];
  entries.sort((left, right) => right[1] - left[1]);
  return entries[0]?.[0] ?? "Polyvalent";
}

function getOverall(ratings: FederationSelectionRider["ratings"]): number {
  const values = Object.values(ratings).sort((left, right) => right - left);
  const bestFour = values.slice(0, 4);
  return Math.round(
    (bestFour.reduce((total, value) => total + value, 0) /
      Math.max(1, bestFour.length)) *
      10,
  ) / 10;
}

function assertSelectionQuery(
  error: { message: string } | null,
  resourceName: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resourceName} : ${error.message}`);
  }
}
