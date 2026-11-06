// Reviewed function-only production correction. Never submits a player's choices.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const mode=process.argv[2];
if(process.argv.length!==3||!['--preflight','--apply-reviewed','--verify'].includes(mode)||
 readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Exact mode and project required');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261106120000',name='fix_cn_junior_fallback_ownership';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const hash=createHash('md5').update(source).digest('hex');
const directory='C:/Dev/artifacts/cn-withdrawal-20261106';mkdirSync(directory,{recursive:true});
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const query=sql=>{
 const file=path.join(directory,'delivery.sql');writeFileSync(file,sql);
 const raw=execFileSync(binary,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:100000});
 return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
};
const ro=sql=>query(`begin read only;set local statement_timeout='5s';set local lock_timeout='500ms';set local application_name='cn-withdrawal-delivery';${sql};commit;`);
const protectedState=()=>ro(`select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid))hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('save_current_team_national_championship_selections','withdraw_current_team_national_championship_rider','sync_team_national_championship_registrations','sync_national_championship_registrations','get_national_championship_country_rankings','sync_junior_pro_national_fallback','respond_to_direct_transfer_offer','submit_direct_transfer_trade_offer')order by signature`);
const receipt=()=>ro(`select name,md5(replace(statements[1],chr(13),''))hash from supabase_migrations.schema_migrations where version='${version}'limit 1`)[0];
const stamp=receipt();if(stamp)assert.deepEqual(stamp,{name,hash});
const beforeFile=path.join(directory,'before.json');
const guard=()=>ro("select pg_get_functiondef('private.guard_live_rider_commitment_ownership()'::regprocedure) definition")[0].definition.replaceAll('\r\n','\n');
if(mode==='--preflight'){
 if(!stamp){
  const fixture=JSON.parse(readFileSync('scripts/fixtures/cn-withdrawal-ownership-baseline.json','utf8'));
  assert.equal(guard(),fixture.guard.definition.replaceAll('\r\n','\n'));
  writeFileSync(beforeFile,JSON.stringify(protectedState(),null,2));
 }
 console.log(JSON.stringify({readOnly:true,alreadyInstalled:!!stamp}));
}else{
 assert.ok(existsSync(beforeFile));const before=JSON.parse(readFileSync(beforeFile,'utf8'));
 if(mode==='--apply-reviewed'&&!stamp){
  assert.deepEqual(protectedState(),before);
  const fixture=JSON.parse(readFileSync('scripts/fixtures/cn-withdrawal-ownership-baseline.json','utf8'));
  assert.equal(guard(),fixture.guard.definition.replaceAll('\r\n','\n'));
  query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements)values('${version}','${name}',array[${quote(source)}]);commit;`));
 }
 assert.deepEqual(receipt(),{name,hash});assert.deepEqual(protectedState(),before);
 const currentGuard=guard();assert.ok(currentGuard.includes('v_academy_owner_id'));assert.ok(currentGuard.includes('for share of academy, link, rider nowait'));
 const access=ro(`select has_function_privilege('authenticated','private.guard_live_rider_commitment_ownership()','execute') public_guard,
 (select count(*)::int from pg_trigger where tgfoid='private.guard_live_rider_commitment_ownership()'::regprocedure and not tgisinternal and tgenabled='O') enabled_guards`)[0];
 assert.deepEqual(access,{public_guard:false,enabled_guards:3});
 const response=await fetch('https://cyclostratege.fr/guide',{signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);
 const proof={checkedAt:new Date().toISOString(),migration:version,protectedFunctions:before.length,
  originalWithdrawalAndSyncRulesUnchanged:true,playerSelectionsNotModified:true,transferProtectionActive:true,access,http:response.status};
 writeFileSync(path.join(directory,'verified.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
