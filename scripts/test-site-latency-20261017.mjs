// All fixtures and simulated contention stay inside isolated PostgreSQL.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
if (!process.argv[2]?.endsWith('/dist/index.js')) throw new Error('Pass the local PGlite module path');
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();let checks=0;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const read=name=>readFileSync(`supabase/migrations/${name}.sql`,'utf8').replaceAll('\r','');
const original=read('20260824113000_harden_header_and_dashboard_performance');
const extract=name=>{const start=original.indexOf(`create or replace function public.${name}(`);assert.ok(start>=0);return original.slice(start,original.indexOf('$$;',start)+3);};
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const scalar=async sql=>Object.values((await db.query(sql)).rows[0])[0];
const summary=async()=>(await db.query('select * from get_current_game_objective_summary_cached()')).rows;
const health=()=>scalar('select get_recent_site_performance_health()');
try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
    create table sporting_directors(id uuid,auth_user_id uuid,status text,experience_points numeric);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text,created_at timestamptz default now());
    create table seasons(id uuid,status text,current_day_number int);
    create table game_objective_definitions(objective_key text,metric_key text,target_value int,is_active boolean);
    create table game_objective_claims(sporting_director_id uuid,objective_key text,claimed_at timestamptz);
    create table game_objective_summary_cache(sporting_director_id uuid primary key,team_id uuid,season_id uuid,season_day_number int,
      experience_points numeric,total_count int,ready_count int,computed_at timestamptz);
    create table rider_training_sessions(id uuid,team_id uuid,season_id uuid,rider_id uuid,processed_at timestamptz,is_contract_eligible boolean,status text);
    create table national_federation_selection_members(owner_director_id uuid,response_status text);
    create table performance_samples(id bigint generated always as identity,recorded_at timestamptz default now(),source text,route text,metric text,value float8,ok boolean);
    create index on performance_samples(recorded_at);
    create sequence progress_calls;
    create function calculate_game_objective_progress(text,uuid,uuid,numeric) returns int language plpgsql as $$begin
      perform nextval('public.progress_calls');return 3;end$$;
    insert into sporting_directors values('${id(1)}','${id(1)}','active',10),('${id(2)}','${id(2)}','active',10);
    insert into team_manager_assignments values('${id(1)}','${id(11)}','general_manager','active',now()),('${id(2)}','${id(12)}','general_manager','active',now());
    insert into seasons values('${id(20)}','active',9);
    insert into game_objective_definitions values('a1','a',1,true),('a5','a',5,true),('b3','b',3,true),('claimed','c',1,true),('inactive','z',1,false);
    insert into game_objective_claims values('${id(1)}','claimed',now());
    select set_config('test.user','${id(1)}',false);`);
  let baseline=extract('get_current_game_objective_summary_cached');
  const start=baseline.indexOf('    select\n      count(*)::integer,');
  const end=baseline.indexOf('    insert into public.game_objective_summary_cache',start);
  const optimized=read('20261002180000_isolate_critical_dashboard_and_cn_work').split('$replacement$')[1];
  baseline=baseline.slice(0,start)+optimized+'\n'+baseline.slice(end);
  await db.exec(baseline);
  await db.exec(extract('invalidate_game_objective_summary_cache'));
  await db.exec(`create trigger invalidate_game_objective_summary_cache_on_claim after insert or update or delete
    on game_objective_claims for each row execute function invalidate_game_objective_summary_cache();
    revoke all on function get_current_game_objective_summary_cached() from public;
    grant execute on function get_current_game_objective_summary_cached() to authenticated,service_role;`);
  const before=await summary();check(before,[{total_count:4,ready_count:2}]);
  const privileges=await scalar("select proacl::text from pg_proc where oid='get_current_game_objective_summary_cached()'::regprocedure");
  await db.exec(read('20261017090000_bound_training_history_and_objective_refresh'));
  await db.exec(read('20261017091000_monitor_recent_site_latency'));
  check(await summary(),before);
  check(await scalar("select proacl::text from pg_proc where oid='get_current_game_objective_summary_cached()'::regprocedure"),privileges);
  check(Number(await scalar("select count(*) from pg_indexes where indexname in('rider_training_sessions_completed_team_idx','rider_training_sessions_eligible_history_idx','federation_selection_members_pending_owner_idx')")),3);
  // Simulate an independently held refresh lock. Only substitute the lock
  // primitives in the installed function; the production control flow is real.
  await db.exec(`create function test_try_lock(bigint) returns boolean language sql as $$select current_setting('test.lock')::boolean$$;
    create function test_block_lock(bigint) returns void language plpgsql as $$begin return;end$$;
    select set_config('test.lock','false',false);`);
  let installed=await scalar("select pg_get_functiondef('get_current_game_objective_summary_cached()'::regprocedure)");
  installed=installed.replaceAll('pg_catalog.pg_try_advisory_xact_lock','public.test_try_lock').replaceAll('pg_catalog.pg_advisory_xact_lock','public.test_block_lock');
  await db.exec(installed);
  await db.exec("update game_objective_summary_cache set ready_count=1,computed_at=now()-interval '70 seconds'");
  const calls=await scalar('select last_value from progress_calls');
  check(await summary(),[{total_count:4,ready_count:1}]);
  check(await scalar('select last_value from progress_calls'),calls);
  check(await scalar("select computed_at < now()-interval '60 seconds' from game_objective_summary_cache"),true);
  await db.exec("update game_objective_summary_cache set computed_at=now()-interval '125 seconds'");
  check(await summary(),before);
  check(Number(await scalar('select last_value from progress_calls'))-Number(calls),2);
  // Every context dimension must prohibit stale reuse, even during contention.
  for (const assignment of ["team_id='"+id(99)+"'","season_id='"+id(99)+"'","season_day_number=8","experience_points=11"]) {
    await db.exec(`update game_objective_summary_cache set ready_count=1,computed_at=now()-interval '70 seconds',${assignment}`);
    check(await summary(),before);
  }
  await db.exec("update game_objective_summary_cache set ready_count=1,computed_at=now()-interval '70 seconds';update game_objective_claims set claimed_at=now()");
  check(Number(await scalar('select count(*) from game_objective_summary_cache')),0);
  check(await summary(),before);
  await db.exec(`select set_config('test.user','${id(2)}',false)`);
  check(await summary(),[{total_count:4,ready_count:3}]);
  await db.exec("select set_config('test.user','',false)");check(await summary(),[]);
  await db.exec(read('20261017090000_bound_training_history_and_objective_refresh')); // idempotent
  check((await health()).status,'insufficient_data');
  const samples=async(source,metric,value,count,ok=true,age='0 seconds')=>db.exec(`insert into performance_samples(source,route,metric,value,ok,recorded_at)
    select '${source}','/jeu','${metric}',${value},${ok},now()-interval '${age}' from generate_series(1,${count})`);
  await samples('rpc','duration',3000,9);check((await health()).healthy,true);
  await samples('rpc','duration',3000,1);check((await health()).status,'degraded');
  check((await health()).breaches[0].p95Ms,3000);
  await db.exec('truncate performance_samples');await samples('rpc','duration',100,17);await samples('rpc','duration',100,3,false);
  check((await health()).breaches[0].errors,3);
  await db.exec('truncate performance_samples');await samples('rpc','duration',3000,20,false,'16 minutes');
  check((await health()).sampleCount,0);
  for (const [metric,value] of [['LCP',4500],['INP',600],['TTFB',2000]]) {
    await db.exec('truncate performance_samples');await samples('web',metric,value,10);
    check((await health()).healthy,false);
  }
  await db.exec('truncate performance_samples');await samples('web','CLS',1,10);
  check((await health()).healthy,true);
  await db.exec('truncate performance_samples');await samples('rpc','duration',100,6000);
  check((await health()).sampleCount,5000);
  check(await scalar("select has_function_privilege('authenticated','get_recent_site_performance_health()','execute')"),false);
  check(await scalar("select has_function_privilege('service_role','get_recent_site_performance_health()','execute')"),true);
  console.log(JSON.stringify({isolated:true,checks,productionFixtures:false,allPassed:true}));
} catch(error) {console.error(JSON.stringify({error:error.message,where:error.where,checks}));process.exitCode=1;}
finally {await db.close();}
