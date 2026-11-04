// Only this reviewed migration; all diagnostics are bounded and read-only.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {config} from 'dotenv';
const mode=process.argv[2],version='20261104120000',name='prevent_international_uci_points';
const folder='artifacts/international-uci-check-20261104';
if(!['--inspect','--apply-reviewed','--verify'].includes(mode)||process.argv.length!==3||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Exact project and mode required.');
const require=createRequire(import.meta.url),binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
function query(sql){
  try{const raw=execFileSync(binary,['db','query','--linked',sql,'--output','json'],{encoding:'utf8',timeout:25000,maxBuffer:70000});return JSON.parse(raw.slice(raw.indexOf('{'))).rows;}
  catch(error){throw Error(error.stderr?.slice(0,1800)??error.message);}
}
const read=sql=>query(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';set local application_name='international-uci-guard-verification';${sql};commit;`);
function state(){return read(`select 'function' kind,p.proname key,md5(pg_get_functiondef(p.oid)) hash,
    position('-- International championship UCI exclusion from S4.' in pg_get_functiondef(p.oid))>0 installed,
    p.proacl::text acl,p.proconfig,p.prosecdef
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('apply_race_roster_competition_reward','apply_detection_rider_competition_reward')
    union all select 'receipt',name,null,true,null,null,null from supabase_migrations.schema_migrations where version='${version}'`);}
function audit(){return read(`with editions as (
  select e.id,e.display_name,r.competition_type from public.seasons s
  join public.race_editions e on e.season_id=s.id and e.status='completed'
  join public.races r on r.id=e.race_id and r.competition_type in('world_championship','continental_championship','nations_cup')
  where s.status='active'
), prefixes as (
  -- Canonical suffixes are rider/detection-rider/roster/team. A lexical upper
  -- suffix keeps the range indexable under the database's locale collation.
  select e.*,p.prefix||e.id::text||':' lower_bound,p.prefix||e.id::text||':zzzzzzzz' upper_bound
  from editions e cross join(values('official-race:'),('quadrennial-games:')) p(prefix)
)
select p.id,p.display_name,p.competition_type,sum(a.events)::integer reward_events,
  sum(a.with_uci)::integer events_with_uci,sum(a.points)::bigint uci_points
from prefixes p cross join lateral (
  select count(*) events,count(*) filter(where ev.uci_points<>0) with_uci,coalesce(sum(ev.uci_points),0) points
  from public.reward_events ev where ev.source_reference>=p.lower_bound and ev.source_reference<p.upper_bound
    and starts_with(ev.source_reference,p.lower_bound)
) a group by p.id,p.display_name,p.competition_type order by p.competition_type,p.display_name limit 20`);}
config({path:'.env.local',quiet:true});
async function health(){
  const auth=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/health',{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(5000)});
  const site=await fetch('https://cyclostratege.fr/connexion',{signal:AbortSignal.timeout(10000)});
  if(auth.status!==200||site.status!==200)throw Error('Service health failed.');return {auth:auth.status,site:site.status};
}
await health();mkdirSync(folder,{recursive:true});
const before=state(),beforeAudit=audit();
writeFileSync(folder+`/award-audit-${mode==='--apply-reviewed'?'before':'verification'}.json`,JSON.stringify(beforeAudit,null,2));
if(beforeAudit.some(r=>r.events_with_uci!==0||Number(r.uci_points)!==0))throw Error('Confirmed nonzero international awards require a reviewed targeted reconciliation.');
if(mode==='--inspect'){console.log(JSON.stringify({state:before,audit:beforeAudit}));process.exit(0);}
const receipt=before.find(r=>r.kind==='receipt');
if(receipt?.key&&receipt.key!==name)throw Error('Migration version collision.');
if(mode==='--apply-reviewed'&&!receipt){
  if(before.some(r=>r.installed))throw Error('Partial installation; review required.');
  for(const fn of JSON.parse(readFileSync(folder+'/guards-before.json','utf8'))){
    if(before.find(r=>r.key===fn.name)?.hash!==createHash('md5').update(fn.definition).digest('hex'))throw Error('Audited reward function changed.');
  }
  const sql=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r','');
  if(!/^begin;/.test(sql)||!/commit;\s*$/.test(sql))throw Error('Atomic migration required.');
  query(sql.replace(/commit;\s*$/,`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]);commit;`));
}
const after=state();
if(after.filter(r=>r.kind==='function'&&r.installed).length!==2||after.find(r=>r.kind==='receipt')?.key!==name)throw Error('Both UCI guards must be installed and recorded.');
for(const fn of before.filter(r=>r.kind==='function')){
  const updated=after.find(r=>r.key===fn.key);
  if(updated.acl!==fn.acl||JSON.stringify(updated.proconfig)!==JSON.stringify(fn.proconfig)||updated.prosecdef!==fn.prosecdef)throw Error('Reward function permissions/settings changed.');
}
const access=read(`select has_function_privilege('authenticated','public.apply_race_roster_competition_reward(text,text,uuid,uuid,integer,integer,numeric,integer,boolean,text)','execute') player_can_credit_club,
  has_function_privilege('authenticated','public.apply_detection_rider_competition_reward(text,text,uuid,uuid,integer,boolean,text)','execute') player_can_credit_free`)[0];
if(access.player_can_credit_club||access.player_can_credit_free)throw Error('Unexpected player reward access.');
const serviceHealth=await health();
writeFileSync(folder+'/production-verification.json',JSON.stringify({version,before,after,audit:beforeAudit,access,health:serviceHealth,verifiedAt:new Date().toISOString()},null,2));
console.log(JSON.stringify({version,installed:true,auditedEditions:beforeAudit.length,internationalUciPoints:0,curativeRequired:false,access,health:serviceHealth,gameplayRpcsInvoked:false}));
