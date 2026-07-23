import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { processDueInternationalChampionshipSelections } from "@/services/international-championship-selections";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";
import { settleFinishedRaceResults } from "@/services/race-results";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const internationalSelections =
    await processDueInternationalChampionshipSelections(now);
  const admin = createSupabaseAdminClient();
  const calendar = await getActiveSeasonRaceCalendar(admin, now);
  if (!calendar) {
    return Response.json({
      processedStages: 0,
      completedEditions: 0,
      internationalSelections,
    });
  }

  const settlement = await settleFinishedRaceResults(calendar, now);
  return Response.json({
    ...settlement,
    internationalSelections,
    settledAt: now.toISOString(),
  });
}

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    return request.headers.get("authorization") === `Bearer ${cronSecret}`;
  }

  return (
    process.env.VERCEL === "1" &&
    request.headers.get("user-agent") === "vercel-cron/1.0"
  );
}
