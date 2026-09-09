import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260909160000_add_operational_staff_affixes.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

describe("operational staff affixes migration", () => {
  it("active les quatre affixes dans le catalogue", () => {
    for (const code of [
      "physio_rider_capacity",
      "physio_fatigue_recovery",
      "preparer_reconnaissance_cost",
      "research_setback_protection",
    ]) {
      expect(migration).toContain(`'${code}'`);
    }
    expect(migration).toContain("is_active = true");
  });

  it("valide le quota élargi dans les deux RPC d'affectation kiné", () => {
    expect(migration).toContain(
      "get_physiotherapist_contract_rider_capacity",
    );
    expect(migration).toContain(
      "requested.staff_contract_id, member.level",
    );
    expect(migration).toContain(
      "v_context.contract_id, v_context.level",
    );
  });

  it("réduit seulement la nouvelle blessure de fatigue du coureur suivi", () => {
    expect(migration).toContain(
      "create or replace function public.get_rider_physio_fatigue_recovery_hours",
    );
    expect(migration).toContain("assignment.status = 'active'");
    expect(migration).toContain("rider_contract.status = 'active'");
    expect(migration).toContain("least(30, greatest(0, member.level) * 6)");
    expect(migration).toContain(
      "new.physiotherapist_recovery_hours_reduced := v_physio_reduction_hours",
    );
  });

  it("applique la remise avant le contrôle de trésorerie existant", () => {
    const priceApplication = migration.indexOf(
      "v_total_price := public.get_race_preparer_reconnaissance_price",
    );
    const balanceCheck = migration.indexOf(
      "if v_context.cash_balance < v_total_price then",
      priceApplication,
    );
    expect(priceApplication).toBeGreaterThan(-1);
    expect(balanceCheck).toBeGreaterThan(priceApplication);
    expect(migration).toContain(
      "then least(20, greatest(0, coalesce(p_level, 0)) * 4)",
    );
  });

  it("neutralise uniquement le malus d'un projet R&D infructueux", () => {
    expect(migration).toContain(
      "create or replace function public.get_equipment_rnd_setback_delta",
    );
    expect(migration).toContain("then 0\n    else -1");
    expect(migration).toContain(
      "v_delta := public.get_equipment_rnd_setback_delta(v_project.engineer_contract_id);",
    );
  });

  it("n'ajoute ni tâche planifiée ni boucle métier globale", () => {
    expect(migration).not.toContain("cron.schedule");
    expect(migration).not.toContain("pg_cron");
    expect(migration).not.toMatch(/for\s+\w+\s+in\s+select/i);
  });
});
