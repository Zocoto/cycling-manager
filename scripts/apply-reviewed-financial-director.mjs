// Apply only this reviewed feature migration. Never execute gameplay fixtures.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const version='20261016120000';
if(process.argv.length!==3 || process.argv[2]!=='--apply-reviewed-feature' ||
  readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg') throw new Error('Exact project and reviewed-feature flag required');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const call=(args,timeout=30000)=>execFileSync(binary,args,{encoding:'utf8',timeout,maxBuffer:300000});
const query=sql=>{const raw=call(['db','query','--linked',sql,'--output','json']);return JSON.parse(raw.slice(raw.indexOf('{'))).rows;};
const ro=sql=>`begin read only;set local application_name='financial-director-delivery';set local statement_timeout='4s';set local lock_timeout='1s';${sql};commit;`;
const status=()=>query(ro(`select 1 database_ok,to_regprocedure('public.settle_due_financial_director_income()') is not null installed,
  exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded`))[0];
const before=status();
if(before.recorded&&!before.installed) throw new Error('Schema/history mismatch');
const expected=JSON.parse(readFileSync('artifacts/.tmp-financial-director/functions.json','utf8'));
if(!before.installed){
  const live=query(ro(`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p
    where p.oid in (${expected.map(fn=>`'public.${fn.signature}'::regprocedure`).join(',')})`));
  if(live.length!==expected.length || live.some(fn=>fn.definition!==expected.find(e=>e.signature===fn.signature)?.definition)) throw new Error('Function drift since isolated tests: review before applying');
  console.log(call(['db','query','--linked','--file',`supabase/migrations/${version}_add_financial_director.sql`,'--output','json'],30000));
}
const health=query(ro(`select 1 database_ok,
  (select count(*)::int from public.staff_talent_catalog where role='financial_director' and is_active) affixes,
  (select count(*)::int from pg_trigger where not tgisinternal and tgenabled<>'D' and tgname in
    ('staff_contracts_financial_director_limit','financial_director_talent_capacity','financial_director_transaction_bonus')) guards,
  (select count(*)::int from pg_proc p where p.oid in (${expected.map(fn=>`'public.${fn.signature}'::regprocedure`).join(',')})
    and position('financial_director' in pg_get_functiondef(p.oid))>0) integrated_paths,
  has_function_privilege('authenticated','public.settle_due_financial_director_income()','EXECUTE') public_payout_access`))[0];
if(health.database_ok!==1 || health.affixes!==4 || health.guards!==3 || health.integrated_paths!==5 || health.public_payout_access) throw new Error(`Post-install verification failed: ${JSON.stringify(health)}`);
if(!before.recorded) console.log(call(['migration','repair',version,'--status','applied','--linked','--yes']));
if(!status().recorded) throw new Error('Missing migration receipt');
console.log(JSON.stringify({version,...health,fixturesRun:false,historicalGainsRewritten:false}));
