import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260811234500_continental_championship_national_teams_and_jerseys.sql",
  ),
  "utf8",
);
const raceCalendar = readFileSync(
  join(process.cwd(), "services/race-calendar.ts"),
  "utf8",
);
const riderProfile = readFileSync(
  join(process.cwd(), "app/jeu/coureurs/[identifiant]/page.tsx"),
  "utf8",
);
const continentalPattern = readFileSync(
  join(process.cwd(), "components/game/continental-champion-pattern.tsx"),
  "utf8",
);

describe("championnats continentaux nationaux et maillots distinctifs", () => {
  it("préserve les résultats S1 et en déduit seulement les titres", () => {
    expect(migration).toContain("Backfill non destructif");
    expect(migration).toContain("from public.race_results as result");
    expect(migration).toContain("result.final_rank = 1");
    expect(migration).not.toContain("official_stage_simulations");
    expect(migration).not.toContain("delete from public.race_results");
  });

  it("active les sélections nationales continentales seulement à partir de la S2", () => {
    expect(migration).toContain("season.game_year >= 2");
    expect(migration).toContain(
      "country.continent_code = v_championship.continent_code",
    );
    expect(migration).toContain("where nation_rank <= 20");
    expect(raceCalendar).toContain('"continental_championship"');
    expect(raceCalendar).toContain("nationalInternationalEditionIds");
    expect(raceCalendar).toContain(
      'role: usesNationalWorldModel ? "auto" : row.race_role',
    );
  });

  it("classe les coureurs selon le profil réel du parcours", () => {
    for (const profile of [
      "flat",
      "sprint",
      "hilly",
      "mountain",
      "cobbles",
      "time_trial",
      "mixed",
    ]) {
      expect(migration).toContain(`when '${profile}'`);
    }
    expect(migration).toContain("pool.profile_rating desc");
    expect(migration).toContain("rating.hills * 0.32");
  });

  it("gère les cinq continents et leurs maillots distinctifs", () => {
    for (const continent of [
      "africa",
      "america",
      "asia",
      "europe",
      "oceania",
    ]) {
      expect(migration).toContain(`continental_${continent}_road`);
      if (continent === "oceania") {
        expect(continentalPattern).toContain("OceaniaPattern");
      } else {
        expect(continentalPattern).toContain(`"${continent}"`);
      }
    }
    expect(continentalPattern).toContain("#003399");
    expect(continentalPattern).toContain("#FFCC00");
  });

  it("applique CM puis CC puis CN à l'avatar et cumule tous les maillots sur la fiche", () => {
    expect(riderProfile.indexOf("activeWorldTitle")).toBeLessThan(
      riderProfile.indexOf("activeContinentalTitle"),
    );
    expect(riderProfile).toContain(
      "activeContinentalTitles={activeContinentalTitles}",
    );
    expect(riderProfile).toContain("activeNationalTitles.map");
    expect(riderProfile).toContain("activeContinentalTitles.map");
    expect(riderProfile).toContain("activeWorldTitles.map");
    expect(riderProfile).toContain("entry.continentalTitles.map");
  });
});
