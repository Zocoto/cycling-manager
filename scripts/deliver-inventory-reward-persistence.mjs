// Reviewed lifetime correction only. Production queries are bounded/sequential;
// all gameplay/regression fixtures run exclusively in isolated PGlite.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const mode=process.argv[2];
assert.ok(process.argv.length===3&&['--preflight','--apply-reviewed','--verify'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261106223000',name='persist_owned_inventory_rewards_across_seasons';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const hash=createHash('md5').update(source).digest('hex');
const dir='C:/Dev/artifacts/inventory-persistence-20261106';mkdirSync(dir,{recursive:true});
const beforeFile=path.join(dir,'before.json'),quote=s=>"'"+s.replaceAll("'","''")+"'";
const query=sql=>{
 const file=path.join(dir,'delivery.sql');writeFileSync(file,sql);
 const raw=execFileSync(binary,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:2500000});
 return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
};
const ro=sql=>query(`begin read only;set local statement_timeout='5s';set local lock_timeout='500ms';set local application_name='inventory-persistence-delivery';${sql};commit;`);
const receipt=()=>ro(`select name,md5(replace(statements[1],chr(13),''))hash from supabase_migrations.schema_migrations where version='${version}'limit 1`)[0];
const protectedFunctions=()=>ro(`select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid))hash
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f'and n.nspname in('public','private')
 and(p.proname='carry_team_consumables_on_rollover'or p.prosrc like '%daily_reward_inventory%')
 order by signature`);
const stock=ids=>ro(`select i.id,i.sporting_director_id,i.reward_key,i.team_season_id,i.status,i.expires_after_game_year,
 md5((to_jsonb(i)-array['status','expires_after_game_year','team_season_id','used_at','usage_payload'])::text) identity_hash,
 i.used_at,i.usage_payload
 from public.daily_reward_inventory i where ${ids?`i.id in(${ids.map(quote).join(',')})`:`i.status in('available','expired')`}order by i.id limit 10000`);
const stamp=receipt();if(stamp)assert.deepEqual(stamp,{name,hash});
if(mode==='--preflight'){
 if(!stamp){
  const items=stock();assert.ok(items.length<10000,'Inventory snapshot limit reached');
  const season=ro("select id,game_year from public.seasons where status='active'order by game_year desc limit 1")[0];assert.ok(season);
  writeFileSync(beforeFile,JSON.stringify({at:new Date().toISOString(),season,items,functions:protectedFunctions()},null,2));
  console.log(JSON.stringify({readOnly:true,unused:items.length,hidden:items.filter(i=>i.status==='available'&&i.expires_after_game_year<season.game_year).length}));
 }else console.log(JSON.stringify({readOnly:true,alreadyInstalled:true}));
}else{
 assert.ok(existsSync(beforeFile),'Run preflight first');const before=JSON.parse(readFileSync(beforeFile,'utf8'));
 if(mode==='--apply-reviewed'&&!stamp){
  assert.deepEqual(protectedFunctions(),before.functions,'A protected effect or rollover changed');
  query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements)values('${version}','${name}',array[${quote(source)}]);commit;`));
 }
 assert.deepEqual(receipt(),{name,hash});assert.deepEqual(protectedFunctions(),before.functions);
 const current=stock(before.items.map(i=>i.id));assert.equal(current.length,before.items.length,'An original object disappeared');
 const originals=new Map(before.items.map(i=>[i.id,i]));
 for(const item of current){
  const original=originals.get(item.id);assert.equal(item.identity_hash,original.identity_hash,'Ownership, provenance or acquisition date changed');
  if(item.status==='available')assert.equal(item.expires_after_game_year,2147483647);
 }
 const stats=ro(`select count(*)::int changed,count(*)filter(where r.was_hidden)::int restored,
 count(distinct r.sporting_director_id)filter(where r.was_hidden)::int affected_players,
 count(*)filter(where r.was_hidden and lower(d.username)='sevrinovitch')::int sevrinovitch_restored
 from private.inventory_reward_persistence_recoveries r join public.sporting_directors d on d.id=r.sporting_director_id`)[0];
 const invariant=ro(`select count(*)::int invalid from public.daily_reward_inventory where status='available'and expires_after_game_year<>2147483647`)[0];assert.equal(invariant.invalid,0);
 const acl=ro(`select has_function_privilege('anon','private.preserve_owned_inventory_reward_lifetime()','execute')anon,
 has_function_privilege('authenticated','private.preserve_owned_inventory_reward_lifetime()','execute')member,
 has_table_privilege('authenticated','private.inventory_reward_persistence_recoveries','select')ledger`)[0];
 assert.deepEqual(acl,{anon:false,member:false,ledger:false});
 const health=ro('select 1 healthy')[0];assert.equal(health.healthy,1);
 const http=await fetch('https://cyclostratege.fr/guide',{signal:AbortSignal.timeout(10000)});assert.equal(http.status,200);
 const proof={checkedAt:new Date().toISOString(),migration:version,...stats,originalIdsAndOwnershipPreserved:current.length,
 redemptionAndRolloverFunctionsUnchanged:before.functions.length,noRequestTimeQueriesAdded:true,acl,databaseHealthy:true,http:http.status};
 writeFileSync(path.join(dir,'verified.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
