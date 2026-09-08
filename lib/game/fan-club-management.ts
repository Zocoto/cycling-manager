import {
  estimateDailyProductSales,
  getFanClubPriceDemandFactor,
  type FanClubProduct,
} from "@/lib/game/fan-club-pilot";
import {
  getClubShopEffectiveDemandPrice,
  getClubShopSpecializationEffects,
  type ClubShopSpecialization,
} from "@/lib/game/club-shop-specialization";

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

export type FanClubWholesalePrice = {
  productId: string;
  dayNumber: number;
  unitCost: number;
};

export type FanClubManagementState = {
  shopSpecialization: ClubShopSpecialization | null;
  fleet: Readonly<Record<string, number>>;
  trips: ReadonlyArray<FanClubTripAllocation>;
  inventory: ReadonlyArray<FanClubInventoryItem>;
  recentSales: ReadonlyArray<FanClubShopSale>;
  wholesaleMarket: ReadonlyArray<FanClubWholesalePrice>;
  eligibleCollectorProductIds: ReadonlyArray<string>;
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
  shopSpecialization?: ClubShopSpecialization | null;
}): FanClubSalesForecast {
  const effectiveSalePrice = getClubShopEffectiveDemandPrice({
    salePrice: input.salePrice,
    specialization: input.shopSpecialization,
  });
  const { salesVolumeBonusPercentage } = getClubShopSpecializationEffects(
    input.shopSpecialization,
  );
  const priceAdjustedInput = {
    ...input,
    salePrice: effectiveSalePrice,
  };
  const expected = Math.max(
    0,
    Math.round(
      estimateDailyProductSales(priceAdjustedInput) *
        (1 + salesVolumeBonusPercentage / 100),
    ),
  );
  const priceFactor = getFanClubPriceDemandFactor(priceAdjustedInput);
  const ratio = effectiveSalePrice / input.product.suggestedSalePrice;
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
