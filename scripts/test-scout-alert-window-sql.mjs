// Isolated PostgreSQL, without credentials or remote gameplay fixtures.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {getYouthScoutingDurationOptionsForDay} from '../lib/game/youth-scouting-duration.ts';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const migration=readFileSync('supabase/migrations/20261104101537_hide_scout_alert_outside_mission_window.sql','utf8').replaceAll('\r','');
const inclusiveMigration=readFileSync('supabase/migrations/20261111180000_count_scouting_dispatch_day.sql','utf8');
const anchor=migration.match(/\$anchor\$([\s\S]*?)\$anchor\$/)[1];
const baseTable=readFileSync('supabase/migrations/20260722090000_create_youth_development_center.sql','utf8')
  .match(/create table public\.youth_scouting_missions \([\s\S]*?\n\);/)[0];
const legacyRpc=readFileSync('supabase/migrations/20260801100000_enforce_youth_scouting_minimum_duration.sql','utf8');
const id = number => `'00000000-0000-4000-8000-${String(number).padStart(12, '0')}'`;
let checks=0;const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const read=async()=> (await db.query('select get_current_dashboard_assistant_summary() payload')).rows[0].payload;
const dispatch=(scout, duration)=> db.query(
  `select start_current_team_youth_scouting(${id(scout)}, ${id(30)}, ${duration}) id`,
);
const readMission=async scout=>(await db.query(
  `select status, start_day_number, duration_days, completes_day_number
   from youth_scouting_missions where scout_contract_id = ${id(scout)} order by created_at desc limit 1`,
)).rows[0];
try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select ${id(21)}::uuid $$;
    create function public.sync_active_season_day() returns integer language sql as $$ select 1 $$;
    create table public.teams(id uuid primary key);
    create table public.seasons(id uuid primary key,status text,current_day_number smallint);
    create table public.countries(id uuid primary key,is_active boolean);
    create table public.sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table public.team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table scout_alert_context(team_id uuid,current_day_number integer);
    create table staff_contracts(id uuid primary key,team_id uuid,staff_member_id uuid,status text);
    create table staff_members(id uuid primary key,role text);
    ${baseTable}
    insert into teams values(${id(11)}),(${id(12)});
    insert into seasons values(${id(31)},'active',1);
    insert into countries values(${id(30)},true);
    insert into sporting_directors values(${id(20)},${id(21)},'active');
    insert into team_manager_assignments values(${id(20)},${id(11)},'general_manager','active');
    insert into scout_alert_context values(${id(11)},27);
    insert into staff_members values
      (${id(1)},'scout'),(${id(2)},'scout'),(${id(3)},'scout'),
      (${id(4)},'trainer'),(${id(5)},'scout'),(${id(6)},'scout');
    insert into staff_contracts values
      (${id(1)},${id(11)},${id(1)},'active'),(${id(2)},${id(11)},${id(2)},'active'),
      (${id(3)},${id(11)},${id(3)},'active'),(${id(4)},${id(11)},${id(4)},'active'),
      (${id(5)},${id(11)},${id(5)},'completed'),(${id(6)},${id(12)},${id(6)},'active');
    insert into youth_scouting_missions
      (team_id,season_id,scout_contract_id,country_id,start_day_number,duration_days,
       completes_day_number,status,report_ready_at) values
      (${id(11)},${id(31)},${id(3)},${id(30)},1,7,8,'active',null),
      (${id(11)},${id(31)},${id(2)},${id(30)},1,3,4,'completed',now()),
      (${id(11)},${id(31)},${id(5)},${id(30)},1,3,4,'cancelled',null);
    create function get_current_dashboard_assistant_summary() returns jsonb language sql stable security definer set search_path=public set statement_timeout='3s' as $$
      with current_context as(select * from public.scout_alert_context)
      select jsonb_build_object('completedScoutingCount',7,
${anchor},'otherAlert',true) $$;
    revoke all on function get_current_dashboard_assistant_summary() from public,anon;
    grant execute on function get_current_dashboard_assistant_summary() to authenticated;`);
  await db.exec(legacyRpc);
  const attrs=async()=> (await db.query(`select proacl::text,prosecdef,proconfig from pg_proc where oid='get_current_dashboard_assistant_summary()'::regprocedure`)).rows[0];
  const before=await attrs();
  check((await read()).availableScoutCount,2,'reproduces alert at J27 before correction');
  await db.exec(migration);
  await db.exec(inclusiveMigration);
  check(await attrs(),before,'privileges and function execution limits preserved');
  check(await readMission(3),{
    status:'active',start_day_number:1,duration_days:7,completes_day_number:7,
  },'active report moves from J8 to J7 without reducing its duration');
  check((await readMission(2)).completes_day_number,4,'historical completed report keeps its date');
  check((await readMission(5)).completes_day_number,4,'cancelled mission keeps its date');
  for(let day=1;day<=28;day++){
    await db.query('update scout_alert_context set current_day_number=$1',[day]);
    const result=await read();
    check(result.availableScoutCount,getYouthScoutingDurationOptionsForDay(day).length>0?2:0,'same mission eligibility on J'+day);
    check(result.completedScoutingCount,7,'ready reports remain available on J'+day);
  }
  await db.exec('update scout_alert_context set current_day_number=1;');
  check((await read()).availableScoutCount,2,'alert returns at next-season J1');
  await dispatch(1,7);
  check((await readMission(1)).completes_day_number,7,'a new J1 mission of seven days ends on J7');
  await db.exec('update seasons set current_day_number=26');
  await dispatch(2,3);
  check((await readMission(2)).completes_day_number,28,'three days from J26 fits in the season');
  await db.exec(`update seasons set current_day_number=27;
    update youth_scouting_missions set status='cancelled' where scout_contract_id=${id(2)} and status='active';`);
  await assert.rejects(dispatch(2,3),/après la fin de la saison/);
  checks++;
  await db.exec(`update staff_contracts set status='completed' where id in(${id(1)},${id(2)});`);
  check((await read()).availableScoutCount,0,'busy, inactive, non-scout and other-team contracts excluded');
  const definition=async()=> (await db.query(`select pg_get_functiondef('get_current_dashboard_assistant_summary()'::regprocedure) value`)).rows[0].value;
  const installed=await definition();await db.exec(inclusiveMigration);
  check(await definition(),installed,'migration retry is idempotent');
  check((await readMission(3)).completes_day_number,7,'retry never shifts a date twice');
  if(process.argv[3]){
    const live=JSON.parse(readFileSync(process.argv[3],'utf8')).definition.replaceAll('\r','');
    check(live.split(anchor).length,2,'captured production function has one exact target');
  }
  console.log(JSON.stringify({isolatedPostgres:true,checks,productionWrites:0}));
}catch(error){
  console.error(error.message);
  process.exitCode=1;
}finally{await db.close();}
