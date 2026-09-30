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
  const [eventsResult, ledgerResult, commitmentsResult, directorResult] = await Promise.all([
    supabase
      .from("reward_events")
      .select("source_type, reputation_points, description, created_at")
      .eq("sporting_director_id", sportingDirectorId)
      .neq("reputation_points", 0)
      .order("created_at", { ascending: false })
      .returns<ReputationGainRow[]>(),
    supabase
      .from("reputation_ledger")
      .select("source_type, applied_delta, description, created_at")
      .eq("sporting_director_id", sportingDirectorId)
      .neq("applied_delta", 0)
      .order("created_at", { ascending: false })
      .returns<Array<{
        source_type: string;
        applied_delta: number | string;
        description: string;
        created_at: string;
      }>>(),
    supabase
      .from("reputation_commitments")
      .select("amount")
      .eq("sporting_director_id", sportingDirectorId)
      .eq("status", "active")
      .returns<Array<{ amount: number | string }>>(),
    supabase
      .from("sporting_directors")
      .select("peak_reputation_points")
      .eq("id", sportingDirectorId)
      .maybeSingle<{ peak_reputation_points: number | string | null }>(),
  ]);

  if (eventsResult.error) {
    throw new Error(
      `Impossible de charger le d\u00e9tail de la r\u00e9putation : ${eventsResult.error.message}`,
    );
  }

  const committedPoints = commitmentsResult.error
    ? 0
    : (commitmentsResult.data ?? []).reduce(
        (total, row) => total + Number(row.amount ?? 0),
        0,
      );
  const peakPoints = directorResult.error
    ? currentPoints
    : Number(directorResult.data?.peak_reputation_points ?? currentPoints);

  const ledgerRows: ReputationGainRow[] = ledgerResult.error
    ? []
    : (ledgerResult.data ?? []).map((row) => ({
        source_type: row.source_type,
        reputation_points: row.applied_delta,
        description: row.description,
        created_at: row.created_at,
      }));
  const rows = [...(eventsResult.data ?? []), ...ledgerRows].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  );

  return buildSportingDirectorReputationBreakdown(
    rows,
    currentPoints,
    { committedPoints, peakPoints },
  );
}
