import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  applyClubShopWholesaleDiscount,
  getClubShopEffectiveDemandPrice,
  getClubShopSpecializationEffects,
} from "./club-shop-specialization";

describe("club shop specializations", () => {
  it("laisse une hausse de prix de 8 % sans pénalité de demande en gamme premium", () => {
    expect(
      getClubShopEffectiveDemandPrice({
        salePrice: 108,
        specialization: { code: "premium_retail", infrastructureLevel: 5 },
      }),
    ).toBe(100);
  });

  it("module les effets avec la puissance du magasin", () => {
    expect(
      getClubShopSpecializationEffects({
        code: "premium_retail",
        infrastructureLevel: 3,
      }).acceptedMarginBonusPercentage,
    ).toBe(4.8);
    expect(
      getClubShopSpecializationEffects({
        code: "limited_editions",
        infrastructureLevel: 4,
      }),
    ).toMatchObject({
      prolificDayChanceBonusPoints: 8,
      wholesaleCostReductionPercentage: 4,
    });
  });

  it("réduit le prix payé des matières premières", () => {
    expect(
      applyClubShopWholesaleDiscount({
        unitCost: 38,
        specialization: { code: "limited_editions", infrastructureLevel: 5 },
      }),
    ).toBe(36.1);
  });

  it("câble ventes, prix premium et achats dans les fonctions de production", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260908143000_activate_club_shop_specializations.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("get_team_club_shop_daily_demand_factor");
    expect(migration).toContain("get_team_club_shop_effective_demand_price");
    expect(migration).toContain("get_team_club_shop_wholesale_cost_multiplier");
    expect(migration).toContain("get_team_club_shop_volume_multiplier");
  });
});
