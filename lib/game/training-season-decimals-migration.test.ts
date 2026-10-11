import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261011170000_preserve_training_decimals_between_seasons.sql", import.meta.url), "utf8");
describe("training fractional continuity across seasons", () => {
  it("carries only the signed fractional remainder, with an idempotent receipt", () => {
    expect(migration).toContain("previous.balance_milli % 1000");
    expect(migration).toContain("source.game_year=target.game_year-1");
    expect(migration).toContain("source.status='completed'");
    expect(migration).toContain("primary key (rider_id, target_season_id, stat_code)");
    expect(migration).toContain("after insert on public.rider_training_stat_progress");
  });
  it("initializes at rollover before the next morning and keeps live engines intact", () => {
    expect(migration).toContain("get diagnostics v_copied_riders = row_count;");
    expect(migration).toContain("perform private.seed_season_training_progress(v_target.id)");
    expect(migration).toContain("if v_count <> 1 then raise exception");
    expect(migration).not.toContain("create or replace function public.settle_due_training_sessions");
    expect(migration).not.toContain("create or replace function public.settle_due_free_agent_training");
  });
  it("restores current balances without replaying reports or resetting seasonal counters", () => {
    expect(migration).toContain("v_progress.balance_milli + v_carry");
    expect(migration).toContain("rating_gain=rating_gain+greatest(0,v_change)");
    expect(migration).not.toContain("update public.rider_training_sessions");
    expect(migration).not.toContain("total_training_milli=");
    expect(migration).toContain("Only the active season can receive");
    expect(migration).toContain("limit least(100,greatest(1,");
  });
  it("bounds locks and retains cap, decline and permission safeguards", () => {
    expect(migration).toContain("set local lock_timeout = '5s'");
    expect(migration).toContain("set local statement_timeout = '30s'");
    expect(migration).toContain("get_rider_potential_stat_cap");
    expect(migration).toContain("v_rating.age < 32");
    expect(migration).toContain("v_balance <= -1000");
    expect(migration).toContain("from public, anon, authenticated");
  });
});
