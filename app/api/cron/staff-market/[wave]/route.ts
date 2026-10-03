import {
  isStaffMarketRefreshHour,
  isStaffMarketRefreshRoute,
} from "@/lib/game/staff-market-waves";
import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { settleDueStaffMarketWaves } from "@/services/team-staff";

export const maxDuration = 60;

export async function GET(
  request: Request,
  context: RouteContext<"/api/cron/staff-market/[wave]">,
) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { wave } = await context.params;
  if (!isStaffMarketRefreshRoute(wave)) {
    return Response.json({ error: "Invalid staff market wave" }, { status: 400 });
  }

  const now = new Date();
  if (!isStaffMarketRefreshHour(now)) {
    return Response.json({
      wave,
      skipped: true,
      reason: "outside_paris_bi_hourly_slot",
      checkedAt: now.toISOString(),
    });
  }

  try {
    const settlement = await settleDueStaffMarketWaves(now);
    console.info("staff_market_waves_settled", settlement);
    return Response.json({
      ...settlement,
      skipped: settlement.generatedCount === 0,
      settledAt: now.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("staff_market_wave_failed", { wave, message });
    return Response.json({ error: message, wave }, { status: 500 });
  }
}
