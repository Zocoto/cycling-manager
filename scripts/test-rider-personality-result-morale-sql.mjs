// Real result and morale routines in an isolated in-memory PostgreSQL fixture.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const read = name => readFileSync("supabase/migrations/" + name + ".sql", "utf8");

try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema private;
    create table season_days(id uuid primary key, season_id uuid, day_number int);
    create table riders(id uuid primary key, first_name text, last_name text, personality_key text);
    create table race_categories(id uuid primary key, code text, name text);
    create table race_editions(id uuid primary key, season_id uuid, race_id uuid, race_category_id uuid, display_name text);
    create table stages(id uuid primary key, season_day_id uuid, race_edition_id uuid, stage_number int, name text, stage_type text, profile_type text);
    create table race_rosters(id uuid primary key, rider_id uuid, race_registration_id uuid, status text, race_role text);
    create table race_roster_stage_roles(race_registration_id uuid, rider_id uuid, stage_id uuid, race_role text);
    create table rider_favorite_races(rider_id uuid, season_id uuid, race_id uuid);
    create table stage_results(id uuid primary key default gen_random_uuid(), stage_id uuid, race_roster_id uuid, rank int, status text);
    create table race_results(id uuid primary key default gen_random_uuid(), race_edition_id uuid, race_roster_id uuid, final_rank int, status text);
    create table rider_season_summaries(rider_id uuid, season_id uuid, uci_rank int);
    create table rider_season_ratings(rider_id uuid, season_id uuid, flat int, sprint int, hills int, mountain int, cobbles int, time_trial int);
    create table rider_condition_states(id uuid primary key default gen_random_uuid(), rider_id uuid, season_day_id uuid, morale numeric, form int, fatigue int, source text, updated_at timestamptz default now(), unique(rider_id, season_day_id));
    create table rider_morale_events(id uuid primary key default gen_random_uuid(), rider_id uuid, season_day_id uuid, source_type text, source_reference text, requested_delta numeric, applied_delta numeric, morale_before numeric, morale_after numeric, description text, metadata jsonb, unique(rider_id,source_type,source_reference));
  `);
  const morale = read("20260927233500_reapply_persistent_rider_morale");
  const start = morale.indexOf("create or replace function public.apply_rider_morale_event(");
  assert.ok(start >= 0);
  await db.exec(morale.slice(start, morale.indexOf("\n$$;", start) + 4));
  await db.exec(read("20260930200000_contextualize_rider_result_morale"));
  const migration = read("20261117093000_apply_result_personality_morale");
  await db.exec(migration);
  await db.exec(migration);

  await db.query("insert into race_categories values ($1,'local','Locale')",[id(1)]);
  for (const edition of [20, 21, 22]) {
    await db.query("insert into race_editions values ($1,$2,$1,$3,'Épreuve test')", [id(edition), id(2), id(1)]);
  }
  for (const [stage, edition, number, terrain] of [
    [30, 20, 1, "hilly"], [31, 21, 1, "mountain"], [32, 21, 2, "mountain"], [33, 22, 1, "flat"],
  ]) {
    await db.query("insert into season_days values ($1,$2,$3)",[id(stage),id(2),stage]);
    await db.query("insert into stages values ($1,$1,$2,$3,'Étape test',$4,$5)",
      [id(stage),id(edition),number,stage===33 ? "team_time_trial" : "road",terrain]);
  }
  for (const [rider, personality, role, mountain] of [
    [101,"ambitieux","auto",85], [102,"ambitieux","leader",85], [103,"ambitieux","leader",55],
    [104,"colerique","leader",85], [105,"colerique","domestique",85], [106,"colerique","leader",85],
    [107,"colerique","sprinter",85],
  ]) {
    await db.query("insert into riders values ($1,'Nom','Test',$2)",[id(rider),personality]);
    await db.query("insert into rider_season_summaries values ($1,$2,1)",[id(rider),id(2)]);
    await db.query("insert into rider_season_ratings values ($1,$2,80,72,78,$3,62,71)",[id(rider),id(2),mountain]);
    await db.query("insert into race_rosters values ($1,$1,$1,'confirmed',$2)",[id(rider),role]);
  }
  for (const stage of [31, 32]) {
    await db.query("insert into race_roster_stage_roles values ($1,$1,$3,'leader'), ($2,$2,$3,'domestique')",
      [id(101),id(102),id(stage)]);
    await db.query("insert into stage_results(stage_id,race_roster_id,rank,status) select $1,id,45,'finished' from race_rosters",
      [id(stage)]);
  }
  const events = (rider, day) => db.query(
    "select requested_delta::int as delta,description,metadata from rider_morale_events where rider_id=$1 and season_day_id=$2 order by source_reference",
    [id(rider),id(day)]).then(result => result.rows);
  assert.equal((await events(101,31))[0].delta,1);
  assert.equal((await events(101,31))[0].metadata.personalityKey,"ambitieux");
  assert.match((await events(101,31))[0].description,/Ambitieux/);
  for (const [rider,day] of [[101,32],[102,31],[103,31],[104,31]]) assert.deepEqual(await events(rider,day),[]);

  await db.query("insert into stage_results(stage_id,race_roster_id,rank,status) values ($1,$2,45,'finished'),($1,$3,45,'finished'),($1,$4,null,'did_not_finish'),($5,$2,45,'finished')",
    [id(30),id(104),id(105),id(106),id(33)]);
  assert.equal((await events(104,30))[0].delta,-5);
  assert.match((await events(104,30))[0].description,/Colérique/);
  assert.equal((await events(105,30))[0].delta,-4);
  assert.equal((await events(106,30))[0].delta,-4);
  assert.equal((await events(104,33))[0].delta,-4);

  await db.query("insert into race_results(race_edition_id,race_roster_id,final_rank,status) values ($1,$2,45,'classified'),($1,$3,45,'classified')",
    [id(21),id(104),id(107)]);
  assert.equal((await events(104,32))[0].delta,-5);
  assert.equal((await events(107,32))[0].delta,-4);
  console.log("Personality race morale: 14 assertions passed on isolated PostgreSQL.");
} finally {
  await db.close();
}
