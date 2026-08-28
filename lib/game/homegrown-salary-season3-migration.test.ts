import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260828180000_replace_homegrown_rating_bonus_with_salary_discount.sql",
  ),
  "utf8",
);

describe("Formé au club à partir de la Saison 3", () => {
  it("préserve le bonus de notes des deux premières saisons seulement", () => {
    expect(migration).toContain("season.game_year < 3");
    expect(migration).toContain("if new.game_year = 3 then");
    expect(migration).toContain("rating.mountain - 2");
    expect(migration).toContain("rating.prologue - 2");
  });

  it("divise une seule fois le salaire du contrat formateur", () => {
    expect(migration).toContain(
      "homegrown_salary_before_discount numeric(12, 2)",
    );
    expect(migration).toContain(
      "create trigger apply_homegrown_salary_discount_before_contract_write",
    );
    expect(migration).toContain(
      "new.salary_per_season := round(new.salary_per_season / 2, 2)",
    );
    expect(migration).toContain(
      "academy.team_id = new.team_id",
    );
  });

  it("active la règle au rollover sans rescanner les contrats à chaque page", () => {
    expect(migration).toContain(
      "create trigger homegrown_effect_on_season_activation",
    );
    expect(migration).toContain("new.game_year < 3");
    expect(migration).toContain(
      "youth_academy_riders_promoted_rider_team_idx",
    );
    expect(migration).not.toContain("get_current_team_dashboard");
  });

  it("conserve la perte définitive déjà liée au départ du club formateur", () => {
    const originalMigration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260727101000_add_homegrown_special_ability.sql",
      ),
      "utf8",
    );

    expect(originalMigration).toContain(
      "public.reconcile_homegrown_ability_after_contract",
    );
    expect(originalMigration).toContain(
      "contract.team_id = v_formative_team_id",
    );
    expect(originalMigration).toContain(
      "delete from public.rider_special_abilities",
    );
  });
});
