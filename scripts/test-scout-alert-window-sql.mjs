// Isolated PostgreSQL, without credentials or remote gameplay fixtures.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {getYouthScoutingDurationOptionsForDay} from '../lib/game/youth-scouting-duration.ts';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const migration=readFileSync('supabase/migrations/20261104101537_hide_scout_alert_outside_mission_window.sql','utf8').replaceAll('\r','');
const anchor=migration.match(/\$anchor\$([\s\S]*?)\$anchor\$/)[1];
let checks=0;const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const read=async()=> (await db.query('select get_current_dashboard_assistant_summary() payload')).rows[0].payload;
try{
  await db.exec(`create role anon;create role authenticated;
    create table scout_alert_context(team_id integer,current_day_number integer);
    insert into scout_alert_context values(1,27);
    create table staff_contracts(id integer,team_id integer,staff_member_id integer,status text);
    create table staff_members(id integer,role text);
    create table youth_scouting_missions(scout_contract_id integer,status text);
    insert into staff_members values(1,'scout'),(2,'scout'),(3,'scout'),(4,'trainer'),(5,'scout'),(6,'scout');
    insert into staff_contracts values(1,1,1,'active'),(2,1,2,'active'),(3,1,3,'active'),(4,1,4,'active'),(5,1,5,'completed'),(6,2,6,'active');
    insert into youth_scouting_missions values(3,'active'),(2,'completed');
    create function get_current_dashboard_assistant_summary() returns jsonb language sql stable security definer set search_path=public set statement_timeout='3s' as $$
      with current_context as(select * from public.scout_alert_context)
      select jsonb_build_object('completedScoutingCount',7,
${anchor},'otherAlert',true) $$;
    revoke all on function get_current_dashboard_assistant_summary() from public,anon;
    grant execute on function get_current_dashboard_assistant_summary() to authenticated;`);
  const attrs=async()=> (await db.query(`select proacl::text,prosecdef,proconfig from pg_proc where oid='get_current_dashboard_assistant_summary()'::regprocedure`)).rows[0];
  const before=await attrs();
  check((await read()).availableScoutCount,2,'reproduces alert at J27 before correction');
  await db.exec(migration);
  check(await attrs(),before,'privileges and function execution limits preserved');
  for(let day=1;day<=28;day++){
    await db.query('update scout_alert_context set current_day_number=$1',[day]);
    const result=await read();
    check(result.availableScoutCount,getYouthScoutingDurationOptionsForDay(day).length>0?2:0,'same mission eligibility on J'+day);
    check(result.completedScoutingCount,7,'ready reports remain available on J'+day);
  }
  await db.exec('update scout_alert_context set current_day_number=1;');
  check((await read()).availableScoutCount,2,'alert returns at next-season J1');
  await db.exec('update staff_contracts set status=\'completed\' where id in(1,2);');
  check((await read()).availableScoutCount,0,'busy, inactive, non-scout and other-team contracts excluded');
  const definition=async()=> (await db.query(`select pg_get_functiondef('get_current_dashboard_assistant_summary()'::regprocedure) value`)).rows[0].value;
  const installed=await definition();await db.exec(migration);
  check(await definition(),installed,'migration retry is idempotent');
  if(process.argv[3]){
    const live=JSON.parse(readFileSync(process.argv[3],'utf8')).definition.replaceAll('\r','');
    check(live.split(anchor).length,2,'captured production function has one exact target');
  }
  console.log(JSON.stringify({isolatedPostgres:true,checks,productionWrites:0}));
}finally{await db.close();}
