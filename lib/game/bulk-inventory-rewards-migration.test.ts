import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260816150000_group_and_bulk_use_inventory_rewards.sql",
  ),
  "utf8",
).toLowerCase();

describe("grouped inventory rewards migration", () => {
  it("range automatiquement les cadeaux matériels dans l’inventaire", () => {
    expect(migration).toContain(
      "create trigger store_daily_reward_equipment_in_inventory",
    );
    expect(migration).toContain("insert into public.team_equipment_inventory");
    expect(migration).toContain("new.status := 'used'");
    expect(migration).toContain("'migrated', true");
  });

  it("consomme les objets génériques en lot dans une transaction unique", () => {
    expect(migration).toContain(
      "create or replace function public.use_current_team_inventory_items",
    );
    expect(migration).toContain("for v_index in 1..p_quantity loop");
    expect(migration).toContain(
      "v_result := public.use_current_team_inventory_item",
    );
    expect(migration).toContain("'quantityapplied', p_quantity");
  });

  it("sélectionne uniquement le contingent quotidien disponible avant le cumul", () => {
    expect(migration).toContain(
      "create or replace function public.redeem_current_daily_rewards",
    );
    expect(migration).toContain("limit p_quantity");
    expect(migration).toContain("cardinality(v_inventory_ids)");
    expect(migration).toContain("foreach v_inventory_id in array v_inventory_ids loop");
    expect(migration).toContain(
      "ce type de cadeau doit être utilisé un exemplaire à la fois",
    );
  });
});
