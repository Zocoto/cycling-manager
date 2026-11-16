// Exercise the actual hosting settlement migration in PostgreSQL isolated from production.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ??
  "C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js";
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const migration = readFileSync(
  "supabase/migrations/20261110130000_finalize_federation_hosting_awards.sql",
  "utf8",
);
const reservationMigration = readFileSync(
  "supabase/migrations/20261110100020_secure_federation_hosting_reservations.sql",
  "utf8",
);
const reservationGuard = reservationMigration.match(
  /create index national_federation_hosting_pending_budget_idx[\s\S]*?(?=create function public.get_national_federation_hosting_budget)/,
)?.[0];
assert.ok(reservationGuard, "apply the real reservation guard alongside the settlement migration");
function migrationFunction(file, name) {
  const source = readFileSync(`supabase/migrations/${file}.sql`, "utf8");
  const definition = source.match(new RegExp(`create (?:or replace )?function ${name.replaceAll(".", "\\.")}\\([\\s\\S]*?\\$\\$;`))?.[0];
  assert.ok(definition, `real function ${name}`);
  return definition;
}

async function scalar(sql) {
  const result = await db.query(sql);
  assert.equal(result.rows.length, 1, sql);
  return Object.values(result.rows[0])[0];
}

async function award(eventKey) {
  const result = await db.query(
    "select * from national_federation_hosting_awards where event_key = $1",
    [eventKey],
  );
  assert.equal(result.rows.length, 1, eventKey);
  return result.rows[0];
}

const balance = (countryId, seasonId) => scalar(
  "select balance::integer from national_federation_accounts where country_id = uid(" +
  countryId + ") and season_id = uid(" + seasonId + ")",
);
const settleAwards = () => scalar("select settle_due_national_federation_hosting_candidacies()");
const settleReturns = () => scalar("select settle_due_national_federation_hosting_returns()");

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role; create schema private;
    create function uid(integer) returns uuid language sql immutable as $$
    select ('00000000-0000-0000-0000-' || lpad($1::text, 12, '0'))::uuid $$;
    create table seasons(id uuid primary key, status text, game_year integer unique, current_day_number integer);
    create table countries(id uuid primary key, iso_alpha2 text, name text, continent_code text, is_active boolean default true);
    create table races(id uuid primary key, competition_type text, championship_continent_code text);
    create table race_editions(id uuid primary key, race_id uuid, season_id uuid, status text, field_limit integer, host_country_id uuid);
    create table stages(id uuid primary key, race_edition_id uuid, status text);
    create table stage_results(stage_id uuid, race_roster_id uuid, status text);
    create table development_race_editions(id uuid primary key, season_id uuid, competition_type text, championship_continent_code text,
    status text, selection_maximum integer, host_country_id uuid, country_code text, location_name text, updated_at timestamptz);
    create table development_race_stages(id uuid primary key, race_edition_id uuid);
    create table development_race_results(race_edition_id uuid, result_scope text, competitor_key text);
    create table national_federation_nations_cup_assignments(season_id uuid, division integer, group_code text);
    create table national_federation_nations_cup_heats(season_id uuid, race_edition_id uuid unique, slot_key text);
    create table national_federation_selection_slots(slot_key text primary key, competition_code text, rider_category text,
    active_from_game_year integer, rider_limit integer);
    create table national_federation_olympic_events(season_id uuid primary key, race_edition_id uuid, time_trial_race_edition_id uuid);
    create table national_federation_olympic_qualifications(season_id uuid, rider_quota integer, time_trial_rider_quota integer);
    create table national_federation_hosting_candidacies(id uuid primary key, country_id uuid, submitted_season_id uuid,
    target_game_year integer, event_type text, event_key text, continent_code text, hosting_cost numeric(14,2),
    base_attendance integer, revenue_per_attendee integer, prestige_gain integer, renown_score integer, selection_score integer,
    status text, created_at timestamptz default now(), decided_at timestamptz, updated_at timestamptz);
    create table national_federation_hosting_awards(id uuid primary key default gen_random_uuid(), candidacy_id uuid unique,
    country_id uuid, target_game_year integer, event_type text, event_key text, continent_code text, hosting_cost numeric(14,2),
    projected_attendance integer, projected_gross_revenue numeric(14,2), projected_net_return numeric(14,2),
    actual_participation_rate numeric(6,5), actual_attendance integer, actual_gross_revenue numeric(14,2),
    actual_net_return numeric(14,2), prestige_gain integer, status text default 'scheduled', selected_at timestamptz default now(),
    settled_at timestamptz, unique(target_game_year,event_key));
    create table national_federation_accounts(id uuid primary key, country_id uuid, season_id uuid, balance numeric(14,2)
    check (balance >= 0), updated_at timestamptz, unique(country_id, season_id));
    create table national_federation_transactions(account_id uuid, day_number integer, amount numeric(14,2), category text,
    description text, source_reference text unique, metadata jsonb);
    create table national_federation_journal_entries(country_id uuid, season_id uuid, day_number integer, category text,
    title text, detail text, source_reference text unique);
    create table national_federation_renown(country_id uuid primary key, score integer);
    create table invoked_hooks(name text);
    create function ensure_transfer_next_season(p_id uuid) returns uuid language plpgsql set search_path=public as $$ begin
    insert into invoked_hooks values ('next'); return (select n.id from seasons n join seasons s
    on n.game_year = s.game_year + 1 where s.id = p_id); end $$;
    create function ensure_development_race_calendar(uuid) returns integer language sql set search_path=public as $$
    insert into invoked_hooks values ('junior') returning 1 $$;
    create function ensure_professional_nations_cup(uuid) returns integer language sql set search_path=public as $$
    insert into invoked_hooks values ('nations') returning 1 $$;
    create function get_national_federation_race_organization_effects(uuid)
    returns table(hosting_revenue_bonus_percentage numeric) language sql as $$ select 0::numeric $$;
    create function refresh_national_federation_renown(uuid) returns integer language sql set search_path=public as $$
    insert into invoked_hooks values ('prestige') returning 1 $$;
  `);
  await db.exec(reservationGuard);
  await db.exec(migration);
  await db.exec(`
    insert into seasons values (uid(1), 'active', 5, 20), (uid(2), 'planned', 6, 1),
    (uid(3), 'planned', 7, 1), (uid(4), 'planned', 8, 1);
    insert into countries(id,iso_alpha2,name,continent_code) values (uid(11),'FR','France','europe'),
    (uid(12),'PL','Pologne','europe'), (uid(13),'KE','Kenya','africa'), (uid(14),'JP','Japon','asia');
    insert into national_federation_renown select id,500 from countries;
    insert into national_federation_accounts(id,country_id,season_id,balance)
    select gen_random_uuid(), c.id, s.id, 8000000 from countries c cross join seasons s;
    insert into national_federation_hosting_candidacies
    (id,country_id,submitted_season_id,target_game_year,event_type,event_key,continent_code,hosting_cost,
    base_attendance,revenue_per_attendee,prestige_gain,renown_score,selection_score) values
    (uid(31),uid(11),uid(1),6,'world_championship_pro','world_championship_pro',null,3500000,240000,18,60,500,800),
    (uid(32),uid(12),uid(1),6,'world_championship_pro','world_championship_pro',null,3500000,240000,18,60,500,650),
    (uid(33),uid(13),uid(1),6,'continental_championship_pro','continental_championship_pro:africa','africa',1800000,130000,16,35,500,1000),
    (uid(34),uid(12),uid(1),6,'continental_championship_junior','continental_championship_junior:europe','europe',700000,50000,16,15,500,700),
    (uid(35),uid(14),uid(1),6,'nations_cup_pro','nations_cup_pro',null,2400000,180000,17,45,500,700),
    (uid(36),uid(11),uid(1),6,'world_championship_junior','world_championship_junior',null,1200000,90000,15,25,500,700),
    (uid(37),uid(13),uid(3),8,'quadrennial_games_pro','quadrennial_games_pro',null,2400000,180000,17,45,500,700);
    update national_federation_hosting_candidacies set status = 'pending';
    insert into races values (uid(41),'world_championship',null),(uid(42),'world_championship',null),
    (uid(43),'continental_championship','africa'),(uid(44),'continental_championship','africa'),
    (uid(45),'continental_championship','europe'),(uid(46),'continental_championship','europe'),
    (uid(47),'nations_cup',null),(uid(48),'nations_cup',null);
    insert into race_editions values (uid(51),uid(41),uid(2),'planned',10,uid(14)),
    (uid(52),uid(42),uid(2),'planned',10,uid(14)),(uid(53),uid(43),uid(2),'planned',10,uid(14)),
    (uid(55),uid(45),uid(2),'planned',10,uid(14)),(uid(56),uid(46),uid(2),'planned',10,uid(14)),
    (uid(57),uid(47),uid(4),'planned',220,uid(14)),(uid(58),uid(48),uid(4),'planned',120,uid(14));
    insert into stages select gen_random_uuid(),id,'planned' from race_editions;
    insert into national_federation_olympic_events values(uid(4),uid(57),uid(58));
    insert into development_race_editions(id,season_id,competition_type,championship_continent_code,status,
    selection_maximum,host_country_id,country_code,location_name) values
    (uid(61),uid(2),'continental_road','europe','planned',5,uid(14),'JP','Japon'),
    (uid(62),uid(2),'continental_time_trial','europe','planned',5,uid(14),'JP','Japon'),
    (uid(63),uid(2),'world_road',null,'planned',5,uid(14),'JP','Japon'),
    (uid(64),uid(2),'world_time_trial',null,'planned',5,uid(14),'JP','Japon');
    insert into development_race_stages select gen_random_uuid(),id from development_race_editions;
    insert into national_federation_nations_cup_assignments values(uid(2),1,null),(uid(2),1,null);
    insert into national_federation_selection_slots
    select 'nc-'||i,'nations_cup','professional',3,2 from generate_series(1,5) i;
    insert into races select uid(70+i),'nations_cup',null from generate_series(1,5) i;
    insert into race_editions select uid(80+i),uid(70+i),uid(2),'planned',2,uid(11) from generate_series(1,5) i;
    insert into national_federation_nations_cup_heats select uid(2),uid(80+i),'nc-'||i from generate_series(1,4) i;
    insert into stages select gen_random_uuid(),uid(80+i),'planned' from generate_series(1,5) i;
  `);

  assert.equal(await settleAwards(), 0, "submissions remain pending until J21");
  assert.equal(await scalar("select count(*)::int from invoked_hooks"), 0);
  await db.exec("update seasons set current_day_number = 21 where id = uid(1);");
  assert.equal(await settleAwards(), 3);
  assert.equal(await balance(11, 1), 3_300_000, "multiple historical guarantees leave enough to settle independently");
  assert.equal(await balance(12, 1), 7_300_000, "the non-selected CM candidate pays only for its CC Junior win");
  assert.equal(await balance(13, 1), 8_000_000, "no award is charged against an incomplete programme");
  assert.equal(await scalar("select status from national_federation_hosting_candidacies where id = uid(33)"), "pending");
  assert.equal(await scalar("select count(*)::int from race_editions where id in (uid(51),uid(52)) and host_country_id=uid(11)"), 2);
  assert.equal(await scalar("select count(*)::int from race_editions where id in (uid(55),uid(56)) and host_country_id=uid(14)"), 2);
  assert.equal(await balance(14, 1), 8_000_000, "a partial Nations Cup programme does not trigger payment or early grouping");
  assert.equal(await scalar("select count(*)::int from invoked_hooks where name='nations'"), 0);
  assert.equal(await scalar("select count(*)::int from development_race_editions where id in (uid(61),uid(62)) and country_code='PL' and host_country_id=uid(12)"), 2);
  assert.equal(await scalar("select count(*)::int from invoked_hooks where name='junior'"), 1);

  await db.exec("insert into race_editions values(uid(54),uid(44),uid(2),'planned',10,uid(14));"
    + "insert into stages values(uid(59),uid(54),'planned');"
    + "insert into national_federation_nations_cup_heats values(uid(2),uid(85),'nc-5');");
  assert.equal(await settleAwards(), 2, "the incomplete programmes retry on the next run");
  assert.equal(await scalar("select count(*)::int from race_editions where id in (select race_edition_id from national_federation_nations_cup_heats) and host_country_id=uid(14)"), 5);
  assert.equal(await balance(13, 1), 6_200_000);
  const provisionCount = await scalar("select count(*)::int from invoked_hooks");
  assert.equal(await settleAwards(), 0, "attribution is idempotent");
  assert.equal(await scalar("select count(*)::int from invoked_hooks"), provisionCount, "no calendar generation without pending bids");
  assert.equal(await scalar("select count(*)::int from national_federation_transactions"), 5);

  await db.exec("insert into national_federation_hosting_candidacies"
    + " (id,country_id,submitted_season_id,target_game_year,event_type,event_key,continent_code,hosting_cost,"
    + " base_attendance,revenue_per_attendee,prestige_gain,renown_score,selection_score,status) values"
    + " (uid(38),uid(14),uid(1),6,'continental_championship_pro','continental_championship_pro:asia','asia',1800000,130000,16,35,500,750,'pending');"
    + "update seasons set status='completed' where id=uid(1);"
    + "update seasons set status='active' where id=uid(2);");
  assert.equal(await settleAwards(), 0);
  assert.equal(await scalar("select status from national_federation_hosting_candidacies where id=uid(38)"), "not_selected");
  assert.equal(await balance(14, 1), 5_600_000, "an unresolved bid cannot debit a carried-over season");
  assert.equal(await balance(14, 2), 8_000_000, "the default host policy is free of hosting charges");
  assert.equal(await settleReturns(), 0, "an award waits for terminal editions, irrespective of the calendar day");
  await db.exec("update race_editions set status='completed' where id = uid(51) or id in "
    + "(select race_edition_id from national_federation_nations_cup_heats);"
    + "update race_editions set status='cancelled' where id=uid(52);"
    + "update stages set status='completed' where race_edition_id=uid(51) or race_edition_id in "
    + "(select race_edition_id from national_federation_nations_cup_heats);"
    + "insert into stage_results select s.id,uid(1000+i),case when i=8 then 'did_not_start' "
    + "when i=7 then 'did_not_finish' else 'finished' end from stages s cross join generate_series(1,8) i where s.race_edition_id=uid(51);"
    + "insert into stage_results select s.id,uid(2000+i),'finished' from stages s cross join generate_series(1,3) i where s.race_edition_id in "
    + "(select race_edition_id from national_federation_nations_cup_heats);"
    + "update development_race_editions set status='completed';"
    + "insert into development_race_results select e.id,'stage',i::text from development_race_editions e cross join"
    + " lateral generate_series(1,case when e.championship_continent_code is null then 18 else 9 end) i;"
    + "insert into development_race_results values(uid(61),'general','aggregate-only');");
  assert.equal(await settleReturns(), 4);
  const partial = await award("world_championship_pro");
  assert.equal(partial.actual_participation_rate, "0.70000", "DNS does not count, a rider who abandons after the start does");
  assert.equal(partial.actual_starter_count, 7);
  assert.equal(partial.actual_place_count, 10);
  assert.equal(partial.actual_gross_revenue, "1900800.00");
  assert.equal(partial.actual_refund, "1750000.00");
  assert.equal(partial.actual_net_return, "150800.00");
  assert.equal(partial.completed_edition_count, 1);
  assert.equal(partial.scheduled_edition_count, 2);
  assert.equal((await award("continental_championship_junior:europe")).actual_net_return, "68000.00");
  assert.equal((await award("world_championship_junior")).actual_net_return, "96000.00");
  assert.equal((await award("nations_cup_pro")).actual_participation_rate, "0.75000", "counts per-heat rider spots");
  assert.equal(await settleReturns(), 0);

  const oldKenyaBalance = await balance(13, 2);
  await db.exec("update race_editions set status='cancelled' where id in (uid(53),uid(54));"
    + "update seasons set status='completed' where id=uid(2);"
    + "update seasons set status='active',current_day_number=21 where id=uid(3);");
  assert.equal(await settleReturns(), 1, "settles prior season receipts after rollover");
  assert.equal(await balance(13, 2), oldKenyaBalance, "the account already carried over is not edited");
  assert.equal(await balance(13, 3), 9_800_000, "the active account receives the refund");
  const cancelled = await award("continental_championship_pro:africa");
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.actual_net_return, "0.00");
  assert.equal(cancelled.actual_gross_revenue, "0.00");
  assert.equal(cancelled.actual_starter_count, 0);
  assert.equal(cancelled.actual_place_count, 0);
  assert.equal(cancelled.actual_refund, "1800000.00");
  assert.equal(await scalar("select count(*)::int from invoked_hooks where name='prestige'"), 4);

  assert.equal(await settleAwards(), 1, "JQ settle only when both official editions are present");
  assert.equal(await scalar("select count(*)::int from race_editions where id in (uid(57),uid(58)) and host_country_id=uid(13)"), 2);
  await db.exec("update seasons set status='completed' where id=uid(3);"
    + "update seasons set status='active' where id=uid(4);"
    + "insert into national_federation_olympic_qualifications values(uid(4),6,2),(uid(4),4,2);"
    + "update race_editions set status='completed' where id in (uid(57),uid(58));"
    + "update stages set status='completed' where race_edition_id in (uid(57),uid(58));"
    + "insert into stage_results select s.id,uid(3000+i),'finished' from stages s cross join"
    + " lateral generate_series(1,case when s.race_edition_id=uid(57) then 5 else 2 end) i where s.race_edition_id in (uid(57),uid(58));");
  assert.equal(await settleReturns(), 1);
  assert.equal((await award("quadrennial_games_pro")).actual_participation_rate, "0.50000", "uses frozen places for both Olympic disciplines");
  assert.equal(await settleReturns(), 0);
  console.log("Hosting awards verified: cutoff, balance guarantees, separate continents, programme binding, actual starters and places, repeat settlement, partial and rollover refunds.");

  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    create table season_days(season_id uuid, day_number integer, calendar_date date);
    drop function public.refresh_national_federation_renown(uuid);
    grant select on public.national_federation_hosting_candidacies to authenticated, service_role;
    insert into seasons values (uid(5), 'planned', 9, 1);
    update seasons set current_day_number = 21 where id = uid(4);
    insert into season_days values (uid(4), 21, (clock_timestamp() at time zone 'Europe/Paris')::date + 1);
    insert into races values (uid(450),'world_championship',null), (uid(451),'world_championship',null),
      (uid(452),'continental_championship','europe'), (uid(453),'standard',null),
      (uid(454),'nations_cup',null), (uid(455),'continental_championship','europe');
    insert into race_editions values
      (uid(460),uid(450),uid(5),'planned',10,uid(13)), (uid(461),uid(451),uid(5),'planned',10,uid(13)),
      (uid(462),uid(452),uid(5),'planned',10,uid(13)), (uid(463),uid(453),uid(5),'planned',10,uid(13)),
      (uid(468),uid(452),uid(1),'completed',10,uid(13)),
      (uid(469),uid(454),uid(5),'planned',10,uid(13));
    insert into stages select gen_random_uuid(), id, 'planned' from race_editions where id in (uid(460),uid(461),uid(462));
    insert into national_federation_nations_cup_heats values (uid(5),uid(469),'nc-hills');
    insert into development_race_editions(id, season_id, competition_type, championship_continent_code, status,
      selection_maximum, host_country_id, country_code, location_name) values
      (uid(464),uid(5),'continental_road','europe','planned',5,uid(12),'PL','Pologne');
    insert into national_federation_hosting_candidacies
      (id,country_id,submitted_season_id,target_game_year,event_type,event_key,continent_code,hosting_cost,
       base_attendance,revenue_per_attendee,prestige_gain,renown_score,selection_score,status) values
      (uid(470),uid(11),uid(4),9,'world_championship_pro','world_championship_pro',null,3500000,240000,18,60,500,800,'pending'),
      (uid(471),uid(13),uid(4),9,'continental_championship_pro','continental_championship_pro:europe','europe',1800000,130000,16,35,500,650,'pending');
  `);
  await db.exec(migrationFunction("20261110100020_secure_federation_hosting_reservations", "private.get_open_federation_hosting_candidacy_context"));
  await db.exec(migrationFunction("20260909193000_wire_federation_organization_prestige", "public.refresh_national_federation_renown"));
  await db.exec(migrationFunction("20261110140000_open_federation_hosting_and_score_organization", "private.score_national_federation_hosting_candidacy"));
  await db.exec(`
    alter table races alter column id set default gen_random_uuid(),
      add column country_id uuid, add column name text, add column short_name text,
      add column race_format text, add column status text, add column slug text unique;
    alter table race_editions alter column id set default gen_random_uuid(),
      add column race_category_id uuid, add column edition_number integer, add column display_name text,
      add column registration_closes_at timestamptz, add column withdrawal_closes_at timestamptz,
      add column minimum_reputation integer, add column registration_policy text;
    alter table stages alter column id set default gen_random_uuid(),
      add column season_day_id uuid, add column stage_number integer, add column name text,
      add column stage_type text, add column distance_km numeric, add column departure_at timestamptz,
      add column profile_type text, add column day_slot text;
    alter table season_days add column id uuid default gen_random_uuid();
    alter table national_federation_olympic_qualifications add column eligible_riders integer,
      add column qualification_rank integer;
    create table stage_segments(stage_id uuid, segment_number smallint, distance_km numeric, terrain_type text,
      surface_type text, average_gradient_pct numeric);
    create function ensure_global_olympic_road_event_before_itt(uuid) returns integer language sql as $$ select 1 $$;
    create function get_federation_professional_event_profile_segments_before_itt(text,integer)
    returns table(segment_number smallint,distance_km numeric,terrain_type text,surface_type text,average_gradient_pct numeric)
    language sql as $$ select null::smallint,null::numeric,null::text,null::text,null::numeric where false $$;
  `);
  await db.exec(migrationFunction("20261016180000_olympic_individual_time_trial", "public.ensure_global_olympic_event"));
  await db.exec(migrationFunction("20261016180000_olympic_individual_time_trial", "public.get_federation_professional_event_profile_segments"));
  const verdictMigration = readFileSync("supabase/migrations/20261116120000_record_official_federation_hosting_decisions.sql", "utf8");
  await db.exec(verdictMigration);
  assert.equal(await settleAwards(), 0, "J21 according to stored game day does not pre-empt actual Paris cutoff");
  assert.equal(await scalar("select count(*)::integer from national_federation_hosting_decisions where target_game_year=9"), 0);
  await db.exec("update season_days set calendar_date=(clock_timestamp() at time zone 'Europe/Paris')::date where season_id=uid(4)");
  const transactionsBefore = await scalar("select count(*)::integer from national_federation_transactions");
  assert.equal(await settleAwards(), 1, "real paid jury retains programme readiness and settles a valid E9 host");
  assert.equal(await scalar("select count(*)::integer from national_federation_hosting_decisions where target_game_year=9 and decision='neutral' and country_id is null and award_id is null"), 11);
  assert.equal(await scalar("select count(*)::integer from national_federation_hosting_decisions where target_game_year=9 and decision='hosted' and country_id=uid(11) and award_id is not null and jury_day_number=21 and gazette_date is not null"), 1);
  assert.equal(await scalar("select count(*)::integer from national_federation_hosting_decisions where target_game_year=9 and event_key='continental_championship_pro:europe'"), 0, "a pending bid and incomplete programme are never mistaken for no bid");
  assert.equal(await scalar("select count(*)::integer from national_federation_transactions"), transactionsBefore + 1, "neutral venues create no debit or award");
  assert.equal(await scalar("select count(*)::integer from national_federation_journal_entries where source_reference like 'federation-hosting:%:selected' and season_id=uid(4) and detail like '%Décision du jury%' and detail not like '%score%'"), 1);
  assert.equal(await scalar("select count(*)::integer from race_editions where id in(uid(460),uid(461)) and host_country_id=uid(11) and not is_neutral_host"), 2);
  assert.equal(await scalar("select is_neutral_host and host_country_id is null from race_editions where id=uid(469)"), true, "existing no-bid official Nations Cup heat is neutral");
  assert.equal(await scalar("select is_neutral_host and host_country_id is null and country_code='PL' from development_race_editions where id=uid(464)"), true, "existing no-bid junior race keeps physical geography only");
  assert.equal(await scalar("select count(*)::integer from race_editions where id in(uid(463),uid(468)) and not is_neutral_host and host_country_id=uid(13)"), 2, "domestic calendar and prior seasons remain untouched");
  assert.equal(await scalar("select has_column_privilege('authenticated','national_federation_hosting_candidacies','selection_score','select')"), false);
  assert.equal(await scalar("select has_column_privilege('authenticated','national_federation_hosting_candidacies','country_id','select')"), true);
  assert.equal(await scalar("select has_column_privilege('service_role','national_federation_hosting_candidacies','selection_score','select')"), true);
  await db.exec(`
    insert into race_editions (id, race_id, season_id, status, field_limit, host_country_id)
      values (uid(465),uid(454),uid(5),'planned',10,uid(13)), (uid(466),uid(455),uid(5),'planned',10,uid(13));
    insert into stages values (uid(480),uid(466),'planned');
    insert into development_race_editions(id, season_id, competition_type, championship_continent_code, status,
      selection_maximum, host_country_id, country_code, location_name) values
      (uid(467),uid(5),'world_time_trial',null,'planned',5,uid(12),'PL','Pologne');
    update race_editions set host_country_id=uid(12) where id=uid(469);
  `);
  assert.equal(await scalar("select count(*)::integer from race_editions where id in(uid(465),uid(469)) and is_neutral_host and host_country_id is null"), 2, "new and regenerated editions respect the recorded jury verdict");
  assert.equal(await scalar("select is_neutral_host and host_country_id is null from development_race_editions where id=uid(467)"), true);
  assert.equal(await settleAwards(), 1, "a pending candidate is considered when the remaining calendar appears");
  assert.equal(await scalar("select count(*)::integer from national_federation_hosting_decisions where target_game_year=9"), 13);
  assert.equal(await settleAwards(), 0, "retries do not create another verdict or fee");
  assert.equal(await scalar("select count(*)::integer from national_federation_transactions"), transactionsBefore + 2);
  await db.exec(`
    update seasons set status='completed' where id=uid(4);
    insert into seasons values (uid(6),'active',11,21),(uid(7),'planned',12,1);
    insert into season_days(season_id,day_number,calendar_date) values
      (uid(6),21,(clock_timestamp() at time zone 'Europe/Paris')::date),(uid(7),24,current_date+30);
  `);
  assert.equal(await settleAwards(), 0, "no federation funded the S12 Olympics");
  await db.exec(`
    insert into races(id,competition_type,country_id) values (uid(490),'nations_cup',uid(13));
    insert into race_editions(id,race_id,season_id,status,host_country_id,race_category_id)
      values(uid(491),uid(490),uid(7),'planned',uid(13),uid(498));
    insert into national_federation_olympic_events(season_id,race_edition_id) values(uid(7),uid(491));
  `);
  assert.equal(await scalar("select is_neutral_host and host_country_id is null from race_editions where id=uid(491)"), true);
  assert.equal(await scalar("select ensure_global_olympic_event(uid(7))"), 2, "the JQ time trial can use the neutral road venue");
  assert.equal(await scalar(`
    select e.is_neutral_host and e.host_country_id is null and r.country_id=uid(13)
    from national_federation_olympic_events o join race_editions e on e.id=o.time_trial_race_edition_id
    join races r on r.id=e.race_id where o.season_id=uid(7)
  `), true, "both JQ events are neutral and retain their geographical course location");
  console.log("Jury verdicts verified: confirmed scheduling, neutral venues, future calendar writes, unaffected seasons and finances, score privileges, retries and neutral Olympic time trial generation.");

  await db.exec(`
    alter table national_federation_hosting_awards
      add column economics_version smallint not null default 1 check (economics_version in (1, 2)),
      add constraint national_federation_hosting_awards_values_valid check (prestige_gain > 0);
    alter table national_federation_hosting_candidacies
      alter column id set default gen_random_uuid(), alter column status set default 'pending',
      alter column selection_score set default 500,
      add column uci_rank integer, add column submitted_by_director_id uuid,
      add unique(country_id,target_game_year,event_key);
    alter table development_race_results add column academy_rider_id uuid, add column country_code text;
    alter table national_federation_journal_entries add column created_at timestamptz default now();
    create table national_federation_selection_lists(id uuid primary key, country_id uuid);
    create table national_federation_selection_race_links(selection_list_id uuid primary key, race_edition_id uuid, race_registration_id uuid unique);
    create table race_registrations(id uuid primary key, status text);
    create table race_rosters(id uuid primary key, race_registration_id uuid);
    create table national_federation_junior_race_registrations(race_edition_id uuid, country_id uuid, status text);

    drop function public.refresh_national_federation_renown(uuid);
    create function public.refresh_national_federation_renown(p_country uuid)
    returns public.national_federation_renown language sql as $$
      select renown from public.national_federation_renown renown where renown.country_id = p_country
    $$;
    drop function public.get_national_federation_race_organization_effects(uuid);
    create function public.get_national_federation_race_organization_effects(p_country uuid)
    returns table(hosting_revenue_bonus_percentage numeric, hosting_cost_reduction_percentage numeric)
    language sql as $$ select 6::numeric, case when p_country=public.uid(13) then 10 else 0 end::numeric $$;
    create function public.get_current_federation_identity(p_country text)
    returns table(country_id uuid, sporting_director_id uuid) language sql as $$
      select id, auth.uid() from public.countries where iso_alpha2 = p_country
    $$;
    create or replace function auth.uid() returns uuid language sql as $$ select public.uid(599) $$;
    create table national_federation_terms(country_id uuid, start_game_year integer, end_game_year integer,
      governance_mode text, president_director_id uuid);
    create function public.get_national_championship_country_rankings(uuid)
    returns table(country_id uuid, uci_points int) language sql as $$
      select id, 100 from public.countries
    $$;

    -- Contract mocks for the independently tested reader and charter migrations.
    create table private.test_hosting_audiences(event_key text, deadline timestamptz, reader_count integer, car_count integer, seat_count integer);
    create function private.get_federation_hosting_revenue_window(uuid) returns timestamptz language sql as $$
      select audience.deadline from private.test_hosting_audiences audience
      join public.national_federation_hosting_awards award using(event_key) where award.id=$1
    $$;
    create function private.get_federation_hosting_unique_readers(uuid) returns integer language sql as $$
      select audience.reader_count from private.test_hosting_audiences audience
      join public.national_federation_hosting_awards award using(event_key) where award.id=$1
    $$;
    create function private.get_federation_hosting_charter_totals(uuid) returns table(car_count integer, seat_count integer)
    language sql as $$
      select audience.car_count, audience.seat_count from private.test_hosting_audiences audience
      join public.national_federation_hosting_awards award using(event_key) where award.id=$1
    $$;

    update seasons set status='completed' where id=uid(6);
    update seasons set status='active',current_day_number=15 where id=uid(7);
    insert into seasons values(uid(8),'planned',13,1);
    insert into season_days(season_id,day_number,calendar_date) values
      (uid(7),20,(clock_timestamp() at time zone 'Europe/Paris')::date+5),
      (uid(7),21,(clock_timestamp() at time zone 'Europe/Paris')::date+6);
    insert into national_federation_terms select id,11,12,'elected',uid(599) from countries;
    insert into national_federation_accounts(id,country_id,season_id,balance)
      select gen_random_uuid(), c.id, s.id, 8000000 from countries c cross join seasons s where s.id in(uid(7),uid(8));
    insert into countries(id,iso_alpha2,name,continent_code)
      select uid(600+n), 'A'||chr(64+n), 'Équipe '||n,'europe' from generate_series(1,23) n;

    -- This guarantee was reserved before V2 and remains on its original economics.
    insert into national_federation_hosting_candidacies
      (id,country_id,submitted_season_id,target_game_year,event_type,event_key,hosting_cost,
       base_attendance,revenue_per_attendee,prestige_gain,renown_score,submitted_by_director_id)
      values(uid(598),uid(14),uid(7),13,'world_championship_pro','world_championship_pro',3500000,240000,18,60,500,uid(599));
    insert into race_editions(id,race_id,season_id,status,field_limit)
      select uid(700+n),uid(case when n<3 then 451+n else 447+n end),uid(8),'planned',200 from generate_series(1,4) n;
    update race_editions set race_id=uid(455) where id=uid(702);
    insert into stages(id,race_edition_id,status) select uid(720+n),uid(700+n),'planned' from generate_series(1,4) n;
    insert into development_race_editions(id,season_id,competition_type,championship_continent_code,status,selection_maximum)
      values(uid(741),uid(8),'continental_road','africa','planned',6),
            (uid(742),uid(8),'continental_time_trial','africa','planned',6),
            (uid(743),uid(8),'world_road',null,'planned',6),
            (uid(744),uid(8),'world_time_trial',null,'planned',6);
    insert into development_race_stages select uid(760+n),uid(740+n) from generate_series(1,4) n;
    insert into private.test_hosting_audiences values
      ('continental_championship_pro:europe',clock_timestamp()+interval '72 hours',42,5,160),
      ('continental_championship_junior:africa',clock_timestamp()+interval '72 hours',0,0,0);
  `);
  await db.exec(migrationFunction("20261110140000_open_federation_hosting_and_score_organization", "public.submit_national_federation_hosting_candidacy"));
  const economicsMigration = readFileSync("supabase/migrations/20261116133000_version_federation_hosting_economics.sql", "utf8");
  await db.exec(economicsMigration.replace(/\r?\n/g, "\r\n"));

  const submit = (country, event) => scalar(`select submit_national_federation_hosting_candidacy('${country}','${event}')`);
  const euPro = await submit("FR", "continental_championship_pro");
  const africaJunior = await submit("KE", "continental_championship_junior");
  await submit("PL", "world_championship_junior");
  assert.equal(await submit("JP", "world_championship_pro"), "00000000-0000-0000-0000-000000000598");
  assert.equal(await scalar("select economics_version=1 and economics_manifest is null and hosting_cost=3500000 from national_federation_hosting_candidacies where id=uid(598)"), true);
  assert.equal(await scalar(`select economics_version=2 and hosting_cost=1440000 and economics_manifest->>'countryTarget'='25' from national_federation_hosting_candidacies where id='${euPro}'`), true);
  assert.equal(await scalar(`select economics_version=2 and hosting_cost=505000 and economics_manifest->>'countryTarget'='1' from national_federation_hosting_candidacies where id='${africaJunior}'`), true);
  const scenario = (countries, ticket) => scalar(`
    select private.calculate_federation_hosting_revenue(economics_manifest,1,30,${countries},1000,7,4000,${ticket})
    from get_federation_hosting_economics_catalog('europe') where event_type='continental_championship_pro'
  `);
  const capped = await scenario(30, 1000);
  assert.equal(capped.countryRate, 0.5);
  assert.equal(capped.readerRate, 0.1);
  assert.equal(capped.seatRate, 0.05);
  assert.equal(capped.drawRate, 0.15);
  assert.equal((await scenario(15, 3999)).drawRate, 0.15, "the draw opens at exactly 60% participation");
  assert.equal((await scenario(14, 0)).drawRate, 0, "a winning ticket cannot bypass the country objective");
  assert.equal((await scenario(25, 4000)).drawRate, 0, "the two prize ranges leave 60% with no award");
  await db.exec("insert into countries(id,iso_alpha2,name,continent_code) values(uid(650),'UG','Ouganda','africa');");
  assert.equal(await scalar("select economics_manifest->>'countryTarget' from get_federation_hosting_economics_catalog('africa') where event_type='continental_championship_junior'"), "2");
  await db.exec(`
    update seasons set current_day_number=21 where id=uid(7);
    update season_days set calendar_date=(clock_timestamp() at time zone 'Europe/Paris')::date where season_id=uid(7) and day_number=21;
  `);
  assert.equal(await settleAwards(), 4);
  const awardsByKey = (await db.query("select * from national_federation_hosting_awards where target_game_year=13")).rows;
  const pro = awardsByKey.find((row) => row.event_key === "continental_championship_pro:europe");
  const junior = awardsByKey.find((row) => row.event_key === "continental_championship_junior:africa");
  const legacy = awardsByKey.find((row) => row.event_key === "world_championship_pro");
  const cancelledV2 = awardsByKey.find((row) => row.event_key === "world_championship_junior");
  assert.equal(pro.economics_version, 2);
  assert.equal(junior.economics_manifest.countryTarget, 1, "the bid freezes the continental denominator through award");
  assert.equal(legacy.economics_version, 1);
  assert.equal(legacy.economics_manifest, null);
  assert.equal(await scalar("select count(*)::int from private.federation_hosting_draw_tickets"), 3);
  assert.equal(await scalar("select has_table_privilege('authenticated','private.federation_hosting_draw_tickets','select')"), false);
  await db.exec(`
    update seasons set status='completed' where id=uid(7);
    update seasons set status='active' where id=uid(8);
    update race_editions set status='completed' where id in(uid(701),uid(702),uid(703),uid(704));
    update stages set status='completed' where id in(uid(721),uid(722),uid(723),uid(724));
    update development_race_editions set status='cancelled' where id in(uid(742),uid(743),uid(744));
    insert into national_federation_junior_race_registrations values (uid(741),uid(13),'completed');
    insert into development_race_results(race_edition_id,result_scope,competitor_key,academy_rider_id,country_code)
      values(uid(741),'stage','real',uid(800),'KE'),(uid(741),'stage','synthetic',null,'UG');
    insert into stage_results(stage_id,race_roster_id,status) values (uid(723),uid(810),'finished');
    insert into national_federation_selection_lists select uid(1000+n),uid(600+n) from generate_series(1,21)n;
    insert into race_registrations select uid(1100+n),'accepted' from generate_series(1,21)n;
    insert into race_rosters select uid(1200+n),uid(1100+n) from generate_series(1,21)n;
    insert into national_federation_selection_race_links select uid(1000+n),uid(701),uid(1100+n) from generate_series(1,21)n;
    insert into stage_results select uid(721),uid(1200+n),case when n<=20 then 'finished' else 'did_not_start' end from generate_series(1,21)n;
    insert into national_federation_selection_lists values(uid(1350),uid(601));
    insert into race_registrations values(uid(1351),'accepted');
    insert into race_rosters values(uid(1352),uid(1351));
    insert into national_federation_selection_race_links values(uid(1350),uid(702),uid(1351));
    insert into stage_results values(uid(722),uid(1352),'outside_time_limit');
    update private.federation_hosting_draw_tickets set ticket=999 where award_id='${pro.id}';
    update private.federation_hosting_draw_tickets set ticket=4000 where award_id='${junior.id}';
  `);
  assert.equal(await settleReturns(), 2, "only legacy and entirely cancelled awards settle without waiting");
  assert.equal(await scalar(`select status='scheduled' and revenue_window_ends_at>clock_timestamp() and economics_breakdown is null from national_federation_hosting_awards where id='${pro.id}'`), true);
  assert.equal(await scalar(`select status='cancelled' and actual_refund=960000 and actual_net_return=0 and prestige_gain=0 and revenue_window_ends_at is null from national_federation_hosting_awards where id='${cancelledV2.id}'`), true);
  assert.equal(await scalar(`select status='settled' and economics_version=1 and economics_breakdown is null from national_federation_hosting_awards where id='${legacy.id}'`), true);
  assert.equal(await settleReturns(), 0, "an incomplete competition and a live reader window cannot settle");
  await db.exec(`
    update development_race_editions set status='completed' where id=uid(741);
    update private.test_hosting_audiences set deadline=clock_timestamp()-interval '1 second';
    update national_federation_hosting_awards set revenue_window_ends_at=clock_timestamp()-interval '1 second' where id='${pro.id}';
  `);
  assert.equal(await settleReturns(), 2);
  const breakdown = (awardId) => scalar(`select economics_breakdown from national_federation_hosting_awards where id='${awardId}'`);
  assert.deepEqual(await breakdown(pro.id), {
    completionRate: 1, registeredCountryCount: 21, countryCount: 20, readerCount: 42, carCount: 5, seatCount: 160,
    countryProgress: 0.8, readerProgress: 0.6, seatProgress: 0.5, countryRate: 0.4, readerRate: 0.06, seatRate: 0.025,
    drawEligible: true, drawRate: 0.35, baseAmount: 1224000, countryAmount: 576000, readerAmount: 86400,
    seatAmount: 36000, drawAmount: 504000, grossRevenue: 2426400, actualPrestigeGain: 35,
  });
  assert.equal(await scalar(`select actual_net_return=986400 from national_federation_hosting_awards where id='${pro.id}'`), true);
  assert.equal((await breakdown(junior.id)).countryCount, 1, "a synthetic junior finisher does not count as another country");
  assert.equal(await scalar(`select actual_gross_revenue=378000 and actual_refund=252500 and actual_net_return=125500 and prestige_gain=8 from national_federation_hosting_awards where id='${junior.id}'`), true);
  await db.exec(`update private.federation_hosting_draw_tickets set ticket=9999 where award_id='${pro.id}';`);
  assert.equal(await settleReturns(), 0);
  assert.equal((await breakdown(pro.id)).drawRate, 0.35, "a retry cannot reroll the persisted draw");
  assert.equal(await scalar(`select count(*)=1 and sum(amount)=2426400 from national_federation_transactions where source_reference='federation-hosting:${pro.id}:revenue'`), true);
  console.log("Versioned hosting economics verified: protected reservations, exact catalog results, real distinct countries, deadlines, discounts, draws, refunds, and once-only finance receipts.");
} finally {
  await db.close();
}

