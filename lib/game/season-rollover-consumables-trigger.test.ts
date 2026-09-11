import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260911153000_carry_consumables_on_team_rollover.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

describe("future consumable rollover", () => {
  it("hooks the next team-season creation and remains idempotent", () => {
    expect(migration).toContain("create or replace function public.carry_team_consumables_on_rollover()");
    expect(migration).toContain("after insert or update of status");
    expect(migration).toContain("zzz_team_season_consumable_rollover");
    expect(migration).toContain("on conflict (source_season_id, target_season_id, team_id, inventory_item_id)");
    expect(migration).toContain("quantity = public.team_item_inventory.quantity + excluded.quantity");
  });

  it("keeps available rewards only when their expiry reaches the target season", () => {
    expect(migration).toContain("inventory.status = 'available'");
    expect(migration).toContain("inventory.expires_after_game_year >= target_season.game_year");
    expect(migration).toContain("daily_reward_wildcard_reservations");
  });
});
