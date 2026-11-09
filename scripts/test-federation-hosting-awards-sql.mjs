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
} finally {
  await db.close();
}

