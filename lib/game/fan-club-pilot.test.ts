import { describe, expect, it } from "vitest";

import {
  calculateCarResalePrice,
  calculateFanClubTripPreview,
  estimateDailyProductSales,
  FAN_CLUB_CAR_MODELS,
  FAN_CLUB_PRODUCTS,
  FAN_CLUB_SHOP_LEVELS,
  getAvailableTravelingSupporters,
  getCurrentWholesalePrice,
  getFanClubPriceDemandFactor,
  getPopularityMaturityCap,
  getWholesaleTrendPercent,
} from "./fan-club-pilot";

describe("popularité du Fan Club", () => {
  it("plafonne la progression normale pendant les deux premières saisons", () => {
    expect(getPopularityMaturityCap(1)).toBe(60);
    expect(getPopularityMaturityCap(2)).toBe(80);
    expect(getPopularityMaturityCap(3)).toBe(100);
  });

  it("autorise une saison phénoménale à lever le plafond", () => {
    expect(getPopularityMaturityCap(1, true)).toBe(100);
  });
});

describe("déplacements du Fan Club", () => {
  const regionalCar = FAN_CLUB_CAR_MODELS[0];

  it("rend 40 % des supporters disponibles pour chaque déplacement", () => {
    expect(getAvailableTravelingSupporters(12_480)).toBe(4_992);
  });

  it("autorise le départ d’un car qui n’est pas rempli", () => {
    expect(
      calculateFanClubTripPreview({
        model: regionalCar,
        requestedCars: 1,
        ownedCars: 1,
        supporterCount: 50,
        distanceKm: 170,
      }),
    ).toMatchObject({
      cars: 1,
      seats: 40,
      availableSupporters: 20,
      travelers: 20,
      occupancyRate: 50,
      name: "Présence visible",
    });
  });

  it("ne permet pas d’envoyer davantage de cars que le parc disponible", () => {
    expect(
      calculateFanClubTripPreview({
        model: regionalCar,
        requestedCars: 8,
        ownedCars: 2,
        supporterCount: 12_480,
        distanceKm: 420,
      }).cars,
    ).toBe(2);
  });

  it("calcule la valeur de revente selon le modèle", () => {
    expect(calculateCarResalePrice(regionalCar)).toBe(55_250);
  });
});

describe("boutique du Fan Club", () => {
  const jersey = FAN_CLUB_PRODUCTS[0];

  it("propose les cinq paliers de capacité retenus", () => {
    expect(FAN_CLUB_SHOP_LEVELS.map((level) => level.capacity)).toEqual([
      300, 800, 1_600, 3_000, 5_000,
    ]);
  });

  it("annule la demande quand le prix dépasse le plafond psychologique", () => {
    const commonInputs = {
      product: jersey,
      supporterCount: 12_480,
      fervor: 74,
      popularityIndex: 58,
    };
    const fairPriceDemand = estimateDailyProductSales({
      ...commonInputs,
      salePrice: jersey.suggestedSalePrice,
    });
    const unmarketableDemand = estimateDailyProductSales({
      ...commonInputs,
      salePrice: 500,
      unitCost: 38,
    });

    expect(fairPriceDemand).toBeGreaterThan(0);
    expect(unmarketableDemand).toBe(0);
  });

  it("calcule le cours courant et sa tendance depuis l’historique réel", () => {
    expect(getCurrentWholesalePrice(jersey, [36.5, 37.25, 38.75])).toBe(38.75);
    expect(getWholesaleTrendPercent(jersey, [36.5, 37.25, 38.75])).toBeCloseTo(
      6.16,
      1,
    );
  });

  it("fait chuter la demande au-delà de 100 % de marge", () => {
    const commonInputs = {
      product: jersey,
      unitCost: 38,
      supporterCount: 12_480,
      fervor: 74,
      popularityIndex: 58,
    };
    const fairPriceDemand = estimateDailyProductSales({
      ...commonInputs,
      salePrice: 69,
    });
    const excessiveMarginDemand = estimateDailyProductSales({
      ...commonInputs,
      salePrice: 110,
    });

    expect(excessiveMarginDemand).toBeLessThan(fairPriceDemand * 0.2);
  });

  it("réserve l’exception de popularité aux équipes réellement immenses", () => {
    const commonInputs = {
      product: jersey,
      salePrice: 100,
      unitCost: 38,
    };

    expect(
      getFanClubPriceDemandFactor({ ...commonInputs, popularityIndex: 100 }),
    ).toBeGreaterThan(
      getFanClubPriceDemandFactor({ ...commonInputs, popularityIndex: 80 }),
    );
  });
});
