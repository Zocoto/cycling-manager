import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260907170000_create_team_tactical_center.sql",
  ),
  "utf8",
);

describe("migration Centre tactique", () => {
  it("réserve la construction et les briefings à la saison 3", () => {
    expect(migration).toContain("enforce_tactical_center_s3");
    expect(migration).toContain("v_context.game_year < 3");
    expect(migration).toContain("Le Centre tactique ouvre avec la saison 3");
  });

  it("verrouille les briefings et toutes leurs affectations côté serveur", () => {
    expect(migration).toContain("official_stage_simulations");
    expect(migration).toContain("for update of registration, stage");
    expect(migration).toContain("race_rosters");
    expect(migration).toContain("center_level_snapshot");
    expect(migration).toContain("Le plan de repli exige le niveau 4");
    expect(migration).toContain(
      "v_context.center_level < (case p_primary_doctrine",
    );
    expect(migration).toContain(
      "v_context.center_level < (case p_backup_doctrine",
    );
  });

  it("n’expose pas la table aux clients et extrait seulement le débrief utile", () => {
    expect(migration).toContain(
      "revoke all on table public.race_stage_tactical_briefings",
    );
    expect(migration).toContain(
      "grant all privileges on table public.race_stage_tactical_briefings\nto service_role",
    );
    expect(migration).toContain("simulation_data -> 'tacticalReports'");
    expect(migration).toContain(
      "revoke all on function public.get_team_race_tactical_briefings(uuid)\nfrom public, anon, authenticated",
    );
  });
});
