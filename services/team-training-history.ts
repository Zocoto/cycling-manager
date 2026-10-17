import type { SupabaseClient } from "@supabase/supabase-js";
import { collectChunkedPaginatedRows } from "@/lib/supabase/pagination";
import type { TrainingSessionStatus } from "@/lib/game/training";

export type TrainingHistoryRow = {
  rider_id: string;
  season_day_id: string;
  status: TrainingSessionStatus;
  intensity: number;
  domain: string;
  minimum_form: number;
  trainer_level: number;
  trainer_specialty: string | null;
  trainer_country_match: boolean;
  physiotherapist_level: number;
  form_before: number;
  form_delta: number;
  form_after: number;
  progress_milli: Record<string, number>;
  decline_milli: Record<string, number>;
  rating_changes: Record<string, number>;
  processed_at: string;
};

/** Full season history, without an unbounded IN filter or silent 1,000-row truncation. */
export function loadTeamTrainingHistory(
  admin: SupabaseClient,
  seasonId: string,
  riderIds: string[],
) {
  return collectChunkedPaginatedRows<TrainingHistoryRow, { message: string }, string>({
    values: [...new Set(riderIds)],
    chunkSize: 50,
    pageSize: 500,
    // Reports contain JSON payloads: never fan out all chunks into the database.
    maxConcurrency: 1,
    fetchPage: async (chunk, from, to) => admin
      .from("rider_training_sessions")
      .select("rider_id,season_day_id,status,intensity,domain,minimum_form,trainer_level,trainer_specialty,trainer_country_match,physiotherapist_level,form_before,form_delta,form_after,progress_milli,decline_milli,rating_changes,processed_at")
      .eq("season_id", seasonId)
      .eq("is_contract_eligible", true)
      .in("rider_id", chunk)
      // A unique tie-breaker keeps pagination deterministic after batch settlement.
      .order("rider_id")
      .order("processed_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to)
      .returns<TrainingHistoryRow[]>(),
  });
}
