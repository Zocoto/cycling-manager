import "server-only";

import {
  buildFanClubSalesReport,
  type FanClubSalesReportSourceRow,
  type FanClubSalesReportState,
} from "@/lib/game/fan-club-sales-report";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type SaleRow = {
  id: string;
  day_number: number;
  product_code: string;
  units_sold: number;
  unit_price: number | string;
  revenue: number | string;
  demand_factor: number | string;
};

type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
  current_day_number: number | null;
};

type SeasonDayRow = {
  day_number: number;
  calendar_date: string;
};

export async function getFanClubSalesReport({
  supabase,
  teamId,
}: {
  supabase: ServerClient;
  teamId: string;
}): Promise<FanClubSalesReportState> {
  const admin = createSupabaseAdminClient();
  const [profileResult, activeSeasonResult] = await Promise.all([
    supabase
      .from("fan_club_profiles")
      .select("last_settled_game_day")
      .eq("team_id", teamId)
      .maybeSingle<{ last_settled_game_day: number | null }>(),
    admin
      .from("seasons")
      .select("id, name, game_year, current_day_number")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),
  ]);

  assertQuery(profileResult.error, "le dernier CR de la boutique");
  assertQuery(activeSeasonResult.error, "la saison active");
  if (!activeSeasonResult.data) {
    throw new Error("Impossible de charger la saison active du rapport de ventes.");
  }

  const activeSeason = activeSeasonResult.data;
  const [salesResult, daysResult] = await Promise.all([
    supabase
      .from("fan_club_shop_sales")
      .select(
        "id, day_number, product_code, units_sold, unit_price, revenue, demand_factor",
      )
      .eq("team_id", teamId)
      .eq("season_id", activeSeason.id)
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<SaleRow[]>(),
    admin
      .from("season_days")
      .select("day_number, calendar_date")
      .eq("season_id", activeSeason.id)
      .returns<SeasonDayRow[]>(),
  ]);
  assertQuery(salesResult.error, "les ventes de la saison en cours");
  assertQuery(daysResult.error, "les dates de la saison en cours");

  const dateByDay = new Map(
    (daysResult.data ?? []).map((day) => [day.day_number, day.calendar_date]),
  );
  const rows = (salesResult.data ?? []).map<FanClubSalesReportSourceRow>(
    (sale) => ({
      id: sale.id,
      seasonId: activeSeason.id,
      seasonName: activeSeason.name,
      gameYear: activeSeason.game_year,
      dayNumber: sale.day_number,
      calendarDate: dateByDay.get(sale.day_number) ?? null,
      productId: sale.product_code,
      unitsSold: sale.units_sold,
      unitPrice: Number(sale.unit_price),
      revenue: Number(sale.revenue),
      demandFactor: Number(sale.demand_factor),
    }),
  );
  const currentDayNumber = Math.max(
    1,
    Math.min(28, activeSeason.current_day_number ?? 1),
  );

  return buildFanClubSalesReport({
    rows,
    currentSeason: {
      id: activeSeason.id,
      name: activeSeason.name,
      gameYear: activeSeason.game_year,
      dayNumber: currentDayNumber,
      calendarDate: dateByDay.get(currentDayNumber) ?? null,
    },
    lastSettledGameDay:
      profileResult.data?.last_settled_game_day ?? null,
  });
}

function assertQuery(
  error: { message: string } | null,
  label: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}
