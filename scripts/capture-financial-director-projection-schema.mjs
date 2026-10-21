// Read-only catalog capture for reviewed patches and isolated tests. No player rows.
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
if(readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Unexpected linked project');
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const signatures=['public.get_current_team_purchase_financial_risk(numeric)','private.restock_fan_club_shop(uuid,integer)',
  'public.settle_due_financial_director_income()','private.credit_financial_director_salary_savings()',
  'private.credit_financial_director_transaction_bonus()'];
const sql=`begin read only;set local application_name='df-projection-schema-review';set local statement_timeout='4s';set local lock_timeout='500ms';
select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,md5(pg_get_functiondef(p.oid)) definition_hash,
p.proowner::regrole::text owner,p.proacl::text acl,
(select coalesce(jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgname),'[]'::jsonb)
 from pg_trigger t where t.tgfoid=p.oid and not t.tgisinternal) triggers
from pg_proc p where p.oid in (${signatures.map(s=>`'${s}'::regprocedure`).join(',')});commit;`;
const raw=execFileSync(binary,['db','query','--linked',sql,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:200000});
const rows=JSON.parse(raw.slice(raw.indexOf('{'))).rows;
if(rows.length!==signatures.length)throw Error('Incomplete baseline');
mkdirSync('artifacts/.tmp-financial-director-projection',{recursive:true});
writeFileSync('artifacts/.tmp-financial-director-projection/consistency-functions.json',JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows.map(({signature,definition_hash,owner})=>({signature,definition_hash,owner}))));
