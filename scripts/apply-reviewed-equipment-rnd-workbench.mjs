// Scoped reviewed migration only. No research launch, settlement or fixture.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const version='20261014110000',name='equipment_rnd_focus_and_audit';
if(process.argv[2]!=='--apply-reviewed-fix'||process.argv.length!==3||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg') throw Error('Exact reviewed-fix flag and expected linked project required.');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
function query(sql,file=false){const raw=execFileSync(binary,['db','query','--linked',...(file?['--file',sql]:[sql]),'--output','json'],{encoding:'utf8',maxBuffer:100000,timeout:30000});return JSON.parse(raw.slice(raw.indexOf('{'))).rows[0];}
const check=`begin read only;set local statement_timeout='4s';
  select (select name from supabase_migrations.schema_migrations where version='${version}') receipt,
    position('equipment_rnd_focus_audit_v1' in pg_get_functiondef('public.apply_federal_staff_to_equipment_rnd()'::regprocedure))>0
    and position('equipment_rnd_focus_audit_v1' in pg_get_functiondef('public.settle_due_equipment_rnd_projects()'::regprocedure))>0
    and to_regprocedure('public.start_current_team_equipment_rnd(uuid,uuid,text,text)') is not null installed,
    md5(pg_get_functiondef('public.start_current_team_equipment_rnd(uuid,uuid)'::regprocedure)) launch_hash,
    md5(pg_get_functiondef('public.start_current_team_equipment_rnd(uuid,uuid,text)'::regprocedure)) named_hash,
    md5(pg_get_functiondef('public.calculate_equipment_rnd_duration_days(jsonb,integer,boolean,boolean)'::regprocedure)) duration_hash,
    md5(pg_get_functiondef('public.settle_due_training_sessions()'::regprocedure)) training_hash;
  commit;`;
const before=query(check);
if(before.receipt && (before.receipt!==name||!before.installed)) throw Error('Receipt mismatch; inspect before retrying.');
if(!before.receipt){
  const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),`../supabase/migrations/${version}_${name}.sql`),sql=readFileSync(file,'utf8');
  if(!/commit;\s*$/.test(sql))throw Error('Atomic migration required.');
  if(!before.installed)query(file,true);
  query(`begin;set local lock_timeout='3s';set local statement_timeout='8s';insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]) on conflict(version) do nothing;commit;`);
}
const after=query(check);
if(after.receipt!==name||!after.installed||['launch_hash','named_hash','duration_hash','training_hash'].some(key=>after[key]!==before[key]))throw Error('Post-migration verification failed.');
console.log(JSON.stringify({version,installed:true,recorded:true,gameplayFunctionsRun:false,inventoryAndExistingProjectsUntouched:true,launchSafetyAndTrainingPreserved:true}));
