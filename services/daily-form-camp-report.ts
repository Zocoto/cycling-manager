import "server-only";

import {
  normalizeDailyFormCampReport,
  parseFormCampReportDay,
  type DailyFormCampReport,
} from "@/lib/game/daily-form-camp-report";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function getDailyFormCampReport(
  supabase: ServerClient,
  requestedDay?: string | string[],
): Promise<DailyFormCampReport | null> {
  // Identity and team scope are resolved by the authenticated RPC, never by a URL parameter.
  const { data, error } = await supabase
    .rpc("get_current_team_daily_form_camp_report", {
      p_day_number: parseFormCampReportDay(requestedDay),
    })
    .abortSignal(AbortSignal.timeout(3000));
  if (error) {
    throw new Error(`Impossible de charger le rapport des stages de forme : ${error.message}`);
  }
  return normalizeDailyFormCampReport(data);
}
