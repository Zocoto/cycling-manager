import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ?? "C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js";
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = (number) => `'00000000-0000-4000-8000-${String(number).padStart(12, "0")}'`;

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create schema private;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create table teams(id uuid primary key);
    create table seasons(id uuid primary key, status text, game_year integer, current_day_number integer);
    create table sporting_directors(id uuid primary key, auth_user_id uuid, status text);
    create table team_manager_assignments(team_id uuid, sporting_director_id uuid, role text, status text);
    create table team_infrastructures(team_id uuid, infrastructure_code text, level integer);
    create table team_infrastructure_specializations(team_id uuid, infrastructure_code text, active_specialization_code text);
    create table team_seasons(id uuid primary key, team_id uuid, season_id uuid, cash_balance numeric);
    create table season_days(id uuid primary key, season_id uuid, day_number integer, calendar_date date);
    create table national_federation_hosting_awards(id uuid primary key, target_game_year integer,
      event_type text, continent_code text, country_id uuid, status text, economics_version smallint not null default 1);
    create table race_editions(id uuid primary key, display_name text, host_country_id uuid, is_neutral_host boolean, status text);
    create table development_race_editions(id uuid primary key, name text, host_country_id uuid,
      is_neutral_host boolean, status text, season_id uuid, start_day_number integer);
    create table stages(id uuid, race_edition_id uuid, season_day_id uuid, distance_km numeric, departure_at timestamptz, status text);
    create table development_race_stages(race_edition_id uuid, distance_km numeric);
    create table national_federation_selection_race_links(race_edition_id uuid, race_registration_id uuid, selection_list_id uuid);
    create table race_registrations(id uuid, status text);
    create table national_federation_selection_members(selection_list_id uuid, owner_team_id uuid,
      response_status text, professional_rider_id uuid, junior_rider_id uuid);
    create table race_rosters(id uuid, race_registration_id uuid, rider_id uuid, status text);
    create table rider_contracts(id uuid primary key default gen_random_uuid(), rider_id uuid, team_id uuid, status text,
      start_season_id uuid, end_season_id uuid, left_season_id uuid, joined_day_number integer, left_day_number integer,
      signed_at timestamptz, created_at timestamptz not null default now());
    create table national_federation_junior_race_registrations(id uuid, race_edition_id uuid, selection_list_id uuid, status text);
    create table national_federation_junior_race_registration_riders(registration_id uuid, academy_rider_id uuid);
    create table youth_academy_riders(id uuid, team_id uuid);
    create table stage_results(stage_id uuid, race_roster_id uuid, status text);
    create table development_teams(id uuid, team_id uuid);
    create table development_race_results(race_edition_id uuid, result_scope text, academy_rider_id uuid, development_team_id uuid);
    create table fan_club_fleet(team_id uuid, model_code text, quantity integer);
    create table fan_club_profiles(team_id uuid, supporter_count integer);
    create table team_finance_transactions(team_season_id uuid, season_day_id uuid, day_number integer,
      amount numeric, category text, status text, description text, source_reference text unique, posted_at timestamptz);
    create function public.settle_current_team_finances() returns void language plpgsql as $$ begin end; $$;
    create function private.get_federation_hosting_editions(uuid, text, text)
    returns table (edition_id uuid, is_junior boolean, edition_status text) language sql stable as $$
      select edition.id, false, edition.status from public.race_editions edition where $2 = 'world_championship_pro'
      union all select edition.id, true, edition.status from public.development_race_editions edition where $2 = 'world_championship_junior'
    $$;
    insert into teams values (${id(1)}), (${id(15)});
    insert into seasons values (${id(2)}, 'active', 6, 1);
    insert into sporting_directors values (${id(3)}, ${id(4)}, 'active'), (${id(16)}, ${id(17)}, 'active');
    insert into team_manager_assignments values (${id(1)}, ${id(3)}, 'general_manager', 'active'), (${id(15)}, ${id(16)}, 'general_manager', 'active');
    insert into team_infrastructures values (${id(1)}, 'fan_club_headquarters', 3), (${id(15)}, 'fan_club_headquarters', 1);
    insert into team_infrastructure_specializations values (${id(1)}, 'fan_club_headquarters', 'loyalty_program');
    insert into team_seasons values (${id(5)}, ${id(1)}, ${id(2)}, 10000), (${id(18)}, ${id(15)}, ${id(2)}, 10000);
    insert into season_days values (${id(6)}, ${id(2)}, 1, current_date), (${id(7)}, ${id(2)}, 2, current_date + 3);
    insert into national_federation_hosting_awards (id, target_game_year, event_type, continent_code, country_id, status) values
      (${id(8)}, 6, 'world_championship_pro', null, ${id(9)}, 'scheduled'),
      (${id(10)}, 6, 'world_championship_junior', null, ${id(9)}, 'scheduled');
    insert into race_editions values (${id(11)}, 'CM pro', ${id(9)}, false, 'registration_open');
    insert into development_race_editions values (${id(12)}, 'CM junior', ${id(9)}, false, 'planned', ${id(2)}, 2);
    insert into stages values (${id(13)}, ${id(11)}, ${id(7)}, 100, now() + interval '3 days', 'scheduled');
    insert into development_race_stages values (${id(12)}, 70);
    insert into national_federation_selection_race_links values (${id(11)}, ${id(20)}, ${id(21)});
    insert into race_registrations values (${id(20)}, 'accepted');
    insert into national_federation_selection_members values
      (${id(21)}, ${id(1)}, 'confirmed', ${id(22)}, null),
      (${id(21)}, ${id(15)}, 'pending', ${id(29)}, null),
      (${id(25)}, ${id(1)}, 'confirmed', null, ${id(26)});
    insert into race_rosters values (${id(23)}, ${id(20)}, ${id(22)}, 'confirmed'), (${id(30)}, ${id(20)}, ${id(29)}, 'selected');
    insert into rider_contracts (rider_id, team_id, status, start_season_id, end_season_id) values
      (${id(22)}, ${id(1)}, 'active', ${id(2)}, ${id(2)}), (${id(29)}, ${id(15)}, 'active', ${id(2)}, ${id(2)});
    insert into national_federation_junior_race_registrations values (${id(24)}, ${id(12)}, ${id(25)}, 'registered');
    insert into national_federation_junior_race_registration_riders values (${id(24)}, ${id(26)});
    insert into youth_academy_riders values (${id(26)}, ${id(1)});
    insert into fan_club_fleet values (${id(1)}, 'regional', 1), (${id(15)}, 'regional', 1);
    insert into fan_club_profiles values (${id(1)}, 200), (${id(15)}, 200);
  `);
  await db.exec(readFileSync("supabase/migrations/20261116132000_allow_international_fan_club_charters.sql", "utf8"));
  const rows = async (sql) => (await db.query(sql)).rows;
  const offerings = () => rows("select * from public.get_current_team_international_fan_club_trips() order by edition_name");
  const charter = (edition, junior, count = 1) => rows(`select public.charter_current_team_international_fan_club_cars(${id(edition)}, ${junior}, 'regional', ${count}) as id`);
  const totals = async (award) => (await rows(`select * from private.get_federation_hosting_charter_totals(${id(award)})`))[0];
  await db.exec(`set request.jwt.claim.sub = ${id(4)};`);
  assert.equal((await offerings()).length, 0, "legacy awards are never offered");
  await db.exec("update national_federation_hosting_awards set economics_version = 2");
  assert.deepEqual((await offerings()).map((entry) => entry.edition_name), ["CM junior", "CM pro"]);

  await db.exec(`set request.jwt.claim.sub = ${id(17)};`);
  assert.equal((await offerings()).length, 0, "a pending call-up does not grant eligibility");
  await assert.rejects(charter(11, false), /n’est plus disponible/);
  await db.exec(`set request.jwt.claim.sub = ${id(4)};`);
  await assert.rejects(charter(11, false, 2), /suffisamment de cars/);
  const firstTrip = await charter(11, false);
  assert.deepEqual(await charter(11, false), firstTrip, "an identical retry does not add an expense");
  const juniorTrip = await charter(12, true);
  assert.notDeepEqual(juniorTrip, firstTrip);
  assert.equal((await rows("select count(*)::integer as count from team_finance_transactions"))[0].count, 2);
  assert.equal(Number((await rows(`select cash_balance from team_seasons where id = ${id(5)}`))[0].cash_balance), 9041);
  assert.deepEqual((await offerings()).map((row) => row.mobilized_supporters), [42, 42]);
  assert.deepEqual(await totals(8), { car_count: 0, seat_count: 0 }, "tickets never count before the race is completed");

  await db.exec(`update race_editions set status = 'completed'; update stages set status = 'completed';
    update development_race_editions set status = 'completed';
    insert into stage_results values (${id(13)}, ${id(23)}, 'did_not_start'), (${id(13)}, ${id(30)}, 'classified');
    insert into development_race_results values (${id(12)}, 'general', ${id(26)}, null);`);
  assert.deepEqual(await totals(8), { car_count: 0, seat_count: 0 }, "DNS and another team's riders do not count");
  assert.deepEqual(await totals(10), { car_count: 0, seat_count: 0 }, "junior overall result is not a start");
  await db.exec(`update stage_results set status = 'did_not_finish' where race_roster_id = ${id(23)};
    insert into development_race_results values (${id(12)}, 'stage', ${id(26)}, null), (${id(12)}, 'stage', ${id(26)}, null);`);
  assert.deepEqual(await totals(8), { car_count: 1, seat_count: 42 });
  assert.deepEqual(await totals(10), { car_count: 1, seat_count: 42 }, "the same trip counts once across all stage finishes");
  await db.exec(`update rider_contracts set status = 'terminated', left_day_number = 1 where rider_id = ${id(22)};
    insert into rider_contracts (rider_id, team_id, status, start_season_id, end_season_id, joined_day_number) values
      (${id(22)}, ${id(15)}, 'active', ${id(2)}, ${id(2)}, 2);`);
  assert.deepEqual(await totals(8), { car_count: 0, seat_count: 0 }, "a rider transferred before departure does not sustain the former team's charter bonus");
  console.log("International charters passed: scope, wallet, retries, pro and junior starts.");
} finally {
  await db.close();
}
