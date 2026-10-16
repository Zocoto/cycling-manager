import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const signatures=[
 'public.ensure_global_olympic_event(uuid)',
 'public.get_federation_selection_rider_limit(uuid,uuid,text)',
 'public.federation_selection_slot_is_available(text,integer)',
 'public.federation_selection_slot_label(text,text,integer)',
 'public.get_federation_professional_event_profile_segments(text,integer)',
 'public.federation_selection_automatic_callup_is_due(uuid,text,text,timestamptz,timestamptz)',
 'public.get_national_federation_selection_target(uuid,uuid,text)',
 'public.get_national_federation_selection_schedule(uuid,uuid)',
 'public.get_national_federation_nations_cup_standings(uuid)',
 'public.guard_olympic_roster()',
 'public.save_national_federation_preselection(text,text,uuid[])',
 'public.prepare_due_automatic_federation_professional_lineups(timestamptz)',
 'public.refill_national_federation_professional_selection(uuid,timestamptz)',
];
const sql=`begin read only;set local application_name='olympic-itt-schema-capture';set local statement_timeout='4s';
select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p
where p.oid in (${signatures.map(s=>`'${s}'::regprocedure`).join(',')});commit;`;
const raw=execFileSync(binary,['db','query','--linked',sql,'--output','json'],{encoding:'utf8',timeout:30000,maxBuffer:300000});
const rows=JSON.parse(raw.slice(raw.indexOf('{'))).rows;
if(rows.length!==signatures.length) throw new Error('Incomplete capture');
mkdirSync('artifacts/.tmp-olympic-itt',{recursive:true});
writeFileSync('artifacts/.tmp-olympic-itt/functions.json',JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows.map(r=>({signature:r.signature,bytes:r.definition.length}))));
