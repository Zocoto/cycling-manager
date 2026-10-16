import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { syncNationalChampionshipRegistrations } from "@/services/national-championships";
import { settleDueNationalChampionshipResults } from "@/services/national-championship-settlement-runner";

export const maxDuration = 300;

const COMPETITION_TYPE_BY_DISCIPLINE = {
  "time-trial-summer": "national_time_trial",
  "time-trial-winter": "national_time_trial",
  "time-trial-recovery": "national_time_trial",
  "road-summer": "national_road",
  "road-winter": "national_road",
  "road-recovery": "national_road",
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ discipline: string }> },
) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { discipline } = await params;
  const competitionType =
    COMPETITION_TYPE_BY_DISCIPLINE[
      discipline as keyof typeof COMPETITION_TYPE_BY_DISCIPLINE
    ];
  if (!competitionType) {
    return Response.json({ error: "Invalid discipline" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: season, error: seasonError } = await admin
    .from("seasons")
    .select("id, current_day_number")
    .eq("status", "active")
    .maybeSingle<{ id: string; current_day_number: number | null }>();
  if (seasonError) {
    throw new Error(
      `Impossible de vérifier la journée active des CN : ${seasonError.message}`,
    );
  }
  if (!season || !season.current_day_number || season.current_day_number < 8) {
    return Response.json({
      discipline,
      skipped: true,
      reason: "not-national-championship-day",
    });
  }

  const now = new Date();
  let synchronizedEntries: number | null = null;
  let synchronizationError: string | null = null;
  // Recovery works from already frozen startlists. Do not repeat an expensive
  // global synchronization on every retry or reopen any closed selection.
  if (!discipline.endsWith("-recovery") && season.current_day_number === 8) {
    try {
      synchronizedEntries = await syncNationalChampionshipRegistrations(now);
    } catch (error) {
      synchronizationError =
        error instanceof Error ? error.message : "Unknown synchronization error";
      console.error(
        `La synchronisation préalable des ${discipline} a échoué ; la consolidation des startlists déjà gelées continue :`,
        error,
      );
    }
  }
  const settlement = await settleDueNationalChampionshipResults({seasonId:season.id,competitionType,now});
  if (settlement.failedEditions > 0) console.error("national_championship_settlement_anomaly",{discipline,...settlement});

  return Response.json({
    discipline,
    synchronizedEntries,
    synchronizationError,
    ...settlement,
    settledAt: now.toISOString(),
  }, {status:settlement.failedEditions > 0 ? 503 : 200});
}
