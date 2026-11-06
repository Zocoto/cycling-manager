import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]??'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js').href);
const migration=readFileSync('supabase/migrations/20261106234500_align_gala_steam_roster_substitutions.sql','utf8');
const parse=name=>JSON.parse(migration.match(new RegExp(name+" constant jsonb := '([^']*)'::jsonb;"))[1]);
const before=parse('v_before'),after=parse('v_after');
const reg='72d5f15a-939b-45fe-83a5-26bc293211cf',team='c7d4f299-3430-4aaf-a029-ac9b97a07ed2',season='c0c5824c-43a4-442e-907c-265c479efa0a';
const changes=[['2a41b6da-9f1d-4cb8-b0b9-6043eedf614f',12739],['ed560026-792d-456c-b4d6-484e46d9020a',10565],['bba478c5-d588-4575-b973-f50f0765036f',12532]];
const source=readFileSync('supabase/migrations/20261023120000_prepare_season_four_gala_rewards.sql','utf8');
const guard=source.slice(source.indexOf('create function public.guard_season_four_gala_registration()'),source.indexOf('revoke all on function public.guard_season_four_gala_registration()'));
const db=new PGlite();let checks=0;
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const lineup=async()=>(await db.query(`select profile,position,rider_id from public.season_gala_registration_riders where registration_id='${reg}' order by profile,position`)).rows;
const core=async()=>(await db.query(`select (select jsonb_agg(to_jsonb(r) order by id) from riders r) riders,(select jsonb_agg(to_jsonb(c) order by rider_id) from rider_contracts c) contracts,(select jsonb_agg(to_jsonb(n) order by rider_id) from rider_season_ratings n) ratings`)).rows;
async function repairFails(pattern){await assert.rejects(()=>db.exec(migration),pattern);await db.exec('rollback;');assert.deepEqual(await lineup(),before);checks++;}
try{
 await db.exec(`create table seasons(id uuid primary key,game_year int);insert into seasons values('${season}',4);
 create table season_gala_registrations(id uuid primary key,team_id uuid,season_id uuid,program text);
 create table season_gala_registration_riders(registration_id uuid,profile text,rider_id uuid,position smallint,primary key(registration_id,profile,rider_id),unique(registration_id,profile,position));
 create table season_gala_result_imports(event_key text primary key,season_id uuid);
 create table riders(id uuid primary key,pcm_export_id int);
 create table rider_contracts(rider_id uuid primary key,team_id uuid,status text,start_season_id uuid,end_season_id uuid,left_season_id uuid);
 create table rider_season_ratings(rider_id uuid primary key,season_id uuid,mountain int,hills int,flat int,time_trial int,cobbles int,sprint int);
 insert into season_gala_registrations values('${reg}','${team}','${season}','continental');
 insert into season_gala_registration_riders select '${reg}',profile,rider_id,position from jsonb_to_recordset(${quote(JSON.stringify(before))}::jsonb) r(profile text,rider_id uuid,position smallint);
 insert into riders values ${changes.map(([id,pcm])=>`('${id}',${pcm})`).join(',')};
 insert into rider_contracts select id,'${team}','completed','${season}','${season}',null from riders;
 insert into rider_season_ratings select id,'${season}',60,60,60,60,60,60 from riders;
 ${guard}
 create trigger season_four_gala_roster_guard before insert or update or delete on season_gala_registration_riders for each row execute function public.guard_season_four_gala_registration();`);
 const guardBefore=(await db.query("select pg_get_functiondef('public.guard_season_four_gala_registration()'::regprocedure) definition")).rows[0].definition;
 const unchangedCore=await core();assert.deepEqual(await lineup(),before);checks++;
 await db.exec(migration);assert.deepEqual(await lineup(),after);assert.equal(after.length,22);assert.equal(after.filter((row,i)=>row.rider_id!==before[i].rider_id).length,3);checks++;
 assert.deepEqual(after.filter(r=>r.profile==='mountain'),before.filter(r=>r.profile==='mountain'));assert.deepEqual(await core(),unchangedCore);checks++;
 assert.equal((await db.query("select pg_get_functiondef('public.guard_season_four_gala_registration()'::regprocedure) definition")).rows[0].definition,guardBefore);checks++;
 await db.exec(migration);assert.deepEqual(await lineup(),after);checks++;
 await db.exec(`insert into season_gala_result_imports values('continental:mountain','${season}');`);
 await db.exec(migration);assert.deepEqual(await lineup(),after);checks++;
 await assert.rejects(()=>db.exec(`update season_gala_registration_riders set rider_id='00000000-0000-4000-8000-000000000001' where registration_id='${reg}' and profile='hills' and position=1`),/figées/);checks++;
 await db.exec(`delete from season_gala_result_imports;update season_gala_registration_riders roster set rider_id=r.rider_id from jsonb_to_recordset(${quote(JSON.stringify(before))}::jsonb) r(profile text,rider_id uuid,position smallint) where roster.registration_id='${reg}' and roster.profile=r.profile and roster.position=r.position;insert into season_gala_result_imports values('continental:mountain','${season}');`);
 await repairFails(/already imported/);await db.exec('delete from season_gala_result_imports;');
 await db.exec(`update riders set pcm_export_id=1 where id='${changes[0][0]}'`);await repairFails(/exact Steam ID/);await db.exec(`update riders set pcm_export_id=${changes[0][1]} where id='${changes[0][0]}'`);
 await db.exec(`update rider_season_ratings set hills=76 where rider_id='${changes[0][0]}'`);await repairFails(/eligible S4 ratings/);await db.exec('update rider_season_ratings set hills=60;');
 await db.exec(`update rider_contracts set team_id='00000000-0000-4000-8000-000000000002' where rider_id='${changes[0][0]}'`);await repairFails(/source-club contract/);await db.exec(`update rider_contracts set team_id='${team}';`);
 await db.exec(`insert into season_gala_result_imports values('world-tour:mountain','${season}');`);await db.exec(migration);assert.deepEqual(await lineup(),after);checks++;
 console.log(JSON.stringify({checks,isolatedPostgres:true,actualGuardUnchanged:true,rows:22,replacements:3,mountainUnchanged:true,productionTouched:false}));
}finally{await db.close();}
