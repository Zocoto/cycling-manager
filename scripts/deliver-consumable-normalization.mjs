// Reviewed catalogue wording + two bulk RPCs only. No gameplay tests in production.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const mode=process.argv[2];
if(process.argv.length!==3||!['--preflight','--apply-reviewed','--verify'].includes(mode)||
 readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Exact mode and production project required.');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261105103000',name='normalize_ordinary_consumable_duplicates';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const hash=createHash('md5').update(source).digest('hex');
const directory='C:/Dev/artifacts/consumable-normalization-20261105';mkdirSync(directory,{recursive:true});
const groups=JSON.parse(readFileSync('lib/game/consumable-equivalences.json','utf8'));
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const query=sql=>{
 const file=path.join(directory,'delivery.sql');writeFileSync(file,sql);
 const raw=execFileSync(binary,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:100000});
 return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
};
const ro=sql=>query(`begin read only;set local statement_timeout='5s';set local lock_timeout='500ms';set local application_name='consumable-normalization-delivery';${sql};commit;`);
const catalog=()=>ro(`select 'daily_reward' source,reward_key key,name,description,effect_summary,icon_key,effect_kind kind,effect_payload payload,importance::text tier,is_active::text status from public.daily_reward_catalog
 union all select 'item',item_key,name,description,effect_summary,icon_key,category,effect_payload,rarity,status from public.inventory_catalog_items order by source,key limit 500`);
const signatures=[
 'public.redeem_current_daily_reward(uuid,uuid,text,text,uuid)',
 'public.redeem_current_daily_reward_without_high_performance_cap(uuid,uuid,text,text,uuid)',
 'public.use_current_team_inventory_item(uuid,uuid)',
 'public.claim_current_daily_reward(text)',
 'public.get_current_daily_reward_overview()',
 'public.store_daily_reward_equipment_in_inventory()',
 'public.redeem_injury_care_reward(uuid,uuid)',
 'public.redeem_construction_time_reward(uuid,uuid)',
 'public.redeem_instant_youth_promotion_reward(uuid,uuid)',
 'public.redeem_staff_level_boost_reward(uuid,uuid)',
 'public.activate_scouting_visibility_reward(uuid)',
];
const protectedFunctions=()=>ro(`select signature,md5(pg_get_functiondef(signature::regprocedure)) hash from unnest(array[${signatures.map(quote).join(',')}])signature order by signature`);
const receipt=()=>ro(`select name,md5(replace(statements[1],chr(13),''))hash from supabase_migrations.schema_migrations where version='${version}' limit 1`)[0];
const stamp=receipt();if(stamp)assert.deepEqual(stamp,{name,hash});
const beforeFile=path.join(directory,'before.json');
if(mode==='--preflight'){
 const current=catalog();
 for(const g of groups)for(const m of g.members){
  const row=current.find(r=>r.source===m.source&&r.key===m.key);
  assert.ok(row,`Missing ${m.source}:${m.key}`);assert.equal(row.kind,m.kind);assert.deepEqual(row.payload,m.payload);
 }
 if(!stamp)writeFileSync(beforeFile,JSON.stringify({catalog:current,functions:protectedFunctions()},null,2));
 console.log(JSON.stringify({readOnly:true,references:current.length,groups:groups.length,alreadyInstalled:!!stamp}));
}else{
 assert.ok(existsSync(beforeFile),'Read-only preflight required');
 const before=JSON.parse(readFileSync(beforeFile,'utf8'));
 if(mode==='--apply-reviewed'&&!stamp){
  assert.deepEqual(protectedFunctions(),before.functions);
  assert.deepEqual(catalog(),before.catalog,'Catalogue changed since review');
  query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements)values('${version}','${name}',array[${quote(source)}]);commit;`));
 }
 assert.deepEqual(receipt(),{name,hash});
 assert.deepEqual(protectedFunctions(),before.functions,'An underlying effect changed');
 const current=catalog();assert.equal(current.length,before.catalog.length);
 for(const row of current){
  const old=before.catalog.find(r=>r.source===row.source&&r.key===row.key);assert.ok(old);
  for(const key of ['key','source','kind','payload','tier','status'])assert.deepEqual(row[key],old[key],`${row.key}:${key}`);
 }
 for(const g of groups)for(const m of g.members){
  const row=current.find(r=>r.source===m.source&&r.key===m.key);
  assert.equal(row.name,g.name);assert.equal(row.description,g.description);assert.equal(row.effect_summary,g.effectSummary);
 }
 const acl=ro(`select has_function_privilege('anon','public.redeem_current_daily_rewards(uuid,integer,uuid,text,text,uuid)','execute') anon,
 has_function_privilege('authenticated','public.use_current_team_inventory_items(uuid,uuid,integer)','execute') member,
 has_function_privilege('authenticated','private.inventory_consumable_equivalence(text,text,text,jsonb)','execute') internal`)[0];
 assert.deepEqual(acl,{anon:false,member:true,internal:false});
 const response=await fetch('https://cyclostratege.fr/guide',{signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);
 const proof={checkedAt:new Date().toISOString(),migration:version,references:current.length,groups:groups.length,
 effectsAndRewardOddsUnchanged:true,underlyingRedemptionsUnchanged:true,noOwnedInventoryRewritten:true,acl,http:response.status};
 writeFileSync(path.join(directory,'verified.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
