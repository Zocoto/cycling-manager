// Exact reviewed migration, then canonical catch-up for three audited teams.
// Never inserts fixtures, edits classifications or manufactures finance rows.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';

const mode=process.argv[2];
const version='20261102120000', name='refresh_unsettled_sponsor_race_results';
const folder='artifacts/montecristi-sponsor-20261102';
const functionName='public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821(uuid,boolean)';
const objectives=[
  ['4ca1c034-9b74-4738-9bab-25e0328e7efc',2,'completed'],
  ['1b9126e1-8c87-400e-b1dc-3817ef4abac7',5,'failed'],
  ['e97add2a-0bf3-4be0-8504-0607d0fd0cc0',10,'completed'],
  ['2793c491-a1e7-41ca-b929-f8fd5f60b68a',5,'completed'],
];
const contracts=['71fc6189-abbd-4e59-87d0-662603ffd118','1ea7d9bc-55f7-447f-ab79-ab910e98fc31','479ea91c-e9eb-4898-81bc-7f80419503d9'];
if(!['--apply-reviewed','--verify'].includes(mode)||process.argv.length!==3||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Expected exact project and delivery mode.');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
function query(sql){
  try{
    const raw=execFileSync(binary,['db','query','--linked',sql,'--output','json'],{encoding:'utf8',timeout:25000,maxBuffer:100000});
    return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
  }catch(error){throw Error(error.stderr?.slice(0,1800)??error.message);}
}
const readonly=sql=>query(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';set local application_name='sponsor-race-results-verification-20261102';${sql};commit;`);
const ids=values=>values.map(v=>`'${v}'`).join(',');
function inspect(){return readonly(`select 'function' kind,md5(pg_get_functiondef('${functionName}'::regprocedure)) hash,
  position('-- Unsettled race goals follow the official classification.' in pg_get_functiondef('${functionName}'::regprocedure))>0 installed,null::text name
  union all select 'receipt',null,true,name from supabase_migrations.schema_migrations where version='${version}'`);}
function snapshot(){return readonly(`select o.id objective_id,o.name,o.status,o.satisfaction_points,p.status progress_status,p.current_value,p.details,p.settled_at,
  c.id contract_id,c.satisfaction_score,c.budget_per_season,ts.display_name,ts.cash_balance,
  terms.settlement_status main_settlement_status,
  (select d.reputation_points from public.team_manager_assignments a join public.sporting_directors d on d.id=a.sporting_director_id
    where a.team_id=c.team_id and a.role='general_manager' and a.status='active' limit 1) reputation
  from public.sponsor_objectives o join public.objective_progress p on p.sponsor_objective_id=o.id and p.season_id=o.season_id
  join public.team_sponsor_contracts c on c.id=p.team_sponsor_contract_id and c.sponsor_offer_id=o.sponsor_offer_id and c.status='active'
  join public.seasons s on s.id=o.season_id and s.status='active' and s.game_year=4
  join public.team_seasons ts on ts.team_id=c.team_id and ts.season_id=s.id
  left join public.sponsor_main_objective_terms terms on terms.sponsor_objective_id=o.id
  where o.id in (${ids(objectives.map(o=>o[0]))}) order by o.id`);}
config({path:'.env.local',quiet:true});
async function health(){
  const auth=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/health',{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(5000)});
  const site=await fetch('https://cyclostratege.fr/connexion',{signal:AbortSignal.timeout(10000)});
  if(auth.status!==200||site.status!==200)throw Error(`Service health failed: auth=${auth.status}, site=${site.status}`);
  return {auth:auth.status,site:site.status};
}
await health();
mkdirSync(folder,{recursive:true});
const beforeCode=inspect(),before=snapshot();
if(before.length!==4)throw Error('Audited season/objectives changed. Stop for review.');
const receipt=beforeCode.find(r=>r.kind==='receipt');
if(receipt&&(!beforeCode.find(r=>r.kind==='function').installed||receipt.name!==name))throw Error('Migration receipt/code mismatch.');
if(mode==='--apply-reviewed'){
  if(!existsSync(folder+'/curative-before.json'))writeFileSync(folder+'/curative-before.json',JSON.stringify(before,null,2));
  if(!receipt){
    const audited=JSON.parse(readFileSync(folder+'/all-evaluators-before.json','utf8')).find(r=>r.name==='evaluate_sponsor_objectives_for_contract_pre_philosophies_20260');
    if(!audited||createHash('md5').update(audited.definition).digest('hex')!==beforeCode.find(r=>r.kind==='function').hash)throw Error('Audited evaluator changed; re-review required.');
    const sql=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r','');
    if(!/^begin;/.test(sql)||!/commit;\s*$/.test(sql))throw Error('Atomic migration required.');
    query(sql.replace(/commit;\s*$/,`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]);commit;`));
  }
  for(const contractId of contracts){
    const needsRepair=before.some(row=>row.contract_id===contractId&&objectives.some(([id,rank,status])=>id===row.objective_id&&(Number(row.current_value)!==rank||row.status!==status)));
    if(!needsRepair)continue;
    if(before.some(row=>row.contract_id===contractId&&(row.settled_at||row.main_settlement_status)))throw Error('Audited objective acquired a settlement. Review required.');
    query(`begin;set local statement_timeout='3s';set local lock_timeout='500ms';set local application_name='sponsor-race-results-catchup-20261102';
      do $catchup$ begin
        if not exists(select 1 from public.team_sponsor_contracts c join public.seasons s on s.id=coalesce(c.objective_season_id,c.start_season_id)
          where c.id='${contractId}' and c.status='active' and s.status='active' and s.game_year=4) then raise exception 'Audited contract changed';end if;
        perform public.evaluate_sponsor_objectives_for_contract('${contractId}',false);
      end $catchup$;commit;`);
  }
}
const afterCode=inspect(),after=snapshot();
if(!afterCode.find(r=>r.kind==='function').installed||afterCode.find(r=>r.kind==='receipt')?.name!==name)throw Error('Source correction missing.');
for(const [id,rank,status] of objectives){
  const row=after.find(r=>r.objective_id===id);
  if(!row||Number(row.current_value)!==rank||row.status!==status||row.progress_status!==(status==='completed'?'achieved':'failed'))throw Error('Classification catch-up incomplete: '+id);
  if(status==='completed'&&(row.details.achievementLevel!=='full'||row.details.partialSatisfactionPoints!==0))throw Error('Partial details remain on achieved objective.');
  const previous=before.find(r=>r.objective_id===id);
  for(const key of ['cash_balance','budget_per_season','reputation'])if(row[key]!==previous[key])throw Error('Unexpected money/reputation change: '+key);
}
const serviceHealth=await health();
const proof={version,beforeCode,afterCode,before,after,health:serviceHealth,verifiedAt:new Date().toISOString()};
writeFileSync(folder+'/production-verification.json',JSON.stringify(proof,null,2));
console.log(JSON.stringify({version,installed:true,rows:after.map(r=>({team:r.display_name,objective:r.name,status:r.status,rank:r.current_value,points:r.satisfaction_points,satisfaction:r.satisfaction_score})),health:serviceHealth}));
