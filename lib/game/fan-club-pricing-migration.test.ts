import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260816124500_balance_fan_club_shop_pricing.sql",
  ),
  "utf8",
);

describe("équilibrage des prix de la boutique du Fan Club", () => {
  it("applique la nouvelle courbe aux ventes courantes et de clôture", () => {
    expect(migration).toContain(
      "create or replace function public.settle_current_team_fan_club_sales()",
    );
    expect(migration).toContain(
      "create or replace function public.settle_team_fan_club_sales_for_day(",
    );
    expect(
      migration.match(/public\.calculate_fan_club_price_factor\(/g),
    ).toHaveLength(5);
  });

  it("supprime le plancher de demande et ajoute marge, popularité et plafond", () => {
    expect(migration).not.toContain("greatest(0.2");
    expect(migration).toContain("v_tolerated_cost_multiple");
    expect(migration).toContain("v_popularity_exception");
    expect(migration).toContain("v_customer_price_ceiling");
    expect(migration).toContain("if p_sale_price >= v_customer_price_ceiling");
  });
});
