import {
  estimateDailyProductSales,
  getFanClubPriceDemandFactor,
  type FanClubProduct,
} from "@/lib/game/fan-club-pilot";

export type FanClubTripAllocation = {
  id: string;
  raceId: string;
  raceName: string;
  raceStatus: string;
  modelId: string;
  carCount: number;
  tripCost: number;
  createdAt: string;
};

export type FanClubInventoryItem = {
  productId: string;
  quantity: number;
  averageUnitCost: number;
  salePrice: number;
};

export type FanClubShopSale = {
  id: string;
  productId: string;
  seasonName: string;
  dayNumber: number;
  unitsSold: number;
  unitPrice: number;
  revenue: number;
  demandFactor: number;
};

export type FanClubManagementState = {
  fleet: Readonly<Record<string, number>>;
  trips: ReadonlyArray<FanClubTripAllocation>;
  inventory: ReadonlyArray<FanClubInventoryItem>;
  recentSales: ReadonlyArray<FanClubShopSale>;
};

export type FanClubSalesForecast = {
  low: number;
  expected: number;
  high: number;
  assessment:
    | "attractive"
    | "balanced"
    | "expensive"
    | "very-expensive"
    | "unmarketable";
};

export function estimateDailyProductSalesForecast(input: {
  product: FanClubProduct;
  salePrice: number;
  unitCost?: number;
  supporterCount: number;
  fervor: number;
  popularityIndex: number;
  recentResultsMultiplier?: number;
}): FanClubSalesForecast {
  const expected = estimateDailyProductSales(input);
  const priceFactor = getFanClubPriceDemandFactor(input);
  const ratio = input.salePrice / input.product.suggestedSalePrice;
  const assessment =
    priceFactor === 0 || expected === 0
      ? "unmarketable"
      : ratio <= 0.85
      ? "attractive"
      : ratio <= 1.1
        ? "balanced"
        : ratio <= 1.45
          ? "expensive"
          : "very-expensive";

  return {
    low: Math.max(0, Math.floor(expected * 0.55)),
    expected,
    high: Math.max(0, Math.ceil(expected * 1.45)),
    assessment,
  };
}

export function getAvailableCarsForRace({
  owned,
  allocated,
}: {
  owned: number;
  allocated: number;
}): number {
  return Math.max(0, Math.floor(owned) - Math.max(0, Math.floor(allocated)));
}
