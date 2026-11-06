// Reviewed prospective inheritance only. Never changes a player's current roles.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
const mode=process.argv[2],linked=path.resolve(process.argv[3]??'.');
assert([3,4].includes(process.argv.length)&&['--preflight','--apply-reviewed','--verify'].includes(mode));
assert.equal(readFileSync(path.join(linked,'supabase/.temp/project-ref'),'utf8').trim(),'ikagfuchasnsakpouosg');
const version='20261106213000',name='persist_team_squad_statuses_on_renewal';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const hash=createHash('md5').update(source).digest('hex');
assert.equal(hash,'760a4ce8918d2bffed34f8e0199797ac','Reviewed migration changed');
const folder=path.resolve('artifacts/squad-role-persistence-20261106');mkdirSync(folder,{recursive:true});
const beforeFile=path.join(folder,'delivery-before.json');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
function query(sql){
  const file=path.join(folder,'delivery.sql');writeFileSync(file,sql);
  const raw=execFileSync(binary,['db','query','--linked','--workdir',linked,'--file',file,'--output','json'],
    {encoding:'utf8',timeout:20000,maxBuffer:160000});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
const read=sql=>query(`begin read only;set local statement_timeout='5s';set local lock_timeout='500ms';set local search_path='';set local application_name='persistent-squad-statuses-inspect';${sql};commit;`);
const receipt=()=>read(`select name,md5(replace(statements[1],chr(13),'')) hash from supabase_migrations.schema_migrations where version='${version}' limit 1`)[0];
const functions=()=>read(`select p.oid::regprocedure::text signature,replace(pg_get_functiondef(p.oid),chr(13),'') definition,p.proacl::text acl
  from pg_proc p where p.oid in(
    'public.set_current_team_rider_squad_status(uuid,text)'::regprocedure,
    'public.set_current_team_rider_squad_statuses(jsonb)'::regprocedure,
    'public.renew_current_team_rider_until(uuid,integer)'::regprocedure,
    'public.settle_expiring_rider_contracts()'::regprocedure,
    'private.guard_deferred_transfer_contract()'::regprocedure) order by signature`);
const stamp=receipt();if(stamp)assert.deepEqual(stamp,{name,hash});
if(mode==='--preflight'){
  if(!stamp){
    const before=functions();assert.equal(before.length,5);
    assert.equal(read("select to_regprocedure('private.inherit_team_squad_status_on_renewal()') is null absent")[0].absent,true);
    writeFileSync(beforeFile,JSON.stringify({hash,functions:before},null,2));
  }
  console.log(JSON.stringify({readOnly:true,alreadyInstalled:!!stamp,hash,protectedFunctions:5}));
}else{
  assert(existsSync(beforeFile));const before=JSON.parse(readFileSync(beforeFile,'utf8'));assert.equal(before.hash,hash);
  if(mode==='--apply-reviewed'&&!stamp){
    assert.deepEqual(functions(),before.functions);
    query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(source)}]);commit;`));
  }
  assert.deepEqual(receipt(),{name,hash});assert.deepEqual(functions(),before.functions);
  const policy=read(`select pg_get_functiondef('private.inherit_team_squad_status_on_renewal()'::regprocedure) definition,
    not has_function_privilege('authenticated','private.inherit_team_squad_status_on_renewal()','execute') helper_protected,
    not has_function_privilege('anon','private.inherit_team_squad_status_on_renewal()','execute') anonymous_denied,
    (select pg_get_triggerdef(oid) from pg_trigger where tgrelid='public.rider_contracts'::regclass
      and tgname='inherit_team_squad_status_on_renewal' and tgenabled='O' and not tgisinternal) trigger_definition,
    1 database_ok`)[0];
  assert(policy.definition.includes(source.split('as $$\n')[1].split('\n$$;')[0]));
  assert(policy.helper_protected&&policy.anonymous_denied&&policy.database_ok===1);
  assert(policy.trigger_definition.includes('BEFORE INSERT OR UPDATE OF status ON public.rider_contracts'));
  const site=await fetch('https://cyclostratege.fr/guide',{signal:AbortSignal.timeout(10000)});assert.equal(site.status,200);
  const proof={checkedAt:new Date().toISOString(),migration:version,hash,databaseOk:true,http:site.status,
    inheritanceVerified:true,existingSettersRenewalLifecycleAndTransferGuardsUnchanged:true,
    helperProtected:true,currentRolesBackfilled:false,productionFixtures:0};
  writeFileSync(path.join(folder,'verified.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
