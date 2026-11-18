// Run the actual dashboard reminder migrations against isolated PostgreSQL.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ?? "";
if (!isAbsolute(modulePath) || !modulePath.replaceAll("\\","/").endsWith("/@electric-sql/pglite/dist/index.js")) {
  throw new Error("Pass the absolute path to a local PGlite installation.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const migration = (name) => readFile(new URL("../supabase/migrations/" + name + ".sql", import.meta.url), "utf8");
const summary = async () => (await db.query("select get_current_dashboard_assistant_summary() as summary")).rows[0].summary;

async function expectReminder(count, nextName = null, nextEditionId = null) {
  const result = await summary();
  assert.deepEqual(result.developmentRaceRegistrationReminder, { count, nextName, nextEditionId });
  assert.equal(result.equipmentPartnerSignatureAvailable, false);
}

try {
  await db.exec(`
    create table public.development_teams (id int primary key, team_id int, season_id int, status text);
    create table public.development_team_roster (
      development_team_id int, academy_rider_id int, primary key(development_team_id, academy_rider_id)
    );
    create table public.youth_academy_riders (id int primary key, team_id int, country_id int, status text, birth_game_year int);
    create table public.countries (id int primary key, iso_alpha2 text);
    create table public.development_race_editions (
      id int primary key, season_id int, start_day_number int, name text, status text,
      selection_mode text, selection_minimum int, competition_type text, country_code text
    );
    create table public.development_race_registrations (
      id int primary key, development_team_id int, race_edition_id int, status text
    );
    create table public.development_race_registration_riders (registration_id int);
    create function public.get_current_dashboard_assistant_summary()
    returns jsonb language sql stable security definer set search_path = '' as $$
      with current_context as (
        select 1 as team_id, 5 as season_id, 5 as game_year, 12 as current_day_number
      )
      select jsonb_build_object(
      'equipmentPartnerSignatureAvailable', (
        select false
      )
      );
    $$;
    insert into public.development_teams values (1, 1, 5, 'active');
    insert into public.countries values (1, 'BE'), (2, 'FR');
    insert into public.youth_academy_riders values
      (1, 1, 1, 'active', -10), -- 15 years old
      (2, 1, 2, 'recruited', -12),
      (3, 1, 1, 'active', -12), -- Eligible academy rider outside the DevTeam
      (4, 1, 1, 'promoted', -13);
    insert into public.development_team_roster values (1, 1), (1, 2), (1, 4);
    insert into public.development_race_editions values
      (1, 5, 13, 'A · Tour', 'planned', 'manual', 3, 'regular', 'BE'),
      (2, 5, 13, 'B · Chrono', 'planned', 'manual', 1, 'regular', 'BE'),
      (3, 5, 13, 'C · CN', 'planned', 'manual', 1, 'national_time_trial', 'BE'),
      (4, 5, 13, 'D · Mondial', 'planned', 'automatic', 1, 'world_road', 'BE'),
      (5, 5, 14, 'E · Plus tard', 'planned', 'manual', 1, 'regular', 'BE');
  `);
  await db.exec(await migration("20260918230000_add_development_race_registration_dashboard_reminder"));
  await expectReminder(3, "A · Tour", "1");
  await db.exec(await migration("20261119090000_filter_unactionable_devteam_registration_reminders"));
  await expectReminder(1, "B · Chrono", "2");

  await db.exec(`
    insert into public.development_race_registrations values (1, 1, 2, 'registered');
    insert into public.development_race_registration_riders values (1);
  `);
  await expectReminder(0);
  await db.exec("insert into public.development_team_roster values (1, 3)");
  await expectReminder(2, "A · Tour", "1");

  await db.exec("update public.development_teams set status = 'completed'");
  await expectReminder(0);
  console.log("PASS: DevTeam reminder requires the race minimum, uses eligible riders and preserves the J+1, manual and registration filters.");
} finally {
  await db.close();
}
