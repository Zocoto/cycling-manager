// Bounded catalog/statistics reads only. Never invokes gameplay functions.
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const mode=process.argv[2];
if(!['schema','metrics','history'].includes(mode))throw new Error('Choose schema, metrics or history');
const sql=mode==='schema'?`select 'function' kind,p.oid::regprocedure::text name,pg_get_functiondef(p.oid) definition
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and
 (p.proname like 'calculate_game_objective_progress%' or p.proname in('was_rider_contracted_by_team_in_season','get_team_roster_commitment_count','get_current_game_objectives_pre_prospective','get_current_dashboard_assistant_summary','get_current_game_objective_summary_cached')))
 or (n.nspname='private' and p.proname='get_team_roster_projection') limit 21`
 :mode==='history'?`select version,name from supabase_migrations.schema_migrations where version>='20261016000000' order by version limit 40`
 :`select queryid::text,calls,round(total_exec_time::numeric,2) total_ms,round(mean_exec_time::numeric,2) mean_ms,
 shared_blks_hit,shared_blks_read,temp_blks_read,temp_blks_written,jit_functions,round(jit_generation_time::numeric,2) jit_generation_ms,
 left(query,280) query from extensions.pg_stat_statements where query like '%get_current_game_objective%' or query like '%get_current_dashboard_assistant_summary%' order by total_exec_time desc limit 8`;
const raw=execFileSync(binary,['db','query','--linked',`begin read only;set local application_name='query-workload-audit-20261016';set local statement_timeout='3s';set local lock_timeout='500ms';${sql};rollback;`,'--output','json'],{encoding:'utf8',timeout:15000,maxBuffer:500000});
const rows=JSON.parse(raw.slice(raw.indexOf('{'))).rows;
mkdirSync('.tmp-query-workload-20261016',{recursive:true});
writeFileSync(`.tmp-query-workload-20261016/${mode}.json`,JSON.stringify(rows,null,2));
console.log(mode==='schema'?rows.map(r=>({name:r.name,characters:r.definition.length})):rows);
