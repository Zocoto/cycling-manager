// Real signing function and table constraints in an isolated PostgreSQL runtime.
// No network, Supabase credentials, or production fixtures are used.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]?.endsWith('/dist/index.js')) throw new Error('Pass the local PGlite module path.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const read = async path => (await readFile(new URL(path,import.meta.url),'utf8')).replaceAll('\r\n','\n');
let assertions=0, phase='schema';
const check=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);assertions++;};
const rows=async sql=>(await db.query(sql)).rows;
const scalar=async sql=>Object.values((await rows(sql))[0])[0];
const rejects=async(sql,pattern)=>{await assert.rejects(db.query(sql),pattern);assertions++;};
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
    create table teams(id uuid primary key);
    create table countries(id uuid primary key);
    create table riders(id uuid primary key);
    create table staff_contracts(id uuid primary key);
    create table seasons(id uuid primary key,game_year integer,status text,current_day_number int);
    create table season_days(id uuid primary key,season_id uuid,day_number int);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,cash_balance numeric);
    create table team_finance_transactions(team_season_id uuid,season_day_id uuid,day_number int,amount numeric,category text,status text,description text,source_reference text unique,posted_at timestamptz);
    create function settle_current_team_finances() returns void language plpgsql as $$begin return; end$$;
    insert into teams values('${id(10)}'),('${id(11)}');
    insert into countries values('${id(20)}');
    insert into staff_contracts values('${id(30)}');
    insert into seasons values('${id(3)}',3,'completed',28),('${id(4)}',4,'active',6),('${id(5)}',5,'planned',1),('${id(8)}',8,'planned',1);
    insert into season_days values('${id(40)}','${id(4)}',6),('${id(50)}','${id(5)}',1),('${id(80)}','${id(8)}',1);
    insert into sporting_directors values('${id(60)}','${id(60)}','active'),('${id(61)}','${id(61)}','active');
    insert into team_manager_assignments values('${id(60)}','${id(10)}','general_manager','active'),('${id(61)}','${id(11)}','general_manager','active');
    insert into team_seasons values('${id(70)}','${id(10)}','${id(4)}',100000),('${id(71)}','${id(11)}','${id(4)}',100000),('${id(75)}','${id(10)}','${id(5)}',100000),('${id(78)}','${id(10)}','${id(8)}',100000);
    select set_config('test.user','${id(60)}',false);`);
  const original=await read('../supabase/migrations/20260722090000_create_youth_development_center.sql');
  for(const table of ['youth_scouting_missions','youth_scouting_candidates','youth_academy_riders']) {
    await db.exec(original.match(new RegExp(`create table public\\.${table} \\([\\s\\S]*?\\n\\);`))[0]);
  }
  await db.exec(original.match(/create or replace function public\.sign_current_team_youth_candidate[\s\S]*?\$\$;/i)[0]);
  await db.exec(`alter table youth_scouting_candidates add scout_training_bonus_percentage numeric not null default 0;
    alter table youth_academy_riders add scout_training_bonus_percentage numeric not null default 0;
    revoke all on function sign_current_team_youth_candidate(uuid) from public,anon;
    grant execute on function sign_current_team_youth_candidate(uuid) to authenticated,service_role;`);
  const bonus=await read('../supabase/migrations/20260827070000_add_scout_academy_training_talent.sql');
  await db.exec(bonus.match(/do \$patch_signing\$[\s\S]*?\$patch_signing\$;/)[0]);
  const archive=await read('../supabase/migrations/20260809150000_auto_archive_fully_recruited_youth_reports.sql');
  await db.exec(archive.slice(archive.indexOf('create or replace function'),archive.indexOf('\nupdate public.youth_scouting_missions')));
  const makeCandidate=async(n,age,season=3,viewed=false,status='spotted',team=10)=>{
    await db.exec(`insert into youth_scouting_missions(id,team_id,season_id,scout_contract_id,country_id,start_day_number,duration_days,completes_day_number,status,report_ready_at,report_viewed_at)
      values('${id(n+1000)}','${id(team)}','${id(season)}','${id(30)}','${id(20)}',1,3,4,'completed',now(),${viewed?'now()':'null'});
      insert into youth_scouting_candidates(id,mission_id,report_slot,country_id,first_name,last_name,age,archetype,potential_steps,avatar_profile_key,avatar_seed,
        mountain,hills,flat,time_trial,cobbles,sprint,acceleration,downhill,endurance,resistance,recovery,breakaway,prologue,signing_fee,tuition_per_season,status,scout_training_bonus_percentage)
      values('${id(n)}','${id(n+1000)}',1,'${id(20)}','Test','Junior',${age},'climber',4,'default',123,
        4,3,3,3,3,3,3,3,3,3,3,3,3,1000,100,'${status}',7.5);`);
  };
  const sign=n=>`select sign_current_team_youth_candidate('${id(n)}')`;
  const snapshot=()=>rows(`select (select jsonb_agg(t order by id) from team_seasons t) balances,
    (select jsonb_agg(t order by id) from youth_scouting_candidates t) candidates,
    (select jsonb_agg(t order by id) from youth_scouting_missions t) missions,
    (select jsonb_agg(t order by id) from youth_academy_riders t) academy,
    (select jsonb_agg(t order by source_reference) from team_finance_transactions t) transactions`);
  await makeCandidate(100,18);
  phase='reproduce old rejuvenation';
  // Local rollback only, never run this fixture against Supabase.
  await db.exec('begin');
  const oldId=await scalar(sign(100));
  check(await scalar(`select 4-birth_game_year from youth_academy_riders where id='${oldId}'`),18,'old S3 age 18 incorrectly recruits as age 18 in S4');
  await db.exec('rollback');
  const before=await snapshot();
  const permissions=await rows("select proacl::text from pg_proc where oid='sign_current_team_youth_candidate(uuid)'::regprocedure");
  phase='reviewed migration';
  await db.exec(await read('../supabase/migrations/20261014153000_age_scouting_candidates_across_seasons.sql'));
  check(await snapshot(),before,'migration modifies no candidate, report, existing rider or money');
  check(await rows("select proacl::text from pg_proc where oid='sign_current_team_youth_candidate(uuid)'::regprocedure"),permissions,'existing authorization grants retained');
  await rejects(sign(100),/plus de 18 ans/);
  check(await snapshot(),before,'rejected stale open report charges nothing and stays readable');
  await makeCandidate(101,18,3,true);
  const archivedBefore=await snapshot();
  await rejects(sign(101),/plus de 18 ans/);
  check(await snapshot(),archivedBefore,'archived over-age report also remains untouched');
  phase='eligible old and current reports';
  for(const [n,age,season,viewed,expected] of [[102,17,3,false,18],[103,17,3,true,18],[104,18,4,false,18],[105,15,3,false,16]]) {
    await makeCandidate(n,age,season,viewed);
    const money=Number(await scalar(`select cash_balance from team_seasons where id='${id(70)}'`));
    await db.exec('set role authenticated');
    const academyId=await scalar(sign(n));
    await db.exec('reset role');
    const rider=(await rows(`select birth_game_year,scout_training_bonus_percentage,mountain,avatar_seed from youth_academy_riders where id='${academyId}'`))[0];
    check(4-rider.birth_game_year,expected,'signing keeps true current age');
    check(Number(rider.scout_training_bonus_percentage),7.5,'scout training affix copied unchanged');
    check(Number(rider.mountain),4,'candidate ratings not changed');
    check(Number(rider.avatar_seed),123,'identity unchanged');
    check(Number(await scalar(`select cash_balance from team_seasons where id='${id(70)}'`)),money-1000,'signing fee charged exactly once');
    check(await scalar(`select status from youth_scouting_candidates where id='${id(n)}'`),'signed','candidate marked signed');
    check(await scalar(`select report_viewed_at is not null from youth_scouting_missions where id='${id(n+1000)}'`),true,'existing auto-archive trigger still works');
    const signedState=await snapshot();
    await rejects(sign(n),/plus disponible/);
    check(await snapshot(),signedState,'repeat signing is rejected without a second debit');
  }
  phase='authorization and existing unavailability';
  await makeCandidate(106,17,4,false,'expired');
  await rejects(sign(106),/plus disponible/);
  await makeCandidate(107,17,4,false,'spotted',11);
  await rejects(sign(107),/plus disponible/);
  await db.exec("select set_config('test.user','',false)");
  await rejects(sign(107),/Aucune équipe/);
  await db.exec(`select set_config('test.user','${id(60)}',false)`);
  await makeCandidate(108,16,4);
  await db.exec(`update team_seasons set cash_balance=999 where id='${id(70)}'`);
  await rejects(sign(108),/insuffisante/);
  phase='future seasons';
  await makeCandidate(109,18,4);
  await db.exec(`update seasons set status=case when game_year=5 then 'active' else 'completed' end`);
  await rejects(sign(109),/plus de 18 ans/);
  await makeCandidate(110,16,4,true);
  const laterId=await scalar(sign(110));
  check(await scalar(`select 5-birth_game_year from youth_academy_riders where id='${laterId}'`),17,'S5 recruitment uses original S4 birth year');
  await db.exec(`update seasons set status=case when game_year=8 then 'active' else 'completed' end`);
  await rejects(sign(108),/plus de 18 ans/);
  check(await scalar(`select birth_game_year from youth_academy_riders where id='${laterId}'`),-12,'later rollover needs no candidate age mutation');
  check(await scalar(`select count(*)::int from team_finance_transactions where team_season_id='${id(78)}'`),0,'old reports never charge the future season');
  console.log(JSON.stringify({isolated:true,productionActions:false,assertions,unreadAndArchivedCovered:true,age18Eligible:true,age19Blocked:true,noRejuvenation:true}));
} catch(error) {
  console.error(JSON.stringify({phase,message:error.message,where:error.where})); process.exitCode=1;
} finally { await db.close(); }
