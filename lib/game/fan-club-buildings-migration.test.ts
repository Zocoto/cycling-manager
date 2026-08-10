import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260810100000_add_fan_club_buildings.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("migration des bâtiments du Fan Club", () => {
  it("autorise les deux bâtiments sur cinq niveaux", () => {
    expect(migration).toContain("'fan_club_headquarters'");
    expect(migration).toContain("'club_shop'");
    expect(migration).toContain(
      "infrastructure_code = 'fan_club_headquarters' and level between 1 and 5",
    );
    expect(migration).toContain(
      "infrastructure_code = 'club_shop' and level between 1 and 5",
    );
  });

  it("active les deux bâtiments au niveau un pour le compte de recette", () => {
    expect(migration).toContain("lower('paul.leblanc22@gmail.com')");
    expect(migration).toContain("select team_id, 'fan_club_headquarters'");
    expect(migration).toContain("select team_id, 'club_shop'");
    expect(migration).toMatch(/select\s+team_id,\s+infrastructure_code,\s+1,/);
  });

  it("reste idempotente et ne rétrograde aucun bâtiment", () => {
    expect(migration).toContain(
      "on conflict (team_id, infrastructure_code) do update",
    );
    expect(migration).toContain(
      "level = greatest(public.team_infrastructures.level, excluded.level)",
    );
  });
});
