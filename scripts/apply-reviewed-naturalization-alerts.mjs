// Review/apply only this migration. Diagnostics are read-only, sequential and <=5s.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
if(readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Unexpected linked project');
const version='20261022100000';
const snapshot=new URL('../.codex-tools/naturalization-alerts-before-20261022.json',import.meta.url);
const call=(args,timeout=15000)=>execFileSync(binary,args,{encoding:'utf8',timeout,maxBuffer:100000});
const inspect=()=>{
 const raw=call(['db','query','--linked',`begin read only;set local application_name='naturalization-assistant-delivery';set local statement_timeout='5s';set local lock_timeout='500ms';
 select 1 as database_ok,md5(pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure)) as dashboard_hash,
 md5(pg_get_functiondef('public.get_team_professional_naturalization_days(uuid)'::regprocedure)||pg_get_functiondef('public.get_team_youth_naturalization_days(uuid)'::regprocedure)||pg_get_functiondef('public.get_rider_country_progress_days(uuid,uuid,uuid,integer)'::regprocedure)) as rules_hash,
 position('naturalizationAlerts' in pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure))>0 as alert_metadata,
 to_regclass('private.dashboard_naturalization_dismissals') is not null as preferences_table,
 to_regprocedure('private.get_dashboard_naturalization_alerts(uuid,uuid,uuid,integer,integer)') is not null as helper,
 to_regprocedure('public.ignore_current_naturalization_alert(text,uuid,uuid)') is not null as ignore_action,
 coalesce(has_function_privilege('authenticated',to_regprocedure('public.ignore_current_naturalization_alert(text,uuid,uuid)'),'execute'),false) as ignore_player_access,
 coalesce(has_function_privilege('anon',to_regprocedure('public.ignore_current_naturalization_alert(text,uuid,uuid)'),'execute'),false) as ignore_anonymous_access,
 coalesce(has_function_privilege('authenticated',to_regprocedure('private.get_dashboard_naturalization_alerts(uuid,uuid,uuid,integer,integer)'),'execute'),false) as private_helper_access,
 coalesce(has_table_privilege('authenticated',to_regclass('private.dashboard_naturalization_dismissals'),'select'),false) as private_table_access,
 coalesce((select relrowsecurity from pg_class where oid=to_regclass('private.dashboard_naturalization_dismissals')),false) as preferences_rls,
 has_function_privilege('authenticated','public.get_current_dashboard_assistant_summary()','execute') as player_access,
 has_function_privilege('anon','public.get_current_dashboard_assistant_summary()','execute') as anonymous_access,
 exists(select 1 from supabase_migrations.schema_migrations where version='${version}') as recorded;
 rollback;`,'--output','json']);return JSON.parse(raw.slice(raw.indexOf('{'))).rows[0];
};
const installed=s=>s.database_ok===1&&s.alert_metadata&&s.preferences_table&&s.helper&&s.ignore_action&&s.player_access&&!s.anonymous_access
 &&s.ignore_player_access&&!s.ignore_anonymous_access&&!s.private_helper_access&&!s.private_table_access&&s.preferences_rls;
const mode=process.argv[2];
if(mode==='--capture'){
 const state=inspect();writeFileSync(snapshot,JSON.stringify(state,null,2));console.log(JSON.stringify(state));
}else if(mode==='--verify'){
 const state=inspect();console.log(JSON.stringify(state));if(!installed(state)||!state.recorded)process.exitCode=1;
}else if(mode==='--apply-reviewed-fix'){
 const expected=JSON.parse(readFileSync(snapshot,'utf8'));const before=inspect();
 if(before.rules_hash!==expected.rules_hash)throw Error('Naturalization rules changed since review; stop');
 if(before.recorded&&!installed(before))throw Error('Schema/history mismatch');
 if(!installed(before)){
   if(before.dashboard_hash!==expected.dashboard_hash||before.alert_metadata||before.preferences_table||before.helper||before.ignore_action)throw Error('Schema drift; stop');
   call(['db','query','--linked','--file',path.resolve(`supabase/migrations/${version}_add_naturalization_assistant_alerts.sql`),'--output','json'],20000);
 }
 const after=inspect();if(!installed(after)||after.rules_hash!==expected.rules_hash)throw Error(`Post-install check failed: ${JSON.stringify(after)}`);
 if(!after.recorded)call(['migration','repair',version,'--status','applied','--linked','--yes']);
 const final=inspect();if(!final.recorded)throw Error('Missing migration receipt');
 console.log(JSON.stringify({...final,productionFixtures:false,naturalizationRulesModified:false,playerNationalitiesModified:false}));
}else throw Error('Use --capture, --verify or --apply-reviewed-fix');
