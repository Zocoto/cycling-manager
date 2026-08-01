import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260801150000_rebalance_rider_form_management.sql",
  ),
  "utf8",
);

describe("migration de gestion de la forme", () => {
  it("branche le coût de course sur le profil de l'étape", () => {
    expect(migration).toContain("calculate_stage_form_cost");
    expect(migration).toContain(
      "form_loss := public.calculate_stage_form_cost(",
    );
  });

  it("cumule la récupération quotidienne de tous les nutritionnistes", () => {
    expect(migration).toContain("get_team_daily_nutrition_form_gain");
    expect(migration).toMatch(/sum\(\r?\n\s+member\.level \/ 5\.0/);
    expect(migration).toContain("settle_due_daily_nutrition_recovery");
    expect(migration).not.toContain("greatest(0, 10 - new.form_delta)");
  });

  it("verrouille les équipes à trois nutritionnistes actifs", () => {
    expect(migration).toContain("enforce_team_nutritionist_limit");
    expect(migration).toContain("if v_active_count >= 3 then");
    expect(migration).toContain("staff_contracts_nutritionist_limit");
  });
});
