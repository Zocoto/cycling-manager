import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ?? "C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js";
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const readMigration = (name) => readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8");

function extract(name, definition) {
  const sql = readMigration(name).match(definition)?.[0];
  assert.ok(sql, `real SQL from ${name}`);
  return sql;
}

async function row(sql) {
  const result = await db.query(sql);
  assert.equal(result.rows.length, 1, sql);
  return result.rows[0];
}

const scalar = async (sql) => Object.values(await row(sql))[0];
const snapshot = (country) => row(`select score, legacy_score, uci_history_points, team_legacy_points,
  rider_legacy_points, hosting_legacy_points, source_through_game_year from get_national_federation_course_renown(uid(${country}))`);

try {
  await db.exec(`
    create schema private;
    create role anon; create role authenticated; create role service_role;
    create function uid(integer) returns uuid language sql immutable as $$
      select ('00000000-0000-0000-0000-' || lpad($1::text, 12, '0'))::uuid $$;
    create table countries(id uuid primary key, iso_alpha2 text, continent_code text, is_active boolean default true);
    create table seasons(id uuid primary key, game_year integer unique, status text, current_day_number integer);
    create table riders(id uuid primary key, country_id uuid);
    create table rider_season_summaries(rider_id uuid, season_id uuid, points integer);
    create table team_seasons(registration_country_id uuid, status text, final_rank integer, points integer);
    create table race_categories(id uuid primary key, code text, prestige_rank integer);
    create table races(id uuid primary key, country_id uuid, competition_type text, championship_continent_code text);
    create table race_editions(id uuid primary key, race_id uuid, season_id uuid, race_category_id uuid, status text,
      host_country_id uuid, is_neutral_host boolean default false, field_limit integer default 10);
    create table race_rosters(id uuid primary key, rider_id uuid);
    create table race_results(race_edition_id uuid, race_roster_id uuid, status text, final_rank integer);
    create table stages(id uuid primary key, race_edition_id uuid, status text);
    create table stage_results(stage_id uuid, race_roster_id uuid, status text);
    create table development_race_editions(id uuid primary key, season_id uuid, status text, competition_type text,
      country_code text, championship_continent_code text, is_neutral_host boolean default false);
    create table national_federation_nations_cup_heats(season_id uuid, race_edition_id uuid, slot_key text);
    create table national_federation_selection_slots(slot_key text primary key, rider_limit integer);
    create table national_federation_olympic_events(season_id uuid, race_edition_id uuid, time_trial_race_edition_id uuid);
    create table national_federation_olympic_qualifications(season_id uuid, rider_quota integer, time_trial_rider_quota integer);
    create table national_federation_renown(country_id uuid primary key, score integer not null check(score between 0 and 1000),
      uci_history_points integer, team_legacy_points integer, rider_legacy_points integer, hosting_legacy_points integer,
      source_through_game_year integer, calculated_at timestamptz,
      constraint national_federation_renown_breakdown_range check(hosting_legacy_points between 0 and 100));
    create table national_federation_hosting_candidacies(id uuid primary key, target_game_year integer, renown_score integer,
      selection_score integer, hosting_cost numeric, status text, base_attendance integer, revenue_per_attendee numeric);
    create table national_federation_hosting_awards(id uuid primary key, candidacy_id uuid, country_id uuid, target_game_year integer,
      event_type text, event_key text, continent_code text, hosting_cost numeric, prestige_gain integer, status text,
      selected_at timestamptz default now(), settled_at timestamptz, scheduled_edition_count integer, completed_edition_count integer,
      actual_participation_rate numeric, actual_attendance integer, actual_starter_count integer, actual_place_count integer,
      actual_gross_revenue numeric, actual_refund numeric, actual_net_return numeric, economics_version smallint default 1,
      economics_manifest jsonb, economics_breakdown jsonb, revenue_window_ends_at timestamptz);
    create table national_federation_accounts(id uuid primary key, country_id uuid, season_id uuid, balance numeric, updated_at timestamptz);
    create table national_federation_transactions(account_id uuid, day_number integer, amount numeric, category text,
      description text, source_reference text unique, metadata jsonb);
    create function get_national_federation_race_organization_effects(uuid)
    returns table(hosting_revenue_bonus_percentage numeric) language sql as $$ select 0::numeric $$;

    insert into countries values(uid(11),'FR','europe',true),(uid(12),'DE','europe',true),(uid(13),'IT','europe',true);
    insert into seasons select uid(n),n,case when n<5 then 'completed' when n=5 then 'active' else 'planned' end,10
      from generate_series(1,6)n;
    insert into race_categories values(uid(20),'elite',1);
    insert into riders values(uid(21),uid(11)),(uid(22),uid(12));
    insert into rider_season_summaries select rider.id, season.id,
      case when rider.id=uid(21) then 100 else 90 end from riders rider cross join seasons season;
    insert into team_seasons select uid(11),'completed',1,100 from generate_series(1,10);
    insert into race_rosters values(uid(23),uid(21)),(uid(24),uid(22));
    insert into races values(uid(31),uid(11),'standard',null),(uid(32),uid(12),'standard',null),
      (uid(33),uid(11),'world_championship',null),(uid(34),uid(12),'world_championship',null),
      (uid(35),uid(13),'world_championship',null),(uid(36),uid(13),'world_championship',null);
    insert into race_editions(id,race_id,season_id,race_category_id,status,host_country_id,is_neutral_host) values
      (uid(41),uid(31),uid(2),uid(20),'completed',uid(11),false),
      (uid(42),uid(32),uid(1),uid(20),'completed',uid(12),false),
      (uid(43),uid(32),uid(2),uid(20),'completed',uid(12),false),
      (uid(44),uid(33),uid(4),uid(20),'completed',uid(11),false),
      (uid(45),uid(34),uid(5),uid(20),'completed',null,true),
      (uid(46),uid(31),uid(6),uid(20),'planned',uid(11),false),
      (uid(47),uid(35),uid(6),uid(20),'planned',uid(12),false),
      (uid(48),uid(36),uid(6),uid(20),'planned',uid(12),false);
    insert into stages select uid(100+n), uid(41),'completed' from generate_series(1,9)n;
    insert into stages select uid(120+n), uid(42),'completed' from generate_series(1,8)n;
    insert into stages select uid(140+n), uid(43),'completed' from generate_series(1,2)n;
    insert into stages select uid(160+n), uid(46),'completed' from generate_series(1,7)n;
    insert into stages values(uid(181),uid(47),'completed'),(uid(182),uid(48),'completed');
    insert into race_results select uid(41),uid(23),'classified',1 from generate_series(1,8);
    insert into development_race_editions values
      (uid(49),uid(5),'completed','world_road','DE',null,true),
      (uid(50),uid(6),'completed','continental_road','IT','europe',false);
    insert into national_federation_hosting_candidacies values
      (uid(70),6,697,812,3500000,'selected',240000,18), (uid(71),6,697,811,2400000,'pending',180000,17);
    insert into national_federation_hosting_awards(id,candidacy_id,country_id,target_game_year,event_type,event_key,
      hosting_cost,prestige_gain,status,scheduled_edition_count) values
      (uid(80),null,uid(11),1,'world_championship_pro','world_championship_pro',3500000,60,'settled',2),
      (uid(81),null,uid(11),3,'continental_championship_pro','continental_championship_pro:europe',1800000,35,'settled',2),
      (uid(82),uid(70),uid(12),6,'world_championship_pro','world_championship_pro',3500000,60,'scheduled',2);
    insert into national_federation_accounts values(uid(90),uid(12),uid(6),100000,now());
  `);

  await db.exec(extract("20260909193000_wire_federation_organization_prestige", /create or replace function public\.refresh_national_federation_renown\([\s\S]*?\$\$;/));
  await db.exec(extract("20261110140000_open_federation_hosting_and_score_organization", /create function private\.score_national_federation_hosting_candidacy\([\s\S]*?\$\$;/));
  await db.exec(extract("20261116120000_record_official_federation_hosting_decisions", /do \$exclude_neutral_history\$[\s\S]*?\$exclude_neutral_history\$;/));
  await db.exec(extract("20261110130000_finalize_federation_hosting_awards", /create or replace function private\.get_federation_hosting_editions\([\s\S]*?\$\$;/));
  await db.exec(extract("20261110130000_finalize_federation_hosting_awards", /create or replace function public\.settle_due_national_federation_hosting_returns\([\s\S]*?\$\$;/));
  await db.exec(extract("20261116133000_version_federation_hosting_economics", /do \$settle\$[\s\S]*?\$settle\$;/));
  await db.exec("select refresh_national_federation_renown(uid(11)), refresh_national_federation_renown(uid(12));");
  const biddingBefore = await row("select * from national_federation_hosting_candidacies where id=uid(71)");
  const snapshotsBefore = await scalar("select jsonb_agg(to_jsonb(r) order by country_id) from national_federation_renown r");
  await db.exec(readMigration("20261116183000_rebalance_federation_renown").replace(/\r?\n/g, "\r\n"));
  assert.deepEqual(await scalar("select jsonb_agg(to_jsonb(r)-'legacy_score' order by country_id) from national_federation_renown r"), snapshotsBefore);
  assert.equal(await scalar("select has_function_privilege('authenticated','private.get_national_federation_organization_prestige(uuid,integer)','execute')"), false);
  assert.deepEqual(await snapshot(11), { score: 1000, legacy_score: null,
    uci_history_points: 600, team_legacy_points: 180, rider_legacy_points: 170, hosting_legacy_points: 100, source_through_game_year: 5 });
  assert.equal(await scalar("select score=1000 and legacy_score=1000 from refresh_national_federation_renown(uid(11))"), true);
  assert.equal(await scalar("select score from get_national_federation_course_renown(uid(12))"), 697);

  await db.exec(`
    update seasons set status='completed' where id=uid(5);
    update seasons set status='active' where id=uid(6);
    update race_editions set status='completed' where id in(uid(46),uid(47),uid(48));
  `);
  assert.deepEqual(await snapshot(11), { score: 1000, legacy_score: 1000,
    uci_history_points: 500, team_legacy_points: 150, rider_legacy_points: 150, hosting_legacy_points: 200, source_through_game_year: 6 });
  assert.equal(await scalar("select source_through_game_year from national_federation_renown where country_id=uid(12)"), 5, "refresh operates on one country");
  assert.deepEqual(await snapshot(12), { score: 517, legacy_score: 617,
    uci_history_points: 497, team_legacy_points: 0, rider_legacy_points: 0, hosting_legacy_points: 20, source_through_game_year: 6 });
  assert.equal(await scalar("select private.get_national_federation_organization_prestige(uid(13),6)"), 0, "the S6 template country has no hosting award");

  await db.exec("insert into stage_results values(uid(181),uid(24),'finished'),(uid(182),uid(24),'finished');");
  assert.equal(await scalar("select settle_due_national_federation_hosting_returns()"), 1);
  assert.equal(await scalar("select actual_gross_revenue=2926548 from national_federation_hosting_awards where id=uid(82)"), true, "V1 receipts use the 617-point legacy score, not 517");
  assert.equal(await scalar("select private.get_national_federation_organization_prestige(uid(12),6)"), 80, "two races earn exactly one paid award's configured 60 prestige");
  assert.equal(await scalar("select private.get_national_federation_organization_prestige(uid(13),6)"), 0, "no prestige transferred to pro or junior template venues");
  assert.deepEqual(await row("select * from national_federation_hosting_candidacies where id=uid(71)"), biddingBefore);
  console.log("Federation renown verified: exact S5 and S6 caps, legacy contracts and scores, single-country cache, five-season history, neutral/template venues, and real V1 ledger settlement.");
} finally {
  await db.close();
}
