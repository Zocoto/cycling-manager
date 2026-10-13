// Deploy only the reviewed definitions. Never executes a gameplay action.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const version='20261013143000',name='bulk_halloween_inventory_consumables';
if(process.argv.length!==3 || process.argv[2]!=='--apply-reviewed-fix' || readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg') throw new Error('Exact reviewed-fix flag and linked project required.');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
function query(sql,file=false){const raw=execFileSync(binary,['db','query','--linked',...(file?['--file',sql]:[sql]),'--output','json'],{encoding:'utf8',maxBuffer:100000,timeout:30000});return JSON.parse(raw.slice(raw.indexOf('{')));}
const check=`begin read only;set local statement_timeout='4s';
  select (select name from supabase_migrations.schema_migrations where version='${version}') receipt,
    position('halloween_bulk_inventory_v1' in pg_get_functiondef('public.halloween_action(uuid,uuid,text,jsonb)'::regprocedure))>0
      and position('halloween_bulk_inventory_v1' in pg_get_functiondef('public.halloween_use_item(uuid,text,uuid)'::regprocedure))>0
      and to_regprocedure('public.halloween_use_items(uuid,text,uuid,integer)') is not null
      and to_regprocedure('public.get_current_halloween_item_target_values()') is not null installed,
    md5(pg_get_functiondef('public.halloween_gift(text,uuid,text,jsonb)'::regprocedure)) gift_hash,
    md5(pg_get_functiondef('public.get_current_halloween_state()'::regprocedure)) state_hash,
    md5(pg_get_functiondef('public.get_current_team_item_target_values()'::regprocedure)) ordinary_targets_hash,
    md5(pg_get_functiondef('public.settle_due_training_sessions()'::regprocedure)) training_hash,
    md5(pg_get_functiondef('public.settle_due_free_agent_training(integer)'::regprocedure)) free_agent_hash;
  commit;`;
const before=query(check).rows[0];
if(before.receipt && (before.receipt!==name || !before.installed)) throw new Error('Migration receipt mismatch; inspect before retrying.');
if(!before.receipt){
  const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),`../supabase/migrations/${version}_${name}.sql`),sql=readFileSync(file,'utf8');
  if(!/commit;\s*$/.test(sql)) throw new Error('Atomic reviewed migration required.');
  if(!before.installed) query(file,true);
  query(`begin;set local lock_timeout='3s';set local statement_timeout='8s';insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]) on conflict(version) do nothing;commit;`);
}
const after=query(check).rows[0];
if(after.receipt!==name || !after.installed || ['gift_hash','state_hash','ordinary_targets_hash','training_hash','free_agent_hash'].some(key=>before[key]!==after[key])) throw new Error('Verification failed; inspect before continuing.');
console.log(JSON.stringify({version,installed:true,existingInventoryPreserved:true,gameplayFunctionsRun:false,ordinaryItemsAndTrainingUnchanged:true}));
