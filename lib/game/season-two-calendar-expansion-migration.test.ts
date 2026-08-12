import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260812110000_expand_s2_national_calendar_and_sprint_profiles.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("extension du calendrier à partir de la S2", () => {
  it("ajoute huit courses nationales sans modifier le contingent élite", () => {
    expect(migration).toContain(
      "Le complément S2 doit contenir exactement huit courses nationales.",
    );
    expect(migration).toContain("category.code = 'national'");
    expect(migration).not.toContain("category.code = 'elite'");

    for (const slug of [
      "ronde-des-polders",
      "trophee-des-chemins-d-armor",
      "kasseien-van-limburg",
      "strade-del-monferrato",
      "circuit-de-la-costa-brava",
      "bergpreis-im-harz",
      "wielkopolska-classic",
      "wachau-hugelklassik",
    ]) {
      expect(migration).toContain(`'${slug}'`);
    }
  });

  it("porte à quatre le complément de classiques pavées", () => {
    expect(migration).toContain(
      "Le complément S2 doit contenir exactement quatre classiques pavées.",
    );
    expect(migration.match(/'cobbles', 1\d{2}\)/g)).toHaveLength(4);
    expect(migration).toContain("then 'cobbles'");
  });

  it("ne touche qu’aux saisons planifiées à partir de la S2", () => {
    expect(migration.match(/season\.game_year >= 2/g)?.length).toBeGreaterThan(5);
    expect(migration.match(/season\.status = 'planned'/g)?.length).toBeGreaterThan(5);
    expect(migration).not.toContain("season.status in ('active', 'planned')");
  });

  it("diversifie les sprints et aplatit explicitement la Ruta", () => {
    expect(migration).toContain("stage.profile_type in ('flat', 'sprint')");
    expect(migration).toContain("stage.stage_number in (1, 4, 8) then 0");
    expect(migration).toContain("stage.stage_number = 12 then 1");
    expect(migration).toContain("target.distance_km / 5.0");
    expect(migration).toContain("'4',");
    expect(migration).toContain("array[3,2,1]::smallint[]");
  });
});
