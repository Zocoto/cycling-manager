import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const migration = readFileSync("supabase/migrations/20261025100000_isolate_training_plan_save_failures.sql", "utf8");
const page = readFileSync("app/jeu/entrainement/page.tsx", "utf8");
describe("durable partial training save guards", () => {
  it("keeps authorization, bounded batches, timeouts and a private search path", () => {
    expect(migration).toContain("if auth.uid() is null");
    expect(migration).toContain("between 1 and 35");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("set lock_timeout = '2500ms'");
    expect(migration).toContain("set statement_timeout = '12s'");
    expect(migration).toContain("from public, anon");
  });
  it("synchronizes the season only once and before taking team-local locks", () => {
    const sync = "v_effective_day := public.get_training_effective_day_number(v_context.season_id);";
    expect(migration.split(sync)).toHaveLength(2);
    expect(migration.indexOf(sync)).toBeLessThan(migration.indexOf("perform 1 from public.teams"));
    expect(migration).toContain("for no key update");
  });
  it("protects final quotas after rider-local failure without rewriting historical rows", () => {
    expect(migration).toContain("final_assignments as (");
    expect(migration).toContain("while not v_completed loop");
    expect(migration).toContain("exception when data_exception or integrity_constraint_violation or raise_exception");
    expect(migration).not.toContain("when others");
    expect(migration).not.toContain("update public.rider_training_plan_versions");
    expect(migration).toContain("on conflict (rider_id, season_id, effective_from_day_number)");
  });
  it("does not remount the editor when only a saved program changes", () => {
    expect(page).toContain("key={`${overview.teamId}:${overview.seasonId}`}");
    expect(page).not.toContain("`${rider.id}:${rider.plan.intensity}");
  });
});
