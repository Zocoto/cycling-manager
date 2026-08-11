import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260811130000_implement_atomic_season_rollover.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");
const maintenanceRoute = readFileSync(
  resolve(process.cwd(), "app/api/cron/game-maintenance/route.ts"),
  "utf8",
);
const vercelConfig = readFileSync(
  resolve(process.cwd(), "vercel.json"),
  "utf8",
);

describe("atomic season rollover", () => {
  it("is locked, audited, idempotent, and service-role only", () => {
    expect(migration).toContain("create table if not exists public.season_rollover_settlements");
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).toContain("idempotentReplay");
    expect(migration).toContain("create or replace function public.get_season_rollover_readiness");
    expect(migration).toMatch(
      /revoke all on function public\.rollover_game_season\(uuid, boolean\)[\s\S]*from public, anon, authenticated/,
    );
    expect(migration).toContain(
      "grant execute on function public.settle_due_season_rollovers() to service_role",
    );
  });

  it("closes sporting and financial state before activating the next season", () => {
    const objectives = migration.indexOf("aaa_team_season_sponsor_objective_closure");
    const finances = migration.indexOf("bbb_team_season_financial_closure");
    const completeTeams = migration.indexOf("set status = 'completed'\n  where season_id = v_source.id");
    const completeSeason = migration.indexOf("set status = 'completed', current_day_number = 28");
    const activateSeason = migration.indexOf("set status = 'active', current_day_number = 1");

    expect(objectives).toBeGreaterThanOrEqual(0);
    expect(finances).toBeGreaterThan(objectives);
    expect(completeTeams).toBeGreaterThan(finances);
    expect(completeSeason).toBeGreaterThan(completeTeams);
    expect(activateSeason).toBeGreaterThan(completeSeason);
    expect(migration).toContain("edition.status not in ('completed', 'cancelled')");
  });

  it("carries riders, age, profile state, teams, training choices, and inventory", () => {
    expect(migration).toContain("least(60, rating.age + 1)");
    expect(migration).toContain("insert into public.rider_season_summaries");
    expect(migration).toContain("'season_rollover'");
    expect(migration).toContain("insert into public.team_training_setting_versions");
    expect(migration).toContain("insert into public.rider_training_plan_versions");
    expect(migration).toContain("insert into public.team_equipment_inventory");
    expect(migration).toContain("opening_cash_balance = excluded.opening_cash_balance");
    expect(migration).toContain("finance_start_day_number = 1");
  });

  it("settles contracts, sponsors, transfers, partner equipment, and youth", () => {
    expect(migration).toContain("update public.staff_contracts");
    expect(migration).toContain("update public.team_manager_assignments");
    expect(migration).toContain("update public.team_sponsor_contracts as contract");
    expect(migration).toContain("contract.contract_duration_seasons - 1");
    expect(migration).toContain("update public.transfer_market_listings");
    expect(migration).toContain("update public.direct_transfer_offers");
    expect(migration).toContain("update public.equipment_partner_contracts as contract");
    expect(migration).toContain("academy.promotion_game_year <= v_target.game_year");
    expect(migration).toContain("'youth-tuition:'");
  });

  it("runs deferred work sequentially and rolls over just after Paris midnight", () => {
    expect(maintenanceRoute).toContain("settle_due_staff_academy_trainings");
    expect(maintenanceRoute).toContain("settle_due_season_rollovers");
    expect(maintenanceRoute).toContain("for (const task of MAINTENANCE_TASKS)");
    expect(maintenanceRoute).not.toContain("Promise.all(");
    expect(maintenanceRoute.indexOf("settle_due_season_rollovers")).toBeGreaterThan(
      maintenanceRoute.indexOf("settle_due_staff_academy_trainings"),
    );
    expect(vercelConfig).toContain('"schedule": "5 23 * * *"');
  });
});
