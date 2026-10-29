// Isolated PostgreSQL only. No network, environment secrets or live mutations.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const read = name => readFileSync(`supabase/migrations/${name}.sql`,'utf8').replaceAll('\r','');
const def = (source,schema,name) => {
  const m=new RegExp(`create (?:or replace )?function ${schema}\\.${name}\\(`,'i').exec(source);
  assert(m,name);return source.slice(m.index,source.indexOf('$$;',m.index)+3);
};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rows=async(sql,args=[]) => (await db.query(sql,args)).rows;
const scalar=async(sql,args=[]) => (await rows(sql,args))[0].value;
let checks=0;
const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
const contract=async(n=10)=>(await rows('select * from team_sponsor_contracts where id=$1',[id(n)]))[0];
const offer=async(n=20)=>(await rows('select * from sponsor_offers where id=$1',[id(n)]))[0];
try {
  await db.exec(`
    create role anon;create role authenticated;create role service_role;create schema private;
    create table seasons(id uuid primary key,game_year int,status text,current_day_number int);
    create table season_rollover_settlements(source_season_id uuid);
    create table sponsors(id uuid primary key,name text);
    create table team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text);
    create table sponsor_offers(id uuid primary key default gen_random_uuid(),sponsor_id uuid,season_id uuid,
      sporting_director_id uuid,continuing_contract_id uuid,title text,description text,budget_per_season numeric,
      base_budget_per_season numeric,negotiation_budget_ceiling numeric,objective_difficulty text,currency_code text,
      contract_duration_seasons int,available_from timestamptz,available_until timestamptz,status text,generation_version int,
      unique(continuing_contract_id,season_id));
    create table team_sponsor_contracts(id uuid primary key,team_id uuid,sponsor_id uuid,sponsor_offer_id uuid,
      pending_sponsor_offer_id uuid,start_season_id uuid,objective_season_id uuid,role text,status text,
      budget_per_season numeric,contract_duration_seasons int,currency_code text,satisfaction_score int,
      satisfaction_updated_at timestamptz,renewal_budget_adjustment_percent numeric,reputation_budget_bonus_percent int default 0);
    create table sponsor_objectives(id uuid primary key default gen_random_uuid(),sponsor_offer_id uuid,season_id uuid,
      status text,display_order int,name text,target_details jsonb);
    create table team_finance_transactions(id uuid primary key,amount numeric,status text);
    create function get_sponsor_objective_satisfaction_score(uuid) returns int language sql stable as $$select satisfaction_score from team_sponsor_contracts where id=$1$$;
    create function get_sponsor_performance_satisfaction_score(uuid) returns int language sql stable as $$select 0$$;
  `);
  await db.exec(def(read('20261001060000_stabilize_annual_sponsor_page'),'public','ensure_continuing_sponsor_offer'));
  await db.exec(def(read('20260903223000_add_sponsor_offer_negotiation'),'public','negotiate_sponsor_offer'));
  await db.exec(def(read('20260908080000_add_annual_sponsor_objective_renegotiation'),'public','negotiate_continuing_sponsor_objectives'));
  await db.exec(def(read('20260908090000_stack_annual_sponsor_budget_modifiers'),'private','finalize_planned_sponsor_renewal_budget'));
  await db.exec(def(read('20260912164723_repair_annual_sponsor_budgets'),'private','finalize_continuing_sponsor_offer_budget'));
  const stacking=read('20260908090000_stack_annual_sponsor_budget_modifiers');
  const start=stacking.indexOf('  -- Annual sponsor satisfaction and ambition stack from season 3 onward.');
  const block=stacking.slice(start,stacking.indexOf('$block$;',start));
  await db.exec(`create function rollover_game_season(uuid,boolean default false) returns jsonb language plpgsql as $$declare v_target seasons%rowtype;begin select * into v_target from seasons where id=$1;${block} return '{}'::jsonb;end $$;`);
  const audited='artifacts/sponsor-ambition-ceiling-20261029/production-functions-before.json';
  if(existsSync(audited))for(const fn of JSON.parse(readFileSync(audited,'utf8')))await db.exec(fn.definition);
  const signatures=['public.ensure_continuing_sponsor_offer(uuid,uuid,numeric,numeric)','public.negotiate_sponsor_offer(uuid,uuid,text,numeric,numeric)',
    'public.negotiate_continuing_sponsor_objectives(uuid,uuid,text,numeric,numeric)','public.rollover_game_season(uuid,boolean)',
    'private.finalize_planned_sponsor_renewal_budget()','private.finalize_continuing_sponsor_offer_budget(uuid,uuid)'];
  for(const fn of signatures)await db.exec(`revoke all on function ${fn} from public,anon,authenticated;grant execute on function ${fn} to service_role`);
  const oldDefinitions=await rows("select proname,pg_get_functiondef(oid) definition from pg_proc where oid=any($1::regprocedure[])",[signatures]);
  await db.exec(`
    insert into seasons values('${id(3)}',3,'completed',28),('${id(4)}',4,'active',21),('${id(5)}',5,'planned',1),('${id(6)}',6,'planned',1);
    insert into sponsors values('${id(1)}','Sponsor');
    insert into team_manager_assignments values('${id(7)}','${id(8)}','general_manager','active');
    insert into team_sponsor_contracts(id,team_id,sponsor_id,sponsor_offer_id,pending_sponsor_offer_id,start_season_id,objective_season_id,role,status,budget_per_season,contract_duration_seasons,currency_code,satisfaction_score,renewal_budget_adjustment_percent)
    values('${id(10)}','${id(7)}','${id(1)}','${id(19)}','${id(20)}','${id(3)}','${id(4)}','principal','active',454080,3,'EUR',49,-0.5);
    insert into sponsor_offers(id,sponsor_id,season_id,sporting_director_id,continuing_contract_id,budget_per_season,base_budget_per_season,negotiation_budget_ceiling,objective_difficulty,status)
    values('${id(19)}','${id(1)}','${id(4)}','${id(8)}',null,454080,454080,454080,'balanced','accepted'),
      ('${id(20)}','${id(1)}','${id(5)}','${id(8)}','${id(10)}',451810,451810,451810,'balanced','accepted'),
      ('${id(21)}','${id(1)}','${id(5)}','${id(8)}',null,420000,420000,420000,'ambitious','open'),
      ('${id(22)}','${id(1)}','${id(5)}','${id(8)}',null,318000,318000,318000,'ambitious','accepted'),
      ('${id(23)}','${id(1)}','${id(3)}','${id(8)}',null,300000,300000,300000,'ambitious','accepted'),
      ('${id(24)}','${id(1)}','${id(6)}','${id(8)}',null,300000,300000,300000,'ambitious','open');
    insert into team_sponsor_contracts(id,team_id,sponsor_id,sponsor_offer_id,start_season_id,objective_season_id,role,status,budget_per_season,contract_duration_seasons,satisfaction_score,renewal_budget_adjustment_percent,reputation_budget_bonus_percent)
    values('${id(11)}','${id(9)}','${id(1)}','${id(23)}','${id(3)}','${id(4)}','principal','active',300000,2,80,6,0),
      ('${id(12)}','${id(9)}','${id(1)}','${id(22)}','${id(5)}','${id(5)}','principal','planned',349800,2,0,0,10);
    insert into sponsor_objectives(sponsor_offer_id,season_id,status,display_order,name,target_details)
      values('${id(20)}','${id(5)}','draft',1,'Future goal','{"targetRank":5}'),('${id(19)}','${id(4)}','active',1,'Current goal','{"targetRank":5}');
    insert into team_finance_transactions values('${id(40)}',100000,'posted');
    create trigger finalize_planned_sponsor_renewal_budget after update of renewal_budget_adjustment_percent on team_sponsor_contracts
      for each row execute function private.finalize_planned_sponsor_renewal_budget();
  `);
  const current=await contract(),past=await offer(23),later=await offer(24);
  const objectives=await rows('select * from sponsor_objectives order by id');
  await db.exec(read('20261029153000_allow_sponsor_ambition_above_catalogue'));
  equal(await contract(),current);equal(await offer(23),past);equal(await offer(24),later);
  equal(await rows('select * from sponsor_objectives order by id'),objectives);
  equal(Number((await offer(20)).budget_per_season),451810);equal((await offer(20)).objective_difficulty,'balanced');
  equal(Number((await offer(20)).negotiation_budget_ceiling),500000);
  equal(Number((await offer(21)).budget_per_season),460000);
  equal(Number((await contract(12)).budget_per_season),385000);
  equal(Number(await scalar('select amount value from team_finance_transactions')),100000);

  for(const [base,ceiling,expected] of [[451810,420000,500000],[735000,700000,810000],[600000,700000,700000]])
    equal(Number(await scalar('select private.sponsor_negotiation_budget_ceiling($1,$2) value',[base,ceiling])),expected);
  const prepare=()=>scalar('select ensure_continuing_sponsor_offer($1,$2,451810,451810) value',[id(10),id(8)]);
  equal(await prepare(),id(20));equal(Number((await offer()).negotiation_budget_ceiling),500000);
  await assert.rejects(()=>scalar('select ensure_continuing_sponsor_offer($1,$2,451810,451810) value',[id(10),id(99)]),/appartient/);checks++;
  await assert.rejects(()=>scalar('select negotiate_sponsor_offer($1,$2,\'ambitious\',421000,421000) value',[id(21),id(8)]),/évolué/);checks++;
  await db.exec(`update seasons set current_day_number=20 where id='${id(4)}'`);
  await assert.rejects(prepare,/jour 21/);checks++;
  await db.exec(`update seasons set current_day_number=21 where id='${id(4)}'`);
  for(const [tier,budget] of [['accessible',410000],['balanced',451810],['ambitious',500000]]) {
    equal(Number(await scalar('select negotiate_continuing_sponsor_objectives($1,$2,$3,451810,451810) value',[id(10),id(8),tier])),budget);
    equal((await offer()).objective_difficulty,tier);
  }
  equal(Number(await scalar('select negotiate_sponsor_offer($1,$2,\'ambitious\',420000,420000) value',[id(21),id(8)])),460000);
  // Final satisfaction after J21 raises the base; the saved old ceiling must
  // never erase the additional ambition when annual terms are activated.
  await db.exec(`update team_sponsor_contracts set satisfaction_score=80 where id='${id(10)}'`);
  equal(Number(await scalar('select private.finalize_continuing_sponsor_offer_budget($1,$2) value',[id(10),id(5)])),530000);
  equal(Number((await offer()).base_budget_per_season),481325);
  const rollover=await scalar("select pg_get_functiondef('public.rollover_game_season(uuid,boolean)'::regprocedure) value");
  const blockStart=rollover.indexOf('  -- Annual sponsor satisfaction and ambition stack from season 3 onward.');
  const blockEnd=rollover.indexOf('  for v_sponsor in',blockStart);
  let actualBlock=rollover.slice(blockStart,blockEnd<0?rollover.indexOf(" return '{}'",blockStart):blockEnd);
  if(!actualBlock.includes('budget_per_season = offer.budget_per_season'))actualBlock+=`update team_sponsor_contracts c set budget_per_season=o.budget_per_season,objective_season_id=o.season_id,sponsor_offer_id=o.id,pending_sponsor_offer_id=null from sponsor_offers o where c.pending_sponsor_offer_id=o.id and o.season_id=v_target.id;`;
  await db.exec(`create function test_sponsor_rollover(uuid) returns void language plpgsql as $$declare v_target seasons%rowtype;begin select * into v_target from seasons where id=$1;${actualBlock} end $$;`);
  await db.query('select test_sponsor_rollover($1)',[id(5)]);
  equal(Number((await contract()).budget_per_season),530000);
  // A second annual adjustment compounds on the real new amount.
  await db.exec(`insert into sponsor_offers(id,sponsor_id,season_id,continuing_contract_id,budget_per_season,base_budget_per_season,negotiation_budget_ceiling,objective_difficulty,status)
    values('${id(25)}','${id(1)}','${id(6)}','${id(10)}',530000,530000,530000,'ambitious','accepted');`);
  equal(Number(await scalar('select private.finalize_continuing_sponsor_offer_budget($1,$2) value',[id(10),id(6)])),620000);
  // Expiry renewal and reputation investment survive repeated finalization.
  await db.exec(`update team_sponsor_contracts set renewal_budget_adjustment_percent=6 where id='${id(11)}'`);
  equal(Number((await contract(12)).budget_per_season),385000);
  equal(Number((await offer(22)).budget_per_season),350000);
  await db.exec(`update team_sponsor_contracts set renewal_budget_adjustment_percent=10 where id='${id(11)}'`);
  equal(Number((await contract(12)).budget_per_season),396000);
  const snapshot=await rows('select * from team_sponsor_contracts order by id');
  await db.exec(`update team_sponsor_contracts set renewal_budget_adjustment_percent=10 where id='${id(11)}'`);
  equal(await rows('select * from team_sponsor_contracts order by id'),snapshot);
  for(const fn of signatures) {
    equal(await scalar('select has_function_privilege(\'authenticated\',$1,\'execute\') value',[fn]),false);
    const updated=await scalar('select pg_get_functiondef($1::regprocedure) value',[fn]);
    equal(updated.includes('private.sponsor_negotiation_budget_ceiling'),true);
  }
  // Preserve owner/day/stale-state guards without running full season mechanics.
  for(const name of ['ensure_continuing_sponsor_offer','negotiate_continuing_sponsor_objectives','negotiate_sponsor_offer']) {
    const old=oldDefinitions.find(r=>r.proname===name).definition;
    const updated=await scalar('select pg_get_functiondef($1::regprocedure) value',[signatures.find(s=>s.startsWith('public.'+name+'('))]);
    for(const line of old.replaceAll('\r','').split('\n').filter(l=>l.includes('raise exception')))equal(updated.includes(line),true);
  }
  const installer=readFileSync('scripts/deliver-sponsor-ambition-ceiling.mjs','utf8');
  const verification=installer.match(/const terms=`([\s\S]*?)`;/)[1];
  const consistency=(await db.exec(verification)).find(r=>r.rows?.[0]?.inconsistent_offers!==undefined).rows[0];
  equal(consistency.inconsistent_offers,0);equal(consistency.inconsistent_planned_contracts,0);
  console.log(`${checks} sponsor ambition checks passed in isolated PostgreSQL.`);
} catch(error) { console.error(error.message,error.where??'',error.stack?.split('\n').slice(0,5).join('\n'));process.exitCode=1; }
finally {await db.close();}
