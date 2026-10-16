// Production delivery: task migration only, never fixtures or historic rewards.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261016150000',file=`supabase/migrations/${version}_rebalance_objectives_and_social_achievements.sql`;
if(process.argv.length!==3||process.argv[2]!=='--apply-reviewed-fix'||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw new Error('Exact reviewed flag/project required');
const call=(args,timeout=15000)=>execFileSync(binary,args,{encoding:'utf8',timeout,maxBuffer:500000});
const query=sql=>{const raw=call(['db','query','--linked',sql,'--output','json']);return JSON.parse(raw.slice(raw.indexOf('{'))).rows;};
const ro=sql=>`begin read only;set local application_name='objective-rebalance-delivery-20261016';set local statement_timeout='5s';set local lock_timeout='1s';${sql};rollback;`;
const initial=query(ro(`select 1 database_ok,to_regclass('private.social_achievement_epoch') is not null installed,
 exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded`))[0];
if(initial.recorded&&!initial.installed)throw new Error('History/schema mismatch: inspect before retrying');
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
if(!initial.installed){
 const expected=JSON.parse(readFileSync('.tmp-objectives-20261016/catalog.json','utf8')).sort((a,b)=>a.objective_key.localeCompare(b.objective_key));
 const current=query(ro(`select to_jsonb(d) definition from public.game_objective_definitions d order by objective_key limit 300`)).map(r=>r.definition).sort((a,b)=>a.objective_key.localeCompare(b.objective_key));
 if(canonical(expected)!==canonical(current))throw new Error('Catalogue drift since isolated audit: review required');
 const functions=query(ro(`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p where p.oid in(
 'public.calculate_game_objective_progress(text,uuid,uuid,numeric)'::regprocedure,'public.claim_current_game_objective(text)'::regprocedure)`));
 const schema=JSON.parse(readFileSync('.tmp-objectives-20261016/schema.json','utf8'));
 if(functions.length!==2||functions.some(r=>r.definition!==schema.find(s=>s.signature===r.signature)?.definition))throw new Error('Claim/progress drift: review required');
 call(['db','query','--linked','--file',file,'--output','json'],35000);
 console.log('Reviewed catalogue/trigger migration committed. No retroactive claims or reward grants.');
}
const health=query(ro(`select 1 database_ok,
 (select count(*)::int from public.game_objective_definitions where is_active) active_objectives,
 (select count(*)::int from public.game_objective_definitions where metric_key like 'future_social_%') new_objectives,
 (select activated_at from private.social_achievement_epoch) activated_at,
 (select count(*)::int from private.objective_catalog_audit_20261016) audited_definitions,
 (select count(*)::int from (select lag(reward_cash) over(partition by metric_key order by target_value) previous,reward_cash from public.game_objective_definitions where is_active) d where reward_cash<previous) decreasing_cash_ladders,
 (select count(*)::int from private.objective_catalog_audit_20261016 where before_definition->'reward_inventory_item_key' is distinct from after_definition->'reward_inventory_item_key'
 or before_definition->'reward_equipment_catalog_key' is distinct from after_definition->'reward_equipment_catalog_key'
 or before_definition->'reward_random_special_ability' is distinct from after_definition->'reward_random_special_ability') changed_item_rewards,
 has_function_privilege('authenticated','private.record_social_achievement(uuid,text,text,timestamptz)','execute') player_can_forge_progress`))[0];
if(health.database_ok!==1||health.active_objectives!==202||health.new_objectives!==21||health.audited_definitions!==182||health.decreasing_cash_ladders||health.changed_item_rewards||health.player_can_forge_progress)throw new Error(`Integrity mismatch: ${JSON.stringify(health)}`);
if(!initial.recorded)call(['migration','repair',version,'--status','applied','--linked','--yes']);
console.log(JSON.stringify({migration:version,...health}));
