import { describe, expect, it } from "vitest";

import {
  calculateCarResalePrice,
  calculateFanClubTripPreview,
  estimateDailyProductSales,
  FAN_CLUB_CAR_MODELS,
  FAN_CLUB_PRODUCTS,
  FAN_CLUB_SHOP_LEVELS,
  getAvailableTravelingSupporters,
  getPopularityMaturityCap,
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

  it("réduit la demande lorsque le DS augmente fortement son prix", () => {
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
    const expensiveDemand = estimateDailyProductSales({
      ...commonInputs,
      salePrice: jersey.suggestedSalePrice * 2,
    });

    expect(fairPriceDemand).toBeGreaterThan(expensiveDemand);
    expect(expensiveDemand).toBeGreaterThan(0);
  });
});
