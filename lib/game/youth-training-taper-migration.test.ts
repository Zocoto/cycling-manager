import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260906120000_taper_youth_training_progression.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("youth training tapered progression migration", () => {
  it("crée la même courbe décroissante continue que le calcul applicatif", () => {
    expect(migration).toContain(
      "create or replace function public.get_youth_training_rating_progress_factor",
    );
    expect(migration).toContain("0.08");
    expect(migration).toContain("+ 1.52");
    expect(migration).toContain(
      "(88 - least(100, greatest(0, p_projected_rating))) / 48.0",
    );
    expect(migration).toContain("      2\n    );");
  });

  it("applique la courbe et le nouveau gain de base aux deux modes", () => {
    expect(migration).toContain(
      "create or replace function public.calculate_youth_training_projected_gain",
    );
    expect(migration).toContain("    0.30");
    expect(migration).toContain(
      "public.get_youth_training_rating_progress_factor(p_projected_rating)",
    );
    expect(migration).toContain("when 'automatic' then 1.00");
    expect(migration).toContain("when 'manual' then");
  });

  it("préserve une courbe séparée pour les récompenses de podium", () => {
    expect(migration).not.toContain(
      "create or replace function public.get_development_podium_rating_factor",
    );
    expect(migration).toContain(
      "public.get_youth_training_rating_progress_factor(p_projected_rating)\n    * public.get_youth_talent_progress_multiplier(p_potential_steps)",
    );
  });
});
