import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260912143000_align_daily_rewards_with_inventory_summary.sql",
  ),
  "utf8",
);

describe("daily reward inventory summary migration", () => {
  it("counts every available non-equipment daily reward on the dashboard", () => {
    expect(migration).toContain(
      "create or replace function public.get_current_dashboard_fast_summary_v2()",
    );
    expect(migration).toContain(
      "summary.inventory_total_units + daily_rewards.quantity",
    );
    expect(migration).toContain(
      "summary.inventory_available_units + daily_rewards.quantity",
    );
    expect(migration).toContain("inventory.status = 'available'");
    expect(migration).toContain(
      "inventory.expires_after_game_year >= season.game_year",
    );
    expect(migration).toContain("catalog.effect_kind <> 'equipment'");
  });

  it("keeps daily reward equipment out of the extra count", () => {
    expect(migration).toContain("catalog.effect_kind <> 'equipment'");
    expect(migration).not.toContain("public.team_equipment_inventory");
  });

  it("rejects a daily claim that is committed without an inventory object", () => {
    expect(migration).toContain(
      "create constraint trigger ensure_daily_reward_claim_has_inventory",
    );
    expect(migration).toContain("deferrable initially deferred");
    expect(migration).toContain("inventory.source_claim_id = new.id");
    expect(migration).toContain(
      "La récompense quotidienne réclamée doit être ajoutée à l’inventaire.",
    );
  });
});
