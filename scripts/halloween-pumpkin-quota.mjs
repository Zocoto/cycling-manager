// Capture read-only schema, or install only the isolated-tested quota migration.
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
if(!['--capture','--apply-reviewed-fix'].includes(process.argv[2]) || process.argv.length!==3 ||
  readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg') throw new Error('Exact mode and project required');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const call=args=>execFileSync(binary,args,{encoding:'utf8',timeout:30000,maxBuffer:200000});
const query=sql=>{const raw=call(['db','query','--linked',sql,'--output','json']);return JSON.parse(raw.slice(raw.indexOf('{'))).rows;};
const ro=sql=>`begin read only;set local statement_timeout='4s';set local application_name='pumpkin-quota-delivery';${sql};commit;`;
const signatures=['public.halloween_action(uuid,uuid,text,jsonb)','public.halloween_gift(text,uuid,text,jsonb)','public.halloween_credit(text,uuid,text,integer)'];
const definitions=()=>query(ro(`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p where p.oid in (${signatures.map(s=>`'${s}'::regprocedure`).join(',')})`));
const file='artifacts/.tmp-pumpkin-quota/functions.json';
if(process.argv[2]==='--capture') {
  const rows=definitions(); if(rows.length!==3) throw new Error('Incomplete capture');
  mkdirSync('artifacts/.tmp-pumpkin-quota',{recursive:true});writeFileSync(file,JSON.stringify(rows,null,2));
  console.log(JSON.stringify(rows.map(r=>({signature:r.signature,bytes:r.definition.length}))));
} else {
  const version='20261016170000';
  const before=query(ro(`select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
    (select max_obtained is null from public.halloween_catalog where id='pumpkin-juice') installed`))[0];
  if(before.recorded&&!before.installed) throw new Error('History/schema mismatch');
  if(!before.installed){
    const expected=JSON.parse(readFileSync(file,'utf8')),live=definitions();
    if(live.length!==expected.length || live.some(r=>r.definition!==expected.find(e=>e.signature===r.signature)?.definition)) throw new Error('Function drift since isolated tests');
    console.log(call(['db','query','--linked','--file',`supabase/migrations/${version}_unlimit_halloween_pumpkin_juice.sql`,'--output','json']));
  }
  const check=query(ro(`select 1 database_ok,price,max_obtained,effect,
    position('if v_item.max_obtained is not null and coalesce' in pg_get_functiondef('public.halloween_action(uuid,uuid,text,jsonb)'::regprocedure))>0 guard_installed,
    (select count(*)::int from public.halloween_catalog where max_obtained is null and id<>'pumpkin-juice') other_uncapped
    from public.halloween_catalog where id='pumpkin-juice'`))[0];
  if(check.database_ok!==1 || check.price!==12 || check.max_obtained!==null || !check.guard_installed || check.other_uncapped!==0) throw new Error(`Verification failed: ${JSON.stringify(check)}`);
  if(!before.recorded) console.log(call(['migration','repair',version,'--status','applied','--linked','--yes']));
  console.log(JSON.stringify({version,...check,walletsRewritten:false,purchasesExecuted:false}));
}
