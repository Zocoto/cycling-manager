import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";

export const maxDuration = 300;

type FanClubSalesSettlementRow = {
  processed_teams: number;
  processed_days: number;
  units_sold: number;
  failed_teams: number;
};

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const settledAt = new Date().toISOString();
  const result = await admin.rpc("settle_due_fan_club_shop_sales");

  if (result.error) {
    console.error("fan_club_daily_sales_failed", {
      settledAt,
      error: result.error.message,
    });
    return Response.json(
      { error: result.error.message, settledAt },
      { status: 500 },
    );
  }

  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as
    | FanClubSalesSettlementRow
    | null;
  const settlement = {
    processedTeams: Number(row?.processed_teams ?? 0),
    processedDays: Number(row?.processed_days ?? 0),
    unitsSold: Number(row?.units_sold ?? 0),
    failedTeams: Number(row?.failed_teams ?? 0),
  };

  const log = settlement.failedTeams > 0 ? console.error : console.info;
  log("fan_club_daily_sales_completed", { settledAt, ...settlement });

  return Response.json(
    { settledAt, ...settlement },
    { status: settlement.failedTeams > 0 ? 500 : 200 },
  );
}
