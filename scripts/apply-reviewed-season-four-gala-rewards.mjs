// Install preparation only. Never calls the reward settlement or activates an item.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';
const mode=process.argv[2];
if(process.argv.length!==3||!['--inspect','--apply-reviewed-preparation'].includes(mode)||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Exact mode and linked project required');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261023120000',name='prepare_season_four_gala_rewards';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const md5=value=>createHash('md5').update(value).digest('hex');
const hash=md5(source),quote=value=>"'"+value.replaceAll("'","''")+"'";
const functionBody=(sql,name)=>{const start=sql.indexOf(`function public.${name}(`);if(start<0)throw Error('Missing reviewed routine');const body=sql.indexOf('$$',start)+2;return sql.slice(body,sql.indexOf('$$;',body)).replaceAll('\r','');};
const helper='get_daily_reward_training_multiplier_for_session';
const originalHash=md5(functionBody(readFileSync('supabase/migrations/20260801110000_create_daily_rewards.sql','utf8'),helper));
const expectedHash=md5(functionBody(source,helper));
if(!source.startsWith('begin;')||!source.includes("set local lock_timeout = '1s'")||!source.includes("set local statement_timeout = '5s'")||!/commit;\s*$/.test(source))throw Error('Unbounded migration');
const run=sql=>{
  mkdirSync('artifacts/gala-s4-rewards-20261023',{recursive:true});
  const file=path.resolve('artifacts/gala-s4-rewards-20261023/reviewed-command.sql');writeFileSync(file,sql);
  const raw=execFileSync(binary,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:18000,maxBuffer:50000});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
};
const inspect=()=>run(`begin read only;set local statement_timeout='4s';set local lock_timeout='500ms';set local application_name='gala-s4-preparation-inspect';
select 1 database_ok,exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
 (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') recorded_hash,
 (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid='public.${helper}(uuid,uuid)'::regprocedure) training_body_hash,
 (select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.daily_reward_inventory'::regclass and conname='daily_reward_inventory_exactly_one_source') inventory_source_constraint,
 not has_table_privilege('authenticated','public.season_gala_registrations','insert') registrations_closed,
 (select jsonb_object_agg(signature,fingerprint) from (select oid::regprocedure::text signature,md5(replace(pg_get_functiondef(oid),chr(13),'')) fingerprint from pg_proc where oid in(
  to_regprocedure('public.redeem_current_daily_reward(uuid,uuid,text,text,uuid)'),
  to_regprocedure('public.redeem_current_daily_reward_without_high_performance_cap(uuid,uuid,text,text,uuid)'),
  to_regprocedure('public.settle_pcm_gala_rewards(uuid,jsonb)'),
  to_regprocedure('public.get_active_calendar_stage_equipment_effects(uuid[])'))) functions) unchanged_functions;
commit;`)[0];
const before=inspect();
if(mode==='--inspect'){console.log(JSON.stringify(before));process.exit(0);}
if(before.database_ok!==1||!before.registrations_closed||Object.keys(before.unchanged_functions??{}).length!==4)throw Error('Preflight health/access mismatch');
if(before.recorded&&before.recorded_hash!==hash)throw Error('Recorded migration differs: never replay');
if(!before.recorded){
  if(before.training_body_hash!==originalHash)throw Error('Training routine changed since review');
  const expected='CHECK ((num_nonnulls(source_claim_id, source_referral_reward_id, source_auction_compensation_id, source_longevity_trophy_reward_id, source_international_selection_compensation_id, source_race_incident_compensation_id) = 1))';
  if(before.inventory_source_constraint!==expected)throw Error('Inventory source shape changed since review');
  run(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(version)},${quote(name)},array[${quote(source)}]);\ncommit;`));
}
const after=inspect();
if(!after.recorded||after.recorded_hash!==hash||after.training_body_hash!==expectedHash||!after.registrations_closed||JSON.stringify(after.unchanged_functions)!==JSON.stringify(before.unchanged_functions))throw Error('Installation receipt mismatch');
const state=run(`begin read only;set local statement_timeout='4s';set local lock_timeout='500ms';select
 (select count(*)::int from public.season_gala_result_imports) imports,
 (select count(*)::int from public.season_gala_reward_grants) grants,
 (select count(*)::int from public.equipment_catalog_items where catalog_key like 'gala-s4-%' and acquisition_channel='event_reward') exclusive_items,
 not has_function_privilege('authenticated','public.settle_season_four_gala_results(text,jsonb)','execute') settlement_private,
 not has_function_privilege('anon','public.settle_season_four_gala_results(text,jsonb)','execute') anonymous_denied;commit;`)[0];
if(state.imports!==0||state.grants!==0||state.exclusive_items!==12||!state.settlement_private||!state.anonymous_denied)throw Error('Unexpected award or permission state; inspect before continuing');
const receipt={migration:version,...after,...state,playerRewardDistributionExecuted:false,registrationOpened:false};
writeFileSync('artifacts/gala-s4-rewards-20261023/installation-receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
