import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { collectChunkedPaginatedRows } from "@/lib/supabase/pagination";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type RiderFavoriteRace = {
  raceId: string;
  name: string;
  slug: string;
  countryName: string;
  countryCode: string;
  categoryCode: string;
  dominantProfile: string;
  geographyCode: "home" | "neighbor" | "continent" | "elsewhere";
  historySeasons: number;
  historyPodiums: number;
  historyVictories: number;
};

type RiderFavoriteRaceRow = {
  rider_id: string;
  race_id: string;
  preference_rank: number;
  race_name: string;
  race_slug: string;
  country_name: string;
  country_code: string;
  category_code: string;
  dominant_profile: string;
  geography_code: RiderFavoriteRace["geographyCode"];
  history_seasons: number;
  history_podiums: number;
  history_victories: number;
};

export async function getRiderFavoriteRaces({
  riderId,
  seasonId,
}: {
  riderId: string;
  seasonId: string;
}): Promise<RiderFavoriteRace[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("rider_favorite_races")
    .select(
      "rider_id, race_id, preference_rank, race_name, race_slug, country_name, country_code, category_code, dominant_profile, geography_code, history_seasons, history_podiums, history_victories",
    )
    .eq("season_id", seasonId)
    .eq("rider_id", riderId)
    .order("preference_rank", { ascending: true })
    .limit(3)
    .returns<RiderFavoriteRaceRow[]>();

  // A missing optional feature must not make the rider profile unavailable.
  if (error) {
    console.error("Impossible de charger les courses préférées :", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    raceId: row.race_id,
    name: row.race_name,
    slug: row.race_slug,
    countryName: row.country_name,
    countryCode: row.country_code,
    categoryCode: row.category_code,
    dominantProfile: row.dominant_profile,
    geographyCode: row.geography_code,
    historySeasons: row.history_seasons,
    historyPodiums: row.history_podiums,
    historyVictories: row.history_victories,
  }));
}

export async function getFavoriteRaceRiderIdsByRace({
  admin,
  seasonId,
  raceIds,
}: {
  admin: SupabaseAdminClient;
  seasonId: string;
  raceIds: string[];
}): Promise<Map<string, Set<string>>> {
  if (raceIds.length === 0) return new Map();

  // The index begins with (season_id, race_id). Querying the few editions in
  // a simulation pack avoids sending an entire startlist through a long URL.
  const result = await collectChunkedPaginatedRows<
    Pick<RiderFavoriteRaceRow, "rider_id" | "race_id">,
    { message: string },
    string
  >({
    values: raceIds,
    chunkSize: 40,
    fetchPage: async (chunk, from, to) => {
      const query = await admin
        .from("rider_favorite_races")
        .select("rider_id, race_id")
        .eq("season_id", seasonId)
        .in("race_id", chunk)
        .order("race_id", { ascending: true })
        .order("rider_id", { ascending: true })
        .range(from, to)
        .returns<Array<Pick<RiderFavoriteRaceRow, "rider_id" | "race_id">>>();
      return { data: query.data, error: query.error };
    },
  });

  if (result.error) {
    console.error("Bonus de course préférée indisponible :", result.error);
    return new Map();
  }

  const ridersByRace = new Map<string, Set<string>>();
  for (const row of result.data) {
    const riders = ridersByRace.get(row.race_id) ?? new Set<string>();
    riders.add(row.rider_id);
    ridersByRace.set(row.race_id, riders);
  }
  return ridersByRace;
}
