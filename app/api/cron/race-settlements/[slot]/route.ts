import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { processDueInternationalChampionshipSelections } from "@/services/international-championship-selections";
import { syncNationalChampionshipRegistrations } from "@/services/national-championships";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";
import { settleFinishedRaceResults } from "@/services/race-results";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const [internationalSelections, nationalChampionshipEntries] =
    await Promise.all([
      processDueInternationalChampionshipSelections(now),
      syncNationalChampionshipRegistrations(now),
    ]);
  const admin = createSupabaseAdminClient();
  const calendar = await getActiveSeasonRaceCalendar(admin, now);
  if (!calendar) {
    return Response.json({
      processedStages: 0,
      completedEditions: 0,
      internationalSelections,
      nationalChampionshipEntries,
    });
  }

  const settlement = await settleFinishedRaceResults(calendar, now);
  return Response.json({
    ...settlement,
    internationalSelections,
    nationalChampionshipEntries,
    settledAt: now.toISOString(),
  });
}
