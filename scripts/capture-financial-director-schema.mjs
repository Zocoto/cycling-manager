// Read-only production schema capture. No player rows or gameplay mutations.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const signatures=[
  'public.create_daily_staff_market(date,jsonb)', 'public.append_staff_market_wave(date,integer,jsonb)',
  'public.redeem_custom_staff_recruitment_reward(uuid,uuid,uuid,text,text,text,integer,text,text,text)',
  'public.calculate_staff_salary(text,integer)', 'public.start_current_team_staff_academy_training(uuid,text)',
];
const sql=`begin read only; set local application_name='financial-director-schema-capture'; set local statement_timeout='4s';
select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p
where p.oid in (${signatures.map(s=>`'${s}'::regprocedure`).join(',')}); commit;`;
const raw=execFileSync(binary,['db','query','--linked',sql,'--output','json'],{encoding:'utf8',timeout:30000,maxBuffer:300000});
const rows=JSON.parse(raw.slice(raw.indexOf('{'))).rows;
if(rows.length!==signatures.length) throw new Error('Incomplete schema capture');
mkdirSync('artifacts/.tmp-financial-director',{recursive:true});
writeFileSync('artifacts/.tmp-financial-director/functions.json',JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows.map(r=>({signature:r.signature,bytes:r.definition.length}))));
