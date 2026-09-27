import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260927183000_add_partial_sponsor_objective_success.sql",
  ),
  "utf8",
);

describe("partial sponsor objective success migration", () => {
  it("considère le podium comme une réussite partielle quand la victoire était exigée", () => {
    expect(migration).toMatch(/greatest\(\s+3,/);
    expect(migration).toContain("ceil(v_target_rank * 1.5)::integer");
    expect(migration).toContain("then 'partial'");
  });

  it("mémorise le classement, la cible et la petite satisfaction", () => {
    for (const detail of [
      "'resultRank'",
      "'targetRank'",
      "'achievementLevel'",
      "'partialSatisfactionPoints'",
    ]) {
      expect(migration).toContain(detail);
    }
    expect(migration).toContain(
      "round(v_objective.satisfaction_points * 0.40)::integer",
    );
  });

  it("intègre le bonus partiel au calcul canonique de satisfaction", () => {
    expect(migration).toContain(
      "create or replace function public.get_sponsor_objective_satisfaction_score",
    );
    expect(migration).toContain(
      "create or replace function public.synchronize_s3_sponsor_satisfaction_score",
    );
    expect(migration).toContain(
      "progress.details ->> 'achievementLevel' = 'partial'",
    );
  });

  it("préserve le moteur existant derrière une enveloppe", () => {
    expect(migration).toContain(
      "rename to evaluate_sponsor_objectives_pre_partial_success_20260927",
    );
    expect(migration).toContain(
      "perform public.evaluate_sponsor_objectives_pre_partial_success_20260927",
    );
  });
});
