import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260824150000_make_equipment_rnd_free_scalable_and_parallel.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("free, scalable and parallel equipment R&D migration", () => {
  it("makes every newly launched research financially free", () => {
    const startFunction = migration.slice(
      migration.indexOf(
        "create or replace function public.start_current_team_equipment_rnd",
      ),
      migration.indexOf("-- Les recherches actives adoptent"),
    );

    expect(startFunction).toContain("research_cost,");
    expect(startFunction).toContain("v_success,\n    0,");
    expect(startFunction).not.toContain("cash_balance");
    expect(startFunction).not.toContain("team_finance_transactions");
    expect(startFunction).not.toContain("Trésorerie insuffisante");
  });

  it("requires one available active engineer per project", () => {
    expect(migration).toContain(
      "if p_engineer_contract_id is null then",
    );
    expect(migration).toContain(
      "equipment_rnd_one_active_per_engineer_idx",
    );
    expect(migration).toContain(
      "where status = 'active' and engineer_contract_id is not null",
    );
    expect(migration).toContain(
      "if v_active_project_count >= v_engineer_count then",
    );
    expect(migration).not.toContain(
      "create unique index equipment_rnd_one_active_idx",
    );
  });

  it("implements the requested exponential duration milestones", () => {
    expect(migration).toContain("when value = 1 then 3");
    expect(migration).toContain("when value = 2 then 5");
    expect(migration).toContain(
      "5 * power(2::numeric, value - 2)",
    );
    expect(migration).toContain(
      "public.calculate_equipment_rnd_duration_days(",
    );
  });

  it("recalculates active projects and indexes due settlement work", () => {
    expect(migration).toContain("equipment_rnd_due_idx");
    expect(migration).toContain("where project.status = 'active'");
    expect(migration).toContain(
      "project.starts_game_day_index + recalculated.duration_days",
    );
    expect(migration).toContain("set statement_timeout = '0'");
  });
});
