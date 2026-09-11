import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260911150000_recover_s2_consumable_inventories.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

describe("S2 consumable rollover recovery", () => {
  it("journals and restores generic consumables idempotently", () => {
    expect(migration).toContain("create table if not exists public.season_rollover_item_recoveries");
    expect(migration).toContain("from public.team_item_inventory as inventory");
    expect(migration).toContain("on conflict (source_season_id, target_season_id, team_id, inventory_item_id)");
    expect(migration).toContain("quantity = public.team_item_inventory.quantity + excluded.quantity");
  });

  it("moves only available daily rewards that remain valid into S3", () => {
    expect(migration).toContain("update public.daily_reward_inventory as inventory");
    expect(migration).toContain("inventory.status = 'available'");
    expect(migration).toContain("inventory.expires_after_game_year >= target_season.game_year");
    expect(migration).toContain("update public.daily_reward_wildcard_reservations as reservation");
  });
});
