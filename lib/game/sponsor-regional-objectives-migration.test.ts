import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260912100000_repair_inaccessible_regional_sponsor_objectives.sql",
  ),
  "utf8",
);

describe("regional sponsor objective repair migration", () => {
  it("remplace seulement les objectifs régionaux actifs devenus inaccessibles", () => {
    expect(migration).toContain("target_category.code = 'regional'");
    expect(migration).toContain("contract.status = 'active'");
    expect(migration).toContain("objective.status = 'active'");
    expect(migration).toContain("category.code in ('national', 'continental', 'world')");
    expect(migration).toContain("edition.registration_policy = 'open'");
    expect(migration).toContain("candidate_stage.first_departure > now()");
  });

  it("resynchronise la cible spécialisée et remet sa progression à zéro", () => {
    expect(migration).toContain("update public.race_result_objectives");
    expect(migration).toContain("race_edition_id = v_replacement.race_edition_id");
    expect(migration).toContain("update public.objective_progress");
    expect(migration).toContain("status = 'not_started'");
    expect(migration).toContain("'replacedInaccessibleRegionalRace', true");
  });
});
