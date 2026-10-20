// Apply only the reviewed migration; never call gameplay RPCs or create fixtures.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const linked=process.cwd();
if(readFileSync(`${linked}/supabase/.temp/project-ref`,'utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Unexpected linked project');
const version='20261020100000';
const snapshot=new URL('../.codex-tools/financial-director-before-20261020.json',import.meta.url);
const call=(args,timeout=15000)=>execFileSync(binary,args,{cwd:linked,encoding:'utf8',timeout,maxBuffer:100000});
const query=sql=>{const raw=call(['db','query','--linked',`begin read only;set local application_name='financial-director-salary-delivery';set local statement_timeout='5s';set local lock_timeout='500ms';${sql};rollback;`,'--output','json']);return JSON.parse(raw.slice(raw.indexOf('{'))).rows;};
const inspect=()=>query(`select 1 database_ok,md5(pg_get_functiondef('public.settle_due_financial_director_income()'::regprocedure)) income_hash,
 position('array[200,450,850,1600,2900]' in pg_get_functiondef('public.settle_due_financial_director_income()'::regprocedure))>0 progressive_base,
 exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
 (select count(*)::int from public.staff_talent_catalog where role='financial_director' and is_active) affixes,
 to_regclass('private.financial_director_salary_savings') is not null savings_table,
 exists(select 1 from pg_trigger where tgname='financial_director_salary_savings' and not tgisinternal and tgenabled<>'D') savings_trigger,
 has_function_privilege('authenticated','public.settle_due_financial_director_income()','execute') public_payout_access`)[0];
const mode=process.argv[2];
if(mode==='--capture'){
 const before=inspect();
 writeFileSync(snapshot,JSON.stringify(before,null,2));
 console.log(JSON.stringify(before));
}else if(mode==='--verify'){
 console.log(JSON.stringify(inspect()));
}else if(mode==='--apply-reviewed-fix'){
 const expected=JSON.parse(readFileSync(snapshot,'utf8'));
 const before=inspect();
 const installed=s=>s.database_ok===1&&s.progressive_base&&s.affixes===5&&s.savings_table&&s.savings_trigger&&!s.public_payout_access;
 if(before.recorded&&!installed(before))throw Error('Schema/history mismatch');
 if(!installed(before)){
   if(before.income_hash!==expected.income_hash||before.affixes!==4||before.savings_table||before.savings_trigger)throw Error('Schema drift since review; do not apply');
   call(['db','query','--linked','--file',path.resolve(`supabase/migrations/${version}_financial_director_base_income_and_salary_savings.sql`),'--output','json'],20000);
 }
 const after=inspect();
 if(!installed(after))throw Error(`Post-install check failed: ${JSON.stringify(after)}`);
 if(!after.recorded)call(['migration','repair',version,'--status','applied','--linked','--yes']);
 const final=inspect();if(!final.recorded)throw Error('Missing migration receipt');
 console.log(JSON.stringify({version,...final,productionFixtures:false,historicalGainsRewritten:false}));
}else throw Error('Use --capture, --verify or --apply-reviewed-fix');
