// Exact reviewed migration only. Never invokes gameplay or finance RPCs.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { config } from 'dotenv';

const mode=process.argv[2], version='20261029153000', name='allow_sponsor_ambition_above_catalogue';
const folder='artifacts/sponsor-ambition-ceiling-20261029';
if(!['--apply-reviewed','--verify'].includes(mode)||process.argv.length!==3||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Expected project and exact delivery mode required.');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
function query(sql){
  const raw=execFileSync(binary,['db','query','--linked',sql,'--output','json'],{encoding:'utf8',timeout:25000,maxBuffer:100000});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
const inspect=`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';set local application_name='sponsor-ambition-ceiling-verification';
select 'function' kind,n.nspname||'.'||p.proname key,md5(pg_get_functiondef(p.oid)) hash,
  position('private.sponsor_negotiation_budget_ceiling' in pg_get_functiondef(p.oid))>0 installed
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname in ('ensure_continuing_sponsor_offer','negotiate_sponsor_offer','negotiate_continuing_sponsor_objectives','rollover_game_season'))
or (n.nspname='private' and p.proname in ('finalize_continuing_sponsor_offer_budget','finalize_planned_sponsor_renewal_budget'))
union all select 'receipt',name,null,true from supabase_migrations.schema_migrations where version='${version}';commit;`;
const terms=`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';
with target as (select s.id from public.seasons s join public.seasons a on a.status='active' and s.game_year=a.game_year+1 where s.status='planned'),
offers as (select o.* from public.sponsor_offers o join target t on t.id=o.season_id where o.status in ('open','accepted') and o.base_budget_per_season>0),
budgets as (select o.*,greatest(10000,case objective_difficulty when 'ambitious' then round(base_budget_per_season*1.1/10000)*10000 when 'accessible' then round(base_budget_per_season*0.9/10000)*10000 else base_budget_per_season end) expected from offers o)
select count(*)::int offers,count(*) filter(where budget_per_season<>expected or negotiation_budget_ceiling<greatest(base_budget_per_season,round(base_budget_per_season*1.1/10000)*10000))::int inconsistent_offers,
(select count(*)::int from public.team_sponsor_contracts c join offers o on o.id=c.sponsor_offer_id and o.season_id=c.start_season_id where c.status='planned' and c.role='principal' and c.budget_per_season<>round(o.budget_per_season*(1+coalesce(c.reputation_budget_bonus_percent,0)/100.0),2)) inconsistent_planned_contracts
from budgets;commit;`;
config({path:'.env.local',quiet:true});
async function health(){const r=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/health',{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(5000)});if(r.status!==200)throw Error('Auth health failed: '+r.status);return r.status;}
await health();
const before=query(inspect), beforeTerms=query(terms)[0];
const receipt=before.find(r=>r.kind==='receipt');
if(receipt && (receipt.key!==name || before.filter(r=>r.kind==='function').some(r=>!r.installed)))throw Error('Migration receipt/code mismatch.');
if(mode==='--apply-reviewed'&&!receipt){
  if(before.some(r=>r.installed))throw Error('Partial installation detected.');
  if(existsSync(folder+'/production-functions-before.json'))for(const fn of JSON.parse(readFileSync(folder+'/production-functions-before.json','utf8'))){
    const expected=createHash('md5').update(fn.definition).digest('hex');
    if(before.find(r=>r.key===fn.schema+'.'+fn.name)?.hash!==expected)throw Error('Audited function changed: '+fn.name);
  }
  const sql=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r','');
  if(!/^begin;/.test(sql)||!/commit;\s*$/.test(sql))throw Error('Atomic migration required.');
  const receiptSql=`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]);\ncommit;`;
  query(sql.replace('begin;',"begin;\nset local application_name='sponsor-ambition-ceiling-migration';").replace(/commit;\s*$/,receiptSql));
}
const after=query(inspect), afterTerms=query(terms)[0];
if(after.filter(r=>r.kind==='function'&&r.installed).length!==6||after.find(r=>r.kind==='receipt')?.key!==name)throw Error('Sponsor budget functions not installed.');
if(afterTerms.inconsistent_offers!==0||afterTerms.inconsistent_planned_contracts!==0)throw Error('Future sponsor terms remain inconsistent.');
const example=query(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';
select c.budget_per_season current_budget,o.base_budget_per_season estimated_base,o.budget_per_season selected_budget,o.objective_difficulty,
  private.sponsor_negotiation_budget_ceiling(o.base_budget_per_season,420000) ambitious_ceiling,
  has_function_privilege('authenticated','private.sponsor_negotiation_budget_ceiling(numeric,numeric)','execute') player_can_call
from public.team_sponsor_contracts c join public.sponsor_offers o on o.id=c.pending_sponsor_offer_id
where c.id='df55019e-58a4-4ba2-a01c-430dce195ddc';commit;`)[0];
if(example?.player_can_call)throw Error('Private helper must not be callable by players.');
const authStatus=await health();
mkdirSync(folder,{recursive:true});
writeFileSync(folder+'/production-verification.json',JSON.stringify({version,before,beforeTerms,after,afterTerms,example,authStatus,verifiedAt:new Date().toISOString()},null,2));
console.log(JSON.stringify({version,installed:true,recorded:true,beforeTerms,afterTerms,example,authStatus,gameplayRpcsRun:false}));
