import "server-only";

import {
  rankNationRiders,
  type NationRiderRatings,
} from "@/lib/game/nation-rider-ranking";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NationRiderSummary = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  avatarProfileKey: string | null;
  avatarSeed: number | string | null;
  age: number;
  overall: number;
  teamId: string | null;
  teamName: string | null;
};

export type NationRiderOverview = {
  totalCount: number;
  topRiders: NationRiderSummary[];
};

type RiderRow = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  avatar_profile_key: string | null;
  avatar_seed: number | string | null;
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

type ContractRow = {
  rider_id: string;
  team_id: string;
};

type TeamSeasonRow = {
  team_id: string;
  display_name: string;
};

export async function getNationRiderOverview(
  countryId: string,
  limit = 5,
): Promise<NationRiderOverview> {
  const normalizedCountryId = countryId.trim();
  if (!normalizedCountryId) return { totalCount: 0, topRiders: [] };

  const supabase = createSupabaseAdminClient();
  const [activeSeasonResult, ridersResult] = await Promise.all([
    supabase
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle<{ id: string }>(),
    supabase
      .from("riders")
      .select(
        "id, first_name, last_name, status, avatar_profile_key, avatar_seed",
      )
      .eq("country_id", normalizedCountryId)
      .in("status", ["active", "free_agent", "suspended"])
      .returns<RiderRow[]>(),
  ]);

  assertNationRiderQuery(activeSeasonResult.error, "la saison active");
  assertNationRiderQuery(ridersResult.error, "les coureurs de la nation");
  const riderRows = ridersResult.data ?? [];
  const totalCount = riderRows.length;
  const activeSeason = activeSeasonResult.data;
  if (!activeSeason || riderRows.length === 0 || limit <= 0) {
    return { totalCount, topRiders: [] };
  }

  const { data: ratings, error: ratingsError } = await supabase
    .from("rider_season_ratings")
    .select(
      "rider_id, age, mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue",
    )
    .eq("season_id", activeSeason.id)
    .in(
      "rider_id",
      riderRows.map((rider) => rider.id),
    )
    .returns<RatingRow[]>();

  assertNationRiderQuery(ratingsError, "les notes des coureurs de la nation");
  const ratingsByRiderId = new Map(
    (ratings ?? []).map((rating) => [rating.rider_id, rating]),
  );

  const rankedRiders = rankNationRiders(
    riderRows.flatMap((rider) => {
      const rating = ratingsByRiderId.get(rider.id);
      if (!rating) return [];

      return [
        {
          id: rider.id,
          firstName: rider.first_name,
          lastName: rider.last_name,
          status: rider.status,
          avatarProfileKey: rider.avatar_profile_key,
          avatarSeed: rider.avatar_seed,
          age: rating.age,
          ratings: toNationRiderRatings(rating),
        },
      ];
    }),
    limit,
  );

  if (rankedRiders.length === 0) return { totalCount, topRiders: [] };

  const topRiderIds = rankedRiders.map((rider) => rider.id);
  const { data: contracts, error: contractsError } = await supabase
    .from("rider_contracts")
    .select("rider_id, team_id")
    .eq("status", "active")
    .in("rider_id", topRiderIds)
    .returns<ContractRow[]>();

  assertNationRiderQuery(contractsError, "les équipes actuelles des coureurs");
  const teamIdByRiderId = new Map(
    (contracts ?? []).map((contract) => [contract.rider_id, contract.team_id]),
  );
  const teamIds = [...new Set(teamIdByRiderId.values())];
  let teamNameById = new Map<string, string>();

  if (teamIds.length > 0) {
    const { data: teamSeasons, error: teamSeasonsError } = await supabase
      .from("team_seasons")
      .select("team_id, display_name")
      .eq("season_id", activeSeason.id)
      .in("team_id", teamIds)
      .returns<TeamSeasonRow[]>();

    assertNationRiderQuery(teamSeasonsError, "les noms actuels des équipes");
    teamNameById = new Map(
      (teamSeasons ?? []).map((team) => [team.team_id, team.display_name]),
    );
  }

  return {
    totalCount,
    topRiders: rankedRiders.map((rider) => {
      const teamId = teamIdByRiderId.get(rider.id) ?? null;
      return {
        id: rider.id,
        firstName: rider.firstName,
        lastName: rider.lastName,
        status: rider.status,
        avatarProfileKey: rider.avatarProfileKey,
        avatarSeed: rider.avatarSeed,
        age: rider.age,
        overall: rider.overall,
        teamId,
        teamName: teamId ? (teamNameById.get(teamId) ?? null) : null,
      };
    }),
  };
}

function toNationRiderRatings(rating: RatingRow): NationRiderRatings {
  return {
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
}

function assertNationRiderQuery(
  error: { message: string } | null,
  resourceName: string,
): asserts error is null {
  if (error) {
    throw new Error(
      `Impossible de charger ${resourceName} : ${error.message}`,
    );
  }
}
