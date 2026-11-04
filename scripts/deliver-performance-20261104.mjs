// Exact, reviewed performance migration. Production diagnostics are read-only,
// bounded and serial. No gameplay RPC, fixture or benchmark is run here.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {config} from 'dotenv';
const mode=process.argv[2],version='20261104150000',name='reduce_completed_race_recovery_work';
const folder='artifacts/performance-cost-20261104';
if(!['--inspect','--apply-reviewed','--verify'].includes(mode)||process.argv.length!==3||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Exact project and mode required.');
const require=createRequire(import.meta.url),binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const appName='performance-20261104-delivery';
function query(sql){
  try {const raw=execFileSync(binary,['db','query','--linked',sql,'--output','json'],{encoding:'utf8',timeout:25000,maxBuffer:150000});return JSON.parse(raw.slice(raw.indexOf('{'))).rows;}
  catch(error){throw Error(error.stderr?.slice(0,1800)??error.message);}
}
const read=sql=>query(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';set local application_name='${appName}';${sql};commit;`);
const signatures=['public.get_incomplete_completed_race_edition_ids(uuid)','public.prepare_due_automatic_federation_professional_lineups(timestamptz)'];
function state(){return read(`select 'function' kind,p.proname key,md5(pg_get_functiondef(p.oid)) hash,
    case when p.proname='get_incomplete_completed_race_edition_ids' then position('missing_results as materialized' in pg_get_functiondef(p.oid))>0
      else position('performance_closed_callup_slots_v1' in pg_get_functiondef(p.oid))>0 end installed,
    p.proacl::text acl,p.proconfig,p.prosecdef,p.provolatile
    from pg_proc p where p.oid=any(array[${signatures.map(s=>`'${s}'::regprocedure`).join(',')}])
    union all select 'receipt',name,null,true,null,null,null,null from supabase_migrations.schema_migrations where version='${version}'`);}
config({path:'.env.local',quiet:true});
async function health(){
  const checks=[];
  for(const [service,url,headers] of [
    ['auth',process.env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/health',{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}],
    ['site','https://cyclostratege.fr/connexion',{}],
  ]) {
    const start=performance.now();const response=await fetch(url,{headers,signal:AbortSignal.timeout(10000)});
    checks.push({service,status:response.status,ms:Math.round(performance.now()-start)});
    if(response.status!==200)throw Error('Service health failed.');
  }
  return checks;
}
mkdirSync(folder,{recursive:true});const beforeHealth=await health();
// A previous read-only process may have been interrupted by the PC crash.
const lingering=read(`select application_name,state from pg_stat_activity
  where pid<>pg_backend_pid() and application_name like 'performance%' and state like 'idle in transaction%' limit 5`);
if(lingering.length)throw Error('Task diagnostic transaction remains open; inspect exact session before continuing.');
const before=state(),receipt=before.find(r=>r.kind==='receipt');
if(receipt&&receipt.key!==name)throw Error('Migration version collision.');
if(mode==='--inspect'){console.log(JSON.stringify({before,health:beforeHealth}));process.exit(0);}
if(mode==='--apply-reviewed'&&!receipt){
  if(before.filter(r=>r.kind==='function').length!==2||before.some(r=>r.installed))throw Error('Unexpected/partial installation.');
  for(const fn of before.filter(r=>r.kind==='function')) {
    const definition=readFileSync(`${folder}/${fn.key}.sql`,'utf8').replaceAll('\r','');
    if(fn.hash!==createHash('md5').update(definition).digest('hex'))throw Error(`Audited function changed: ${fn.key}`);
  }
  const sql=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r','');
  if(!/^begin;/.test(sql)||!/commit;\s*$/.test(sql))throw Error('Atomic migration required.');
  query(sql.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]);commit;`));
}
const after=state();
if(after.filter(r=>r.kind==='function'&&r.installed).length!==2||after.find(r=>r.kind==='receipt')?.key!==name)throw Error('Exact migration not installed.');
for(const fn of before.filter(r=>r.kind==='function')){
  const updated=after.find(r=>r.key===fn.key);
  for(const key of ['acl','proconfig','prosecdef','provolatile'])if(JSON.stringify(updated[key])!==JSON.stringify(fn[key]))throw Error(`Function security/settings changed: ${fn.key}.${key}`);
}
const validation=read(`select season.game_year,
  (select count(*)::int from public.get_incomplete_completed_race_edition_ids(season.id)) incomplete_completed_editions,
  has_function_privilege('authenticated','public.get_incomplete_completed_race_edition_ids(uuid)','execute') player_can_scan_recovery
  from public.seasons season where season.status='active' limit 1`);
if(validation.some(r=>r.player_can_scan_recovery))throw Error('Unexpected recovery access.');
const afterHealth=await health();
writeFileSync(`${folder}/production-verification.json`,JSON.stringify({version,before,after,validation,health:afterHealth,verifiedAt:new Date().toISOString(),gameplayRpcsInvoked:false},null,2));
console.log(JSON.stringify({installed:true,version,validation,health:afterHealth,gameplayRpcsInvoked:false}));
