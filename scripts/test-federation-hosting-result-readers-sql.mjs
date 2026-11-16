import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ??
  "C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js";
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const migration = (name) => readFileSync(`supabase/migrations/${name}.sql`, "utf8");
const officialScope = migration("20261110130000_finalize_federation_hosting_awards")
  .match(/create or replace function private\.get_federation_hosting_editions\([\s\S]*?\$\$;/)?.[0];
assert.ok(officialScope);

async function scalar(sql) {
  const { rows } = await db.query(sql);
  assert.equal(rows.length, 1, sql);
  return Object.values(rows[0])[0];
}

async function view(director, edition, isJunior = false) {
  await db.exec(`select set_config('request.jwt.claim.sub', uid(${director})::text, false); set role authenticated;`);
  try {
    return await scalar(`select record_current_federation_hosting_result_view(uid(${edition}), ${isJunior})`);
  } finally {
    await db.exec("reset role");
  }
}

const count = (award) => scalar(`select private.get_federation_hosting_unique_readers(uid(${award}))`);
const deadline = (award) => scalar(`select private.get_federation_hosting_revenue_window(uid(${award}))::text`);

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema private; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select nullif(current_setting('request.jwt.claims', true), '')::jsonb
    $$;
    create function uid(integer) returns uuid language sql immutable as $$
      select ('00000000-0000-0000-0000-' || lpad($1::text, 12, '0'))::uuid
    $$;
    create table public.seasons(id uuid primary key, game_year int unique);
    create table public.sporting_directors(id uuid primary key, auth_user_id uuid unique, status text);
    create table public.alpha_bot_managers(sporting_director_id uuid primary key);
    create table public.races(id uuid primary key, competition_type text, championship_continent_code text);
    create table public.race_editions(id uuid primary key, race_id uuid, season_id uuid, status text,
      host_country_id uuid, is_neutral_host boolean default false);
    create table public.development_race_editions(id uuid primary key, season_id uuid, competition_type text,
      championship_continent_code text, status text, host_country_id uuid, is_neutral_host boolean default false);
    create table public.national_federation_olympic_events(season_id uuid primary key, race_edition_id uuid, time_trial_race_edition_id uuid);
    create table public.national_federation_nations_cup_heats(season_id uuid, race_edition_id uuid unique);
    create table public.national_federation_hosting_awards(id uuid primary key, target_game_year int,
      event_type text, continent_code text, status text, scheduled_edition_count int);
    create table public.national_federation_hosting_decisions(target_game_year int, event_key text,
      decision text, country_id uuid, award_id uuid references public.national_federation_hosting_awards(id),
      primary key(target_game_year,event_key));
    create table public.race_results(race_edition_id uuid, status text);
    create table public.development_race_results(race_edition_id uuid, result_scope text);
  `);
  await db.exec(officialScope);
  await db.exec(migration("20261116130000_track_federation_hosting_result_readers"));
  await db.exec(`
    insert into seasons values (uid(1),5), (uid(2),6);
    insert into sporting_directors values
      (uid(11),uid(101),'active'),(uid(12),uid(102),'active'),
      (uid(13),uid(103),'active'),(uid(14),uid(104),'inactive');
    insert into alpha_bot_managers values (uid(13));
    insert into races values (uid(20),'world_championship',null),(uid(21),'world_championship',null),
      (uid(22),'nations_cup',null),(uid(23),'standard',null),(uid(24),'continental_championship','europe');
    insert into race_editions values
      (uid(30),uid(20),uid(2),'planned',uid(3),false), (uid(31),uid(21),uid(2),'planned',uid(3),false),
      (uid(32),uid(22),uid(2),'planned',uid(3),false), (uid(33),uid(23),uid(2),'planned',uid(3),false),
      (uid(34),uid(20),uid(1),'planned',uid(3),false), (uid(35),uid(24),uid(2),'planned',null,true),
      (uid(36),uid(22),uid(2),'planned',uid(4),false);
    insert into national_federation_nations_cup_heats values (uid(2),uid(36));
    insert into development_race_editions values
      (uid(40),uid(2),'world_road',null,'planned',uid(3),false),
      (uid(41),uid(2),'world_time_trial',null,'planned',uid(3),false);
    insert into national_federation_hosting_awards values
      (uid(50),6,'world_championship_pro',null,'scheduled',2,2),
      (uid(51),6,'world_championship_junior',null,'scheduled',2,2),
      (uid(52),6,'nations_cup_pro',null,'scheduled',1,2);
    insert into national_federation_hosting_decisions values
      (6,'world_championship_pro','hosted',uid(3),uid(50)),
      (6,'world_championship_junior','hosted',uid(3),uid(51)),
      (6,'nations_cup_pro','hosted',uid(4),uid(52)),
      (6,'continental_championship_pro:europe','neutral',null,null);
    insert into race_results values (uid(30),'classified'),(uid(31),'classified'),(uid(32),'classified'),
      (uid(33),'classified'),(uid(34),'classified'),(uid(35),'classified'),(uid(36),'did_not_finish');
    insert into development_race_results values (uid(40),'stage'),(uid(40),'general');
  `);

  assert.equal(await view(101, 30), false, "planned races have no readers");
  await db.exec("update race_editions set status='completed' where id <> uid(31)");
  assert.equal(await deadline(50), null, "one race cannot open the package window");
  assert.equal(await view(101, 30), false, "earlier official results open only after the last race");
  assert.equal(await view(101, 32), false, "unmapped Nations Cup edition");
  assert.equal(await view(101, 33), false, "ordinary race in host country");
  assert.equal(await view(101, 34), false, "previous season");
  assert.equal(await view(101, 35), false, "neutral event");
  assert.equal(await view(101, 36), false, "no classified outcome");
  await db.exec("update race_editions set status='completed' where id=uid(31)");
  const originalDeadline = await deadline(50);
  assert.ok(originalDeadline);
  assert.equal(await view(101, 30), true);
  assert.equal(await view(101, 31), true);
  assert.equal(await view(101, 31), true);
  assert.equal(await count(50), 1, "multiple views across editions count once per award");
  assert.equal(await view(102, 31, true), false, "wrong result platform");
  assert.equal(await view(103, 31), false, "bot identity");
  assert.equal(await view(104, 31), false, "inactive identity");
  assert.equal(await view(105, 31), false, "no director identity");
  await db.exec("select set_config('request.jwt.claims', '{\"is_anonymous\":true}', false)");
  assert.equal(await view(102, 31), false, "anonymous Supabase session despite authenticated role");
  await db.exec("reset request.jwt.claims");

  await db.exec("update race_editions set status='in_progress' where id=uid(31)");
  assert.equal(await view(102, 30), false, "reopening an edition temporarily closes the window");
  await db.exec("update race_editions set status='completed' where id=uid(31)");
  assert.equal(await deadline(50), originalDeadline, "a replay retains the original window");
  assert.equal(await view(102, 31), true);
  assert.equal(await count(50), 2);

  await db.exec("update development_race_editions set status=case when id=uid(40) then 'completed' else 'cancelled' end");
  assert.ok(await deadline(51), "cancellation closes an outstanding slot without fabricating a completion");
  assert.equal(await view(101, 40, true), true);
  assert.equal(await count(51), 1, "same director can read a different award");
  assert.equal(await view(102, 41, true), false, "cancelled edition is never viewable");
  await db.exec("update private.federation_hosting_result_publications set completed_at=now()-interval '73 hours' where award_id=uid(51)");
  assert.equal(await view(102, 40, true), false, "expired window");
  assert.equal(await count(51), 1);
  assert.equal(await scalar("select has_function_privilege('anon','public.record_current_federation_hosting_result_view(uuid,boolean)','execute')"), false);
  assert.equal(await scalar("select has_function_privilege('authenticated','public.record_current_federation_hosting_result_view(uuid,boolean)','execute')"), true);
  assert.equal(await scalar("select has_table_privilege('authenticated','private.federation_hosting_result_readers','select')"), false);
  assert.equal(await scalar("select has_function_privilege('authenticated','private.get_federation_hosting_unique_readers(uuid)','execute')"), false);

  await db.exec(`
    alter table seasons add column status text;
    update seasons set status=case when game_year=6 then 'active' else 'completed' end;
    alter table race_editions add column display_name text;
    update race_editions set display_name='World Championship';
    alter table development_race_editions add column name text;
    update development_race_editions set name='Junior World Championship';
    alter table race_results add column final_rank integer, add column race_roster_id uuid,
      add column total_time_ms bigint, add column gap_to_winner_ms bigint;
    update race_results set final_rank=1,race_roster_id=uid(60),total_time_ms=1234600,gap_to_winner_ms=0 where race_edition_id=uid(30);
    alter table development_race_results add column rank integer, add column rider_name text,
      add column team_name text, add column elapsed_time_seconds integer, add column gap_to_winner_seconds integer;
    update development_race_results set rank=1,rider_name='Camille Roule',team_name='Belgique',
      elapsed_time_seconds=1600,gap_to_winner_seconds=0 where result_scope='general';
    create table race_rosters(id uuid primary key, rider_id uuid, race_registration_id uuid);
    create table riders(id uuid primary key, first_name text, last_name text);
    create table race_registrations(id uuid primary key, race_edition_id uuid, team_season_id uuid, historical_team_name text);
    create table team_seasons(id uuid primary key, display_name text);
    insert into race_rosters values (uid(60),uid(61),uid(62));
    insert into riders values (uid(61),'Camille','Pédale');
    insert into race_registrations values (uid(62),uid(30),null,'France');
  `);
  await db.exec(migration("20261116131000_expose_recent_federation_hosting_results"));
  assert.deepEqual(await scalar("select get_recent_federation_hosting_result_archive()"), { editions: [], classification: [] },
    "active-season results stay on ordinary routes");
  await db.exec("update seasons set status='completed'; insert into seasons values (uid(3),7,'active')");
  const list = await scalar("select get_recent_federation_hosting_result_archive()");
  assert.equal(list.editions.length, 2, "only editions in the still-open prior-season award are listed");
  assert.deepEqual(list.classification, [], "directory does not load full classification");
  const proResult = await scalar("select get_recent_federation_hosting_result_archive(uid(30))");
  assert.deepEqual(proResult.classification, [{ rank: 1, rider_name: "Camille Pédale", team_name: "France",
    elapsed_time_seconds: 1235, gap_to_winner_seconds: 0 }]);
  assert.deepEqual((await scalar("select get_recent_federation_hosting_result_archive(uid(33))")).classification, []);
  assert.equal(await view(101, 30), true, "reopened via archive after rollover still hits the original reader key");
  assert.equal(await count(50), 2);
  await db.exec("update private.federation_hosting_result_publications set completed_at=now()-interval '1 hour' where award_id=uid(51)");
  const juniorResult = await scalar("select get_recent_federation_hosting_result_archive(uid(40))");
  assert.deepEqual(juniorResult.classification, [{ rank: 1, rider_name: "Camille Roule", team_name: "Belgique",
    elapsed_time_seconds: 1600, gap_to_winner_seconds: 0 }]);
  await db.exec("update private.federation_hosting_result_publications set completed_at=now()-interval '73 hours'");
  assert.deepEqual(await scalar("select get_recent_federation_hosting_result_archive()"), { editions: [], classification: [] },
    "archive ends at the original revenue deadline");
  assert.equal(await scalar("select has_function_privilege('anon','public.get_recent_federation_hosting_result_archive(uuid)','execute')"), false);
  assert.equal(await scalar("select has_function_privilege('authenticated','public.get_recent_federation_hosting_result_archive(uuid)','execute')"), true);
  console.log("OK: hosting reader scope, publication, 72-hour deadline, deduplication, archive and grants.");
} finally {
  await db.close();
}
