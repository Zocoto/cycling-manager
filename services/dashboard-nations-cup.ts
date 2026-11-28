import "server-only";

import { compactDataCache } from "@/lib/performance/compact-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DashboardNationsCupLeader = {
  countryCode: string;
  countryName: string;
};

type LeaderRow = { country_code: string; country_name: string };

// Public, season-scoped data shared by every DS. Do not load the full Nations
// Cup overview (heats, startlists and riders) for five small flags.
export const getDashboardNationsCupLeaders = compactDataCache(
  async (seasonId: string): Promise<DashboardNationsCupLeader[]> => {
    const { data, error } = await createSupabaseAdminClient()
      .rpc("get_national_federation_nations_cup_standings", { p_season_id: seasonId })
      .select("country_code,country_name")
      .eq("division", 1)
      .order("division_rank", { ascending: true })
      .limit(5)
      .abortSignal(AbortSignal.timeout(2500));
    if (error) throw error;

    return (Array.isArray(data) ? data : [])
      .filter((country: unknown): country is LeaderRow => country !== null
        && typeof country === "object"
        && "country_code" in country && typeof country.country_code === "string"
        && /^[a-z]{2}$/i.test(country.country_code)
        && "country_name" in country && typeof country.country_name === "string")
      .map((country: LeaderRow) => ({
        countryCode: country.country_code.toLowerCase(),
        countryName: country.country_name,
      }));
  },
  ["dashboard-nations-cup-leaders-v1"],
  { revalidate: 120 },
);
