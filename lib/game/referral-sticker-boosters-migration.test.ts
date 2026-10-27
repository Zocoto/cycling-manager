import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261027180000_add_s5_referral_sticker_boosters.sql"), "utf8");

describe("S5 additive referral booster delivery", () => {
  it("never replaces the existing reward or qualification functions", () => {
    expect(migration).not.toMatch(/create or replace function (?:private\.sync_referral_rewards|private\.qualify_referral|public\.get_current_referral)/);
    expect(migration).not.toMatch(/(?:update|delete from) public\.(?:sporting_director_referrals|daily_reward_inventory|referral_reward_grants)/);
    expect(migration).toContain("after insert or update of status");
  });

  it("arms a private, edition-bound stock with no client mint or migration backfill", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("director.auth_user_id = auth.uid()");
    expect(migration).toContain("unique (source_referral_id, copy_number)");
    expect(migration).toContain("collection.game_year >= 5");
    expect(migration).toContain("source.game_year = collection.game_year - 1");
    expect(migration).toContain("Europe/Paris");
    expect(migration).toContain("grant select on public.cyclo_sticker_boosters to authenticated");
    expect(migration).not.toMatch(/grant (?:insert|update|all)[^;]+to authenticated/);
  });
});
