// Task migration only. No fixture, benchmark, gameplay mutation or catch-up.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261016160000';
if(process.argv.length!==3||process.argv[2]!=='--apply-reviewed-fix'||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw new Error('Exact reviewed flag/project required');
const call=(args,timeout=15000)=>execFileSync(binary,args,{encoding:'utf8',timeout,maxBuffer:35000});
const query=sql=>{const raw=call(['db','query','--linked',`begin read only;set local application_name='callup-performance-delivery-20261016';set local statement_timeout='3s';set local lock_timeout='500ms';${sql};rollback;`,'--output','json']);return JSON.parse(raw.slice(raw.indexOf('{'))).rows;};
const row=query(`select pg_get_functiondef('public.get_current_director_federation_callups()'::regprocedure) definition,
 pg_get_functiondef('public.publish_national_federation_preselection(text,text)'::regprocedure) publish_definition,
 pg_get_functiondef('public.respond_to_national_federation_preselection(uuid,boolean)'::regprocedure) response_definition,
 exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded`)[0];
if(!row.definition.includes('incident_callup_schedule_once_v1')) {
 const captured=JSON.parse(readFileSync('.tmp-incident-20261016/functions.json','utf8')).rows.find(r=>r.proname==='get_current_director_federation_callups').definition;
 if(row.recorded||row.definition!==captured)throw new Error('Function changed since audit: review required');
 const functions=JSON.parse(readFileSync('.tmp-incident-20261016/functions.json','utf8')).rows;
 if(row.publish_definition!==functions.find(r=>r.proname==='publish_national_federation_preselection')?.definition
  ||row.response_definition!==functions.find(r=>r.proname==='respond_to_national_federation_preselection')?.definition
  ||!row.response_definition.includes('perform public.sync_national_federation_championship_lineup(v_list.id);'))throw new Error('Publication/response drift: review required');
 call(['db','query','--linked','--file',`supabase/migrations/${version}_bound_federation_callup_schedule_work.sql`,'--output','json'],20000);
}
const health=query(`select 1 database_ok,
 position('incident_callup_schedule_once_v1' in pg_get_functiondef('public.get_current_director_federation_callups()'::regprocedure))>0 optimization_installed,
 position('incident_publish_sync_once_v1' in pg_get_functiondef('public.publish_national_federation_preselection(text,text)'::regprocedure))>0 publication_sync_installed,
 has_function_privilege('authenticated','public.get_current_director_federation_callups()','execute') player_can_read,
 has_function_privilege('anon','public.get_current_director_federation_callups()','execute') anonymous_can_read`)[0];
if(health.database_ok!==1||!health.optimization_installed||!health.publication_sync_installed||!health.player_can_read||health.anonymous_can_read)throw new Error(`Integrity mismatch: ${JSON.stringify(health)}`);
if(!row.recorded)call(['migration','repair',version,'--status','applied','--linked','--yes']);
console.log(JSON.stringify({migration:version,...health}));
