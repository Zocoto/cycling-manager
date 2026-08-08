import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260808165300_fix_rider_contract_extension_consistency.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const renewalFunction = migration.slice(
  migration.indexOf("create or replace function public.renew_current_team_rider"),
);

describe("rider contract extension consistency migration", () => {
  it("fusionne les anciennes prolongations planifiées dans le contrat actif", () => {
    expect(migration).toContain("select distinct on (active_contract.id)");
    expect(migration).toContain("planned_end.game_year > active_end.game_year");
    expect(migration).toContain("set end_season_id = legacy_extension.end_season_id");
    expect(migration).toContain("set status = 'cancelled'");
    expect(migration).toContain("planned_contract.acquisition_type = 'renewal'");
  });

  it("prolonge toujours le contrat actif affiché sur la fiche coureur", () => {
    expect(renewalFunction).toContain("and contract.status = 'active'");
    expect(renewalFunction).not.toContain("contract.status in ('active', 'planned')");
    expect(renewalFunction).not.toContain("contract.status = 'planned'");
  });

  it("conserve la limite glissante et synchronise les échéances salariales", () => {
    expect(renewalFunction).toContain(
      "if v_end_year >= v_context.game_year + 2 then",
    );
    expect(renewalFunction).toContain(
      "perform public.sync_rider_salary_installments(v_contract.id);",
    );
  });
});
