import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(pathToFileURL(process.env.SPONSOR_PARTIAL_SQL_TEST_MODULE).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const migration = readFileSync('supabase/migrations/20261011124731_expand_sponsor_partial_race_achievements.sql','utf8');
let checks = 0;
try {
  await db.exec(`
    create schema private;
    create role anon; create role authenticated; create role service_role;
    create table seasons(id uuid primary key, game_year integer, status text);
    create table team_seasons(id uuid primary key, team_id uuid, season_id uuid, cash_balance numeric default 30000);
    create table races(id uuid primary key, race_format text);
    create table race_editions(id uuid primary key,race_id uuid,season_id uuid,status text,created_at timestamptz default now());
    create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid);
    create table race_rosters(id uuid primary key,race_registration_id uuid);
    create table stages(id uuid primary key,race_edition_id uuid,status text);
    create table stage_results(stage_id uuid,race_roster_id uuid,status text,rank integer);
    create table race_results(race_edition_id uuid,race_roster_id uuid,status text,final_rank integer);
    create table race_secondary_results(race_edition_id uuid,classification_type text,race_roster_id uuid,team_season_id uuid,rank integer,points integer);
    create table race_combativity_awards(id uuid primary key default gen_random_uuid(),race_edition_id uuid,stage_id uuid,race_roster_id uuid,award_scope text);
    create table team_sponsor_contracts(id uuid primary key,team_id uuid,sponsor_offer_id uuid,start_season_id uuid,objective_season_id uuid,status text,role text,satisfaction_score integer default 0,satisfaction_updated_at timestamptz,budget_per_season numeric default 50000);
    create table sponsor_objectives(id uuid primary key,sponsor_offer_id uuid,season_id uuid,objective_type text,status text,satisfaction_points integer,target_details jsonb,display_order integer);
    create table objective_progress(id uuid primary key,sponsor_objective_id uuid,team_sponsor_contract_id uuid,season_id uuid,current_value numeric,status text,details jsonb,settled_at timestamptz,updated_at timestamptz);
    create table sponsor_satisfaction_events(team_sponsor_contract_id uuid,season_id uuid,event_type text,points integer);
    create table test_media(power integer); insert into test_media values(0);
    create function get_team_specialization_power(uuid,text,text) returns integer language sql as $$ select power from public.test_media $$;
    create table legacy_calls(finalize boolean);
    -- The pre-existing main evaluator is a boundary stub; the actual new SQL
    -- computes every achievement, score and trigger in this isolated database.
    create function evaluate_sponsor_objectives_pre_partial_success_20260927(uuid,boolean)
    returns void language plpgsql as $$ begin insert into public.legacy_calls values($2); end $$;
    insert into seasons values('${id(4)}',4,'active'),('${id(5)}',3,'completed');
    insert into team_seasons(id,team_id,season_id) values('${id(6)}','${id(3)}','${id(4)}'),('${id(7)}','${id(8)}','${id(4)}');
    insert into races values('${id(11)}','stage_race');
    insert into race_editions(id,race_id,season_id,status) values('${id(10)}','${id(11)}','${id(4)}','completed'),('${id(12)}','${id(11)}','${id(5)}','completed');
    insert into race_registrations values('${id(21)}','${id(10)}','${id(6)}'),('${id(23)}','${id(10)}','${id(7)}');
    insert into race_rosters values('${id(20)}','${id(21)}'),('${id(22)}','${id(23)}');
    insert into stages select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'${id(10)}','completed' from generate_series(50,60) as n;
    insert into stages values('${id(99)}','${id(12)}','completed');
    insert into team_sponsor_contracts(id,team_id,sponsor_offer_id,start_season_id,objective_season_id,status,role) values('${id(1)}','${id(3)}','${id(2)}','${id(5)}','${id(4)}','active','principal');
    insert into sponsor_objectives values('${id(30)}','${id(2)}','${id(4)}','race_result','failed',20,'{"raceEditionId":"${id(10)}","raceId":"${id(11)}","targetRank":1}',1);
    insert into objective_progress(id,sponsor_objective_id,team_sponsor_contract_id,season_id,current_value,status,details) values('${id(31)}','${id(30)}','${id(1)}','${id(4)}',52,'failed','{}');
  `);
  await db.exec(migration);
  await db.exec(`create trigger test_satisfaction before insert or update on team_sponsor_contracts for each row execute function synchronize_s3_sponsor_satisfaction_score();`);
  const refresh = () => db.query('select evaluate_sponsor_objectives_for_contract($1,false)',[id(1)]);
  const snapshot = async () => (await db.query(`select progress.details,contract.satisfaction_score as score,objective.status,
    get_sponsor_objective_satisfaction_score(contract.id) as canonical
    from objective_progress as progress join sponsor_objectives as objective on objective.id=progress.sponsor_objective_id
    join team_sponsor_contracts as contract on contract.id=progress.team_sponsor_contract_id where progress.id=$1`,[id(31)])).rows[0];
  const reset = async () => {
    await db.exec(`delete from stage_results; delete from race_secondary_results; delete from race_combativity_awards;
      delete from sponsor_satisfaction_events; update test_media set power=0;
      update races set race_format='stage_race'; update race_editions set status='completed'; update stages set status='completed';
      update sponsor_objectives set status='failed',satisfaction_points=20;
      update objective_progress set current_value=52,status='failed',details='{}',settled_at=null;
      update team_sponsor_contracts set objective_season_id='${id(4)}';`);
  };
  const check = async (points, level='partial') => {
    await refresh(); const row=await snapshot();
    assert.equal(row.details.achievementLevel,level);
    assert.equal(row.details.partialSatisfactionPoints,points);
    assert.equal(row.score,points); assert.equal(row.canonical,points);
    assert.equal(row.status,'failed'); checks++;
    return row;
  };
  for (const [rank,points,code] of [[1,8,'stage_win'],[2,5,'stage_podium'],[3,5,'stage_podium'],[4,3,'stage_top5'],[5,3,'stage_top5'],[6,2,'stage_top10'],[10,2,'stage_top10']]) {
    await reset(); await db.query(`insert into stage_results values($1,$2,'finished',$3)`,[id(50),id(20),rank]);
    const row=await check(points); assert.equal(row.details.partialAchievements[0].code,code);
  }
  for (const classification of ['mountain','sprint','youth','team']) {
    for (const [rank,points] of [[1,8],[2,5],[3,5]]) {
      await reset(); await db.query('insert into race_secondary_results values($1,$2,$3,$4,$5,100)',
        [id(10),classification,classification==='team'?null:id(20),classification==='team'?id(6):null,rank]);
      const row=await check(points); assert.equal(row.details.partialAchievements[0].code,`${classification}_classification`);
    }
  }
  await reset(); await db.exec(`insert into stage_results values('${id(50)}','${id(20)}','finished',1),('${id(51)}','${id(20)}','finished',1);
    insert into race_secondary_results values('${id(10)}','mountain','${id(20)}',null,1,100);`);
  let row=await check(8); assert.equal(row.details.partialAchievements.find(f=>f.code==='stage_win').count,2);
  await refresh(); assert.deepEqual((await snapshot()).details,row.details); assert.equal((await snapshot()).score,8); checks++;
  // Already failed general, official prize persisted later: no page visit needed.
  await reset(); await refresh();
  await db.exec(`insert into race_combativity_awards(race_edition_id,stage_id,race_roster_id,award_scope) values('${id(10)}','${id(50)}','${id(20)}','stage');`);
  row=await snapshot(); assert.equal(row.score,4); assert.equal(row.details.partialAchievements[0].code,'combativity_stage'); checks++;
  await db.exec(`update race_combativity_awards set race_roster_id='${id(22)}';`);
  assert.equal((await snapshot()).score,0); checks++;
  await reset(); await db.exec(`insert into race_combativity_awards(race_edition_id,race_roster_id,award_scope) values('${id(10)}','${id(20)}','race');`);
  await check(6);
  await db.exec('delete from race_combativity_awards'); assert.equal((await snapshot()).score,0); checks++;
  // Missing GC rank (e.g. later DNF) must not erase a legitimate stage win.
  await reset(); await db.exec(`update objective_progress set current_value=0; insert into stage_results values('${id(50)}','${id(20)}','finished',1);`);
  row=await check(8); assert.equal(row.details.resultRank,null);
  // Main objective fulfilled: full weight, never partial plus full.
  await reset(); await db.exec(`update objective_progress set current_value=1,status='achieved'; update sponsor_objectives set status='completed';
    insert into stage_results values('${id(50)}','${id(20)}','finished',1);`);
  await refresh(); row=await snapshot(); assert.equal(row.score,20); assert.equal(row.details.achievementLevel,'full'); assert.equal(row.details.partialSatisfactionPoints,0); assert.deepEqual(row.details.partialAchievements,[]); checks++;
  // Preserve the original near-target podium tier for a victory objective.
  await reset(); await db.exec('update objective_progress set current_value=3'); await check(8);
  // Foreign team, wrong edition/season, unhomologated stage, DQ, zero points.
  await reset(); await db.exec(`insert into stage_results values('${id(50)}','${id(22)}','finished',1),('${id(99)}','${id(20)}','finished',1),('${id(51)}','${id(20)}','disqualified',null);
    insert into race_secondary_results values('${id(10)}','team',null,'${id(7)}',1,100),('${id(10)}','mountain','${id(20)}',null,1,0);`);
  await check(0,'missed');
  await reset(); await db.exec(`update stages set status='planned'; insert into stage_results values('${id(50)}','${id(20)}','finished',1);`); await check(0,'missed');
  await reset(); await db.exec(`update race_editions set status='cancelled'; insert into stage_results values('${id(50)}','${id(20)}','finished',1);`);
  await refresh(); row=await snapshot(); assert.equal(row.score,0); assert.equal(row.details.achievementLevel,null); checks++;
  await reset(); await db.exec(`update races set race_format='one_day'; insert into stage_results values('${id(50)}','${id(20)}','finished',1);`); await check(0,'missed');
  // Official replay reopens progress and corrects the results: recompute, don't accumulate.
  await reset(); await db.exec(`insert into stage_results values('${id(50)}','${id(20)}','finished',1);`); await check(8);
  await db.exec(`update stage_results set rank=11; update objective_progress set status='in_progress';`); await check(0,'missed');
  // Sealed history is not rewritten by late award notifications.
  await reset(); await db.exec(`update objective_progress set settled_at=now(),details='{"historical":true}';
    insert into race_combativity_awards(race_edition_id,race_roster_id,award_scope) values('${id(10)}','${id(20)}','race');`);
  await refresh(); assert.deepEqual((await snapshot()).details,{historical:true}); checks++;
  // Annual rollover uses NEW, not the previous season's objective subtotal/events.
  await reset(); await db.exec('update objective_progress set current_value=3'); await check(8);
  await db.exec(`insert into sponsor_satisfaction_events values('${id(1)}','${id(4)}','race_result',100),('${id(1)}','${id(4)}','pre_race_commitment',100);
    update team_sponsor_contracts set satisfaction_score=0;`);
  assert.equal((await snapshot()).score,41); checks++;
  await db.exec(`update team_sponsor_contracts set objective_season_id='${id(5)}';`);
  assert.equal((await snapshot()).score,0); checks++;
  await reset(); await db.exec('update objective_progress set current_value=3; update test_media set power=1;');
  await refresh(); assert.equal((await snapshot()).canonical,9); assert.equal((await snapshot()).score,9); checks++;
  // Historical 40% details remain readable; corrupt percentages cannot credit 100%.
  assert.equal((await db.query(`select private.sponsor_partial_objective_points(20,'{"achievementLevel":"partial"}') as points`)).rows[0].points,8);
  assert.equal((await db.query(`select private.sponsor_partial_objective_points(20,'{"achievementLevel":"partial","partialCreditPercent":100}') as points`)).rows[0].points,0);
  assert.equal((await db.query(`select private.sponsor_partial_objective_points(0,'{"achievementLevel":"partial"}') as points`)).rows[0].points,0); checks+=3;
  // Explicit finalization is forwarded unchanged to the preserved evaluator.
  await db.query('select evaluate_sponsor_objectives_for_contract($1,true)',[id(1)]);
  assert.equal((await db.query('select finalize from legacy_calls order by ctid desc limit 1')).rows[0].finalize,true); checks++;
  await db.exec(migration); await refresh();
  assert.equal((await db.query(`select has_function_privilege('authenticated','public.evaluate_sponsor_objectives_for_contract(uuid,boolean)','EXECUTE') as allowed`)).rows[0].allowed,false); checks++;
  assert.equal((await db.query('select cash_balance from team_seasons where id=$1',[id(6)])).rows[0].cash_balance,'30000');
  assert.equal((await db.query('select budget_per_season from team_sponsor_contracts where id=$1',[id(1)])).rows[0].budget_per_season,'50000'); checks++;
  console.log(`PASS: ${checks} isolated SQL checks; stages, annexes, combativity, caps, DNF, replay, rollover, history, permissions and unchanged finances.`);
} catch (error) {
  console.error('FAIL:', error.message, error.where ?? '');
  process.exitCode = 1;
} finally { await db.close(); }
