import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = read(
  "supabase/migrations/20260904110000_federation_junior_championship_registrations.sql",
);
const selectionPool = read("services/federation-selection-pool.ts");
const raceCalendar = read("services/race-calendar.ts");
const proCalendarPage = read("app/jeu/calendrier/page.tsx");
const developmentPanel = read("components/game/development-team-panel.tsx");

describe("federation junior championship registrations", () => {
  it("builds the presidential shortlist from cycling schools and optional DevTeams", () => {
    expect(selectionPool).toContain('.in("status", ["active", "recruited"])');
    expect(selectionPool).toContain('.from("development_team_roster")');
    expect(selectionPool).toContain('"cycling_school"');
    expect(selectionPool).toContain('"development_team"');
    expect(migration).toContain("academy.status in ('active', 'recruited')");
  });

  it("materializes confirmed federation choices as junior race registrations", () => {
    expect(migration).toContain(
      "create table public.national_federation_junior_race_registrations",
    );
    expect(migration).toContain(
      "create table public.national_federation_junior_race_registration_riders",
    );
    expect(migration).toContain(
      "sync_national_federation_junior_lineup",
    );
    expect(migration).toContain("member.response_status = 'confirmed'");
    expect(migration).toContain("development_membership.development_team_id");
  });

  it("removes direct DevTeam entry from Season 3 world and continental events", () => {
    expect(migration).toContain(
      "block_development_team_championship_entry",
    );
    expect(migration).toContain(
      "Les inscriptions internationales juniors sont réservées aux fédérations",
    );
    expect(migration).toContain("set status = 'withdrawn'");
    expect(developmentPanel).toContain("CC junior");
    expect(read("services/development-team.ts")).toContain(
      'isFederationChampionship && view !== "resultats"',
    );
  });

  it("adds continental races and sends the pro calendar directly to junior results", () => {
    expect(migration).toContain("'continental_road'");
    expect(migration).toContain("'continental_time_trial'");
    expect(migration).toContain("championship_continent_code");
    expect(migration).toContain(
      "settle_due_development_races_pre_federation_juniors",
    );
    expect(raceCalendar).toContain("loadJuniorChampionshipCalendarEditions");
    expect(raceCalendar).toContain("/jeu/resultats-juniors/");
    expect(raceCalendar).toContain("isJuniorChampionship: true");
    expect(raceCalendar).toContain(
      "options.includeJuniorChampionships === true",
    );
    expect(proCalendarPage).toContain("includeJuniorChampionships: true");
  });

  it("adds the junior Nations Cup with the same federation-only pool", () => {
    expect(migration).toContain("'nc-junior-road'");
    expect(migration).toContain("'nations_cup_junior'");
    expect(migration).toContain("'nations-cup-juniors'");
    expect(migration).toContain(
      "ensure_automatic_federation_junior_lineups",
    );
    expect(raceCalendar).toContain('"nations_cup_junior"');
  });

  it("merges federation riders into the official deterministic result", () => {
    expect(migration).toContain(
      "simulate_development_race_pre_federation_juniors",
    );
    expect(migration).toContain("'federation-youth:'");
    expect(migration).toContain("virtual_country_mapping");
    expect(migration).toContain(
      "country.continent_code = v_edition.championship_continent_code",
    );
    expect(migration).toContain("public.get_development_result_points");
    expect(migration).toContain("public.refresh_development_rankings");
  });
});

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}
