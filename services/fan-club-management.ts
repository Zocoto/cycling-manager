import "server-only";

import type {
  FanClubInventoryItem,
  FanClubManagementState,
  FanClubShopSale,
  FanClubTripAllocation,
  FanClubWholesalePrice,
} from "@/lib/game/fan-club-management";
import type { FanClubLiveData } from "@/lib/game/fan-club-pilot";
import { isFanClubCollectorProductId } from "@/lib/game/fan-club-pilot";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type FleetRow = { model_code: string; quantity: number };
type TripRow = {
  id: string;
  race_edition_id: string;
  model_code: string;
  car_count: number;
  trip_cost: number | string;
  created_at: string;
};
type InventoryRow = {
  product_code: string;
  quantity: number;
  average_unit_cost: number | string;
  sale_price: number | string;
};
type SaleRow = {
  id: string;
  season_id: string;
  day_number: number;
  product_code: string;
  units_sold: number;
  unit_price: number | string;
  revenue: number | string;
  demand_factor: number | string;
};
type EditionRow = { id: string; display_name: string; status: string };
type SeasonRow = { id: string; name: string };
type WholesalePriceRow = {
  product_code: string;
  day_number: number;
  unit_cost: number | string;
};
type CollectorProductRow = { product_code: string };

export async function getFanClubManagementState({
  supabase,
  teamId,
  liveData,
}: {
  supabase: ServerClient;
  teamId: string;
  liveData: FanClubLiveData;
}): Promise<FanClubManagementState> {
  const admin = createSupabaseAdminClient();
  const profileResult = await admin.from("fan_club_profiles").upsert(
    {
      team_id: teamId,
      supporter_count: liveData.supporterCount,
      fervor: liveData.fervor,
      popularity_index: liveData.popularityIndex,
      recent_results_multiplier: liveData.recentResultsMultiplier,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "team_id" },
  );
  assertQuery(profileResult.error, "le profil de production du Fan Club");

  const [
    fleetResult,
    tripsResult,
    inventoryResult,
    salesResult,
    wholesaleMarketResult,
    collectorProductsResult,
  ] =
    await Promise.all([
      supabase
        .from("fan_club_fleet")
        .select("model_code, quantity")
        .eq("team_id", teamId)
        .returns<FleetRow[]>(),
      supabase
        .from("fan_club_trip_allocations")
        .select(
          "id, race_edition_id, model_code, car_count, trip_cost, created_at",
        )
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(30)
        .returns<TripRow[]>(),
      supabase
        .from("fan_club_shop_inventory")
        .select("product_code, quantity, average_unit_cost, sale_price")
        .eq("team_id", teamId)
        .returns<InventoryRow[]>(),
      supabase
        .from("fan_club_shop_sales")
        .select(
          "id, season_id, day_number, product_code, units_sold, unit_price, revenue, demand_factor",
        )
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(20)
        .returns<SaleRow[]>(),
      supabase.rpc("get_current_fan_club_wholesale_market"),
      supabase.rpc("get_current_team_fan_club_collector_products"),
    ]);

  assertQuery(fleetResult.error, "le parc de cars du Fan Club");
  assertQuery(tripsResult.error, "les déplacements du Fan Club");
  assertQuery(inventoryResult.error, "le stock du Fan Club");
  assertQuery(salesResult.error, "les ventes du Fan Club");
  assertQuery(
    wholesaleMarketResult.error,
    "le cours des matières premières du Fan Club",
  );
  assertQuery(
    collectorProductsResult.error,
    "les maillots collectors du Fan Club",
  );

  const tripRows = tripsResult.data ?? [];
  const saleRows = salesResult.data ?? [];
  const wholesaleMarketRows = Array.isArray(wholesaleMarketResult.data)
    ? (wholesaleMarketResult.data as unknown as WholesalePriceRow[])
    : [];
  const eligibleCollectorProductIds = Array.isArray(collectorProductsResult.data)
    ? [
        ...new Set(
          (collectorProductsResult.data as unknown as CollectorProductRow[])
            .map((row) => row.product_code)
            .filter(isFanClubCollectorProductId),
        ),
      ]
    : [];
  const editionIds = [...new Set(tripRows.map((row) => row.race_edition_id))];
  const seasonIds = [...new Set(saleRows.map((row) => row.season_id))];
  const [editionsResult, seasonsResult] = await Promise.all([
    editionIds.length > 0
      ? admin
          .from("race_editions")
          .select("id, display_name, status")
          .in("id", editionIds)
          .returns<EditionRow[]>()
      : Promise.resolve({ data: [] as EditionRow[], error: null }),
    seasonIds.length > 0
      ? admin
          .from("seasons")
          .select("id, name")
          .in("id", seasonIds)
          .returns<SeasonRow[]>()
      : Promise.resolve({ data: [] as SeasonRow[], error: null }),
  ]);
  assertQuery(editionsResult.error, "les courses des déplacements");
  assertQuery(seasonsResult.error, "les saisons des ventes");

  const editionById = new Map(
    (editionsResult.data ?? []).map((row) => [row.id, row]),
  );
  const seasonNameById = new Map(
    (seasonsResult.data ?? []).map((row) => [row.id, row.name]),
  );

  return {
    fleet: Object.fromEntries(
      (fleetResult.data ?? []).map((row) => [row.model_code, row.quantity]),
    ),
    trips: tripRows.map<FanClubTripAllocation>((row) => {
      const edition = editionById.get(row.race_edition_id);
      return {
        id: row.id,
        raceId: row.race_edition_id,
        raceName: edition?.display_name ?? "Course",
        raceStatus: edition?.status ?? "planned",
        modelId: row.model_code,
        carCount: row.car_count,
        tripCost: Number(row.trip_cost),
        createdAt: row.created_at,
      };
    }),
    inventory: (inventoryResult.data ?? []).map<FanClubInventoryItem>(
      (row) => ({
        productId: row.product_code,
        quantity: row.quantity,
        averageUnitCost: Number(row.average_unit_cost),
        salePrice: Number(row.sale_price),
      }),
    ),
    recentSales: saleRows.map<FanClubShopSale>((row) => ({
      id: row.id,
      productId: row.product_code,
      seasonName: seasonNameById.get(row.season_id) ?? "Saison",
      dayNumber: row.day_number,
      unitsSold: row.units_sold,
      unitPrice: Number(row.unit_price),
      revenue: Number(row.revenue),
      demandFactor: Number(row.demand_factor),
    })),
    wholesaleMarket: [
      ...wholesaleMarketRows.map<FanClubWholesalePrice>((row) => ({
        productId: row.product_code,
        dayNumber: row.day_number,
        unitCost: Number(row.unit_cost),
      })),
      ...eligibleCollectorProductIds.flatMap((productId) =>
        wholesaleMarketRows
          .filter((row) => row.product_code === "team-jersey")
          .map<FanClubWholesalePrice>((row) => ({
            productId,
            dayNumber: row.day_number,
            unitCost: Number(row.unit_cost),
          })),
      ),
    ],
    eligibleCollectorProductIds,
  };
}

function assertQuery(
  error: { message: string } | null,
  label: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}
