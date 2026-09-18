import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260918160000_prepare_pending_elite_wildcards.sql",
  ),
  "utf8",
);

describe("préparation des WildCards Élite en attente", () => {
  it("n'ouvre les RPC qu'aux vraies demandes Élite encore en attente", () => {
    expect(migration).toContain("registration.status = 'pending'");
    expect(migration).toContain("registration.entry_method = 'requested'");
    expect(migration).toContain("category.code = 'elite'");
    expect(migration).toContain("public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)");
    expect(migration).toContain("public.save_current_team_time_trial_preparation(uuid,uuid,jsonb)");
    expect(migration).toContain("public.save_current_team_race_equipment_plan(uuid,uuid,jsonb,boolean)");
    expect(migration).toContain("public.assert_reconnaissance_riders_registered(");
  });

  it("annule les plans et la reconnaissance sans contre-écriture financière", () => {
    expect(migration).toContain("old.status <> 'pending'");
    expect(migration).toContain("new.status <> 'rejected'");
    expect(migration).toContain("delete from public.race_stage_strategies");
    expect(migration).toContain("delete from public.race_roster_stage_roles");
    expect(migration).toContain("delete from public.race_time_trial_rider_plans");
    expect(migration).toContain("delete from public.race_stage_equipment_assignments");
    expect(migration).toContain("update public.stage_reconnaissances as reconnaissance");
    expect(migration).toContain("update public.rider_form_camps as camp");
    expect(migration).not.toMatch(/insert\s+into\s+public\.team_finance_transactions/i);
    expect(migration).not.toMatch(/update\s+public\.team_seasons\s+set\s+cash_balance/i);
  });
});
