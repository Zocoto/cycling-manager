import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20261002173000_create_pcm_gala_registrations.sql",
);
const migration = readFileSync(migrationPath, "utf8");

describe("stockage isolé des inscriptions gala", () => {
  it("garantit une seule course par équipe et par saison", () => {
    expect(migration).toContain("unique (team_id, season_id)");
    expect(migration).toContain("on conflict (team_id, season_id) do update");
    expect(migration).toContain("gala_event_id = excluded.gala_event_id");
  });

  it("valide sept coureurs actifs appartenant à l'équipe", () => {
    expect(migration).toContain("cardinality(p_rider_ids) <> required_roster_size");
    expect(migration).toContain("rider_contracts.team_id = current_team_id");
    expect(migration).toContain("rider_contracts.status = 'active'");
    expect(migration).toContain("rider_season_ratings.season_id = current_season_id");
  });

  it("ne touche à aucun stockage sportif officiel", () => {
    expect(migration).not.toMatch(/\b(race_rosters|race_registrations|rider_forms|team_finances)\b/);
    expect(migration).toContain("pcm_gala_registration_riders");
  });
});
