import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const raceCalendarService = readFileSync(
  join(process.cwd(), "services/race-calendar.ts"),
  "utf8",
);
const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260811223000_world_championship_national_teams_s2.sql",
  ),
  "utf8",
);
const riderProfilePage = readFileSync(
  join(process.cwd(), "app/jeu/coureurs/[identifiant]/page.tsx"),
  "utf8",
);
const worldJersey = readFileSync(
  join(process.cwd(), "components/game/world-champion-jersey.tsx"),
  "utf8",
);

describe("nouveau cycle des championnats du monde a partir de la S2", () => {
  it("conserve integralement le modele et les resultats de S1", () => {
    expect(raceCalendarService).toContain("season.game_year >= 2");
    expect(migration).toContain("v_game_year < 2");
    expect(migration).not.toContain("official_stage_simulations");
    expect(migration).not.toContain("process_due_international");
  });

  it("regroupe les coureurs par pays sans roles ni strategies de club", () => {
    expect(raceCalendarService).toContain("? riderMetadata.country_id");
    expect(raceCalendarService).toContain("? riderCountry.name");
    expect(raceCalendarService).toContain(
      'role: usesNationalWorldModel ? "auto" : row.race_role',
    );
    expect(raceCalendarService).toContain(
      'race.competition_type !== "world_championship"',
    );
  });

  it("cree deux titres mondiaux globaux et independants", () => {
    expect(migration).toContain("'world_road'");
    expect(migration).toContain("'world_time_trial'");
    expect(migration).toContain(
      "rider_world_titles_one_active_per_discipline_idx",
    );
    expect(migration).toContain(
      "create trigger assign_world_championship_title",
    );
  });

  it("reproduit les cinq bandes officielles du maillot arc-en-ciel", () => {
    for (const color of [
      "#2166B1",
      "#E32636",
      "#111111",
      "#F2C94C",
      "#16834A",
    ]) {
      expect(worldJersey).toContain(color);
    }
  });

  it("cumule les badges mondiaux et nationaux dans le palmares", () => {
    expect(riderProfilePage).toContain("entry.nationalTitles.map");
    expect(riderProfilePage).toContain("entry.worldTitles.map");
    expect(riderProfilePage).toContain("function WorldTitleBadge");
    expect(riderProfilePage).toContain(
      'discipline === "time_trial"',
    );
  });
});
