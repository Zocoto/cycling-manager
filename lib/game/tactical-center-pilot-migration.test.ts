import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260907180000_enable_tactical_center_pilot_access.sql",
  ),
  "utf8",
);

describe("accès pilote au Centre tactique", () => {
  it("retire uniquement le verrou S3 du briefing", () => {
    expect(migration).toContain("save_current_team_tactical_briefing");
    expect(migration).toContain("v_context.game_year < 3");
    expect(migration).toContain("Accès pilote S2");
    expect(migration).not.toContain("enforce_tactical_center_s3");
  });

  it("échoue si la fonction de production ne correspond pas à la version attendue", () => {
    expect(migration).toContain(
      "Garde saisonnière du briefing tactique inattendue.",
    );
    expect(migration).toContain("position(v_season_guard in v_definition) = 0");
  });
});
