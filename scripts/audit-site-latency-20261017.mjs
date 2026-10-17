// Bounded, sequential, read-only diagnostics. No gameplay RPC is executed.
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const query=sql=>{
  const raw=execFileSync(binary,['db','query','--linked',`begin read only;set local application_name='site-latency-audit-20261017';set local statement_timeout='4s';set local lock_timeout='1s';${sql};commit;`,'--output','json'],{encoding:'utf8',timeout:15000,maxBuffer:250000});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
};
const mode=process.argv[2];
if(mode==='--functions'){
  const rows=query(`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'calculate_game_objective_progress%' or p.proname in ('get_current_dashboard_assistant_summary','get_current_game_objective_summary_cached',
      'get_current_game_objective_progress','get_current_dashboard_core_summary_v2','get_current_dashboard_core_summary',
      'run_transfer_market_maintenance','get_team_training_sessions','get_current_team_training_sessions')) order by p.proname`);
  mkdirSync('artifacts/.tmp-site-latency-20261017',{recursive:true});
  writeFileSync('artifacts/.tmp-site-latency-20261017/functions.json',JSON.stringify(rows,null,2));
  console.log(JSON.stringify(rows.map(r=>({signature:r.signature,bytes:r.definition.length}))));
}else if(mode==='--metrics'){
  console.log(JSON.stringify(query(`with recent as materialized(select route,metric,value,ok,source from public.performance_samples
    order by recorded_at desc limit 2000) select route,metric,count(*)::int samples,count(*) filter(where not ok)::int errors,
    round(percentile_cont(.50) within group(order by value)::numeric) p50,round(percentile_cont(.95) within group(order by value)::numeric) p95,
    round(max(value)::numeric) max_ms from recent where source='rpc' group by route,metric order by p95 desc limit 16`)));
}else if(mode==='--indexes'){
  console.log(JSON.stringify(query(`select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename in
    ('rider_training_sessions','game_objective_claims','game_objective_summary_cache','team_race_reward_events','race_rosters','rider_contracts') order by tablename,indexname`)));
}else if(mode==='--hotspots'){
  const [extension]=query(`select n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_stat_statements'`);
  if(!extension || !/^[a-z_]+$/.test(extension.nspname)) throw new Error('Statement statistics unavailable');
  console.log(JSON.stringify(query(`select calls,round(total_exec_time::numeric) total_ms,round(mean_exec_time::numeric) mean_ms,
    round(max_exec_time::numeric) max_ms,left(query,220) query from ${extension.nspname}.pg_stat_statements
    where dbid=(select oid from pg_database where datname=current_database()) and calls>5 and query not like '%pg_stat_statements%'
    order by total_exec_time desc limit 12`)));
}else if(mode==='--objective-plan'){
  console.log(JSON.stringify(query(`explain(format json) select count(*) from public.race_results result
    join public.race_rosters roster on roster.id=result.race_roster_id
    join public.race_registrations registration on registration.id=roster.race_registration_id
    join public.team_seasons ts on ts.id=registration.team_season_id
    where result.status='classified' and result.final_rank=1 and exists(select 1 from public.team_manager_assignments assignment
      where assignment.team_id=ts.team_id and assignment.sporting_director_id='8406962e-41b9-4181-a372-3d57043de3a8' and assignment.role='general_manager')`)));
}else if(mode==='--relation-sizes'){
  console.log(JSON.stringify(query(`select relname,n_live_tup,n_dead_tup,last_autoanalyze,last_autovacuum from pg_stat_user_tables
    where schemaname='public' and relname in('rider_training_sessions','race_results','stage_results','rider_condition_states','performance_samples')`)));
  console.log(JSON.stringify(query(`select tablename,indexname,indexdef from pg_indexes where schemaname='public'
    and tablename in('stage_results','race_results','career_achievement_progress') order by tablename,indexname`)));
}else if(mode==='--capacity'){
  console.log(JSON.stringify(query(`select state,wait_event_type,wait_event,count(*)::integer connections,
    max(round(extract(epoch from clock_timestamp()-query_start))) longest_seconds
    from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid()
    group by state,wait_event_type,wait_event order by count(*) desc limit 15`)));
  console.log(JSON.stringify(query(`select numbackends,deadlocks,temp_files,round(temp_bytes/1048576.0) temp_mb,
    blks_read,blks_hit,round(100.0*blks_hit/nullif(blks_read+blks_hit,0),2) cache_hit_percent,stats_reset
    from pg_stat_database where datname=current_database()`)));
  console.log(JSON.stringify(query(`select calls,round(total_exec_time::numeric) total_ms,round(mean_exec_time::numeric) mean_ms,
    shared_blks_read,shared_blks_hit,temp_blks_written,left(query,170) query from extensions.pg_stat_statements
    where dbid=(select oid from pg_database where datname=current_database()) and calls>5
      and query not like '%pg_stat_statements%' order by shared_blks_read desc limit 8`)));
}else if(mode==='--training-count-plan'){
  console.log(JSON.stringify(query(`explain(analyze,buffers,format json) select count(*)::integer
    from public.rider_training_sessions session where session.status='completed' and exists(
      select 1 from public.team_manager_assignments assignment where assignment.sporting_director_id='8406962e-41b9-4181-a372-3d57043de3a8'
      and assignment.role='general_manager' and assignment.team_id=session.team_id)`)));
}else if(mode==='--assistant-plan'){
  const rows=JSON.parse(readFileSync('artifacts/.tmp-site-latency-20261017/functions.json','utf8'));
  const body=rows.find(row=>row.signature==='get_current_dashboard_assistant_summary()').definition.split('AS $function$')[1].split('$function$')[0];
  const plan=query(`explain(format json) ${body}`)[0]['QUERY PLAN'][0];
  const nodes=[];
  const walk=node=>{nodes.push({node:node['Node Type'],relation:node['Relation Name'],index:node['Index Name'],cost:node['Total Cost'],rows:node['Plan Rows'],subplan:node['Subplan Name']});for(const child of node.Plans??[])walk(child);};
  walk(plan.Plan);console.log(JSON.stringify(nodes.sort((a,b)=>b.cost-a.cost).slice(0,30)));
}else if(mode==='--objective-costs'){
  console.log(JSON.stringify(query(`with context as materialized(
    select d.id,d.experience_points,a.team_id from public.sporting_directors d
    join public.team_manager_assignments a on a.sporting_director_id=d.id and a.status='active' and a.role='general_manager'
    where d.id='8406962e-41b9-4181-a372-3d57043de3a8' limit 1
  ), metrics as materialized(
    select distinct metric_key from public.game_objective_definitions definition cross join context
    where definition.is_active and not exists(select 1 from public.game_objective_claims claim
      where claim.sporting_director_id=context.id and claim.objective_key=definition.objective_key and claim.claimed_at is not null)
  ) select metric_key,value,round(extract(epoch from clock_timestamp()-started)*1000) duration_ms
    from(select metric_key,clock_timestamp() started,public.calculate_game_objective_progress(metric_key,context.id,context.team_id,context.experience_points) value
      from metrics cross join context offset 0) readings`)));
}else if(mode==='--planner-settings'){
  console.log(JSON.stringify(query(`select current_setting('jit') jit,current_setting('jit_above_cost') jit_above_cost,
    current_setting('max_connections') max_connections,current_setting('statement_timeout') statement_timeout`)));
  console.log(JSON.stringify(query(`select relname,reltuples::bigint estimated_rows,pg_relation_size(oid)::bigint bytes from pg_class
    where relnamespace='public'::regnamespace and relname in('rider_training_sessions','stage_results','race_results','team_finance_transactions')`)));
  console.log(JSON.stringify(query(`select calls,round(jit_generation_time::numeric) jit_generation_ms,round(jit_emission_time::numeric) jit_emission_ms,
    round(total_exec_time::numeric) total_ms,left(query,140) query from extensions.pg_stat_statements
    where query like '%get_current_game_objective_summary_cached%' or query like '%get_current_dashboard_assistant_summary%'
    order by total_exec_time desc limit 4`)));
}else throw new Error('Choose --functions, --metrics, --indexes or --hotspots');
