import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260817120000_unify_national_championship_registrations.sql",
  ),
  "utf8",
);
const scheduleMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260808163000_rework_national_championships.sql",
  ),
  "utf8",
);

describe("grille unifiée des championnats nationaux", () => {
  it("classe 200 coureurs par pays puis départage les égalités par la moyenne", () => {
    expect(migration).toContain(
      "partition by rider.country_id",
    );
    expect(migration).toContain(
      "coalesce(summary.points, 0) desc",
    );
    expect(migration).toContain(
      ")::numeric / 13), 2) desc",
    );
    expect(migration).toContain(
      "candidate.national_rank <= 200",
    );
  });

  it("inclut les coureurs actifs et les agents libres", () => {
    expect(migration).toContain(
      "rider.status in ('active', 'free_agent')",
    );
    expect(migration).toContain(
      "if v_entry.team_season_id is not null then",
    );
    expect(migration).toContain(
      "historical_team_name = 'Coureurs libres'",
    );
  });

  it("provisionne route et CLM pour chaque pays actif sur les créneaux de J8", () => {
    expect(migration).toMatch(
      /from public\.countries as country\s+where country\.is_active = true/,
    );
    expect(migration).toContain(
      "ensure_country_national_championships",
    );
    expect(scheduleMigration.match(/v_day_number := 8/g)).toHaveLength(2);
    expect(scheduleMigration).toContain("time '14:00'");
    expect(scheduleMigration).toContain("time '18:00'");
  });

  it("annule une épreuve sans partant et ne publie aucun classement", () => {
    expect(migration).toContain(
      "set status = 'cancelled'",
    );
    expect(migration).toContain(
      "v_cancelled_without_field",
    );
    expect(migration).toContain(
      "roster.status in ('selected', 'confirmed')",
    );
  });

  it("enregistre en une transaction les deux choix de chaque coureur", () => {
    expect(migration).toContain(
      "save_current_team_national_championship_selections",
    );
    expect(migration).toContain("'national_road'::text");
    expect(migration).toContain("'national_time_trial'::text");
    expect(migration).toContain(
      "national_championship_rider_preferences",
    );
  });
});
