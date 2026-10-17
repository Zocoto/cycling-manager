// Applies only the reviewed availability fixes. No fixtures or gameplay calls.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
if (process.argv[2]!=='--apply-reviewed-fixes' || process.argv.length!==3
  || readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg') throw new Error('Exact flag and project required');
const call=(args,timeout=15000)=>execFileSync(binary,args,{encoding:'utf8',timeout,maxBuffer:80000});
const query=sql=>{const raw=call(['db','query','--linked',`begin read only;set local application_name='site-latency-verification-20261017';set local statement_timeout='4s';set local lock_timeout='1s';${sql};commit;`,'--output','json']);return JSON.parse(raw.slice(raw.indexOf('{'))).rows;};
const inspect=()=>query(`select replace(pg_get_functiondef(p.oid),chr(13),'') definition,p.proacl::text privileges,
  pg_get_userbyid(p.proowner) owner,p.proconfig settings,p.prorettype::text return_type
  from pg_proc p where oid='public.get_current_game_objective_summary_cached()'::regprocedure`)[0];
const initial=inspect();
if(!initial.definition.includes('objective_refresh_contention_v1')) assert.equal(createHash('sha256').update(initial.definition).digest('hex'),
  'e2e9274510e6401eb8983d99ed9c30b14bca8df359b01c522bbefec6882ad28a','Live objective cache changed since review');
for (const [version,name] of [['20261017090000','bound_training_history_and_objective_refresh'],['20261017091000','monitor_recent_site_latency']]) {
  const recorded=query(`select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded`)[0].recorded;
  if(!recorded) {
    call(['db','query','--linked','--file',`supabase/migrations/${version}_${name}.sql`,'--output','json'],20000);
    call(['migration','repair',version,'--status','applied','--linked','--yes']);
  }
  console.log(JSON.stringify({version,applied:true}));
}
const installed=inspect();
const metadata=row=>Object.fromEntries(Object.entries(row).filter(([key])=>key!=='definition'));
assert.deepEqual(metadata(installed),metadata(initial),'Cache function security or return type changed');
assert.ok(installed.definition.includes('objective_refresh_contention_v1'));
const indexes=query(`select indexname,indexdef from pg_indexes where schemaname='public'
  and indexname in('rider_training_sessions_completed_team_idx','rider_training_sessions_eligible_history_idx','federation_selection_members_pending_owner_idx')`);
assert.equal(indexes.length,3);console.log(JSON.stringify({indexes}));
console.log(JSON.stringify({health:query(`select 1 database_ok,
  (select count(*) from pg_stat_activity where pid<>pg_backend_pid() and application_name='site-latency-delivery-20261017' and state<>'idle') task_transactions_remaining,
  (select count(*) from pg_stat_activity where cardinality(pg_blocking_pids(pid))>0) blocked_sessions,
  public.get_recent_site_performance_health() performance`)[0]}));
