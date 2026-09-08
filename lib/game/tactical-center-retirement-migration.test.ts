import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260908163000_retire_team_tactical_center.sql",
  ),
  "utf8",
);

describe("retrait du Centre tactique", () => {
  it("bloque les nouveaux chantiers et briefings sans effacer l’historique", () => {
    expect(migration).toContain("Le Centre tactique a été retiré du jeu.");
    expect(migration).toContain(
      "Les doctrines de course et le Centre tactique ont été retirés.",
    );
    expect(migration).toContain("race_stage_tactical_briefings");
    expect(migration).not.toMatch(/delete\s+from\s+public\.race_stage_tactical_briefings/i);
    expect(migration).not.toMatch(/drop\s+table/i);
  });
});
