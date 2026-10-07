import "server-only";
import { getRiderWeightStatus, type OverweightRiderSummary } from "@/lib/game/rider-weight-status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type WeightRatingRow = {
  rider_id: string;
  mountain: number; hills: number; flat: number; time_trial: number;
  cobbles: number; sprint: number; acceleration: number; downhill: number;
  endurance: number; resistance: number; recovery: number; breakaway: number; prologue: number;
  riders: {
    first_name: string; last_name: string;
    height_cm: number | string | null; weight_kg: number | string | null;
  };
};

export async function getDashboardOverweightRiders(
  context: { teamId: string; seasonId: string },
  supabase: SupabaseAdminClient = createSupabaseAdminClient(),
): Promise<OverweightRiderSummary[]> {
  // Only use the team/season returned by the authenticated dashboard RPC, never
  // URL/form parameters. Core rider tables deny direct authenticated reads;
  // use the server-only client, as the health service does, with bounded filters.
  // Do not load the health overview or scan every rider to paint the dashboard.
  // A slow optional alert must not hold up the other assistant information.
  const signal = AbortSignal.timeout(3_000);
  const contracts = await supabase.from("rider_contracts").select("rider_id")
    .eq("team_id", context.teamId).eq("status", "active").limit(100).abortSignal(signal)
    .returns<{ rider_id: string }[]>();
  if (contracts.error) throw new Error(`Lecture des poids de l’effectif : ${contracts.error.message}`);
  const riderIds = [...new Set((contracts.data ?? []).map((row) => row.rider_id))];
  if (riderIds.length === 0) return [];

  const ratings = await supabase.from("rider_season_ratings")
    .select("rider_id, mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue, riders!inner(first_name, last_name, height_cm, weight_kg)")
    .eq("season_id", context.seasonId).in("rider_id", riderIds).limit(100).abortSignal(signal)
    .returns<WeightRatingRow[]>();
  if (ratings.error) throw new Error(`Lecture des profils de l’effectif : ${ratings.error.message}`);

  return (ratings.data ?? []).flatMap((row): OverweightRiderSummary[] => {
    const weightKg = row.riders.weight_kg === null ? null : Number(row.riders.weight_kg);
    const status = getRiderWeightStatus({
      heightCm: row.riders.height_cm === null ? null : Number(row.riders.height_cm), weightKg,
      ratings: {
        mountain: row.mountain, hills: row.hills, flat: row.flat, timeTrial: row.time_trial,
        cobbles: row.cobbles, sprint: row.sprint, acceleration: row.acceleration,
        downhill: row.downhill, endurance: row.endurance, resistance: row.resistance,
        recovery: row.recovery, breakaway: row.breakaway, prologue: row.prologue,
      },
    });
    return status?.isOverweight && weightKg !== null ? [{
      riderId: row.rider_id,
      name: `${row.riders.first_name} ${row.riders.last_name}`.trim(),
      profileLabel: status.profileLabel, weightKg, maximumWeightKg: status.maximumWeightKg,
    }] : [];
  }).sort((left, right) => left.name.localeCompare(right.name, "fr"));
}
