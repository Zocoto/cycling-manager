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
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [country, season, president, outsider, account] = Array.from({ length: 5 }, (_, i) => id(i + 1));
const migrate = (file) => readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8");
const scalar = async (query) => Object.values((await db.query(query)).rows[0])[0];

try {
  await db.exec(`
    create schema private;
    create schema auth;
    create role anon;
    create role authenticated;
    create role service_role;
    create table countries (id uuid primary key, iso_alpha2 text, continent_code text, is_active boolean);
    create table seasons (id uuid primary key, status text, game_year int, current_day_number int);
    create table season_days (season_id uuid, day_number int, calendar_date date);
    create table sporting_directors (id uuid primary key);
    create table national_federation_terms (country_id uuid, start_game_year int, end_game_year int,
      governance_mode text, president_director_id uuid);
    create table national_federation_accounts (id uuid primary key, country_id uuid, season_id uuid,
      balance numeric, updated_at timestamptz default now(), unique(country_id, season_id));
    create table national_federation_journal_entries (
      country_id uuid, season_id uuid, day_number int, category text,
      title text, detail text, source_reference text unique, created_at timestamptz default now()
    );
    create table races (id uuid primary key, country_id uuid, competition_type text, championship_continent_code text);
    create table race_editions (id uuid primary key, race_id uuid, season_id uuid, status text);
    create table development_race_editions (id uuid primary key, season_id uuid, country_code text,
      competition_type text, championship_continent_code text, status text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.user_id', true), '')::uuid
    $$;
    create function get_current_federation_identity(code text) returns table(country_id uuid, sporting_director_id uuid)
      language sql stable as $$
        select id, auth.uid() from public.countries where iso_alpha2 = upper(code)
      $$;
    create function get_national_federation_race_organization_effects(uuid)
      returns table(office_level int, hosting_cost_reduction_percentage numeric, candidacy_score_bonus_percentage numeric)
      language sql stable as $$
        select current_setting('test.office_level')::int, 0::numeric,
          coalesce(nullif(current_setting('test.office_bonus', true), ''), '0')::numeric
      $$;
    create function get_national_championship_country_rankings(uuid)
      returns table(country_id uuid, uci_points int) language sql stable as $$
        select id, 100 from public.countries
      $$;
    insert into countries values ('${country}', 'BE', 'europe', true);
    insert into seasons values ('${season}', 'active', 5, 4);
    insert into season_days values ('${season}', 20, (now() at time zone 'Europe/Paris')::date + 16);
    insert into sporting_directors values ('${president}'), ('${outsider}');
    insert into national_federation_terms values ('${country}', 5, 5, 'elected', '${president}');
    insert into national_federation_accounts(id, country_id, season_id, balance)
      values ('${account}', '${country}', '${season}', 4000000);
  `);
  const original = await migrate("20260904170000_create_federation_course_portfolio_and_hosting.sql");
  await db.exec(original.slice(original.indexOf("alter table public.race_editions"), original.indexOf("create or replace function public.refresh_national_federation_renown")));
  await db.exec(`
    alter table national_federation_hosting_candidacies add column specialization_bonus_points int not null default 0;
    create function refresh_national_federation_renown(p_country_id uuid)
      returns national_federation_renown language sql as $$
        insert into public.national_federation_renown (
          country_id, score, uci_history_points, team_legacy_points, rider_legacy_points,
          hosting_legacy_points, source_through_game_year, calculated_at
        ) values (p_country_id, 500, 500, 0, 0, 0, 5, now())
        on conflict (country_id) do update set calculated_at = now()
        returning *
      $$;
  `);
  await db.exec(await migrate("20261110100020_secure_federation_hosting_reservations.sql"));
  await db.exec(`set test.user_id = '${outsider}'; set test.office_level = '1'`);
  await assert.rejects(scalar("select submit_national_federation_hosting_candidacy('BE', 'world_championship_junior')"), /président élu/);
  await db.exec(`set test.user_id = '${president}'`);
  await assert.rejects(scalar("select submit_national_federation_hosting_candidacy('BE', 'world_championship_pro')"), /niveau 3/);
  await assert.rejects(scalar("select submit_national_federation_hosting_candidacy('BE', 'nations_cup_junior')"), /pas proposée/);

  const world = "select submit_national_federation_hosting_candidacy('BE', 'world_championship_junior')";
  const continent = "select submit_national_federation_hosting_candidacy('BE', 'continental_championship_junior')";
  const candidacy = await scalar(world);
  assert.equal(await scalar(world), candidacy);
  assert.equal(Number(await scalar("select balance from national_federation_accounts")), 4_000_000);
  assert.equal(Number(await scalar(`select reserved_amount from get_national_federation_hosting_budget('${country}', '${season}')`)), 1_200_000);
  assert.equal(Number(await scalar("select revenue_per_attendee from national_federation_hosting_candidacies")), 15);
  await assert.rejects(scalar(continent), /Retirez la candidature/);
  await assert.rejects(db.exec("update national_federation_accounts set balance = 1199999"), /budget réservé/);
  await db.exec("update national_federation_accounts set balance = 1200000");

  const withdraw = `select withdraw_national_federation_hosting_candidacy('BE', '${candidacy}')`;
  await db.exec(`set test.user_id = '${outsider}'`);
  await assert.rejects(scalar(withdraw), /président élu/);
  await db.exec(`set test.user_id = '${president}'`);
  assert.equal(await scalar(withdraw), candidacy);
  assert.equal(await scalar(withdraw), candidacy);
  const next = await scalar(continent);
  assert.notEqual(next, candidacy);
  assert.equal(Number(await scalar("select revenue_per_attendee from national_federation_hosting_candidacies where status = 'pending'")), 16);
  await db.exec("update national_federation_accounts set balance = 700000");
  await db.exec("update season_days set calendar_date = (now() at time zone 'Europe/Paris')::date - 1");
  await assert.rejects(scalar(`select withdraw_national_federation_hosting_candidacy('BE', '${next}')`), /fin de J20/);
  await db.exec("update national_federation_hosting_candidacies set status = 'selected' where status = 'pending'");
  await db.exec("update national_federation_accounts set balance = 0");
  assert.equal(Number(await scalar("select balance from national_federation_accounts")), 0);

  await db.exec(`
    update season_days set calendar_date = (now() at time zone 'Europe/Paris')::date + 16;
    update national_federation_accounts set balance = 4000000;
  `);
  assert.equal(await scalar(world), candidacy);
  const legacyPending = (await db.query(
    "select created_at, updated_at, hosting_cost, selection_score from national_federation_hosting_candidacies where id = $1",
    [candidacy],
  )).rows[0];
  const legacySelected = (await db.query(
    "select created_at, updated_at, hosting_cost, selection_score from national_federation_hosting_candidacies where id = $1",
    [next],
  )).rows[0];
  assert.equal(legacyPending.selection_score, 925);

  const [oldSeason, otherCountry, hostedRace, standardRace] = [6, 7, 8, 9].map(id);
  await db.exec(`
    insert into countries values ('${otherCountry}', 'FR', 'europe', true);
    insert into seasons values ('${oldSeason}', 'completed', 4, 28);
    insert into races values
      ('${hostedRace}', '${otherCountry}', 'nations_cup', null),
      ('${standardRace}', '${country}', 'standard', null);
    insert into race_editions(id, race_id, season_id, status, host_country_id) values
      ('${id(10)}', '${hostedRace}', '${oldSeason}', 'completed', '${country}'),
      ('${id(11)}', '${standardRace}', '${season}', 'completed', '${country}'),
      ('${id(12)}', '${hostedRace}', '${season}', 'cancelled', '${country}');
    set test.office_level = '2';
  `);
  await db.exec(await migrate("20261110140000_open_federation_hosting_and_score_organization.sql"));

  const score = async (id) => (await db.query(
    `select last_hosted_game_year, recency_points, ranking_points, renown_points, organization_points,
      specialization_bonus_points, selection_score
      from national_federation_hosting_candidacies where id = $1`,
    [id],
  )).rows[0];
  assert.deepEqual(await score(candidacy), {
    last_hosted_game_year: 4,
    recency_points: 75,
    ranking_points: 200,
    renown_points: 75,
    organization_points: 20,
    specialization_bonus_points: 0,
    selection_score: 370,
  });
  const rescoredPending = (await db.query(
    "select created_at, updated_at, hosting_cost from national_federation_hosting_candidacies where id = $1",
    [candidacy],
  )).rows[0];
  assert.deepEqual(rescoredPending, {
    created_at: legacyPending.created_at,
    updated_at: legacyPending.updated_at,
    hosting_cost: legacyPending.hosting_cost,
  });
  assert.deepEqual((await db.query(
    "select created_at, updated_at, hosting_cost, selection_score from national_federation_hosting_candidacies where id = $1",
    [next],
  )).rows[0], legacySelected);
  assert.equal(Number(await scalar(`select reserved_amount from get_national_federation_hosting_budget('${country}', '${season}')`)), 1_200_000);

  await scalar(withdraw);
  await db.exec("set test.office_level = '0'");
  assert.equal(await scalar(world), candidacy);
  assert.equal((await score(candidacy)).organization_points, 0);
  await scalar(withdraw);
  const pro = "select submit_national_federation_hosting_candidacy('BE', 'world_championship_pro')";
  await db.exec("update national_federation_accounts set balance = 3499999");
  await assert.rejects(scalar(pro), /trésorerie disponible/);
  await db.exec("update national_federation_accounts set balance = 4000000");
  const proCandidacy = await scalar(pro);
  assert.equal((await score(proCandidacy)).selection_score, 350);
  assert.equal(await scalar(pro), proCandidacy);
  await assert.rejects(db.exec("update national_federation_accounts set balance = 3499999"), /budget réservé/);
  await scalar(`select withdraw_national_federation_hosting_candidacy('BE', '${proCandidacy}')`);
  await db.exec("set test.office_level = '5'; set test.office_bonus = '8'");
  assert.equal(await scalar(pro), proCandidacy);
  const upgraded = await score(proCandidacy);
  assert.equal(upgraded.organization_points, 50);
  assert.equal(upgraded.specialization_bonus_points, 32);
  assert.equal(upgraded.selection_score, 432);
  console.log("Hosting reservations and scoring SQL passed: eligibility, treasury, rotation, office, pending migration and retries.");
} catch (error) {
  console.error(error.message, error.where ?? "");
  process.exitCode = 1;
} finally {
  await db.close();
}
