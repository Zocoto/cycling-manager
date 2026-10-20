import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getPerformancePreparationPolicy } from "@/lib/game/performance-preparation";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261020090000_rebalance_performance_preparations.sql",
  ),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ");
const rpc = migration.split(
  "create or replace function public.start_current_team_rider_performance_preparation(",
)[1]!.split("revoke all on function")[0]!;

describe("performance preparation balance migration", () => {
  it("keeps the SQL policy in sync with the five client-visible levels", () => {
    const policyRows = [...migration.matchAll(
      /\((\d),\s*(\d+(?:\.\d+)?)::numeric,\s*(\d),\s*(\d)\)/g,
    )].map((match) => ({
      level: Number(match[1]),
      ratingBonus: Number(match[2]),
      bonusDays: Number(match[3]),
      capacity: Number(match[4]),
    }));

    expect(policyRows).toEqual([
      { level: 1, ratingBonus: 1, bonusDays: 3, capacity: 1 },
      { level: 2, ratingBonus: 1.5, bonusDays: 4, capacity: 1 },
      { level: 3, ratingBonus: 2, bonusDays: 4, capacity: 2 },
      { level: 4, ratingBonus: 2.5, bonusDays: 5, capacity: 2 },
      { level: 5, ratingBonus: 3, bonusDays: 6, capacity: 3 },
    ]);
    for (const { level, ...policy } of policyRows) {
      expect(getPerformancePreparationPolicy(level)).toEqual(policy);
    }
    expect(migration).toContain("where policy.level = p_level");
    expect(migration).toContain("immutable");
  });

  it("serializes rider and facility before counting raw occupied slots", () => {
    const riderLock = rpc.indexOf("from public.riders as rider");
    const facilityLock = rpc.indexOf("from public.team_infrastructures as infrastructure");
    const occupiedCount = rpc.indexOf("select count(*)::integer");
    const insert = rpc.indexOf("insert into public.rider_form_camps");

    expect(riderLock).toBeGreaterThan(0);
    expect(facilityLock).toBeGreaterThan(riderLock);
    expect(occupiedCount).toBeGreaterThan(facilityLock);
    expect(insert).toBeGreaterThan(occupiedCount);
    expect(rpc.slice(riderLock, facilityLock)).toContain("for update;");
    expect(rpc.slice(facilityLock, occupiedCount)).toContain("for update;");
    expect(normalized).toContain("if v_occupied >= v_policy.capacity then");
    expect(normalized).toContain(
      "where preparation.team_id = v_context.team_id and preparation.preparation_type = p_preparation_type and preparation.status = 'planned'",
    );
    expect(normalized).toContain(
      "drop index if exists public.rider_performance_preparations_facility_active_idx",
    );
    expect(normalized).toContain(
      "create index if not exists rider_performance_preparations_facility_planned_idx on public.rider_performance_preparations(team_id, preparation_type) where status = 'planned'",
    );
    expect(migration).not.toMatch(/create unique index/i);
  });

  it("blocks inclusive same-type bonus overlaps across teams without blocking other types", () => {
    const overlap = rpc.split("-- A transfer must not allow stacking")[1]!
      .split("select count(*)::integer")[0]!;

    expect(overlap).toContain("preparation.rider_id = p_rider_id");
    expect(overlap).toContain("preparation.preparation_type = p_preparation_type");
    expect(overlap).toContain("preparation.status <> 'cancelled'");
    expect(overlap).toContain("preparation.bonus_start_game_day <= v_bonus_end");
    expect(overlap).toContain("preparation.bonus_end_game_day >= v_bonus_start");
    expect(overlap).not.toContain("preparation.team_id");
    expect(normalized).toContain("v_bonus_start := v_game_day + 3");
    expect(normalized).toContain("v_bonus_end := v_game_day + 2 + v_policy.bonus_days");
    expect(normalized).toContain("camp.start_day_number <= v_context.current_day_number + 2");
    expect(normalized).toContain("camp.end_day_number >= v_context.current_day_number + 1");
  });

  it("preserves authentication, ownership, injury, race and season guards", () => {
    for (const marker of [
      "if auth.uid() is null then",
      "p_preparation_type not in ('indoor_track', 'wind_tunnel')",
      "director.auth_user_id = auth.uid()",
      "assignment.role = 'general_manager'",
      "assignment.status = 'active'",
      "director.status = 'active'",
      "season.status = 'active'",
      "contract.rider_id = p_rider_id",
      "contract.team_id = v_context.team_id",
      "contract.status = 'active'",
      "injury.status <> 'recovered'",
      "registration.status = 'accepted'",
      "day.day_number between v_context.current_day_number + 1 and v_context.current_day_number + 2",
      "if v_context.current_day_number > 26 then",
      "v_context.current_day_number + 1, v_context.current_day_number + 2, 0, 0, 0",
    ]) {
      expect(normalized).toContain(marker);
    }
  });

  it("retains architect efficiency and the existing 3.3 temporary-rating ceiling", () => {
    expect(normalized).toContain("v_bonus := least(3.3, greatest(1, round(");
    expect(normalized).toContain(
      "v_policy.rating_bonus * public.get_team_infrastructure_efficiency_multiplier( v_context.team_id, p_preparation_type )",
    );
    expect(migration).not.toContain("alter column rating_bonus");
    expect(migration).not.toContain("drop constraint");
  });

  it("settles only this team's expired slots without altering historical bonuses or ratings", () => {
    expect(normalized).toContain(
      "update public.rider_performance_preparations as preparation set status = 'completed' where preparation.team_id = v_context.team_id and preparation.status = 'planned' and preparation.preparation_end_game_day < v_game_day",
    );
    expect(migration).not.toContain("perform public.settle_due_rider_performance_preparations()");
    expect(migration).not.toMatch(/update\s+public\.(riders|rider_ratings|official_stage_simulations)\b/i);
    expect(migration).not.toMatch(/set\s+(rating_bonus|bonus_start_game_day|bonus_end_game_day)\s*=/i);
    expect(migration).not.toMatch(/delete\s+from\b/i);
  });

  it("bounds migration locks and preserves backend RPC permissions", () => {
    expect(migration.trim()).toMatch(/^begin;/);
    expect(migration.trim()).toMatch(/commit;$/);
    expect(migration).toContain("set local lock_timeout = '3s'");
    expect(migration).toContain("set local statement_timeout = '8s'");
    expect(migration).toContain("security definer\nset search_path = ''");
    for (const signature of [
      "get_performance_preparation_policy(integer)",
      "start_current_team_rider_performance_preparation(uuid, text)",
    ]) {
      expect(normalized).toContain(
        `revoke all on function public.${signature} from public, anon`,
      );
      expect(normalized).toContain(
        `grant execute on function public.${signature} to authenticated, service_role`,
      );
    }
    expect((migration.match(/\$\$/g)?.length ?? 0) % 2).toBe(0);
  });
});
