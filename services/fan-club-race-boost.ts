import "server-only";

import {
  calculateFanClubRaceBoost,
  type FanClubRaceBoost,
  type FanClubRaceTripAllocation,
} from "@/lib/game/fan-club-race-boost";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { collectChunkedPaginatedRows } from "@/lib/supabase/pagination";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type FanClubProfileRow = {
  team_id: string;
  supporter_count: number;
  fervor: number;
};

type FanClubTripAllocationRow = {
  team_id: string;
  race_edition_id: string;
  model_code: string;
  car_count: number;
};

export function getFanClubRaceBoostKey(
  raceEditionId: string,
  teamId: string,
) {
  return `${raceEditionId}:${teamId}`;
}

export async function loadFanClubRaceBoostDirectory(
  admin: SupabaseAdminClient,
  {
    raceEditionIds,
    teamIds,
  }: {
    raceEditionIds: readonly string[];
    teamIds: readonly string[];
  },
): Promise<ReadonlyMap<string, FanClubRaceBoost>> {
  const uniqueRaceEditionIds = [...new Set(raceEditionIds.filter(Boolean))];
  const uniqueTeamIds = [...new Set(teamIds.filter(Boolean))];
  if (uniqueRaceEditionIds.length === 0 || uniqueTeamIds.length === 0) {
    return new Map();
  }

  const [profilesResult, allocationsResult] = await Promise.all([
    collectChunkedPaginatedRows<
      FanClubProfileRow,
      { message: string },
      string
    >({
      values: uniqueTeamIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("fan_club_profiles")
          .select("team_id, supporter_count, fervor")
          .in("team_id", chunk)
          .order("team_id", { ascending: true })
          .range(from, to)
          .returns<FanClubProfileRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
    collectChunkedPaginatedRows<
      FanClubTripAllocationRow,
      { message: string },
      string
    >({
      values: uniqueRaceEditionIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("fan_club_trip_allocations")
          .select("team_id, race_edition_id, model_code, car_count")
          .in("race_edition_id", chunk)
          .order("race_edition_id", { ascending: true })
          .order("team_id", { ascending: true })
          .range(from, to)
          .returns<FanClubTripAllocationRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
  ]);

  assertQuery(profilesResult.error, "les profils de supporters");
  assertQuery(allocationsResult.error, "les cars mobilisés");

  const allowedTeamIds = new Set(uniqueTeamIds);
  const profileByTeamId = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.team_id, profile]),
  );
  const allocationsByRaceAndTeam = new Map<
    string,
    FanClubRaceTripAllocation[]
  >();

  for (const allocation of allocationsResult.data ?? []) {
    if (!allowedTeamIds.has(allocation.team_id)) continue;
    const key = getFanClubRaceBoostKey(
      allocation.race_edition_id,
      allocation.team_id,
    );
    const values = allocationsByRaceAndTeam.get(key) ?? [];
    values.push({
      modelCode: allocation.model_code,
      carCount: Number(allocation.car_count),
    });
    allocationsByRaceAndTeam.set(key, values);
  }

  return new Map(
    [...allocationsByRaceAndTeam.entries()].map(([key, allocations]) => {
      const teamId = key.slice(key.lastIndexOf(":") + 1);
      const profile = profileByTeamId.get(teamId);
      return [
        key,
        calculateFanClubRaceBoost({
          supporterCount: Number(profile?.supporter_count ?? 0),
          fervor: Number(profile?.fervor ?? 0),
          allocations,
        }),
      ];
    }),
  );
}

export async function getTeamFanClubRaceBoost({
  raceEditionId,
  teamId,
}: {
  raceEditionId: string;
  teamId: string;
}) {
  const admin = createSupabaseAdminClient();
  const directory = await loadFanClubRaceBoostDirectory(admin, {
    raceEditionIds: [raceEditionId],
    teamIds: [teamId],
  });
  return directory.get(getFanClubRaceBoostKey(raceEditionId, teamId)) ?? null;
}

function assertQuery(
  error: { message: string } | null,
  label: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}
