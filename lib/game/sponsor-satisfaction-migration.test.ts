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
      /renewal_bonus_percent,[\s\S]*satisfaction_points,[\s\S]*select[\s\S]*\n\s+0,\n\s+0,/,
    );
  });

  it("autorise la régénération pondérée des offres S2", () => {
    expect(repairMigration).toMatch(
      /grant delete\s+on table public\.sponsor_objectives\s+to service_role/,
    );
  });
});
