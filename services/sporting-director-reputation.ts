import "server-only";

import {
  buildSportingDirectorReputationBreakdown,
  type ReputationGainRow,
  type SportingDirectorReputationBreakdown,
} from "@/lib/game/reputation-breakdown";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export async function getSportingDirectorReputationBreakdown(
  supabase: SupabaseServerClient,
  sportingDirectorId: string,
  currentPoints: number,
): Promise<SportingDirectorReputationBreakdown> {
  const { data, error } = await supabase
    .from("reward_events")
    .select("source_type, reputation_points, description, created_at")
    .eq("sporting_director_id", sportingDirectorId)
    .gt("reputation_points", 0)
    .order("created_at", { ascending: false })
    .returns<ReputationGainRow[]>();

  if (error) {
    throw new Error(
      `Impossible de charger le d\u00e9tail de la r\u00e9putation : ${error.message}`,
    );
  }

  return buildSportingDirectorReputationBreakdown(data ?? [], currentPoints);
}
