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
      popularityIndex: 58,
      recentResultsMultiplier: 1,
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
});
