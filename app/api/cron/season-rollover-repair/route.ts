import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";
import { settleFinishedRaceResults } from "@/services/race-results";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const now = new Date();
  const calendar = await getActiveSeasonRaceCalendar(admin, now);
  const raceSettlement = calendar
    ? await settleFinishedRaceResults(calendar, now)
    : null;
  console.info("Season rollover race preflight completed", raceSettlement);
  const result = await admin.rpc("settle_due_season_rollovers");

  if (result.error) {
    console.error("Season rollover repair failed", {
      code: result.error.code,
      message: result.error.message,
      details: result.error.details,
      hint: result.error.hint,
    });
    return Response.json(
      { ok: false, error: result.error.message, code: result.error.code },
      { status: 500 },
    );
  }

  console.info("Season rollover repair completed", {
    settlements: result.data,
  });
  return Response.json({ ok: true, settlements: result.data });
}
