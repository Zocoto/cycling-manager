import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260909194500_credit_previous_federation_objectives.sql",
  ),
  "utf8",
);

describe("previous-season federation objective finance migration", () => {
  it("evaluates objectives from the account source season", () => {
    expect(migration).toContain("season.game_year = new.source_game_year");
    expect(migration).toContain(
      "public.get_national_federation_race_creation_score(",
    );
    expect(migration).toContain("'completedObjectiveCount'");
  });

  it("persists and credits the three objective tiers", () => {
    expect(migration).toContain("v_objective_count >= 5");
    expect(migration).toContain("v_bonus_rate := 0.10");
    expect(migration).toContain("v_objective_count >= 3");
    expect(migration).toContain("v_bonus_rate := 0.06");
    expect(migration).toContain("v_objective_count >= 1");
    expect(migration).toContain("v_bonus_rate := 0.03");
    expect(migration).toContain("'objective_bonus'");
  });
});
