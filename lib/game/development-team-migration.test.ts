import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260812130000_create_development_team.sql",
  ),
  "utf8",
);
const registrationFix = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260812131000_fix_development_race_registration_context.sql",
  ),
  "utf8",
);
const maintenanceRoute = readFileSync(
  join(process.cwd(), "app/api/cron/game-maintenance/route.ts"),
  "utf8",
);

describe("Development Team migration", () => {
  it("verrouille un effectif saisonnier de onze juniors entre J1 et J7", () => {
    expect(migration).toContain("create table public.development_teams");
    expect(migration).toContain("create table public.development_team_roster");
    expect(migration).toContain("unique (team_id, season_id)");
    expect(migration).toContain("race_number between 1 and 11");
    expect(migration).toContain("v_day_number not between 1 and 7");
    expect(migration).toContain("v_count < 1 or v_count > 11");
  });

  it("crée dix rendez-vous dont le mini-tour et les deux Mondiaux", () => {
    const editionSlugs = [
      "prix-de-la-releve",
      "fleche-des-jeunes",
      "paves-du-nord-juniors",
      "chrono-europeen-u19",
      "col-des-espoirs",
      "tour-de-la-releve",
      "coupe-des-sprinteurs",
      "classique-des-lacs-juniors",
      "mondial-junior-clm",
      "mondial-junior-route",
    ];
    for (const slug of editionSlugs) expect(migration).toContain(`'${slug}'`);
    expect(migration).toContain("'stage_race'");
    expect(migration).toContain("17, 19, 'mixed'");
    expect(migration.match(/true, 1, 3\)|true, 3, 6\)/g)).toHaveLength(2);
  });

  it("simule une seule fois et publie étapes plus classement général", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("if v_edition.status = 'completed' then return 0");
    expect(migration).toContain("create table public.development_race_results");
    expect(migration).toContain("result_scope in ('stage', 'general')");
    expect(migration).toContain("development_race_results_competitor_unique_idx");
    expect(migration).toContain("'virtual:' || generated.ordinal");
  });

  it("valide les inscriptions côté serveur et les règle avant l’intersaison", () => {
    expect(registrationFix).toContain(
      "select development_team, coalesce(season.current_day_number, 1)",
    );
    expect(registrationFix).toContain(
      "v_day_number >= v_edition.start_day_number",
    );
    expect(registrationFix).toContain(
      "roster.academy_rider_id = any(p_academy_rider_ids)",
    );
    expect(maintenanceRoute).toContain('"settle_due_development_races"');
    expect(maintenanceRoute.indexOf('"settle_due_development_races"')).toBeLessThan(
      maintenanceRoute.indexOf('"settle_due_season_rollovers"'),
    );
  });

  it("ajoute des succès réclamables pour la création et les titres juniors", () => {
    expect(migration).toContain("development_team_created");
    expect(migration).toContain("development_roster_full");
    expect(migration).toContain("development_first_win");
    expect(migration).toContain("development_tour_win");
    expect(migration).toContain("development_world_title");
    expect(migration).toContain("reward_random_special_ability");
  });
});
