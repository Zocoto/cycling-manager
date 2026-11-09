// Isolated PostgreSQL/WASM only. Apply the actual dashboard reminder migration.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2];
if (!isAbsolute(modulePath ?? "") || !modulePath.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js")) {
  throw new Error("Pass the absolute path to an installed local PGlite module.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const [country, season, team, teamSeason, director, regular, exceptional, candidate, replacement] =
  Array.from({ length: 9 }, (_, index) => id(index + 1));

async function scalar(sql) {
  return Object.values((await db.query(sql)).rows[0])[0];
}

async function reminder() {
  return scalar("select journal_items -> 'federationVoteReminder' from public.get_current_dashboard_assistant_summary()");
}

async function verifyReminder(expectedCloseSql) {
  const value = await reminder();
  assert.equal(value.countryCode, "be");
  assert.equal(Date.parse(value.closesAt), new Date(await scalar(expectedCloseSql)).getTime());
  assert.deepEqual(Object.keys(value).sort(), ["closesAt", "countryCode"]);
}

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema private;
    create table public.countries (id uuid primary key, iso_alpha2 text, is_active boolean);
    create table public.seasons (id uuid primary key, game_year int, current_day_number int, status text, ends_on date);
    create table public.team_seasons (id uuid primary key, team_id uuid, season_id uuid, registration_country_id uuid);
    create table public.national_federation_elections (
      id uuid primary key, country_id uuid, election_season_id uuid, term_start_game_year int, term_end_game_year int,
      election_type text, status text, applications_close_at timestamptz, voting_close_at timestamptz,
      created_at timestamptz default now()
    );
    create table public.national_federation_electorate (
      election_id uuid, team_id uuid, sporting_director_id uuid, primary key (election_id, team_id)
    );
    create table public.national_federation_candidates (
      id uuid primary key, election_id uuid, team_id uuid, withdrawn_at timestamptz, eligible boolean
    );
    create table public.national_federation_votes (election_id uuid, team_id uuid, candidate_id uuid, primary key (election_id, team_id));
    create function public.is_national_federation_candidate_eligible(uuid, uuid) returns boolean
    language sql stable as $$
      select eligible from public.national_federation_candidates where election_id = $1 and team_id = $2
    $$;
    create function public.get_current_dashboard_assistant_summary() returns table(journal_items jsonb)
    language sql stable security definer set search_path = '' as $$
      with current_context as (select '${teamSeason}'::uuid as team_season_id, '${director}'::uuid as sporting_director_id)
      select jsonb_build_object('equipmentPartnerSignatureAvailable', (select false));
    $$;
    revoke all on function public.get_current_dashboard_assistant_summary() from public;
    grant execute on function public.get_current_dashboard_assistant_summary() to authenticated;
    insert into public.countries values ('${country}', 'BE', true);
    insert into public.seasons values ('${season}', 4, 25, 'active', (now() at time zone 'Europe/Paris')::date + 3);
    insert into public.team_seasons values ('${teamSeason}', '${team}', '${season}', '${country}');
  `);

  const migration = new URL("../supabase/migrations/20261109170000_add_federation_vote_dashboard_reminder.sql", import.meta.url);
  await db.exec(await readFile(migration, "utf8"));
  assert.equal(await scalar("select has_function_privilege('authenticated', 'private.get_dashboard_federation_vote_reminder(uuid,uuid)', 'execute')"), false);
  assert.equal(await scalar("select has_function_privilege('service_role', 'private.get_dashboard_federation_vote_reminder(uuid,uuid)', 'execute')"), false);
  assert.equal(await scalar("select journal_items -> 'equipmentPartnerSignatureAvailable' from public.get_current_dashboard_assistant_summary()"), false);
  assert.equal(await reminder(), null);

  const regularCloseSql = "select ((ends_on + 1)::timestamp at time zone 'Europe/Paris') from public.seasons";
  await db.exec(`
    insert into public.national_federation_elections values
      ('${regular}', '${country}', '${season}', 5, 6, 'regular', 'applications', null, null);
    insert into public.national_federation_electorate values ('${regular}', '${team}', '${director}');
    insert into public.national_federation_candidates values ('${candidate}', '${regular}', '${id(30)}', null, true);
  `);
  await verifyReminder(regularCloseSql);
  assert.equal(await scalar("select status from public.national_federation_elections"), "applications");
  await db.exec("update public.seasons set current_day_number = 24");
  assert.equal(await reminder(), null);
  await db.exec("update public.seasons set current_day_number = 28, ends_on = (now() at time zone 'Europe/Paris')::date - 1");
  assert.equal(await reminder(), null);
  await db.exec("update public.seasons set ends_on = (now() at time zone 'Europe/Paris')::date + 1");
  await verifyReminder(regularCloseSql);

  const exceptionalCloseSql = `select voting_close_at from public.national_federation_elections where id = '${exceptional}'`;
  await db.exec(`
    insert into public.national_federation_elections values
      ('${exceptional}', '${country}', '${season}', 3, 4, 'exceptional', 'applications', now() + interval '1 hour', now() + interval '2 days');
    insert into public.national_federation_electorate values ('${exceptional}', '${team}', '${director}');
    insert into public.national_federation_candidates values
      ('${id(20)}', '${exceptional}', '${id(31)}', null, true),
      ('${replacement}', '${exceptional}', '${id(32)}', null, true);
  `);
  assert.equal(await reminder(), null);
  await db.exec(`update public.national_federation_elections set applications_close_at = now() where id = '${exceptional}'`);
  const ownerView = await reminder();
  await db.exec("set role authenticated");
  assert.deepEqual(await reminder(), ownerView);
  await db.exec("reset role");
  await verifyReminder(exceptionalCloseSql);
  assert.equal(await scalar(`select status from public.national_federation_elections where id = '${exceptional}'`), "applications");

  await db.exec(`update public.national_federation_electorate set sporting_director_id = '${id(55)}' where election_id = '${exceptional}'`);
  assert.equal(await reminder(), null);
  await db.exec(`update public.national_federation_electorate set sporting_director_id = '${director}' where election_id = '${exceptional}'`);
  await db.exec(`insert into public.national_federation_votes values ('${exceptional}', '${team}', '${id(20)}')`);
  assert.equal(await reminder(), null);
  await db.exec(`update public.national_federation_candidates set withdrawn_at = now() where id = '${id(20)}'`);
  await verifyReminder(exceptionalCloseSql);
  await db.exec(`update public.national_federation_candidates set eligible = false where id = '${replacement}'`);
  assert.equal(await reminder(), null);
  await db.exec(`update public.national_federation_elections set voting_close_at = now() where id = '${exceptional}'`);
  await verifyReminder(regularCloseSql);
  await db.exec("update public.countries set is_active = false");
  assert.equal(await reminder(), null);

  console.log("Federation vote reminder, calendar, precedence, eligibility, ballot and ACL checks passed.");
} finally {
  await db.close();
}
