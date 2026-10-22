// Exact, reviewed presentation-only migration. No player actions or fixtures.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
if(readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Unexpected linked project');
const version='20261022090000';
const snapshot=new URL('../.codex-tools/passport-targets-before-20261022.json',import.meta.url);
const call=(args,timeout=15000)=>execFileSync(binary,args,{encoding:'utf8',timeout,maxBuffer:100000});
const inspect=()=>{
 const raw=call(['db','query','--linked',`begin read only;set local application_name='sporting-passport-targets-review';set local statement_timeout='5s';set local lock_timeout='500ms';
 select 1 as database_ok,md5(pg_get_functiondef('public.get_current_team_item_target_values()'::regprocedure)) as function_hash,
 position('canNaturalizeWithPassport' in pg_get_functiondef('public.get_current_team_item_target_values()'::regprocedure))>0 as passport_metadata,
 to_regclass('public.rider_national_titles_rider_id_idx') is not null as title_index,
 has_function_privilege('authenticated','public.get_current_team_item_target_values()','execute') as player_access,
 has_function_privilege('anon','public.get_current_team_item_target_values()','execute') as anonymous_access,
 exists(select 1 from supabase_migrations.schema_migrations where version='${version}') as recorded;
 rollback;`,'--output','json']);
 return JSON.parse(raw.slice(raw.indexOf('{'))).rows[0];
};
const installed=s=>s.database_ok===1&&s.passport_metadata&&s.title_index&&s.player_access&&!s.anonymous_access;
const mode=process.argv[2];
if(mode==='--capture'){
 const before=inspect();writeFileSync(snapshot,JSON.stringify(before,null,2));console.log(JSON.stringify(before));
}else if(mode==='--verify'){
 const state=inspect();console.log(JSON.stringify(state));if(!installed(state)||!state.recorded)process.exitCode=1;
}else if(mode==='--apply-reviewed-fix'){
 const expected=JSON.parse(readFileSync(snapshot,'utf8'));const before=inspect();
 if(before.recorded&&!installed(before))throw Error('Schema/history mismatch');
 if(!installed(before)){
   if(before.function_hash!==expected.function_hash||before.passport_metadata||!before.title_index)throw Error('Schema drift or missing lookup index; do not apply');
   call(['db','query','--linked','--file',path.resolve(`supabase/migrations/${version}_expose_sporting_passport_eligible_targets.sql`),'--output','json'],20000);
 }
 const after=inspect();if(!installed(after))throw Error(`Post-install check failed: ${JSON.stringify(after)}`);
 if(!after.recorded)call(['migration','repair',version,'--status','applied','--linked','--yes']);
 const final=inspect();if(!final.recorded)throw Error('Missing migration receipt');
 console.log(JSON.stringify({...final,productionFixtures:false,playerDataModified:false}));
}else throw Error('Use --capture, --verify or --apply-reviewed-fix');
