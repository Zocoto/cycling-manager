import { describe, expect, it } from "vitest";

import { FAN_CLUB_PRODUCTS } from "./fan-club-pilot";
import {
  estimateDailyProductSalesForecast,
  getAvailableCarsForRace,
} from "./fan-club-management";

describe("gestion de production du Fan Club", () => {
  it("ne réserve un car qu’une fois sur une même course", () => {
    expect(getAvailableCarsForRace({ owned: 3, allocated: 2 })).toBe(1);
    expect(getAvailableCarsForRace({ owned: 3, allocated: 3 })).toBe(0);
  });

  it("dégrade nettement la prévision lorsque le prix devient trop élevé", () => {
    const product = FAN_CLUB_PRODUCTS[0];
    const inputs = {
      product,
      supporterCount: 12_480,
      fervor: 74,
    };
    const balanced = estimateDailyProductSalesForecast({
      ...inputs,
      salePrice: product.suggestedSalePrice,
      unitCost: 38,
    });
    const expensive = estimateDailyProductSalesForecast({
      ...inputs,
      salePrice: 500,
      unitCost: 38,
    });

    expect(balanced.expected).toBeGreaterThan(expensive.expected);
    expect(expensive.expected).toBe(0);
    expect(expensive.assessment).toBe("unmarketable");
    expect(balanced.low).toBeLessThan(balanced.high);
  });

  it("préserve la demande avec 8 % de prix supplémentaire en Gamme premium", () => {
    const product = FAN_CLUB_PRODUCTS[0];
    const inputs = {
      product,
      supporterCount: 12_480,
      fervor: 74,
      unitCost: 38,
    };
    const baseline = estimateDailyProductSalesForecast({
      ...inputs,
      salePrice: product.suggestedSalePrice,
    });
    const premium = estimateDailyProductSalesForecast({
      ...inputs,
      salePrice: product.suggestedSalePrice * 1.08,
      shopSpecialization: {
        code: "premium_retail",
        infrastructureLevel: 5,
      },
    });

    expect(premium.expected).toBe(baseline.expected);
    expect(premium.assessment).toBe(baseline.assessment);
  });

  it("ajoute 10 % de volume à pleine puissance en Grande diffusion", () => {
    const product = FAN_CLUB_PRODUCTS[0];
    const inputs = {
      product,
      salePrice: product.suggestedSalePrice,
      unitCost: 38,
      supporterCount: 12_480,
      fervor: 74,
    };
    const baseline = estimateDailyProductSalesForecast(inputs);
    const volume = estimateDailyProductSalesForecast({
      ...inputs,
      shopSpecialization: {
        code: "volume_retail",
        infrastructureLevel: 5,
      },
    });

    expect(volume.expected).toBe(Math.round(baseline.expected * 1.1));
  });
});
