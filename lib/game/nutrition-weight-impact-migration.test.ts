import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260930140000_refine_nutrition_weight_impacts.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("nutrition weight impact migration", () => {
  it("augmente progressivement l’impact des trois compléments", () => {
    expect(migration).toContain("when 'recovery_snack' then 0.1");
    expect(migration).toContain("when 'tailored_plan' then 0.2");
    expect(migration).toContain("else 0.3");
    expect(migration).toContain("when 'recovery_snack' then 4");
    expect(migration).toContain("when 'tailored_plan' then 7");
    expect(migration).toContain("else 12");
  });

  it("conserve un risque plancher sans rendre la prise quotidienne", () => {
    expect(migration).toContain("greatest(\n    1,");
    expect(migration).toContain("new.weight_delta_kg := case when v_roll < v_risk_pct");
  });
});
