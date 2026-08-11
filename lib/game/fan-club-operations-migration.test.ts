import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260811120000_create_fan_club_operations.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("migration des opérations du Fan Club", () => {
  it("persiste le parc, les affrètements, le stock et les ventes", () => {
    expect(migration).toContain("create table public.fan_club_fleet");
    expect(migration).toContain("create table public.fan_club_trip_allocations");
    expect(migration).toContain("create table public.fan_club_shop_inventory");
    expect(migration).toContain("create table public.fan_club_shop_sales");
  });

  it("limite chaque modèle de car au parc possédé sur une course", () => {
    expect(migration).toContain(
      "unique (team_id, race_edition_id, model_code)",
    );
    expect(migration).toContain(
      "Chaque car ne peut être engagé qu’une fois sur cette course.",
    );
  });

  it("règle automatiquement des ventes aléatoires sensibles au prix", () => {
    expect(migration).toContain(
      "create or replace function public.settle_current_team_fan_club_sales()",
    );
    expect(migration).toContain("0.55 + random() * 0.90");
    expect(migration).toContain(
      "power(v_suggested_price / v_inventory.sale_price, v_elasticity)",
    );
  });
});
