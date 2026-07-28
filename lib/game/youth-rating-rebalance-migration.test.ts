import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260728110000_rebalance_existing_youth_ratings.sql",
  ),
  "utf8",
);

describe("existing youth rating rebalance migration", () => {
  it("rééquilibre les juniors déjà signés avant leur source de scouting", () => {
    const academyUpdate = migration.indexOf(
      "update public.youth_academy_riders as academy",
    );
    const candidateUpdate = migration.indexOf(
      "update public.youth_scouting_candidates as candidate",
    );

    expect(academyUpdate).toBeGreaterThan(-1);
    expect(candidateUpdate).toBeGreaterThan(academyUpdate);
  });

  it("préserve les gains obtenus depuis la signature", () => {
    expect(migration).toContain(
      "greatest(0, academy.mountain - candidate.mountain)",
    );
    expect(migration).toContain(
      "greatest(0, academy.prologue - candidate.prologue)",
    );
  });

  it("utilise les trois paliers d’âge demandés", () => {
    expect(migration).toContain("when p_age = 16 then 1");
    expect(migration).toContain("when p_age = 17 then 1.5");
    expect(migration).toContain("else 2.6");
  });
});
