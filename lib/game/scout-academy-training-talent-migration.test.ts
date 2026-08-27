import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260827070000_add_scout_academy_training_talent.sql",
  ),
  "utf8",
).toLowerCase();
const service = readFileSync(
  resolve(process.cwd(), "services/youth-development.ts"),
  "utf8",
);

describe("scout academy training talent migration", () => {
  it("enregistre le talent et mémorise son bonus sans requête par séance", () => {
    expect(migration).toContain("'scout_academy_training'");
    expect(migration).toContain(
      "youth_scouting_candidates\n  add column if not exists scout_training_bonus_percentage",
    );
    expect(migration).toContain(
      "youth_academy_riders\n  add column if not exists scout_training_bonus_percentage",
    );
    expect(migration).toContain(
      "v_candidate.scout_training_bonus_percentage",
    );
  });

  it("alimente le bonus à la détection et l'applique à l'automatique", () => {
    expect(service).toContain(
      "talentBonuses.academyTrainingBonusPercentage",
    );
    expect(service).toContain(
      "schoolTrainingBonusPercentage: toNumber(\n            rider.scout_training_bonus_percentage",
    );
  });

  it("applique le même multiplicateur aux séances manuelles", () => {
    expect(migration).toContain(
      "public.get_youth_school_training_multiplier(",
    );
    expect(migration).toContain("v_context.scout_training_bonus_percentage");
    expect(migration).toContain(
      "academy.scout_training_bonus_percentage",
    );
  });
});
