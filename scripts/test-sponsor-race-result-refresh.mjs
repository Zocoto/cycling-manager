// Isolated PostgreSQL only. Reconstruct the real evaluator from committed SQL.
// No production credentials, network or fixtures against a live database.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const read = name => readFileSync(`supabase/migrations/${name}.sql`,'utf8').replaceAll('\r','');
const def = (source,name,schema='public') => {
  const start = source.toLowerCase().indexOf(`create or replace function ${schema}.${name}(`);
  assert(start >= 0, name);
  return source.slice(start,source.indexOf('$$;',start)+3);
};
const fix=read('20261102120000_refresh_unsettled_sponsor_race_results');
let checks=0;
try {
  await db.exec(`
    create schema private; create role anon; create role authenticated; create role service_role;
    create table seasons(id uuid primary key,game_year integer,status text,starts_on date,ends_on date);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,status text,final_rank integer,next_sponsor_budget_bonus_percent numeric default 0,cash_balance numeric default 30000);
    create table team_sponsor_contracts(id uuid primary key,team_id uuid,sponsor_offer_id uuid,start_season_id uuid,objective_season_id uuid,status text,role text,satisfaction_score integer default 0,satisfaction_updated_at timestamptz,budget_per_season numeric default 50000);
    create table sporting_directors(id uuid primary key,reputation_points integer default 100);
    create table team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text);
    create table sponsor_objectives(id uuid primary key default gen_random_uuid(),sponsor_offer_id uuid,season_id uuid,objective_type text,status text,satisfaction_points integer,target_details jsonb,display_order integer,renewal_bonus_percent numeric default 0,updated_at timestamptz);
    create table objective_progress(id uuid primary key default gen_random_uuid(),sponsor_objective_id uuid,team_sponsor_contract_id uuid,season_id uuid,current_value numeric,status text,details jsonb,settled_at timestamptz,updated_at timestamptz,last_evaluated_at timestamptz,achieved_at timestamptz,reputation_penalty integer default 0,unique(sponsor_objective_id,team_sponsor_contract_id,season_id));
    create table races(id uuid primary key,race_format text);
    create table race_editions(id uuid primary key,race_id uuid,season_id uuid,status text,created_at timestamptz default now());
    create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid);
    create table race_rosters(id uuid primary key,race_registration_id uuid);
    create table race_results(id uuid primary key default gen_random_uuid(),race_edition_id uuid,race_roster_id uuid,status text,final_rank integer);
    create table stages(id uuid primary key,race_edition_id uuid,status text);
    create table stage_results(id uuid,stage_id uuid,race_roster_id uuid,status text,rank integer,finish_rank integer);
    create table race_secondary_results(race_edition_id uuid,classification_type text,race_roster_id uuid,team_season_id uuid,rank integer,points integer);
    create table race_combativity_awards(id uuid primary key default gen_random_uuid(),race_edition_id uuid,stage_id uuid,race_roster_id uuid,award_scope text);
    create table sponsor_satisfaction_events(team_sponsor_contract_id uuid,season_id uuid,event_type text,points integer);
    create function get_team_specialization_power(uuid,text,text) returns integer language sql as $$ select 0 $$;
  `);
  let base=def(read('20260813110000_expand_sponsor_objectives_and_satisfaction'),'evaluate_sponsor_objectives_for_contract')
    .replace('public.evaluate_sponsor_objectives_for_contract(','public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821(')
    .replace('contract.start_season_id,','coalesce(contract.objective_season_id, contract.start_season_id) as objective_season_id,')
    .replace('team_season.season_id = contract.start_season_id','team_season.season_id = coalesce(contract.objective_season_id, contract.start_season_id)')
    .replace('join public.seasons as season on season.id = contract.start_season_id','join public.seasons as season on season.id = coalesce(contract.objective_season_id, contract.start_season_id)')
    .replaceAll('v_contract.start_season_id','v_contract.objective_season_id')
    .replaceAll('and objective.season_id = v_contract.objective_season_id',"and objective.season_id = v_contract.objective_season_id and objective.status <> 'cancelled'")
    .replace('if v_edition_id is null then','if v_edition_id is null or not exists (select 1 from public.race_editions as expected_edition where expected_edition.id = v_edition_id and expected_edition.season_id = v_contract.objective_season_id) then');
  await db.exec(base);
  // The outer reputation wrapper is unrelated to classification resolution;
  // delegate through it without simulating staff, transfers or annual finance.
  await db.exec(`create function evaluate_sponsor_objectives_pre_partial_success_20260927(uuid,boolean) returns void language sql as $$ select public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821($1,$2) $$;`);
  await db.exec(read('20261011124731_expand_sponsor_partial_race_achievements'));
  await db.exec(`create trigger test_satisfaction before insert or update on team_sponsor_contracts for each row execute function synchronize_s3_sponsor_satisfaction_score();
    insert into seasons values('${id(4)}',4,'active','2026-10-09','2026-11-05'),('${id(3)}',3,'completed','2026-09-11','2026-10-08');
    insert into team_seasons(id,team_id,season_id,status) values('${id(6)}','${id(7)}','${id(4)}','active'),('${id(8)}','${id(9)}','${id(4)}','active');
    insert into team_sponsor_contracts(id,team_id,sponsor_offer_id,start_season_id,objective_season_id,status,role) values('${id(1)}','${id(7)}','${id(2)}','${id(3)}','${id(4)}','active','principal');
    insert into races values('${id(11)}','stage_race');
    insert into race_editions(id,race_id,season_id,status) values('${id(10)}','${id(11)}','${id(4)}','completed'),('${id(12)}','${id(11)}','${id(3)}','completed');
    insert into race_registrations values('${id(21)}','${id(10)}','${id(6)}'),('${id(23)}','${id(10)}','${id(8)}');
    insert into race_rosters values('${id(20)}','${id(21)}'),('${id(22)}','${id(23)}');
    insert into stages values('${id(50)}','${id(10)}','completed');
    insert into sponsor_objectives(id,sponsor_offer_id,season_id,objective_type,status,satisfaction_points,target_details,display_order) values('${id(30)}','${id(2)}','${id(4)}','race_result','failed',20,'{"raceEditionId":"${id(10)}","raceId":"${id(11)}","targetRank":5}',1);
    insert into objective_progress(id,sponsor_objective_id,team_sponsor_contract_id,season_id,current_value,status,details) values('${id(31)}','${id(30)}','${id(1)}','${id(4)}',0,'failed','{}');
    insert into race_results(race_edition_id,race_roster_id,status,final_rank) values('${id(10)}','${id(20)}','classified',2);
    insert into race_secondary_results values('${id(10)}','mountain','${id(20)}',null,3,40);
  `);
  const refresh=finalize=>db.query('select public.evaluate_sponsor_objectives_for_contract($1,$2)',[id(1),finalize??false]);
  const snapshot=async()=> (await db.query(`select p.*,o.status objective_status,c.satisfaction_score score,c.cash_balance from objective_progress p join sponsor_objectives o on o.id=p.sponsor_objective_id cross join lateral (select c.satisfaction_score,ts.cash_balance from team_sponsor_contracts c join team_seasons ts on ts.team_id=c.team_id and ts.season_id=p.season_id where c.id=p.team_sponsor_contract_id) c where p.id=$1`,[id(31)])).rows[0];
  await refresh(); let row=await snapshot();
  assert.equal(row.status,'failed'); assert.equal(row.details.achievementLevel,'partial'); assert.equal(row.score,5); checks++;
  console.log('PASS reproduced: official 2nd, Top 5 marked partial, only 5/20 points.');
  const aclBefore=(await db.query(`select proacl::text acl from pg_proc where oid='public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821(uuid,boolean)'::regprocedure`)).rows[0].acl;
  await db.exec(fix); await refresh(); row=await snapshot();
  assert.equal(row.status,'achieved'); assert.equal(row.objective_status,'completed'); assert.equal(Number(row.current_value),2);
  assert.equal(row.details.achievementLevel,'full'); assert.equal(row.details.partialSatisfactionPoints,0); assert.deepEqual(row.details.partialAchievements,[]); assert.equal(row.score,20); checks+=7;
  await refresh(); row=await snapshot(); assert.equal(row.score,20); assert.equal(Number(row.cash_balance),30000); checks+=2;
  // An official result change repairs terminal success, rank and partial credit.
  await db.exec(`update race_results set final_rank=7 where race_roster_id='${id(20)}';`); await refresh(); row=await snapshot();
  assert.equal(row.status,'failed'); assert.equal(Number(row.current_value),7); assert.equal(row.details.achievementLevel,'partial'); assert.equal(row.score,8); checks+=4;
  await db.exec(`update race_results set final_rank=20 where race_roster_id='${id(20)}';`); await refresh(); row=await snapshot(); assert.equal(row.score,5); checks++;
  await db.exec('delete from race_secondary_results'); await refresh(); row=await snapshot(); assert.equal(row.score,0); assert.equal(row.details.achievementLevel,'missed'); checks+=2;
  // Before final homologation, a provisional placing does not validate a goal.
  await db.exec(`update race_editions set status='in_progress' where id='${id(10)}'; update race_results set final_rank=2;`);
  await refresh(); row=await snapshot(); assert.equal(row.status,'in_progress'); assert.equal(row.objective_status,'active'); assert.equal(row.score,0); checks+=3;
  await db.exec(`update race_editions set status='completed' where id='${id(10)}';`); await refresh(); assert.equal((await snapshot()).score,20); checks++;
  // Sealed main objectives/history cannot be reopened or paid again.
  await db.exec(`update objective_progress set settled_at=now(); update race_results set final_rank=40;`); await refresh(); row=await snapshot();
  assert.equal(row.status,'achieved'); assert.equal(Number(row.current_value),2); assert.equal(row.score,20); checks+=3;
  await db.exec(`update objective_progress set status='failed',current_value=0,details='{"sealed":true}';update sponsor_objectives set status='failed';update race_results set final_rank=1;`);
  await refresh(); row=await snapshot(); assert.equal(row.status,'failed'); assert.equal(Number(row.current_value),0); assert.equal(row.details.sealed,true); checks+=3;
  // Withdrawals/DQ and foreign teams or seasons never qualify.
  await db.exec(`update objective_progress set settled_at=null; update race_results set status='disqualified'; insert into race_results(race_edition_id,race_roster_id,status,final_rank) values('${id(10)}','${id(22)}','classified',1),('${id(12)}','${id(20)}','classified',1);`);
  await refresh(); row=await snapshot(); assert.equal(row.status,'failed'); assert.equal(Number(row.current_value),0); assert.equal(row.score,0); checks+=3;
  // Cancelled objectives retain their neutralized state even with a victory.
  await db.exec(`update sponsor_objectives set status='cancelled';update race_results set status='classified';`); const neutral=await snapshot();await refresh();row=await snapshot();assert.equal(row.objective_status,'cancelled');assert.equal(row.status,neutral.status);checks+=2;
  // Fallback to the edition in the actual objective season, never an old year.
  await db.exec(`update sponsor_objectives set status='failed',target_details=jsonb_set(target_details,'{raceEditionId}','"${id(12)}"');`);await refresh();row=await snapshot();assert.equal(row.status,'achieved');assert.equal(Number(row.current_value),1);checks+=2;
  // Non-race terminal objectives preserve their existing behavior.
  await db.exec(`update sponsor_objectives set objective_type='infrastructure';update objective_progress set current_value=9;`);await refresh();row=await snapshot();assert.equal(row.status,'achieved');assert.equal(Number(row.current_value),9);checks+=2;
  await db.exec(fix); assert.equal((await db.query(`select proacl::text acl from pg_proc where oid='public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821(uuid,boolean)'::regprocedure`)).rows[0].acl,aclBefore);checks++;
  console.log(`PASS ${checks} isolated SQL assertions: official ranks, stale failure/success, partials, publication order, annual scope, sealed history, non-race goals, unchanged cash and ACLs.`);
} finally { await db.close(); }
