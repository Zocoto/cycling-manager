// Deploy only the reviewed migration. Never switch a player's ambition or run
// integration fixtures / financial settlements on the production database.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,rmdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const mode=process.argv[2];assert(['--inspect','--apply','--verify'].includes(mode));
const workdir=process.env.SUPABASE_LINKED_WORKDIR??process.cwd();
assert.equal(readFileSync(join(workdir,'supabase/.temp/project-ref'),'utf8').trim(),'ikagfuchasnsakpouosg');
const require=createRequire(import.meta.url);
const binary=join(require.resolve('@supabase/cli-windows-x64/package.json'),'..','bin/supabase.exe');
const version='20261104143037',name='preserve_sponsor_objectives_by_ambition';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r','');
const directory='C:/Dev/artifacts/sponsor-ambition-plans-20261104';
const tested=JSON.parse(readFileSync(join(directory,'isolated-verification.json'),'utf8'));
const hash=(text,algorithm='md5')=>createHash(algorithm).update(text).digest('hex');
assert.equal(tested.migrationSha256,hash(source,'sha256'),'Migration differs from isolated test.');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
function query(sql){
  const directory=mkdtempSync(join(tmpdir(),'sponsor-ambition-plans-')),file=join(directory,'query.sql');
  try{
    writeFileSync(file,sql);
    const raw=execFileSync(binary,['db','query','--linked','--workdir',workdir,'--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:200000});
    return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
  }finally{rmSync(file,{force:true});rmdirSync(directory);}
}
function state(){return query(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';
  select 'function' kind,p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,
    jsonb_build_object('acl',p.proacl::text,'definer',p.prosecdef,'config',p.proconfig) data
  from pg_proc p where p.oid=any(array[${tested.before.map(r=>quote('public.'+r.signature)+'::regprocedure').join(',')}])
  union all select 'receipt',version,null,jsonb_build_object('name',name,'hash',md5(statements[1])) from supabase_migrations.schema_migrations where version='${version}'
  union all select 'table',coalesce(to_regclass('private.sponsor_objective_ambition_plans')::text,'absent'),null,null
  union all select 'unchanged',p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid)),null
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
    ('sign_sponsor_offer','rollover_game_season','evaluate_sponsor_objectives_for_contract','get_current_dashboard_assistant_summary')
  union all select 'season',game_year::text,null,jsonb_build_object('day',current_day_number) from public.seasons where status='active' limit 30;
  commit;`);}
const publicHealth=async()=>{const r=await fetch('https://cyclostratege.fr/connexion',{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200,'Live site unavailable.');return r.status;};
await publicHealth();const before=state();
const receipt=before.find(r=>r.kind==='receipt');
if(receipt){assert.equal(receipt.data.name,name);assert.equal(receipt.data.hash,hash(source),'Migration version collision.');}
for(const fn of before.filter(r=>r.kind==='function')){
  const expected=(receipt?tested.after:tested.before).find(r=>r.signature===fn.signature);
  assert(expected,'Unexpected routine');assert.equal(fn.definition.replaceAll('\r',''),expected.definition.replaceAll('\r',''),'Audited source changed: '+fn.signature);
}
mkdirSync(directory,{recursive:true});
if(mode==='--inspect'){
  writeFileSync(join(directory,'production-before.json'),JSON.stringify({checkedAt:new Date().toISOString(),rows:before},null,2));
  console.log(JSON.stringify({databaseHealthy:true,publicHttp:200,installed:Boolean(receipt),reviewedSourceMatches:true,isolatedChecks:tested.checks}));
  process.exit(0);
}
if(!receipt){
  assert.equal(mode,'--apply');assert(before.some(r=>r.kind==='table'&&r.signature==='absent'),'Unrecorded partial install.');
  query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(source)}]);commit;`));
}
const after=state();
assert.equal(after.find(r=>r.kind==='receipt')?.data.hash,hash(source));
assert(after.some(r=>r.kind==='table'&&r.signature!=='absent'));
for(const fn of after.filter(r=>r.kind==='function')){
  assert.equal(fn.definition.replaceAll('\r',''),tested.after.find(r=>r.signature===fn.signature).definition.replaceAll('\r',''),'Deployed source differs from tested source.');
  assert.deepEqual(fn.data,before.find(r=>r.signature===fn.signature).data,'Privileges/settings changed.');
}
assert.deepEqual(after.filter(r=>r.kind==='unchanged').sort((a,b)=>a.signature.localeCompare(b.signature)),before.filter(r=>r.kind==='unchanged').sort((a,b)=>a.signature.localeCompare(b.signature)),'Unrelated gameplay function changed.');
const security=query(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';
  select r.rolname,has_table_privilege(r.rolname,'private.sponsor_objective_ambition_plans','select') can_read,
    has_function_privilege(r.rolname,'private.remember_sponsor_objective_ambition(uuid,text)','execute') can_remember,
    has_function_privilege(r.rolname,'private.restore_sponsor_objective_ambition(uuid,text)','execute') can_restore,
    (select relrowsecurity from pg_class where oid='private.sponsor_objective_ambition_plans'::regclass) rls
  from pg_roles r where r.rolname in ('anon','authenticated','service_role');commit;`);
assert.equal(security.length,3);for(const r of security){assert(!r.can_read&&!r.can_remember&&!r.can_restore);assert(r.rls);}
const publicHttp=await publicHealth();
const result={checkedAt:new Date().toISOString(),version,installed:true,recorded:true,databaseHealthy:true,publicHttp,
  isolatedChecks:tested.checks,sourceMatchesIsolatedTests:true,privilegesPreserved:true,unrelatedGameplayPreserved:true,
  season:after.find(r=>r.kind==='season'),playerNegotiationsRun:0,gameplayBackfill:0,security};
writeFileSync(join(directory,'production-verification.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
