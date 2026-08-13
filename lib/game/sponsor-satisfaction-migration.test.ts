import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260813110000_expand_sponsor_objectives_and_satisfaction.sql",
  ),
  "utf8",
);

const repairMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260813193000_repair_legacy_sponsor_objectives.sql",
  ),
  "utf8",
);

const renewalMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260813203000_rework_sponsor_renewals_and_reputation.sql",
  ),
  "utf8",
);

describe("sponsor satisfaction migration", () => {
  it("Étend les offres à dix objectifs pondérés", () => {
    expect(migration).toContain("check (display_order between 1 and 10)");
    expect(migration).toContain(
      "add column if not exists satisfaction_points smallint",
    );
    expect(migration).toContain(
      "sponsor_objectives_satisfaction_points_allowed",
    );
  });

  it("stocke un indice sponsor strictement borné sur 100", () => {
    expect(migration).toContain(
      "add column if not exists satisfaction_score smallint not null default 0",
    );
    expect(migration).toContain(
      "check (satisfaction_score between 0 and 100)",
    );
    expect(migration).toContain(
      "coalesce(sum(objective.satisfaction_points), 0)",
    );
  });

  it("Évalue les nouvelles familles réellement depuis les données du jeu", () => {
    for (const objectiveType of [
      "nation_uci_ranking",
      "national_championship",
      "homegrown_roster",
      "infrastructure",
    ]) {
      expect(migration).toContain(
        `v_objective.objective_type = '${objectiveType}'`,
      );
    }

    expect(migration).toContain("public.rider_season_summaries");
    expect(migration).toContain("public.rider_national_championship_titles");
    expect(migration).toContain(
      "title.championship_type in ('road', 'time_trial')",
    );
    expect(migration).toContain("public.youth_academy_riders");
    expect(migration).toContain("public.team_infrastructures");
  });

  it("préserve l’économie malgré les trois objectifs supplémentaires", () => {
    expect(migration).toMatch(/v_context\.team_season_id,\s+1,/);
    expect(migration).toMatch(/least\(\s+7,/);
    expect(migration).toContain(
      "round(v_objective.satisfaction_points * 0.35)",
    );
  });

  it("n’attribue aucun gain rétroactif lors de la migration", () => {
    const initialization = migration.slice(
      migration.indexOf("-- Initialise l'indice"),
    );

    expect(initialization).not.toContain("insert into public.reward_events");
    expect(initialization).not.toContain("reputation_points = reputation_points +");
  });
});

describe("legacy sponsor objective repair", () => {
  it("neutralise exactement les trois ajouts des contrats S1", () => {
    expect(repairMigration).toContain(
      "and season.status = 'active'",
    );
    expect(repairMigration).toContain(
      ") = 7",
    );
    expect(repairMigration).toContain(
      "where missing_order.missing_rank <= 3",
    );
    expect(repairMigration).toContain(
      "'cancelled'",
    );
    expect(repairMigration).toContain(
      "'legacyNeutralized', true",
    );
  });

  it("exclut ces objectifs de la satisfaction et de la progression", () => {
    expect(repairMigration).toContain(
      "check (satisfaction_points between 0 and 100)",
    );
    expect(repairMigration).toContain(
      "skip_cancelled_sponsor_objective_progress",
    );
    expect(repairMigration).toMatch(
      /renewal_bonus_percent,[\s\S]*satisfaction_points,[\s\S]*select[\s\S]*\r?\n\s+0,\r?\n\s+0,/,
    );
  });

  it("autorise la régénération pondérée des offres S2", () => {
    expect(repairMigration).toMatch(
      /grant delete\s+on table public\.sponsor_objectives\s+to service_role/,
    );
  });
});

describe("sponsor renewal and reputation settlement", () => {
  it("applique le barème linéaire -25 / 0 / +10 depuis la satisfaction", () => {
    expect(renewalMigration).toContain(
      "v_budget_adjustment := (v_satisfaction_score - 50) / 2.0",
    );
    expect(renewalMigration).toContain(
      "v_budget_adjustment := (v_satisfaction_score - 50) / 5.0",
    );
    expect(renewalMigration).toContain(
      "renewal_budget_adjustment_percent between -25 and 10",
    );
  });

  it("retire dix points par objectif manquant sous la moitié", () => {
    expect(renewalMigration).toContain(
      "ceil(v_live_objective_count / 2.0)::integer",
    );
    expect(renewalMigration).toMatch(
      /v_required_completed_count - v_completed_objective_count[\s\S]*\) \* 10/,
    );
  });

  it("supprime les gains de réputation et les anciens bonus unitaires", () => {
    const rewardFunction = renewalMigration.slice(
      renewalMigration.indexOf(
        "create or replace function public.reward_completed_sponsor_objective",
      ),
      renewalMigration.indexOf(
        "alter function public.evaluate_sponsor_objectives_for_contract",
      ),
    );

    expect(rewardFunction).toContain("return new");
    expect(rewardFunction).not.toContain("insert into public.reward_events");
    expect(renewalMigration).toContain(
      "set next_sponsor_budget_bonus_percent = 0",
    );
  });
});
