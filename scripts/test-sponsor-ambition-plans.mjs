// Isolated PostgreSQL only: no secrets, network or production fixtures.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const migration=readFileSync('supabase/migrations/20261104143037_preserve_sponsor_objectives_by_ambition.sql','utf8').replaceAll('\r','');
const runtime=JSON.parse(readFileSync(process.argv[3]??'C:/Dev/artifacts/sponsor-objective-change-20261104/runtime.json','utf8')).rows;
const read=name=>readFileSync(`supabase/migrations/${name}.sql`,'utf8').replaceAll('\r','');
const definition=(text,schema,name)=>{
  const start=text.indexOf(`create function ${schema}.${name}(`)>=0?text.indexOf(`create function ${schema}.${name}(`):text.indexOf(`create or replace function ${schema}.${name}(`);
  assert(start>=0,name);return text.slice(start,text.indexOf('$$;',start)+3);
};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rows=async(sql,args=[]) => (await db.query(sql,args)).rows;
const scalar=async(sql,args=[]) => (await rows(sql,args))[0].value;
let checks=0;const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const rejects=async(fn,pattern)=>{await assert.rejects(fn,pattern);checks++;};
const offer=async(n)=>(await rows('select * from sponsor_offers where id=$1',[id(n)]))[0];
const plan=async(n)=>({
  objectives:await rows('select * from sponsor_objectives where sponsor_offer_id=$1 order by display_order',[id(n)]),
  terms:await rows('select t.* from sponsor_main_objective_terms t join sponsor_objectives o on o.id=t.sponsor_objective_id where o.sponsor_offer_id=$1 order by t.sponsor_objective_id',[id(n)]),
  races:await rows('select r.* from race_result_objectives r join sponsor_objectives o on o.id=r.objective_id where o.sponsor_offer_id=$1 order by r.objective_id',[id(n)]),
  nations:await rows('select r.* from nationality_objectives r join sponsor_objectives o on o.id=r.objective_id where o.sponsor_offer_id=$1 order by r.objective_id',[id(n)]),
  wins:await rows('select r.* from season_win_objectives r join sponsor_objectives o on o.id=r.objective_id where o.sponsor_offer_id=$1 order by r.objective_id',[id(n)]),
});
async function generate(n,tier,label){
  equal(Number(await scalar('select count(*) value from sponsor_objectives where sponsor_offer_id=$1',[id(n)])),0,'generate only unseen tiers');
  await db.query(`insert into sponsor_objectives(sponsor_offer_id,season_id,name,description,objective_type,display_order,satisfaction_points,renewal_bonus_percent,target_details)
    select $1,$2,$3||' '||i,'Stable requirements',case when i=1 then 'race_result' when i=2 then 'nationality_quota' when i=3 then 'season_wins' when i=4 then 'rider_recruitment' else 'uci_ranking' end,
      i,10,0,jsonb_build_object('objectiveDifficulty',$4::text,'kind',case when i=1 then 'race_result' when i=4 then 'rider_recruitment' else 'uci_ranking' end,'riderName',$3::text,'targetRank',case when $4='ambitious' then 3 else 8 end,'achievementType','top_n')
    from generate_series(1,10) i`,[id(n),id(5),label,tier]);
  const goals=(await plan(n)).objectives;
  await db.query(`insert into race_result_objectives(objective_id,race_edition_id,target_scope,achievement_type,target_rank,required_count) values($1,$2,'race_final','top_n',8,1)`,[goals[0].id,id(70)]);
  await db.query('insert into nationality_objectives(objective_id,country_id,minimum_rider_count) values($1,$2,4)',[goals[1].id,id(80)]);
  await db.query('insert into season_win_objectives(objective_id,minimum_win_count,win_scope) values($1,2,\'stages\')',[goals[2].id]);
  await db.query(`insert into sponsor_main_objective_terms(sponsor_objective_id,cash_reward,reputation_penalty,race_category_code) values($1,$2,20,'world')`,[goals[0].id,tier==='ambitious'?110000:85000]);
}
const negotiate=async(n,tier,ds=8,base=1000000)=>Number(await scalar('select negotiate_sponsor_offer($1,$2,$3,$4,1500000) value',[id(n),id(ds),tier,base]));
const annual=async(tier,base=1000000)=>Number(await scalar('select negotiate_continuing_sponsor_objectives($1,$2,$3,$4,1500000) value',[id(10),id(8),tier,base]));
const prepare=async()=>scalar('select ensure_continuing_sponsor_offer($1,$2,1000000,1500000) value',[id(10),id(8)]);
try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;
    create table seasons(id uuid primary key,game_year int,status text,current_day_number int);
    create table sponsors(id uuid primary key,name text);
    create table team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text);
    create table sponsor_offers(id uuid primary key default gen_random_uuid(),sponsor_id uuid,season_id uuid,
      sporting_director_id uuid,continuing_contract_id uuid,title text,description text,budget_per_season numeric,
      base_budget_per_season numeric,negotiation_budget_ceiling numeric,objective_difficulty text,currency_code text,
      contract_duration_seasons int,available_from timestamptz,available_until timestamptz,status text,generation_version int,
      unique(continuing_contract_id,season_id));
    create table team_sponsor_contracts(id uuid primary key,team_id uuid,sponsor_id uuid,sponsor_offer_id uuid,
      pending_sponsor_offer_id uuid,start_season_id uuid,objective_season_id uuid,role text,status text,
      budget_per_season numeric,contract_duration_seasons int,currency_code text,satisfaction_score int,satisfaction_updated_at timestamptz);
    create table team_finance_transactions(id uuid primary key,amount numeric,status text);
    create function get_sponsor_objective_satisfaction_score(uuid) returns int language sql stable as $$select satisfaction_score from team_sponsor_contracts where id=$1$$;
    create function get_sponsor_performance_satisfaction_score(uuid) returns int language sql stable as $$select 0$$;
  `);
  // The six exact production row types, defaults and column order.
  for(const r of runtime.filter(r=>r.kind==='columns'))await db.exec(`create table public.${r.signature}(${r.attributes.map(c=>`"${c.name}" ${c.type}${c.default?' default '+c.default:''}`).join(',')});`);
  await db.exec(`alter table sponsor_objectives add primary key(id),add unique(sponsor_offer_id,display_order),add foreign key(sponsor_offer_id) references sponsor_offers(id) on delete cascade;
    alter table sponsor_main_objective_terms add primary key(sponsor_objective_id),add foreign key(sponsor_objective_id) references sponsor_objectives(id) on delete cascade;
    alter table objective_progress add primary key(id),add foreign key(sponsor_objective_id) references sponsor_objectives(id) on delete cascade;`);
  for(const name of ['race_result_objectives','nationality_objectives','season_win_objectives'])await db.exec(`alter table ${name} add primary key(objective_id),add foreign key(objective_id) references sponsor_objectives(id) on delete cascade;`);
  for(const r of runtime.filter(r=>r.kind==='function'))await db.exec(r.definition);
  await db.exec(definition(read('20261029153000_allow_sponsor_ambition_above_catalogue'),'private','sponsor_negotiation_budget_ceiling'));
  const cap=read('20261026110000_cap_future_sponsor_main_objective_rewards');
  for(const name of ['cap_sponsor_main_objective_reward','recap_sponsor_main_objectives_after_budget_change'])await db.exec(definition(cap,'private',name));
  await db.exec(`create trigger cap_future_sponsor_main_objective_reward before insert or update on sponsor_main_objective_terms for each row execute function private.cap_sponsor_main_objective_reward();
    create trigger recap_future_sponsor_main_objectives after update of budget_per_season on sponsor_offers for each row execute function private.recap_sponsor_main_objectives_after_budget_change();
    insert into seasons values('${id(3)}',3,'completed',28),('${id(4)}',4,'active',27),('${id(5)}',5,'planned',1),('${id(6)}',6,'planned',1);
    insert into sponsors values('${id(1)}','Sponsor');
    insert into team_manager_assignments values('${id(7)}','${id(8)}','general_manager','active');
    insert into sponsor_offers(id,sponsor_id,season_id,sporting_director_id,continuing_contract_id,budget_per_season,base_budget_per_season,negotiation_budget_ceiling,objective_difficulty,status)
    values('${id(19)}','${id(1)}','${id(4)}','${id(8)}',null,1000000,1000000,1500000,'balanced','accepted'),
      ('${id(20)}','${id(1)}','${id(5)}','${id(8)}','${id(10)}',1000000,1000000,1500000,'balanced','accepted'),
      ('${id(21)}','${id(1)}','${id(5)}','${id(8)}',null,1000000,1000000,1500000,'balanced','open'),
      ('${id(22)}','${id(1)}','${id(5)}','${id(9)}',null,1000000,1000000,1500000,'balanced','open'),
      ('${id(23)}','${id(1)}','${id(6)}','${id(8)}',null,1000000,1000000,1500000,'balanced','open');
    insert into team_sponsor_contracts(id,team_id,sponsor_id,sponsor_offer_id,pending_sponsor_offer_id,start_season_id,objective_season_id,role,status,budget_per_season,contract_duration_seasons,currency_code,satisfaction_score)
    values('${id(10)}','${id(7)}','${id(1)}','${id(19)}','${id(20)}','${id(3)}','${id(4)}','principal','active',1000000,3,'EUR',50);
    insert into sponsor_objectives(sponsor_offer_id,season_id,status,name,display_order,target_details) values('${id(19)}','${id(4)}','active','Signed requirement',1,'{"kind":"uci_ranking"}');
    insert into team_finance_transactions values('${id(40)}',100000,'posted');`);
  const signatures=runtime.filter(r=>r.kind==='function').map(r=>'public.'+r.signature);
  for(const fn of signatures)await db.exec(`revoke all on function ${fn} from public,anon,authenticated;grant execute on function ${fn} to service_role;`);
  const attrs=()=>rows('select oid::regprocedure::text signature,proacl::text,proconfig,prosecdef from pg_proc where oid=any($1::regprocedure[]) order by signature',[signatures]);
  await generate(21,'balanced','Initial Belgian target');await generate(20,'balanced','Annual initial target');
  const initial=await plan(21),initialAnnual=await plan(20),signed=await plan(19),contractBefore=await rows('select * from team_sponsor_contracts'),attributes=await attrs();
  await db.exec(migration);
  equal(await attrs(),attributes,'existing function privileges preserved');
  equal(await plan(21),initial,'installation preserves current offer');equal(await plan(20),initialAnnual,'installation preserves annual offer');equal(await plan(19),signed,'installation preserves signed terms');
  equal(await rows('select * from team_sponsor_contracts'),contractBefore,'no contract mutation on install');
  equal(await rows('select * from private.sponsor_objective_ambition_plans'),[],'no bulk gameplay backfill');

  const saved={balanced:initial};
  for(const tier of ['ambitious','balanced','ambitious','accessible','balanced','accessible','ambitious','balanced']){
    equal(await negotiate(21,tier),{balanced:1000000,ambitious:1100000,accessible:900000}[tier],'budget tier preserved');
    if(!saved[tier]){await generate(21,tier,'First '+tier+' target');saved[tier]=await plan(21);}
    equal(await plan(21),saved[tier],tier+' exact targets, IDs, order, weights and linked terms restored');
    equal((await offer(21)).objective_difficulty,tier);
  }
  equal(saved.ambitious.terms[0].cash_reward,'110000','ambitious reward not shrunk by temporary normal budget');
  equal(Number(await scalar('select count(*) value from private.sponsor_objective_ambition_plans where sponsor_offer_id=$1',[id(21)])),3,'bounded three snapshots');
  const snapshots=await rows('select * from private.sponsor_objective_ambition_plans order by sponsor_offer_id,objective_difficulty');
  for(let i=0;i<3;i++)equal(await negotiate(21,'balanced'),1000000,'same tier submit');
  equal(await plan(21),initial,'same tier does not reroll');equal(await rows('select * from private.sponsor_objective_ambition_plans order by sponsor_offer_id,objective_difficulty'),snapshots,'same tier creates no snapshot writes');

  await annual('ambitious');await generate(20,'ambitious','First annual ambitious target');const annualAmbitious=await plan(20);
  await annual('balanced');equal(await plan(20),initialAnnual,'annual normal restored');
  await annual('ambitious');equal(await plan(20),annualAmbitious,'annual ambitious restored');
  await db.exec(`update team_sponsor_contracts set satisfaction_score=80 where id='${id(10)}'`);
  equal(await prepare(),id(20));equal(await plan(20),annualAmbitious,'satisfaction budget refresh retains requirements');
  equal(Number((await offer(20)).base_budget_per_season),1060000,'annual satisfaction adjustment retained');
  await annual('balanced',1060000);equal(await plan(20),initialAnnual,'normal initial target retained despite market and budget evolution');
  await annual('ambitious',1060000);equal(await plan(20),annualAmbitious,'ambitious initial target retained after refresh');

  // Old render after a switch: cannot fill the new tier with the old targets.
  await negotiate(21,'ambitious');
  await rejects(()=>db.query(`insert into sponsor_objectives(sponsor_offer_id,season_id,name,display_order,target_details) values($1,$2,'Stale target',11,'{"objectiveDifficulty":"balanced"}')`,[id(21),id(5)]),/ambition a changé/);
  equal(await plan(21),saved.ambitious,'stale render leaves selected plan intact');

  // Ownership/calendar/signature guards still reject without deleting anything.
  await rejects(()=>negotiate(21,'balanced',9),/introuvable/);
  await rejects(()=>negotiate(21,'balanced',8,999999),/évolué/);
  await rejects(()=>negotiate(21,'wrong'),/invalide/);
  await rejects(()=>negotiate(23,'ambitious'),/réservée/);
  await rejects(()=>negotiate(19,'ambitious'),/négociable/);
  await db.exec(`update seasons set current_day_number=20 where id='${id(4)}'`);
  await rejects(()=>negotiate(21,'balanced'),/jour 21/);await rejects(()=>annual('balanced',1060000),/jour 21/);
  await db.exec(`update seasons set current_day_number=27 where id='${id(4)}'`);
  await rejects(()=>scalar('select negotiate_continuing_sponsor_objectives($1,$2,\'balanced\',1060000,1500000) value',[id(10),id(99)]),/appartient/);
  await db.query('update sponsor_offers set status=\'accepted\' where id=$1',[id(21)]);
  await rejects(()=>negotiate(21,'balanced'),/négociable/);equal(await plan(21),saved.ambitious,'signed plan unchanged');
  await db.query('update sponsor_offers set status=\'open\' where id=$1',[id(21)]);
  await db.query('update sponsor_objectives set status=\'active\' where sponsor_offer_id=$1',[id(21)]);
  await rejects(()=>negotiate(21,'balanced'),/négociables/);
  await db.query('update sponsor_objectives set status=\'draft\' where sponsor_offer_id=$1',[id(21)]);

  // Even an unexpected progress row is protected rather than deleted/restored.
  const firstObjective=(await plan(21)).objectives[0].id;
  await db.query('insert into objective_progress(sponsor_objective_id,team_sponsor_contract_id,season_id) values($1,$2,$3)',[firstObjective,id(10),id(5)]);
  await rejects(()=>negotiate(21,'balanced'),/négociables/);
  equal(Number(await scalar('select count(*) value from objective_progress')),1,'progress is not reset');
  await db.exec('delete from objective_progress');

  // Partial generation is never cached as a complete, permanently broken plan.
  await db.query(`insert into sponsor_objectives(sponsor_offer_id,season_id,name,display_order,target_details) values($1,$2,'Partial target',1,'{"objectiveDifficulty":"balanced"}')`,[id(22),id(5)]);
  await rejects(()=>negotiate(22,'ambitious',9),/préparation/);
  equal((await offer(22)).objective_difficulty,'balanced','failed switch rolls back budget/tier');
  equal(Number(await scalar('select count(*) value from sponsor_objectives where sponsor_offer_id=$1',[id(22)])),1,'partial target not deleted');
  await db.query('delete from sponsor_objectives where sponsor_offer_id=$1',[id(22)]);
  await negotiate(22,'ambitious',9);await generate(22,'ambitious','Other player target');
  await negotiate(22,'balanced',9);await generate(22,'balanced','Other player normal');
  equal(await plan(21),saved.ambitious,'players and offers isolated');

  for(const role of ['anon','authenticated','service_role']){
    equal(await scalar(`select has_table_privilege($1,'private.sponsor_objective_ambition_plans','select') value`,[role]),false,'private snapshot table '+role);
    for(const fn of ['remember_sponsor_objective_ambition(uuid,text)','restore_sponsor_objective_ambition(uuid,text)','guard_sponsor_objective_ambition_insert()'])equal(await scalar('select has_function_privilege($1,$2,\'execute\') value',[role,'private.'+fn]),false,'private helper '+role);
  }
  equal(await plan(19),signed,'current-season signed contract intact after all switches');
  equal(Number(await scalar('select amount value from team_finance_transactions')),100000,'no finance postings');
  const newDefinitions=await rows('select oid::regprocedure::text signature,pg_get_functiondef(oid) definition from pg_proc where oid=any($1::regprocedure[])',[signatures]);
  for(const before of runtime.filter(r=>r.kind==='function'))for(const line of before.definition.split('\n').filter(line=>line.includes('raise exception')))
    equal(newDefinitions.find(r=>r.signature===before.signature).definition.includes(line),true,'original safety check preserved');

  // Selected cached requirements follow the normal activation path; inactive
  // snapshots cannot become additional evaluated objectives or renewals.
  await negotiate(21,'balanced');
  await db.query('update sponsor_offers set status=\'accepted\' where id=$1',[id(21)]);
  await db.query('update sponsor_objectives set status=\'active\',is_provisional=false where sponsor_offer_id=$1',[id(21)]);
  equal((await plan(21)).objectives.map(o=>o.target_details),initial.objectives.map(o=>o.target_details),'activation retains the selected goals');
  equal(Number(await scalar('select count(*) value from sponsor_objectives where sponsor_offer_id=$1',[id(21)])),10,'only ten selected objectives activated');
  await rejects(()=>negotiate(21,'ambitious'),/négociable/);

  // A drift in the second patched routine rolls back the first patch and all
  // new objects. Never install a partial migration against a changed engine.
  await db.exec(`drop trigger guard_sponsor_objective_ambition_insert on sponsor_objectives;
    drop function private.guard_sponsor_objective_ambition_insert();
    drop function private.remember_sponsor_objective_ambition(uuid,text);
    drop function private.restore_sponsor_objective_ambition(uuid,text);
    drop table private.sponsor_objective_ambition_plans;`);
  for(const r of runtime.filter(r=>r.kind==='function'))await db.exec(r.signature.startsWith('negotiate_continuing_')?r.definition.replace('  delete from public.sponsor_objectives','  delete  from public.sponsor_objectives'):r.definition);
  const drifted=await rows('select oid::regprocedure::text signature,pg_get_functiondef(oid) definition from pg_proc where oid=any($1::regprocedure[]) order by signature',[signatures]);
  await rejects(()=>db.exec(migration),/Unexpected sponsor ambition switch source/);await db.exec('rollback;');
  equal(await scalar("select to_regclass('private.sponsor_objective_ambition_plans')::text value"),null,'drift abort leaves no new table');
  equal(await rows('select oid::regprocedure::text signature,pg_get_functiondef(oid) definition from pg_proc where oid=any($1::regprocedure[]) order by signature',[signatures]),drifted,'drift abort leaves all functions unchanged');
  if(process.argv[4]){
    mkdirSync(process.argv[4],{recursive:true});
    writeFileSync(process.argv[4]+'/isolated-verification.json',JSON.stringify({checkedAt:new Date().toISOString(),checks,
      migrationSha256:createHash('sha256').update(migration).digest('hex'),before:runtime.filter(r=>r.kind==='function'),after:newDefinitions},null,2));
  }
  console.log(`${checks} sponsor ambition plan checks passed in isolated PostgreSQL.`);
}catch(error){console.error(error.message,error.where??'',error.stack);process.exitCode=1;}
finally{await db.close();}
