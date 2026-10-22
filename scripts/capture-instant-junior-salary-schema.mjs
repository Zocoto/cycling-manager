// Read-only, bounded, sequential diagnostics. Never calls gameplay RPCs.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const signatures=[
  'public.redeem_instant_youth_promotion_reward(uuid,uuid)',
  'public.renew_current_team_rider_until(uuid,integer)',
  'public.renew_current_team_rider(uuid)',
  'public.sync_rider_salary_installments(uuid)',
  'public.apply_homegrown_salary_discount_to_contract()',
  'public.calculate_rider_season_salary(uuid,uuid)',
  'public.calculate_rider_season_salary_quotes(uuid[],uuid)',
];
const query=sql=>{
  const raw=execFileSync(binary,['db','query','--linked',`begin read only;set local application_name='instant-junior-salary-capture';set local statement_timeout='4s';set local lock_timeout='500ms';${sql}commit;`,'--output','json'],{encoding:'utf8',timeout:15000,maxBuffer:250000,stdio:['ignore','pipe','pipe']});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
};
const folder='artifacts/.tmp-instant-junior-salary';mkdirSync(folder,{recursive:true});
const previous=process.argv.includes('--supplement')&&existsSync(`${folder}/schema-before.json`)?JSON.parse(readFileSync(`${folder}/schema-before.json`,'utf8')):null;
const functions=previous?.functions??[];
for(const signature of signatures){
  if(functions.some(f=>f.signature===signature.replace('public.','')))continue;
  functions.push(...query(`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,md5(pg_get_functiondef(p.oid)) hash,p.proacl::text acl,p.proowner::regrole::text owner from pg_proc p where p.oid=to_regprocedure('${signature}');`));
}
const triggers=previous?.triggers??query("select t.tgname,pg_get_triggerdef(t.oid) definition,p.oid::regprocedure::text function,pg_get_functiondef(p.oid) function_definition from pg_trigger t join pg_proc p on p.oid=t.tgfoid where t.tgrelid='public.rider_contracts'::regclass and not t.tgisinternal order by t.tgname limit 20;");
const columns=query("select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name in ('rider_contracts','team_finance_transactions','youth_development_notifications') order by table_name,ordinal_position;");
const affected=query("select contract.id,contract.rider_id,contract.team_id,contract.status,contract.acquisition_type,contract.salary_per_season,contract.start_season_id,contract.end_season_id,contract.joined_day_number from public.youth_academy_riders academy join public.youth_development_notifications notice on notice.team_id=academy.team_id and notice.source_reference='instant-youth-promotion:'||academy.id::text join public.rider_contracts contract on contract.rider_id=academy.promoted_rider_id and contract.team_id=academy.team_id where academy.status='promoted' and contract.status in ('active','planned') and contract.acquisition_type in ('academy','renewal') and contract.salary_per_season<=0 order by contract.id limit 201;");
writeFileSync(`${folder}/schema-before.json`,JSON.stringify({functions,triggers,columns,affected},null,2));
console.log(JSON.stringify({readOnly:true,functions:functions.map(({signature,hash})=>({signature,hash})),triggers:triggers.map(t=>t.tgname),columns:columns.length,affectedContracts:affected.length,truncated:affected.length>200}));
