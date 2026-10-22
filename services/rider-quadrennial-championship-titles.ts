import "server-only";
import { collectChunkedPaginatedRows } from "@/lib/supabase/pagination";
import { parseQuadrennialChampionshipType, type QuadrennialChampionshipDiscipline } from "@/lib/game/quadrennial-games";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActiveQuadrennialChampionshipTitle = { riderId: string; championshipType: QuadrennialChampionshipDiscipline };
export type ActiveQuadrennialChampionshipTitlesByDiscipline = Partial<Record<QuadrennialChampionshipDiscipline, ActiveQuadrennialChampionshipTitle>>;

/** Only used by the legacy calendar fallback; the compact RPC already includes these titles. */
export async function getActiveQuadrennialChampionshipTitlesByDisciplineForRiders(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, riderIds: readonly string[],
): Promise<Map<string, ActiveQuadrennialChampionshipTitlesByDiscipline>> {
  const result = await collectChunkedPaginatedRows<{ rider_id: string; championship_type: string }, { message: string }, string>({
    values: [...new Set(riderIds.filter(Boolean))],
    fetchPage: async (ids, from, to) => {
      const query = await supabase.from("rider_national_championship_titles")
        .select("rider_id, championship_type").in("rider_id", ids)
        .in("championship_type", ["quadrennial_road", "quadrennial_time_trial"])
        .is("relinquished_at", null).range(from, to).returns<{ rider_id: string; championship_type: string }[]>();
      return { data: query.data, error: query.error };
    },
  });
  if (result.error) throw new Error(result.error.message);
  const titles = new Map<string, ActiveQuadrennialChampionshipTitlesByDiscipline>();
  for (const row of result.data ?? []) {
    const discipline = parseQuadrennialChampionshipType(row.championship_type);
    if (!discipline) continue;
    const current = titles.get(row.rider_id) ?? {};
    current[discipline] = { riderId: row.rider_id, championshipType: discipline };
    titles.set(row.rider_id, current);
  }
  return titles;
}
