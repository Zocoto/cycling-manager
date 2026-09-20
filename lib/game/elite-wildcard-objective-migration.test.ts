import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260920090000_credit_elite_race_participations_as_wildcards.sql",
  ),
  "utf8",
);

describe("objectif de WildCards pour les équipes Élite", () => {
  it("conserve les WildCards et crédite les inscriptions Élite acceptées", () => {
    expect(migration).toContain("p_metric_key = 'accepted_wildcards'");
    expect(migration).toContain("registration.status = 'accepted'");
    expect(migration).toContain("registration.entry_method = 'invited'");
    expect(migration).toContain("division.code = 'elite'");
    expect(migration).toContain("category.code = 'elite'");
    expect(migration).toContain("count(distinct registration.id)::integer");
  });

  it("reprend le calcul existant pour toutes les autres métriques", () => {
    expect(migration).toContain(
      "rename to calculate_game_objective_progress_pre_elite_participation_credit",
    );
    expect(migration).toContain(
      "return public.calculate_game_objective_progress_pre_elite_participation_credit(",
    );
  });

  it("explique l'alternative Élite sur les deux paliers", () => {
    expect(migration).toContain("where objective_key in ('wildcard_1', 'wildcard_5')");
    expect(migration).toContain(
      "participation validée à une course Élite avec une équipe Élite",
    );
    expect(migration).toContain(
      "participations validées à des courses Élite avec une équipe Élite",
    );
  });
});
