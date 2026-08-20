import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260820180000_create_global_fan_club_wholesale_market.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("cours global des matières premières du Fan Club", () => {
  it("persiste un prix unique par saison, journée et article", () => {
    expect(migration).toContain("create table public.fan_club_wholesale_prices");
    expect(migration).toContain(
      "primary key (season_id, day_number, product_code)",
    );
    expect(migration).not.toContain("team_id uuid");
  });

  it("génère un mouvement non nul chaque journée dans une fourchette bornée", () => {
    expect(migration).toContain("v_direction * v_magnitude");
    expect(migration).toContain("if v_candidate = v_previous_price then");
    expect(migration).toContain("v_product.base_unit_cost * 0.82");
    expect(migration).toContain("v_product.base_unit_cost * 1.18");
  });

  it("alimente la courbe et l’achat avec la même table de cours", () => {
    expect(migration).toContain(
      "create or replace function public.get_current_fan_club_wholesale_market()",
    );
    expect(migration).toContain(
      "create or replace function public.purchase_current_team_fan_club_stock(",
    );
    expect(
      migration.match(/from public\.fan_club_wholesale_prices price/g),
    ).toHaveLength(4);
  });
});
