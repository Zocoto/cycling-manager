import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260808165200_expose_item_target_values.sql"
  ),
  "utf8"
);

describe("item target values migration", () => {
  it("expose toutes les valeurs qui peuvent être impactées", () => {
    expect(migration).toContain("get_current_team_item_target_values");
    expect(migration).toContain("'form', coalesce(current_condition.form, 75)");
    expect(migration).toContain("'experienceDays', coalesce(rider.career_race_days, 0)");
    expect(migration).toContain("'potentialSteps', rider.potential_steps");
    expect(migration).toContain("'prologue', rating.prologue");
    expect(migration).toContain("'abilityCodes', coalesce(abilities.codes");
  });

  it("reste limité à l'effectif du Directeur Sportif connecté", () => {
    expect(migration).toContain("director.auth_user_id = auth.uid()");
    expect(migration).toContain("contract.team_id = context.team_id");
    expect(migration).toContain("to authenticated, service_role");
  });
});
