import type { RaceCalendarStage } from "@/lib/game/race-calendar";
import { getStageLiveState } from "@/lib/game/race-live";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const headers = { "Cache-Control": "private, no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StageAvailabilityRow = {
  status: RaceCalendarStage["status"];
  departure_at: string | null;
  distance_km: number | string;
  results: { id: string }[];
  simulation: { stage_id: string } | { stage_id: string }[] | null;
};

export async function GET(request: Request, { params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params;
  if (!UUID.test(stageId)) return new Response(null, { status: 404, headers });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await getAuthenticatedUser(supabase);
    if (error || !user) return new Response(null, { status: 401, headers });

    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(4_000)]);
    const [director, stage] = await Promise.all([
      supabase.from("sporting_directors")
        .select("id")
        .eq("auth_user_id", user.id)
        .abortSignal(signal)
        .maybeSingle(),
      supabase.from("stages")
        .select(`status,departure_at,distance_km,
          edition:race_editions!inner(season:seasons!inner(status),race:races!inner(competition_type)),
          results:stage_results(id),simulation:official_stage_simulations(stage_id)`)
        .eq("id", stageId)
        .eq("edition.season.status", "active")
        .neq("edition.status", "cancelled")
        .not("edition.race.competition_type", "in", "(national_road,national_time_trial)")
        .limit(1, { referencedTable: "results" })
        .abortSignal(signal)
        .maybeSingle<StageAvailabilityRow>(),
    ]);
    if (director.error || stage.error) return new Response(null, { status: 503, headers });
    if (!director.data) return new Response(null, { status: 403, headers });
    if (!stage.data) return new Response(null, { status: 404, headers });

    const { status, departure_at: departureAt, distance_km: distanceKm, results, simulation } = stage.data;
    const state = getStageLiveState({ status, departureAt, distanceKm: Number(distanceKm) });
    return Response.json({
      cancelled: state.status === "cancelled",
      resultsAvailable: state.status === "finished" && results.length > 0,
      simulationAvailable: (state.status === "live" || state.status === "finished") &&
        (Array.isArray(simulation) ? simulation.length > 0 : simulation !== null),
    }, { headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
