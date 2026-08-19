import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260819110000_rebalance_high_rating_youth_training.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("youth high-rating progression migration", () => {
  it("reproduit en base le ralentissement de 70 au plafond souple de 76", () => {
    expect(migration).toContain("when p_projected_rating < 70 then 1");
    expect(migration).toContain("when p_projected_rating >= 76 then 0");
    expect(migration).toContain(
      "* power((76 - p_projected_rating) / 6.0, 2)",
    );
  });

  it("conserve une influence bornée du potentiel", () => {
    expect(migration).toContain("0.35");
    expect(migration).toContain("0.55");
    expect(migration).toContain(
      "least(8, greatest(1, p_potential_steps))",
    );
  });

  it("applique le même facteur aux séances manuelles existantes", () => {
    expect(migration).toContain(
      "public.complete_current_youth_training_attempt(uuid,integer)",
    );
    expect(migration).toContain(
      ") * v_weight * public.get_youth_high_rating_progress_factor(v_current_projected, v_context.potential_steps);",
    );
    expect(migration).toContain("raise exception");
  });
});
