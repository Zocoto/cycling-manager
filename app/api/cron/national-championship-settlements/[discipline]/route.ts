import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { syncNationalChampionshipRegistrations } from "@/services/national-championships";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";
import { settleFinishedRaceResults } from "@/services/race-results";

export const maxDuration = 300;

const COMPETITION_TYPE_BY_DISCIPLINE = {
  "time-trial-summer": "national_time_trial",
  "time-trial-winter": "national_time_trial",
  "road-summer": "national_road",
  "road-winter": "national_road",
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
  if (!season || season.current_day_number !== 8) {
    return Response.json({
      discipline,
      skipped: true,
      reason: "not-national-championship-day",
    });
  }

  const now = new Date();
  const synchronizedEntries = await syncNationalChampionshipRegistrations(now);
  const calendar = await getActiveSeasonRaceCalendar(admin, now, {
    includeIneligibleRegionalRaces: true,
  });
  if (!calendar) {
    return Response.json({
      discipline,
      synchronizedEntries,
      processedStages: 0,
      completedEditions: 0,
      failedEditions: 0,
    });
  }

  const nationalCalendar = {
    ...calendar,
    editions: calendar.editions.filter(
      (edition) => edition.competitionType === competitionType,
    ),
  };
  const settlement = await settleFinishedRaceResults(nationalCalendar, now);

  return Response.json({
    discipline,
    synchronizedEntries,
    targetedEditions: nationalCalendar.editions.length,
    ...settlement,
    settledAt: now.toISOString(),
  });
}
