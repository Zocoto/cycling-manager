import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260903223000_add_sponsor_offer_negotiation.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("négociation des offres sponsor", () => {
  it("persiste séparément le budget de base, le plafond et la difficulté", () => {
    expect(migration).toContain("base_budget_per_season");
    expect(migration).toContain("negotiation_budget_ceiling");
    expect(migration).toContain("objective_difficulty");
    expect(migration).toContain(
      "objective_difficulty in ('accessible', 'balanced', 'ambitious')",
    );
  });

  it("n’autorise la négociation qu’à partir de la saison 3", () => {
    expect(migration).toContain("v_target_season.game_year < 3");
    expect(migration).toContain(
      "v_target_season.game_year <> v_active_season.game_year + 1",
    );
    expect(migration).toContain("v_active_season.current_day_number < 21");
  });

  it("remplace atomiquement les objectifs encore provisoires", () => {
    expect(migration).toContain("v_offer.status <> 'open'");
    expect(migration).toContain("objective.status <> 'draft'");
    expect(migration).toContain("delete from public.sponsor_objectives");
  });

  it("réserve l’opération au serveur", () => {
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });

  it("préserve les augmentations annuelles au-dessus du plafond", () => {
    expect(migration).toContain(
      "greatest(v_planned.negotiation_budget_ceiling, v_renewal_base)",
    );
    expect(migration).toContain(
      "set base_budget_per_season = v_renewal_base",
    );
  });
});
