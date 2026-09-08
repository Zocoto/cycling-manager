import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260908070000_buff_youth_potential_training_multiplier.sql",
  ),
  "utf8",
);

describe("renforcement du potentiel dans l entraînement junior", () => {
  it("conserve ×0,5 au minimum et atteint ×2 à quatre étoiles", () => {
    expect(migration).toContain("0.50");
    expect(migration).toContain("+ 1.50");
    expect(migration).toContain("p_potential_steps");
    expect(migration).toContain("1.35");
  });

  it("remplace la fonction partagée par les entraînements automatique et manuel", () => {
    expect(migration).toContain(
      "create or replace function public.get_youth_talent_progress_multiplier",
    );
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it("renforce le frein des notes hautes pour préserver la cible autour de 75", () => {
    expect(migration).toContain(
      "create or replace function public.get_youth_training_rating_progress_factor",
    );
    expect(migration).toContain("0.03");
    expect(migration).toContain("+ 1.57");
  });
});
