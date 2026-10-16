// Read-only, bounded incident snapshot. Never performs catch-up or changes gameplay.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
let sql = `begin read only;
set local application_name='incident-audit-20261016';
set local statement_timeout='3s';set local lock_timeout='500ms';
select jsonb_build_object('checked_at',now(),'database_started_at',pg_postmaster_start_time(),
 'max_connections',current_setting('max_connections'),'work_mem',current_setting('work_mem'),
 'activity',(select coalesce(jsonb_agg(a),'[]') from (select pid,application_name,state,wait_event_type,wait_event,
 round(extract(epoch from clock_timestamp()-query_start)) seconds,
 pg_blocking_pids(pid) blockers,left(regexp_replace(query,'''[^'']*''','?', 'g'),220) query
 from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and state<>'idle'
 order by query_start limit 12) a),
 'maintenance',(select jsonb_agg(m) from (select task_key,status,last_started_at,last_succeeded_at,last_failed_at,last_duration_ms,left(last_error,220) last_error
 from public.game_maintenance_runs order by task_key limit 10) m)) snapshot;
rollback;`;
if (process.argv[2] === '--functions') sql = `begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';
select p.proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in('get_current_director_federation_callups','get_national_federation_selection_schedule','get_current_game_objective_summary_cached','respond_to_national_federation_preselection','publish_national_federation_preselection') limit 6;rollback;`;
try {
 const output = execFileSync(binary, ['db','query','--linked',sql,'--output','json'],
  {encoding:'utf8',timeout:15000,maxBuffer:30000});
 if (process.argv[2] === '--functions') {
  mkdirSync('.tmp-incident-20261016',{recursive:true});
  writeFileSync('.tmp-incident-20261016/functions.json',output);
  console.log('Saved bounded function definitions for offline analysis.');
 } else console.log(output);
} catch (error) {
 console.error(String(error.stderr || error.message).slice(0,1000));
 process.exitCode=1;
}
