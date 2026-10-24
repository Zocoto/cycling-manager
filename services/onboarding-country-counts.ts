import "server-only";

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CountryCountRow = { country_id: string; director_count: number | string };

// Only requested while an initial nationality choice is still available.
// Counts are shared presentation data; no session or player record is cached.
const loadCountryCounts = unstable_cache(async (): Promise<Record<string, number>> => {
  const result = await createSupabaseAdminClient()
    .rpc("get_onboarding_country_director_counts")
    .abortSignal(AbortSignal.timeout(3000));
  if (result.error || !result.data) throw new Error("Country counts unavailable");

  return Object.fromEntries((result.data as CountryCountRow[]).map((row) => {
    const count = Number(row.director_count);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid country count");
    return [row.country_id, count];
  }));
}, ["onboarding-country-director-counts-v1"], { revalidate: 60 });

export async function getOnboardingCountryDirectorCounts(): Promise<Record<string, number> | null> {
  try {
    return await loadCountryCounts();
  } catch {
    // A missing indicator must never prevent registration or suggest a false zero.
    console.error("Le nombre de DS par nationalité n’a pas pu être chargé.");
    return null;
  }
}
