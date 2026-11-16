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
    create role anon; create role authenticated; create role service_role;
    create schema private;
    create table season_days(id uuid primary key, season_id uuid, day_number int);
    create table riders(id uuid primary key, first_name text, last_name text, personality_key text, potential_steps int default 1);
    create table race_categories(id uuid primary key, code text, name text);
    create table race_editions(id uuid primary key, season_id uuid, race_id uuid, race_category_id uuid, display_name text);
    create table stages(id uuid primary key, season_day_id uuid, race_edition_id uuid, stage_number int, name text, stage_type text, profile_type text);
    create table race_rosters(id uuid primary key, rider_id uuid, race_registration_id uuid, status text, race_role text);
    create table race_roster_stage_roles(race_registration_id uuid, rider_id uuid, stage_id uuid, race_role text);
    create table rider_favorite_races(rider_id uuid, season_id uuid, race_id uuid);
    create table stage_results(id uuid primary key default gen_random_uuid(), stage_id uuid, race_roster_id uuid, rank int, status text);
    create table race_results(id uuid primary key default gen_random_uuid(), race_edition_id uuid, race_roster_id uuid, final_rank int, status text);
    create table rider_season_summaries(rider_id uuid, season_id uuid, uci_rank int);
    create table rider_season_ratings(rider_id uuid, season_id uuid, flat int, sprint int, hills int, mountain int, cobbles int, time_trial int,
      acceleration int default 70, downhill int default 70, endurance int default 70, resistance int default 70,
      recovery int default 70, breakaway int default 70, prologue int default 70);
    create table rider_condition_states(id uuid primary key default gen_random_uuid(), rider_id uuid, season_day_id uuid, morale numeric, form int, fatigue int, source text, updated_at timestamptz default now(), unique(rider_id, season_day_id));
    create table rider_morale_events(id uuid primary key default gen_random_uuid(), rider_id uuid, season_day_id uuid, source_type text, source_reference text, requested_delta numeric, applied_delta numeric, morale_before numeric, morale_after numeric, description text, metadata jsonb, unique(rider_id,source_type,source_reference));
    create table youth_academy_riders(id uuid primary key, personality_key text, potential_steps int default 1, morale numeric default 60, updated_at timestamptz default now());
    create table youth_rider_morale_events(id uuid primary key default gen_random_uuid(), academy_rider_id uuid, season_day_id uuid, source_type text, source_reference text, requested_delta numeric, applied_delta numeric, morale_before numeric, morale_after numeric, description text, metadata jsonb, unique(academy_rider_id,source_type,source_reference));
    create table rider_training_sessions(rider_id uuid, season_id uuid, season_day_id uuid, status text, intensity int, domain text, rating_changes jsonb default '{}', progress_milli jsonb default '{}', primary key(rider_id, season_day_id));
    create table free_agent_training_sessions(rider_id uuid, season_id uuid, season_day_id uuid, status text, rating_changes jsonb default '{}', progress_milli jsonb default '{}', primary key(rider_id, season_day_id));
    create table youth_academy_training_sessions(id uuid primary key default gen_random_uuid(), academy_rider_id uuid, season_id uuid, season_day_id uuid,
      day_number int, training_priority text, training_mode text, rating_changes jsonb, ratings_after jsonb);
  `);
  const morale = read("20260927233500_reapply_persistent_rider_morale");
  const start = morale.indexOf("create or replace function public.apply_rider_morale_event(");
  assert.ok(start >= 0);
  await db.exec(morale.slice(start, morale.indexOf("\n$$;", start) + 4));
  const youthStart = morale.indexOf("create or replace function public.apply_youth_rider_morale_event(");
  assert.ok(youthStart >= 0);
  await db.exec(morale.slice(youthStart, morale.indexOf("\n$$;", youthStart) + 4));
  await db.exec(read("20260930200000_contextualize_rider_result_morale"));
  await db.exec(read("20260723170000_lock_official_stage_simulations"));
  const migration = read("20261117093000_apply_result_personality_morale");
  await db.exec(migration);
  await db.exec(migration);
  const caps = read("20261011133000_enforce_training_potential_stat_caps");
  const capStart = caps.indexOf("create or replace function public.get_rider_potential_stat_cap(");
  assert.ok(capStart >= 0);
  await db.exec(caps.slice(capStart, caps.indexOf("\n$$;", capStart) + 4));
  await db.exec(read("20261117100000_apply_perfectionniste_and_force_tranquille"));

  await db.query("insert into race_categories values ($1,'local','Locale'),($2,'elite','Élite')",[id(1),id(3)]);
  for (const edition of [20, 21, 22, 23]) {
    await db.query("insert into race_editions values ($1,$2,$1,$3,'Épreuve test')", [id(edition), id(2), id(edition === 23 ? 3 : 1)]);
  }
  for (const [stage, edition, number, terrain] of [
    [30, 20, 1, "hilly"], [31, 21, 1, "mountain"], [32, 21, 2, "mountain"], [33, 22, 1, "flat"], [34, 23, 1, "flat"],
  ]) {
    await db.query("insert into season_days values ($1,$2,$3)",[id(stage),id(2),stage]);
    await db.query("insert into stages values ($1,$1,$2,$3,'Étape test',$4,$5)",
      [id(stage),id(edition),number,stage===33 ? "team_time_trial" : "road",terrain]);
  }
  for (const [rider, personality, role, mountain] of [
    [101,"ambitieux","auto",85], [102,"ambitieux","leader",85], [103,"ambitieux","leader",55],
    [104,"colerique","leader",85], [105,"colerique","domestique",85], [106,"colerique","leader",85],
    [107,"colerique","sprinter",85],[108,"force_tranquille","leader",85],[109,"force_tranquille","domestique",85],
    [110,"force_tranquille","leader",85],[111,"force_tranquille","leader",85],
    [112,"colerique","leader",85],[113,"colerique","leader",85],
  ]) {
    await db.query("insert into riders values ($1,'Nom','Test',$2)",[id(rider),personality]);
    await db.query("insert into rider_season_summaries values ($1,$2,$3)",[id(rider),id(2),rider===110 ? 20 : 1]);
    await db.query("insert into rider_season_ratings values ($1,$2,80,72,78,$3,62,71)",[id(rider),id(2),mountain]);
    await db.query("insert into race_rosters values ($1,$1,$1,'confirmed',$2)",[id(rider),role]);
  }
  async function freezeStage(stage, edition, appointments, riders = []) {
    const input = { riders, ...(appointments && { personalityLeadershipByRiderId: Object.fromEntries(
      appointments.map(([number, personalityKey, stageRole, generalRole]) => [id(number), { personalityKey, stageRole, generalRole }]),
    ) }) };
    await db.query("insert into official_stage_simulations(stage_id,race_edition_id,engine_version,seed,input_data,simulation_data) values ($1,$2,'test','test',$3,'{}')",
      [id(stage),id(edition),JSON.stringify(input)]);
  }
  await freezeStage(30,20,[[104,"colerique","leader"],[106,"colerique","leader"],[112,"ambitieux","leader"]]);
  await freezeStage(31,21,[[101,"ambitieux","leader"],[102,"ambitieux",undefined,"leader"],
    [103,"ambitieux","leader"],[104,"colerique","leader","leader"],[107,"colerique","sprinter"]]);
  await freezeStage(32,21,[[101,"ambitieux","leader"],[104,"colerique","sprinter"],[107,"colerique","leader","leader"]]);
  await freezeStage(33,22,[[104,"colerique","leader"]]);
  await freezeStage(34,23,null,[{id:id(113),role:"leader"}]);

  // Roles edited after the official start must not flow back into the results.
  await db.query("update race_rosters set race_role = 'domestique' where rider_id = $1", [id(104)]);
  await db.query("update race_rosters set race_role = 'leader' where rider_id in ($1,$2)", [id(105),id(107)]);
  for (const stage of [31, 32]) {
    await db.query("insert into race_roster_stage_roles values ($1,$1,$3,'domestique'), ($2,$2,$3,'leader')",
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

  await db.query("insert into stage_results(stage_id,race_roster_id,rank,status) values ($1,$2,45,'finished'),($1,$3,45,'finished'),($1,$4,null,'did_not_finish'),($5,$2,45,'finished'),($1,$6,45,'finished'),($7,$8,90,'finished')",
    [id(30),id(104),id(105),id(106),id(33),id(112),id(34),id(113)]);
  assert.equal((await events(104,30))[0].delta,-5);
  assert.match((await events(104,30))[0].description,/Colérique/);
  assert.equal((await events(105,30))[0].delta,-4);
  assert.equal((await events(106,30))[0].delta,-4);
  assert.equal((await events(104,33))[0].delta,-4);
  assert.equal((await events(112,30))[0].delta,-4);
  assert.doesNotMatch((await events(113,34))[0].description,/Colérique/);

  await db.query("insert into race_results(race_edition_id,race_roster_id,final_rank,status) values ($1,$2,45,'classified'),($1,$3,45,'classified')",
    [id(21),id(104),id(107)]);
  assert.equal((await events(104,32))[0].delta,-5);
  assert.equal((await events(107,32))[0].delta,-4);

  for (const [rider,stage,rank,status] of [
    [108,30,45,"finished"],[109,30,null,"did_not_finish"],[108,33,45,"finished"],[110,34,50,"finished"],[111,31,45,"finished"],
  ]) {
    await db.query("insert into stage_results(stage_id,race_roster_id,rank,status) values ($1,$2,$3,$4)",
      [id(stage),id(rider),rank,status]);
  }
  assert.equal((await events(108,30))[0].delta,-3);
  assert.match((await events(108,30))[0].description,/Force tranquille/);
  assert.equal((await events(109,30))[0].delta,-4);
  assert.equal((await events(108,33))[0].delta,-4);
  assert.deepEqual(await events(110,34),[]);
  assert.deepEqual(await events(111,31),[]);
  await db.query("insert into race_results(race_edition_id,race_roster_id,final_rank,status) values ($1,$2,45,'classified')",
    [id(21),id(108)]);
  assert.equal((await events(108,32))[0].delta,-3);

  for (const rider of [120,121,122,123]) {
    await db.query("insert into riders values ($1,'Nom','Test',$2)",[id(rider),rider===122 ? "assidu" : "perfectionniste"]);
    await db.query("insert into rider_season_ratings values ($1,$2,70,70,70,70,70,70)",[id(rider),id(2)]);
  }
  for (const day of [1,2,3,4,8,9]) {
    await db.query("insert into season_days values ($1,$2,$3)",[id(200+day),id(2),day]);
  }
  async function clubSession(rider, day, changes, progress, domain="climber", status="completed") {
    await db.query("insert into rider_training_sessions(rider_id,season_id,season_day_id,status,intensity,domain) values ($1,$2,$3,$4,50,$5)",
      [id(rider),id(2),id(200+day),status,domain]);
    await db.query("update rider_training_sessions set rating_changes=$3,progress_milli=$4 where rider_id=$1 and season_day_id=$2",
      [id(rider),id(200+day),JSON.stringify(changes),JSON.stringify(progress)]);
  }
  await clubSession(120,1,{},{mountain:25});
  await clubSession(120,2,{mountain:1},{mountain:25});
  await clubSession(120,3,{hills:1},{hills:25});
  await clubSession(120,8,{hills:1},{hills:25});
  assert.deepEqual(await events(120,201),[]);
  assert.equal((await events(120,202))[0].delta,1);
  assert.match((await events(120,202))[0].description,/palier franchi/);
  assert.deepEqual(await events(120,203),[]);
  assert.equal((await events(120,208))[0].delta,1);
  await clubSession(121,1,{},{mountain:0},"climber");
  await clubSession(121,2,{},{sprint:0},"sprinter");
  await clubSession(121,3,{},{sprint:0},"sprinter");
  await clubSession(121,4,{},{sprint:0},"sprinter");
  assert.deepEqual(await events(121,201),[]);
  assert.deepEqual(await events(121,202),[]);
  assert.equal((await events(121,203))[0].delta,-1);
  assert.match((await events(121,203))[0].description,/séances répétées/);
  assert.deepEqual(await events(121,204),[]);
  await clubSession(122,1,{mountain:1},{mountain:25});
  await clubSession(123,1,{mountain:1},{mountain:25},"climber","skipped_injury");
  assert.deepEqual(await events(122,201),[]);
  assert.deepEqual(await events(123,201),[]);
  await db.query("insert into free_agent_training_sessions values ($1,$2,$3,'completed','{\"hills\":1}','{\"hills\":30}')",
    [id(123),id(2),id(202)]);
  assert.equal((await events(123,202))[0].delta,1);

  const cappedRatings = Object.fromEntries([
    "mountain","hills","flat","time_trial","cobbles","sprint","acceleration",
    "downhill","endurance","resistance","recovery","breakaway","prologue",
  ].map(key => [key,4.5]));
  for (const rider of [130,131,132]) {
    await db.query("insert into youth_academy_riders(id,personality_key) values ($1,'perfectionniste')",[id(rider)]);
  }
  async function youthSession(rider, day, changes, ratings, mode="automatic") {
    await db.query("insert into youth_academy_training_sessions(academy_rider_id,season_id,season_day_id,day_number,training_priority,training_mode,rating_changes,ratings_after) values ($1,$2,$3,$4,'rouleur',$5,$6,$7)",
      [id(rider),id(2),id(200+day),day,mode,JSON.stringify(changes),JSON.stringify(ratings)]);
  }
  const youthEvents = rider => db.query(
    "select requested_delta::int as delta, season_day_id from youth_rider_morale_events where academy_rider_id=$1 order by season_day_id",
    [id(rider)]).then(result=>result.rows);
  await youthSession(130,1,{timeTrial:0.01},{time_trial:4.01});
  await youthSession(130,2,{timeTrial:0.07},{timeTrial:4.07},"manual");
  await youthSession(130,3,{timeTrial:0.12},{time_trial:4.19});
  assert.deepEqual(await youthEvents(130),[{delta:1,season_day_id:id(202)}]);
  await youthSession(131,1,{},cappedRatings);
  await youthSession(131,2,{},cappedRatings);
  await youthSession(131,3,{},cappedRatings);
  assert.deepEqual(await youthEvents(131),[{delta:-1,season_day_id:id(202)}]);
  await youthSession(132,1,{}, {...cappedRatings, time_trial:4.3});
  await youthSession(132,2,{}, {...cappedRatings, time_trial:4.3});
  assert.deepEqual(await youthEvents(132),[]);
  console.log("Personality result and training morale: all assertions passed on isolated PostgreSQL.");
} finally {
  await db.close();
}
