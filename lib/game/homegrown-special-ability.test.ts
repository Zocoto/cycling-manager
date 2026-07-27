import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260727101000_add_homegrown_special_ability.sql",
  ),
  "utf8",
);

const RATING_COLUMNS = [
  "mountain",
  "hills",
  "flat",
  "time_trial",
  "cobbles",
  "sprint",
  "acceleration",
  "downhill",
  "endurance",
  "resistance",
  "recovery",
  "breakaway",
  "prologue",
] as const;

describe("Formé au club migration", () => {
  it("réserve l’attribution au centre de formation sans objet consommable", () => {
    expect(migration).toContain("validate_homegrown_ability_source");
    expect(migration).toContain("new.source_type is distinct from 'youth_academy'");
    expect(migration).toContain(
      "new.source_reference = 'academy:' || academy.id::text",
    );
    expect(migration).not.toContain("medallion-homegrown");
  });

  it("ajoute puis retire deux points aux treize caractéristiques", () => {
    for (const stat of RATING_COLUMNS) {
      expect(migration).toContain(
        `${stat} = least(100, rating.${stat} + 2)`,
      );
      expect(migration).toContain(
        `${stat} = greatest(0, rating.${stat} - 2)`,
      );
    }
  });

  it("conserve la capacité uniquement avec un contrat du club formateur", () => {
    expect(migration).toContain(
      "contract.team_id = v_formative_team_id",
    );
    expect(migration).toContain(
      "contract.status in ('active', 'planned')",
    );
    expect(migration).toContain(
      "delete from public.rider_special_abilities",
    );
    expect(migration).toContain(
      "remove_unrenewed_homegrown_before_season_completion",
    );
    expect(migration).toContain("contract.end_season_id <> new.id");
  });
});
