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
      language sql stable as $$ select current_setting('test.office_level')::int, 0::numeric, 0::numeric $$;
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
  console.log("Hosting reservations SQL passed: authority, deadline, affordability, withdrawal, retry and award debit.");
} catch (error) {
  console.error(error.message, error.where ?? "");
  process.exitCode = 1;
} finally {
  await db.close();
}
