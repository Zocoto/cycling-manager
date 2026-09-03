import "server-only";

import { unstable_cache } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FederationSelectionRider = {
  id: string;
  teamId: string | null;
  name: string;
  category: "professional" | "junior";
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
};
type ContractRow = { rider_id: string; team_id: string };
type TeamSeasonRow = { team_id: string; display_name: string };
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
};

const getCachedFederationSelectionPool = unstable_cache(
  (
    countryId: string,
    seasonId: string,
    gameYear: number,
  ) =>
    loadFederationSelectionPool({ countryId, seasonId, gameYear }),
  ["federation-selection-pool"],
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
  const [ridersResult, juniorsResult] = await Promise.all([
    admin
      .from("riders")
      .select("id, first_name, last_name")
      .eq("country_id", countryId)
      .in("status", ["active", "free_agent"])
      .limit(250)
      .returns<RiderRow[]>(),
    admin
      .from("youth_academy_riders")
      .select(
        "id, team_id, first_name, last_name, birth_game_year, mountain, hills, flat, time_trial, cobbles, sprint",
      )
      .eq("country_id", countryId)
      .in("status", ["active", "free_agent"])
      .limit(250)
      .returns<JuniorRow[]>(),
  ]);

  assertSelectionQuery(ridersResult.error, "les coureurs professionnels");
  assertSelectionQuery(juniorsResult.error, "les coureurs juniors");
  const riders = ridersResult.data ?? [];
  const juniors = juniorsResult.data ?? [];
  const riderIds = riders.map((rider) => rider.id);

  const [ratingsResult, contractsResult] = await Promise.all([
    riderIds.length > 0
      ? admin
          .from("rider_season_ratings")
          .select(
            "rider_id, age, mountain, hills, flat, time_trial, cobbles, sprint",
          )
          .eq("season_id", seasonId)
          .in("rider_id", riderIds)
          .returns<RatingRow[]>()
      : Promise.resolve({ data: [] as RatingRow[], error: null }),
    riderIds.length > 0
      ? admin
          .from("rider_contracts")
          .select("rider_id, team_id")
          .eq("status", "active")
          .in("rider_id", riderIds)
          .returns<ContractRow[]>()
      : Promise.resolve({ data: [] as ContractRow[], error: null }),
  ]);

  assertSelectionQuery(ratingsResult.error, "les statistiques professionnelles");
  assertSelectionQuery(contractsResult.error, "les équipes des professionnels");
  const contracts = contractsResult.data ?? [];
  const teamIds = [
    ...new Set([
      ...contracts.map((contract) => contract.team_id),
      ...juniors.map((junior) => junior.team_id),
    ]),
  ];
  const teamsResult =
    teamIds.length > 0
      ? await admin
          .from("team_seasons")
          .select("team_id, display_name")
          .eq("season_id", seasonId)
          .in("team_id", teamIds)
          .returns<TeamSeasonRow[]>()
      : { data: [] as TeamSeasonRow[], error: null };

  assertSelectionQuery(teamsResult.error, "les noms des équipes");
  const ratingByRiderId = new Map(
    (ratingsResult.data ?? []).map((rating) => [rating.rider_id, rating]),
  );
  const teamIdByRiderId = new Map(
    contracts.map((contract) => [contract.rider_id, contract.team_id]),
  );
  const teamNameById = new Map(
    (teamsResult.data ?? []).map((team) => [team.team_id, team.display_name]),
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
    };
    const teamId = teamIdByRiderId.get(rider.id);
    return [
      {
        id: rider.id,
        teamId: teamId ?? null,
        name: `${rider.first_name} ${rider.last_name}`.trim(),
        category: "professional" as const,
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
    const ratings = {
      mountain: Number(junior.mountain),
      hills: Number(junior.hills),
      flat: Number(junior.flat),
      timeTrial: Number(junior.time_trial),
      cobbles: Number(junior.cobbles),
      sprint: Number(junior.sprint),
    };
    return {
      id: junior.id,
      teamId: junior.team_id,
      name: `${junior.first_name} ${junior.last_name}`.trim(),
      category: "junior" as const,
      teamName: teamNameById.get(junior.team_id) ?? "Équipe de développement",
      age: Math.max(15, gameYear - junior.birth_game_year),
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
