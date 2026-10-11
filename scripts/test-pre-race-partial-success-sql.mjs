import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.SPONSOR_PARTIAL_SQL_TEST_MODULE).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const catchupId = 'feed9099-f880-4273-9378-390213f3617e';
const migration = readFileSync('supabase/migrations/20261011150742_add_pre_race_press_partial_success.sql','utf8');
const source = readFileSync('supabase/migrations/20260927200000_create_s4_reputation_system.sql','utf8');
const reputationFunction = name => source.match(new RegExp(`create or replace function private\\.${name}\\([\\s\\S]*?\n\\$\\$;`))[0];
const annualSource = readFileSync('supabase/migrations/20261001060000_stabilize_annual_sponsor_page.sql','utf8');
let checks = 0;
try {
  await db.exec(`
    create schema private; create schema auth;
    create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.auth_user',true),'')::uuid $$;
    create table seasons(id uuid primary key,game_year integer,status text);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,reputation_points numeric);
    create table reputation_ledger(id uuid default gen_random_uuid(),sporting_director_id uuid,season_id uuid,
      source_type text,source_reference text unique,requested_delta numeric,applied_delta numeric,
      points_before numeric,points_after numeric,description text,metadata jsonb,created_at timestamptz default now());
    create table reputation_commitments(id uuid primary key,sporting_director_id uuid,season_id uuid,
      source_type text,amount numeric,status text default 'active',settlement_outcome text,
      loss_amount numeric default 0,settled_at timestamptz);
    create table race_editions(id uuid primary key,season_id uuid,status text);
    create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid);
    create table race_rosters(id uuid primary key,race_registration_id uuid,rider_id uuid);
    create table race_results(race_edition_id uuid,race_roster_id uuid,status text,final_rank integer);
    create table team_sponsor_contracts(id uuid primary key,team_id uuid,role text,status text,start_season_id uuid,
      objective_season_id uuid,contract_duration_seasons integer,created_at timestamptz default now());
    create table sponsor_satisfaction_events(team_sponsor_contract_id uuid,season_id uuid,event_type text,
      source_key text,race_edition_id uuid,rider_id uuid,points integer check(points>0),title text,description text,metadata jsonb,
      unique(team_sponsor_contract_id,source_key));
    create table pre_race_press_conferences(id uuid primary key,race_edition_id uuid,season_id uuid,team_season_id uuid,
      team_id uuid,sporting_director_id uuid,leader_rider_id uuid,race_name text,team_name text,director_name text,
      leader_name text,ambition text,race_intent text,public_statement text,status text default 'published',target_met boolean,
      leader_final_rank integer,reputation_delta integer,submitted_at timestamptz default now(),settled_at timestamptz,
      reputation_commitment_id uuid,commitment_amount integer default 0,sponsor_bonus smallint default 0,
      check((status='published' and target_met is null and reputation_delta is null and settled_at is null)
        or(status='settled' and target_met is not null and reputation_delta is not null and settled_at is not null)
        or status='cancelled'));
    insert into seasons values('${id(1)}',4,'active'),('${id(2)}',3,'completed');
    insert into race_editions values('${id(3)}','${id(1)}','completed');
    insert into sporting_directors values('${id(4)}','${id(5)}',1000);
    insert into team_sponsor_contracts(id,team_id,role,status,start_season_id,objective_season_id,contract_duration_seasons)
      values('${id(14)}','${id(12)}','principal','active','${id(1)}','${id(1)}',1);
  `);
  await db.exec(reputationFunction('apply_reputation_delta'));
  await db.exec(reputationFunction('settle_reputation_commitment'));
  await db.exec(annualSource.match(/create or replace function public\.get_sponsor_performance_satisfaction_score\([\s\S]*?\n\$\$;/)[0]);
  // Isolated representative data for the guarded, real current-season catch-up.
  await db.exec(`insert into pre_race_press_conferences(id,race_edition_id,season_id,team_season_id,team_id,
    sporting_director_id,leader_rider_id,race_name,ambition,status,target_met,leader_final_rank,reputation_delta,settled_at)
    values('${catchupId}','${id(3)}','${id(1)}','${id(13)}','${id(12)}','${id(4)}','${id(11)}','Test race','top_10','settled',false,15,-2,now());
    select private.apply_reputation_delta('${id(4)}','${id(1)}',-2,'pre_race_press','pre-race-press-result:${catchupId}','Original result');`);
  await db.exec(migration);
  let catchup = (await db.query(`select achievement_level,achievement_percent,reputation_delta from pre_race_press_conferences where id=$1`,[catchupId])).rows[0];
  assert.deepEqual(catchup,{achievement_level:'partial',achievement_percent:40,reputation_delta:1});
  assert.equal(Number((await db.query('select reputation_points from sporting_directors')).rows[0].reputation_points),1001);
  assert.equal(Number((await db.query(`select applied_delta from reputation_ledger where source_reference=$1`,[`pre-race-press-result:${catchupId}`])).rows[0].applied_delta),-2); checks++;
  await db.exec(migration);
  assert.equal((await db.query('select count(*)::integer as n from reputation_ledger')).rows[0].n,2);
  assert.equal(Number((await db.query('select reputation_points from sporting_directors')).rows[0].reputation_points),1001); checks++;

  const reset = async (ambition='victory',rank=2,stake=0,bonus=0,year=4) => {
    await db.exec(`delete from pre_race_press_conferences where id <> '${catchupId}'; delete from reputation_commitments;
      delete from reputation_ledger where source_reference not in ('pre-race-press-result:${catchupId}','pre-race-press-partial-catchup:${catchupId}');
      delete from sponsor_satisfaction_events; delete from race_results; delete from race_rosters; delete from race_registrations;
      update sporting_directors set reputation_points=1001;
      update race_editions set season_id='${year===4?id(1):id(2)}',status='completed';
      update team_sponsor_contracts set status='active',objective_season_id='${id(1)}';
      insert into race_registrations values('${id(15)}','${id(3)}','${id(13)}');
      insert into race_rosters values('${id(16)}','${id(15)}','${id(11)}');`);
    if(rank!==null) await db.query(`insert into race_results values($1,$2,'classified',$3)`,[id(3),id(16),rank]);
    if(stake) await db.query(`insert into reputation_commitments(id,sporting_director_id,season_id,source_type,amount) values($1,$2,$3,'pre_race_press',$4)`,[id(18),id(4),id(1),stake]);
    await db.query(`insert into pre_race_press_conferences(id,race_edition_id,season_id,team_season_id,team_id,sporting_director_id,
      leader_rider_id,race_name,team_name,director_name,leader_name,ambition,race_intent,public_statement,
      commitment_amount,sponsor_bonus,reputation_commitment_id) values($1,$2,$3,$4,$5,$6,$7,'Test race','Test team','DS','Leader',$8,'attack','Public promise',$9,$10,$11)`,
      [id(10),id(3),year===4?id(1):id(2),id(13),id(12),id(4),id(11),ambition,stake,bonus,stake?id(18):null]);
  };
  const settle = () => db.query('select private.settle_pre_race_press_conferences($1) as n',[id(3)]);
  const snapshot = async () => (await db.query('select * from pre_race_press_conferences where id=$1',[id(10)])).rows[0];
  const cases = {
    victory:[[1,100,8],[2,40,3],[3,40,3],[4,20,2],[5,20,2],[6,0,-4],[null,0,-4]],
    podium:[[3,100,5],[4,40,2],[5,40,2],[6,20,1],[10,20,1],[11,0,-3]],
    top_10:[[10,100,3],[11,40,1],[15,40,1],[16,20,1],[20,20,1],[21,0,-2]],
    visibility:[[20,100,2],[21,40,1],[25,40,1],[26,20,1],[30,20,1],[31,0,-1]],
  };
  for(const [ambition,results] of Object.entries(cases)) for(const [rank,percent,delta] of results){
    await reset(ambition,rank); assert.equal((await settle()).rows[0].n,1); const row=await snapshot();
    assert.equal(row.achievement_percent,percent); assert.equal(row.target_met,percent===100);
    assert.equal(row.achievement_level,percent===100?'full':percent>0?'partial':'missed');
    assert.equal(row.reputation_delta,delta); assert.equal(row.status,'settled');
    assert.equal((await db.query('select count(*)::integer as n from sponsor_satisfaction_events')).rows[0].n,0); checks++;
  }
  for(const [rank,percent,delta,loss,awarded] of [[1,100,8,0,4],[2,40,-33,36,2],[4,20,-46,48,1],[6,0,-64,60,0]]){
    await reset('victory',rank,60,4); await settle(); const row=await snapshot();
    const commitment=(await db.query('select * from reputation_commitments')).rows[0];
    assert.equal(row.achievement_percent,percent); assert.equal(row.reputation_delta,delta);
    assert.equal(Number(commitment.loss_amount),loss); assert.equal(row.sponsor_bonus_awarded,awarded);
    assert.equal(commitment.settlement_outcome,percent===100?'achieved':percent>0?'partial':'failed');
    if(awarded){const event=(await db.query('select * from sponsor_satisfaction_events')).rows[0];
      assert.equal(event.event_type,'pre_race_commitment');assert.equal(event.points,awarded);
      assert.equal(event.metadata.achievementPercent,percent);}
    const ledgerCount=(await db.query('select count(*)::integer as n from reputation_ledger')).rows[0].n;
    assert.equal((await settle()).rows[0].n,0);
    assert.equal((await db.query('select count(*)::integer as n from reputation_ledger')).rows[0].n,ledgerCount); checks+=2;
  }
  await reset('victory',2,15,1); await settle(); assert.equal((await snapshot()).sponsor_bonus_awarded,0);
  assert.equal(Number((await db.query('select loss_amount from reputation_commitments')).rows[0].loss_amount),9); checks++;
  await reset('victory',2,35,2); await settle(); assert.equal((await snapshot()).sponsor_bonus_awarded,1);
  assert.equal(Number((await db.query('select loss_amount from reputation_commitments')).rows[0].loss_amount),21); checks++;
  // A teammate's victory never fulfills the named leader's promise.
  await reset('victory',null); await db.exec(`insert into race_rosters values('${id(20)}','${id(15)}','${id(21)}');
    insert into race_results values('${id(3)}','${id(20)}','classified',1);`);
  await settle(); assert.equal((await snapshot()).achievement_level,'missed'); checks++;
  await reset('victory',2); await db.exec(`update race_results set status='disqualified';`);
  await settle(); assert.equal((await snapshot()).leader_final_rank,null); assert.equal((await snapshot()).achievement_level,'missed'); checks++;
  await reset('victory',2); await db.exec(`update race_registrations set team_season_id='${id(99)}';`);
  await settle(); assert.equal((await snapshot()).achievement_level,'missed'); checks++;
  await reset('victory',2,60,4); await db.exec(`update race_editions set status='registration_open';`);
  assert.equal((await settle()).rows[0].n,0);assert.equal((await snapshot()).status,'published');
  assert.equal((await db.query('select status from reputation_commitments')).rows[0].status,'active'); checks++;
  await reset('victory',2,0,0,3); await settle(); assert.equal((await snapshot()).achievement_level,'missed');
  assert.equal((await snapshot()).reputation_delta,-4); checks++;
  await reset('victory',1,60,4); await db.exec(`update team_sponsor_contracts set objective_season_id='${id(2)}';`);
  await settle(); assert.equal((await snapshot()).sponsor_bonus_awarded,0); checks++;
  // The +25 result pool is unchanged; partial engagement points use only +8.
  await reset('victory',2,60,4); await db.exec(`insert into sponsor_satisfaction_events(team_sponsor_contract_id,season_id,event_type,source_key,points)
    values('${id(14)}','${id(1)}','race_result','existing-race',25),('${id(14)}','${id(1)}','pre_race_commitment','existing-press',7);`);
  await settle(); assert.equal((await db.query('select get_sponsor_performance_satisfaction_score($1) as points',[id(14)])).rows[0].points,33);
  assert.equal((await db.query(`select sum(points)::integer as points from sponsor_satisfaction_events where event_type='race_result'`)).rows[0].points,25); checks++;
  assert.equal((await db.query(`select private.pre_race_press_achievement_percent('victory',0) as p`)).rows[0].p,0);
  assert.equal((await db.query(`select private.pre_race_press_achievement_percent('unknown',1) as p`)).rows[0].p,0); checks++;
  assert.equal((await db.query(`select has_function_privilege('authenticated','private.settle_pre_race_press_conferences(uuid)','execute') as allowed`)).rows[0].allowed,false);
  assert.equal((await db.query(`select has_function_privilege('authenticated','public.get_pre_race_press_conferences(uuid)','execute') as allowed`)).rows[0].allowed,true); checks++;
  assert.equal((await db.query('select * from get_pre_race_press_conferences($1)',[id(3)])).rows.length,0);
  await db.query(`select set_config('test.auth_user',$1,false)`,[id(5)]);
  const own=(await db.query('select * from get_pre_race_press_conferences($1)',[id(3)])).rows.find(row=>row.conference_id===id(10));
  assert.equal(own.is_own,true);assert.equal(own.achievement_percent,40);checks++;
  await assert.rejects(db.query(`update pre_race_press_conferences set achievement_level=null,achievement_percent=40 where id=$1`,[id(10)]));
  await assert.rejects(db.query(`update pre_race_press_conferences set sponsor_bonus_awarded=5 where id=$1`,[id(10)])); checks++;
  console.log(`PASS: ${checks} isolated SQL checks; thresholds, stakes, ledger catch-up, idempotence, named leader, S3 history, permissions and separate +25/+8 pools.`);
} catch(error){console.error('FAIL:',error.message,error.where??'');process.exitCode=1;}
finally{await db.close();}
