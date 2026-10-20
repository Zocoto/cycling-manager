import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { collectChunkedPaginatedRows } from "@/lib/supabase/pagination";
import {
  getViewerRiderIdsByEdition,
  resolveRaceViewerTeamId,
  type CalendarRiderOwnership,
} from "@/lib/game/race-viewer-riders";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Optional view metadata only: never block the race if this lookup fails. */
export async function loadViewerNationalRaceRiderIds(
  supabase: SupabaseServerClient,
  viewerTeamId: string | null,
  engagedRiderIds: readonly string[],
): Promise<ReadonlySet<string>> {
  if (!viewerTeamId || engagedRiderIds.length === 0) return new Set();

  try {
    const signal = AbortSignal.timeout(1_000);
    const result = await collectChunkedPaginatedRows<
      { rider_id: string },
      { message: string },
      string
    >({
      values: [...new Set(engagedRiderIds)].sort(),
      chunkSize: 100,
      maxConcurrency: 1,
      fetchPage: async (chunk, from, to) => {
        // Do not start another batch after the shared deadline has expired.
        signal.throwIfAborted();
        const response = await supabase
          .from("rider_contracts")
          .select("rider_id")
          .eq("team_id", viewerTeamId)
          .eq("status", "active")
          .in("rider_id", chunk)
          .order("rider_id", { ascending: true })
          .range(from, to)
          .abortSignal(signal)
          .returns<Array<{ rider_id: string }>>();
        return { data: response.data, error: response.error };
      },
    });

    if (result.error) throw result.error;
    return new Set(result.data.map((row) => row.rider_id));
  } catch {
    console.warn("Optional federation rider ownership unavailable; keeping the default list order.");
    return new Set();
  }
}

/** Starts while the calendar loads other enrichments; never changes simulation data. */
export async function loadViewerRaceRiderIdsByEdition(
  supabase: SupabaseServerClient,
  viewerTeamId: string | null | Promise<string | null>,
  rows: readonly CalendarRiderOwnership[],
  nationalEditionIds: ReadonlySet<string>,
): Promise<Map<string, string[]> | null> {
  const teamId = await resolveRaceViewerTeamId(viewerTeamId);
  if (!teamId) return null;

  const nationalRiderIds = await loadViewerNationalRaceRiderIds(
    supabase,
    teamId,
    rows.filter((row) => nationalEditionIds.has(row.race_edition_id))
      .map((row) => row.rider_id)
      .filter(Boolean),
  );
  return getViewerRiderIdsByEdition(rows, teamId, {
    editionIds: nationalEditionIds,
    riderIds: nationalRiderIds,
  });
}
