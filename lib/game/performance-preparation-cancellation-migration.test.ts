import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261020120500_guard_cancelled_performance_preparations.sql"),
  "utf8",
);
const base = readFileSync(
  join(process.cwd(), "supabase/migrations/20261020090000_rebalance_performance_preparations.sql"),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ");

function patchLiteral(name: "v_old" | "v_new") {
  const value = migration.match(new RegExp(`${name} constant text := E'((?:''|[^'])*)';`))?.[1];
  if (value === undefined) throw new Error(`Missing guarded patch literal ${name}`);
  return value.replaceAll("\\n", "\n").replaceAll("''", "'");
}

describe("performance preparation cancellation and race-calendar consistency", () => {
  it("synchronizes any source-camp cancellation through one indexed row trigger", () => {
    expect(normalized).toContain(
      "create index if not exists rider_performance_preparations_camp_active_idx on public.rider_performance_preparations(form_camp_id) where status <> 'cancelled'",
    );
    expect(normalized).toContain("after update of status on public.rider_form_camps for each row");
    expect(normalized).toContain(
      "when (new.status = 'cancelled' and old.status is distinct from new.status)",
    );
    expect(normalized).toContain(
      "update public.rider_performance_preparations as preparation set status = 'cancelled' where preparation.form_camp_id = new.id and preparation.status <> 'cancelled'",
    );
    // Completion is not cancellation: normal finished preparations keep their bonus.
    expect(normalized).not.toContain("new.status = 'completed'");
    expect(normalized).toContain("revoke all on function public.cancel_performance_preparation_from_camp() from public, anon, authenticated");
  });

  it("repairs only at most 200 current/future ghosts without rewriting history", () => {
    const repair = migration.split("do $repair$")[1]!.split("$repair$;")[0]!;
    expect(repair).toContain("season.status = 'active'");
    expect(repair).toContain("camp.status = 'cancelled'");
    expect(repair).toContain("preparation.bonus_end_game_day >= v_game_day");
    expect(repair).toContain("limit 201");
    expect(repair).toContain("if cardinality(v_preparation_ids) > 200 then");
    expect(repair).toContain("where preparation.id = any(v_preparation_ids)");
    expect(migration).not.toMatch(/update\s+public\.(riders|rider_season_ratings|official_stage_simulations)\b/i);
    expect(migration).not.toMatch(/set\s+(rating_bonus|bonus_start_game_day|bonus_end_game_day)\s*=/i);
  });

  it("patches only the exact reviewed guard and preserves booking capacity, ownership and locks", () => {
    const oldGuard = patchLiteral("v_old");
    const newGuard = patchLiteral("v_new");
    expect(base.split(oldGuard)).toHaveLength(2);
    expect(newGuard).toContain("registration.status in ('pending', 'accepted')");
    expect(newGuard).toContain("roster.status in ('selected', 'confirmed')");
    expect(newGuard).toContain("stage.status <> 'cancelled'");
    const patched = base.replace(oldGuard, newGuard);
    // The text surrounding the guard is identical, including auth and serialization.
    expect(patched.split(newGuard)).toEqual(base.split(oldGuard));
    expect(patched).toContain("if v_occupied >= v_policy.capacity then");
    expect(patched).toContain("if auth.uid() is null then");
    expect(patched).toContain("contract.team_id = v_context.team_id");
    expect(patched.match(/for update;/g)).toHaveLength(2);
    expect(normalized).toContain("if v_count <> 1 then");
    expect(normalized).toContain("if position(v_new in v_definition) > 0 then return;");
    expect(normalized).toContain("position('v_occupied >= v_policy.capacity' in v_definition) = 0");
  });

  it("keeps the migration atomic with bounded locks and execution", () => {
    expect(migration.trim()).toMatch(/^begin;/);
    expect(migration.trim()).toMatch(/commit;$/);
    expect(migration).toContain("set local lock_timeout = '3s'");
    expect(migration).toContain("set local statement_timeout = '8s'");
    expect(migration).toContain("set local application_name = 'cyclostratege-preparation-postcheck-20261020'");
    expect(migration).toContain("security definer\nset search_path = ''");
    expect(migration).toContain("set statement_timeout = '5s'");
  });
});
