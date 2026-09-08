import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { calculateSponsorNegotiatedBudget } from "./sponsor-negotiation";
import { calculateSponsorRenewalBudget } from "./sponsor-renewal-budget";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260908080000_add_annual_sponsor_objective_renegotiation.sql",
    import.meta.url,
  ),
  "utf8",
);
const workflow = readFileSync(
  new URL("../../services/sponsoring-workflow.ts", import.meta.url),
  "utf8",
);
const annualObjectives = readFileSync(
  new URL("../../services/continuing-sponsor-objectives.ts", import.meta.url),
  "utf8",
);
const actions = readFileSync(
  new URL("../../app/jeu/sponsoring/actions.ts", import.meta.url),
  "utf8",
);
const futureSection = readFileSync(
  new URL(
    "../../app/jeu/sponsoring/future-sponsoring-section.tsx",
    import.meta.url,
  ),
  "utf8",
);
const cumulativeBudgetMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260908090000_stack_annual_sponsor_budget_modifiers.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("renégociation annuelle des objectifs sponsor", () => {
  it.each([
    { satisfaction: 0, difficulty: "accessible" as const, expected: 680_000 },
    { satisfaction: 50, difficulty: "balanced" as const, expected: 1_000_000 },
    { satisfaction: 75, difficulty: "ambitious" as const, expected: 1_160_000 },
    { satisfaction: 100, difficulty: "ambitious" as const, expected: 1_210_000 },
  ])(
    "compose la satisfaction $satisfaction puis le palier $difficulty",
    ({ satisfaction, difficulty, expected }) => {
      const satisfactionAdjustedBudget = calculateSponsorRenewalBudget({
        currentBudget: 1_000_000,
        satisfactionScore: satisfaction,
      });

      expect(
        calculateSponsorNegotiatedBudget({
          baseBudget: satisfactionAdjustedBudget,
          budgetCeiling: 2_000_000,
          difficulty,
        }),
      ).toBe(expected);
    },
  );

  it("isole l'offre future du contrat et de ses objectifs courants", () => {
    expect(migration).toContain("continuing_contract_id uuid");
    expect(migration).toContain("pending_sponsor_offer_id uuid");
    expect(migration).toContain("objective_season_id uuid");
    expect(migration).toContain("ensure_continuing_sponsor_offer");
    expect(migration).toContain("status,\n    generation_version\n  ) values");
    expect(migration).toContain("'accepted',\n    8");
  });

  it("réserve la négociation à J21+, à la saison 3+ et au propriétaire", () => {
    const negotiation = migration.slice(
      migration.indexOf(
        "create or replace function public.negotiate_continuing_sponsor_objectives",
      ),
      migration.indexOf("do $patch_legacy_evaluator$"),
    );

    expect(negotiation).toContain(
      "assignment.sporting_director_id = p_sporting_director_id",
    );
    expect(negotiation).toContain(
      "coalesce(v_active_season.current_day_number, 0) < 21",
    );
    expect(negotiation).toContain("v_target_season.game_year < 3");
    expect(negotiation).toContain("v_contract.end_game_year <");
    expect(negotiation).toContain("objective.status <> 'draft'");
  });

  it("ne rend le budget et les objectifs effectifs qu'au rollover", () => {
    const pendingUpdate = migration.indexOf(
      "Annual sponsor terms prepared during J21-J28 become live atomically",
    );
    const sponsorPaymentLoop = migration.indexOf(
      "v_marker text := '  for v_sponsor in'",
    );

    expect(pendingUpdate).toBeGreaterThan(-1);
    expect(sponsorPaymentLoop).toBeGreaterThan(-1);
    expect(migration).toContain("budget_per_season = offer.budget_per_season");
    expect(migration).toContain("objective_season_id = offer.season_id");
    expect(migration).toContain("pending_sponsor_offer_id = null");
  });

  it("évalue chaque année du contrat dans la bonne saison", () => {
    expect(migration).toContain(
      "coalesce(contract.objective_season_id, contract.start_season_id)",
    );
    expect(migration).toContain(
      "v_contract.objective_season_id",
    );
    expect(workflow).toContain(
      "contractRow.objective_season_id ?? contractRow.start_season_id",
    );
  });

  it("affiche les trois paliers et régénère immédiatement l'aperçu", () => {
    expect(workflow).toContain("ensureContinuingSponsorObjectivePlan");
    expect(annualObjectives).toContain(
      "ensureContinuingSponsorObjectivePlan",
    );
    expect(workflow).toContain("objectivePlan: PersistedSponsorOffer | null");
    expect(futureSection).toContain('negotiationMode="continuing-contract"');
    expect(futureSection).toContain("Objectifs proposés · 100 points");
    expect(actions).toContain(
      "negotiateContinuingSponsorObjectivesAction",
    );
    expect(actions).toContain("ensureAndLoadSponsorObjectives");
  });

  it("cumule dès la saison 3 la satisfaction courante puis le palier annuel", () => {
    expect(annualObjectives).toContain("calculateSponsorRenewalBudget");
    expect(annualObjectives).toContain(
      "satisfactionScore: contract.satisfactionScore",
    );
    expect(cumulativeBudgetMigration).toContain(
      "v_target_season.game_year < 3",
    );
    expect(cumulativeBudgetMigration).toContain(
      "new.satisfaction_score <= 50",
    );
    expect(cumulativeBudgetMigration).toContain(
      "Annual sponsor satisfaction and ambition stack",
    );
    expect(cumulativeBudgetMigration).toContain(
      "contract.satisfaction_score <= 50",
    );
    expect(cumulativeBudgetMigration).toContain(
      "offer.objective_difficulty",
    );
    expect(cumulativeBudgetMigration).toContain(
      "budget_per_season = annual_budget.negotiated_budget",
    );
    expect(workflow).toContain('.eq("season_id", satisfactionSeasonId)');
    expect(futureSection).toContain(
      "le montant définitif sera recalculé",
    );
  });
});
