// Isolated PostgreSQL checks. No network or production writes.
// npm install --prefix .tmp/callup-db-tests --no-save --package-lock=false @electric-sql/pglite
// node scripts/verify-annual-sponsor-rollover.mjs
import { PGlite } from '../.tmp/callup-db-tests/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const read = name => readFileSync(`supabase/migrations/${name}.sql`, 'utf8').replaceAll('\r', '');
const def = (source, name) => {
  const match = new RegExp(`create (?:or replace )?function public\\.${name}\\(`, 'i').exec(source);
  assert(match, name);
  return source.slice(match.index, source.indexOf('$$;', match.index) + 3);
};
const block = (source, marker) => {
  const start = source.indexOf(marker);
  assert(start >= 0, marker);
  return source.slice(start, source.indexOf('$block$;', start));
};
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const s2=id(2), s3=id(3), s4=id(4), team=id(5), director=id(6), sponsor=id(7), offer=id(8), contract=id(9), country=id(10);
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table seasons(id uuid primary key, game_year int, status text, current_day_number int, starts_on date, ends_on date);
    create table teams(id uuid primary key);
    create table countries(id uuid primary key, iso_alpha2 text);
    create table sporting_directors(id uuid primary key, reputation_points int default 100);
    create table team_manager_assignments(team_id uuid, sporting_director_id uuid, role text, status text);
    create table team_seasons(id uuid primary key default gen_random_uuid(),team_id uuid,season_id uuid,status text,final_rank int, next_sponsor_budget_bonus_percent numeric default 0, display_name text, short_name text, registration_country_id uuid, operating_budget numeric, currency text, currency_code text);
    create table sponsors(id uuid primary key,name text,short_name text,country_id uuid);
    create table sponsor_offers(id uuid primary key default gen_random_uuid(),sponsor_id uuid,season_id uuid,sporting_director_id uuid,continuing_contract_id uuid,title text,description text,budget_per_season numeric,base_budget_per_season numeric,negotiation_budget_ceiling numeric,objective_difficulty text,currency_code text,contract_duration_seasons int,available_from timestamptz,available_until timestamptz,status text,generation_version int,unique(continuing_contract_id,season_id));
    create table team_sponsor_contracts(id uuid primary key,team_id uuid,sponsor_id uuid,sponsor_offer_id uuid,pending_sponsor_offer_id uuid,start_season_id uuid,end_season_id uuid,objective_season_id uuid,role text,status text,budget_per_season numeric,contract_duration_seasons int,currency_code text,satisfaction_score int default 0,satisfaction_updated_at timestamptz,objective_reputation_penalty int default 0,renewal_budget_adjustment_percent numeric default 0,selected_jersey_id uuid,selected_jersey_style text,previous_team_display_name text,previous_team_short_name text,previous_registration_country_id uuid,activated_at timestamptz);
    create table sponsor_objectives(id uuid primary key default gen_random_uuid(),sponsor_offer_id uuid,season_id uuid,name text,description text,objective_type text,priority text,evaluation_timing text,evaluation_day_number int,status text,display_order int,renewal_bonus_percent numeric default 0,satisfaction_points int,is_provisional boolean,target_details jsonb,created_at timestamptz default now(),updated_at timestamptz default now(),unique(sponsor_offer_id,display_order),unique(sponsor_offer_id,season_id,name));
    create table objective_progress(id uuid primary key default gen_random_uuid(),sponsor_objective_id uuid,team_sponsor_contract_id uuid,season_id uuid,status text,current_value numeric,details jsonb,achieved_at timestamptz,settled_at timestamptz,reputation_penalty int default 0,last_evaluated_at timestamptz,updated_at timestamptz default now(),unique(sponsor_objective_id,team_sponsor_contract_id,season_id));
    create table races(id uuid primary key,race_format text);
    create table race_editions(id uuid primary key,race_id uuid,season_id uuid,status text,unique(race_id,season_id));
    create table race_result_objectives(objective_id uuid primary key,race_edition_id uuid,stage_id uuid,target_scope text,achievement_type text,target_rank int,required_count int);
    create table race_rosters(id uuid primary key,race_registration_id uuid,rider_id uuid);
    create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid);
    create table race_results(id uuid primary key,race_edition_id uuid,race_roster_id uuid,final_rank int,status text);
    create table stages(id uuid,race_edition_id uuid);
    create table stage_results(id uuid,stage_id uuid,race_roster_id uuid,finish_rank int,status text);
    create table rider_contracts(rider_id uuid,team_id uuid,start_season_id uuid,end_season_id uuid,status text);
    create table rider_national_championship_titles(id uuid,rider_id uuid,country_id uuid,season_id uuid,championship_type text);
    create table riders(id uuid,country_id uuid);
    create table rider_season_summaries(rider_id uuid,season_id uuid,points int);
    create table sponsor_satisfaction_events(team_sponsor_contract_id uuid,season_id uuid,points int);
    create function get_team_specialization_power(uuid,text,text) returns numeric language sql as $$ select 0::numeric $$;
  `);
  // The complete evaluator chain, reconstructed from the committed migrations.
  await db.exec(def(read('20260813110000_expand_sponsor_objectives_and_satisfaction'), 'evaluate_sponsor_objectives_for_contract').replace('public.evaluate_sponsor_objectives_for_contract(', 'public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821('));
  await db.exec(def(read('20260821223000_add_sponsor_national_and_development_philosophies'), 'evaluate_sponsor_objectives_for_contract_legacy_20260813').replace('public.evaluate_sponsor_objectives_for_contract_legacy_20260813(', 'public.evaluate_sponsor_objectives_pre_recruitment_20260905('));
  await db.exec(def(read('20260905113000_add_sponsor_rider_recruitment_objectives'), 'evaluate_sponsor_objectives_for_contract_legacy_20260813'));
  await db.exec(def(read('20260813203000_rework_sponsor_renewals_and_reputation'), 'evaluate_sponsor_objectives_for_contract'));
  const annual = read('20260908080000_add_annual_sponsor_objective_renegotiation');
  for (const marker of ['patch_legacy_evaluator', 'patch_current_evaluator']) {
    const start = annual.indexOf(`do $${marker}$`);
    await db.exec(annual.slice(start, annual.indexOf(`$${marker}$;`, start) + marker.length + 3));
  }
  // Only the sponsor section of rollover is exercised; unrelated rider aging,
  // finance closure, promotion and calendar provisioning are not simulated.
  const baseRoll = def(read('20260811130000_implement_atomic_season_rollover'), 'rollover_game_season');
  const sponsorLoop = baseRoll.slice(baseRoll.indexOf('  for v_sponsor in'), baseRoll.indexOf("  update public.team_seasons\n  set status = 'active'"));
  await db.exec(`create function rollover_game_season(p_source_season_id uuid,p_force boolean default false) returns jsonb language plpgsql as $$
    declare v_target public.seasons%rowtype; v_sponsor record;
    begin
      select * into v_target from seasons where game_year=(select game_year+1 from seasons where id=p_source_season_id);
      ${block(read('20260908090000_stack_annual_sponsor_budget_modifiers'), '  -- Annual sponsor satisfaction and ambition stack from season 3 onward.')}
      ${block(annual, '  -- Annual sponsor terms prepared during J21-J28 become live atomically.')}
      ${sponsorLoop}
      update seasons set status='completed' where id=p_source_season_id;
      update seasons set status='active' where id=v_target.id;
      return jsonb_build_object('target',v_target.id);
    end $$;`);
  const migration = read('20260911160000_ensure_annual_sponsor_objective_rollover');
  await db.exec(migration);
  await db.exec('create trigger synchronize_s3_sponsor_satisfaction_score_trigger before insert or update on team_sponsor_contracts for each row execute function synchronize_s3_sponsor_satisfaction_score();');
  await db.exec(`
    insert into seasons values('${s2}',2,'completed',28,'2026-08-14','2026-09-10'),('${s3}',3,'active',1,'2026-09-11','2026-10-08'),('${s4}',4,'planned',1,'2026-10-09','2026-11-05');
    insert into teams values('${team}'); insert into countries values('${country}','DK');
    insert into sporting_directors(id) values('${director}');
    insert into team_manager_assignments values('${team}','${director}','general_manager','active');
    insert into team_seasons(team_id,season_id,status,final_rank) values('${team}','${s2}','completed',1),('${team}','${s3}','active',null),('${team}','${s4}','planned',null);
    insert into sponsors values('${sponsor}','Test sponsor','TS','${country}');
    insert into sponsor_offers(id,sponsor_id,season_id,sporting_director_id,status,objective_difficulty,budget_per_season) values('${offer}','${sponsor}','${s2}','${director}','accepted','balanced',100000);
  `);
  for (let i=1;i<=10;i++) {
    await db.query('insert into races values($1,\'one_day\')', [id(100+i)]);
    for (const [year,season] of [[2,s2],[3,s3],[4,s4]]) await db.query('insert into race_editions values($1,$2,$3,$4)', [id(year*1000+i),id(100+i),season,year===2?'completed':'registration_open']);
    await db.query(`insert into sponsor_objectives(id,sponsor_offer_id,season_id,name,description,objective_type,priority,evaluation_timing,status,display_order,satisfaction_points,is_provisional,target_details)
      values($1,$2,$3,$4,'Annual test','race_result','standard','season_end',$5,$6,10,false,$7)`, [id(200+i),offer,s2,`Top 8 CN ${i}`,i<=8?'completed':'failed',i,{kind:'race_result',raceId:id(100+i),raceEditionId:id(2000+i),achievementType:'top_n',targetRank:8,requiredCount:1}]);
  }
  await db.exec(`
    insert into team_sponsor_contracts(id,team_id,sponsor_id,sponsor_offer_id,start_season_id,role,status,budget_per_season,contract_duration_seasons,currency_code,objective_reputation_penalty,renewal_budget_adjustment_percent)
      values('${contract}','${team}','${sponsor}','${offer}','${s2}','principal','active',100000,3,'EUR',20,6);
    insert into objective_progress(sponsor_objective_id,team_sponsor_contract_id,season_id,status,current_value,details,settled_at)
      select id,'${contract}','${s2}',case status when 'completed' then 'achieved' else 'failed' end,0,'{}',now() from sponsor_objectives;
  `);
  const rows = async sql => (await db.query(sql)).rows;
  const live = async () => (await rows('select * from team_sponsor_contracts'))[0];
  const repair = async () => (await rows('select repair_due_annual_sponsor_objectives() n'))[0].n;
  const evaluate = () => db.query('select evaluate_sponsor_objectives_for_contract($1,false)', [contract]);
  const snapshotOld = () => db.query('select * from sponsor_objectives where season_id=$1 order by id', [s2]).then(r=>r.rows);
  const check = async (name,run) => { await db.exec('begin'); await run(); await db.exec('rollback'); console.log('PASS '+name); };
  await check('Curative: 10 new S3 goals, 100 points, correct CN editions, S2 history and money preserved', async () => {
    const old=await snapshotOld(), before=await live();
    assert.equal(await repair(),1);
    const after=await live();
    assert.equal(after.objective_season_id,s3); assert.equal(after.start_season_id,s2);
    assert.equal(after.budget_per_season,before.budget_per_season);
    assert.equal(after.satisfaction_score,0); assert.equal(after.objective_reputation_penalty,0);
    const fresh=await db.query('select * from sponsor_objectives where sponsor_offer_id=$1',[after.sponsor_offer_id]);
    assert.equal(fresh.rows.length,10); assert.equal(fresh.rows.reduce((n,o)=>n+o.satisfaction_points,0),100);
    assert(fresh.rows.every(o=>o.status==='active'&&o.season_id===s3&&!old.some(p=>p.id===o.id)));
    for(const o of fresh.rows) assert.equal((await db.query('select season_id from race_editions where id=$1',[o.target_details.raceEditionId])).rows[0].season_id,s3);
    await evaluate();
    assert((await rows(`select status from sponsor_objectives where season_id='${s3}'`)).every(o=>o.status==='active'));
    assert.deepEqual(await snapshotOld(),old);
    assert.equal((await rows('select reputation_points from sporting_directors'))[0].reputation_points,100);
    assert.equal((await rows('select satisfaction_score from sponsor_annual_objective_history'))[0].satisfaction_score,80);
    const offerAfter=after.sponsor_offer_id;
    assert.equal(await repair(),0); assert.equal((await live()).sponsor_offer_id,offerAfter);
    assert.equal((await rows('select count(*)::int n from sponsor_objectives'))[0].n,20);
  });
  await check('Race evaluator ignores stale edition IDs; current results are still evaluated', async () => {
    await repair();
    const newGoal=(await rows(`select * from sponsor_objectives where season_id='${s3}' and display_order=9`))[0];
    await db.query("update sponsor_objectives set target_details=jsonb_set(target_details,'{raceEditionId}',to_jsonb($1::text)) where id=$2",[id(2009),newGoal.id]);
    await evaluate(); assert.equal((await db.query('select status from sponsor_objectives where id=$1',[newGoal.id])).rows[0].status,'active');
    const teamSeason=(await rows(`select id from team_seasons where season_id='${s3}'`))[0].id;
    await db.query('insert into race_registrations values($1,$2,$3)',[id(700),id(3009),teamSeason]);
    await db.query('insert into race_rosters values($1,$2,null)',[id(701),id(700)]);
    await db.query("insert into race_results values($1,$2,$3,3,'classified')",[id(702),id(3009),id(701)]);
    await db.query("update race_editions set status='completed' where id=$1",[id(3009)]);
    await evaluate(); assert.equal((await db.query('select status from sponsor_objectives where id=$1',[newGoal.id])).rows[0].status,'completed');
  });
  await check('S2 neutralizations do not remove requirements from the new full season', async () => {
    await db.exec(`update sponsor_objectives set status='cancelled' where season_id='${s2}' and display_order=1`);
    await repair();
    assert.equal((await rows(`select status from sponsor_objectives where season_id='${s3}' and display_order=1`))[0].status,'active');
    assert.equal((await rows(`select status from sponsor_objectives where season_id='${s2}' and display_order=1`))[0].status,'cancelled');
  });
  await check('Zero-win legacy placeholders become real accessible race goals with a 100-point total', async () => {
    await db.exec(`
      alter table countries add name text;
      alter table races add country_id uuid, add status text, add competition_type text, add slug text;
      alter table race_editions add race_category_id uuid, add minimum_reputation numeric, add registration_policy text, add display_name text;
      create table race_categories(id uuid,code text);
      insert into race_categories values('${id(800)}','national');
      insert into races(id,race_format,country_id,status,competition_type,slug) values('${id(801)}','one_day','${country}','active','standard','new-classic');
      insert into race_editions(id,race_id,season_id,status,race_category_id,minimum_reputation,registration_policy,display_name)
        values('${id(802)}','${id(801)}','${s3}','registration_open','${id(800)}',0,'open','Nouvelle classique');
      update sponsor_objectives set objective_type='season_wins',name='Transition neutralisée',status='cancelled',satisfaction_points=0,
        target_details='{"kind":"season_wins","minimumWinCount":0,"legacyNeutralized":true}' where display_order=10;
    `);
    await repair();
    const fresh=(await rows(`select * from sponsor_objectives where season_id='${s3}' and display_order=10`))[0];
    assert.equal(fresh.objective_type,'race_result'); assert.equal(fresh.target_details.raceEditionId,id(802));
    assert.equal(fresh.target_details.targetRank,10); assert(fresh.satisfaction_points>0);
    assert.equal((await rows(`select sum(satisfaction_points)::int n from sponsor_objectives where season_id='${s3}'`))[0].n,100);
  });
  await check('S3 to S4 without visiting sponsoring: new goals, correct year, normal renewal budget, no recycled score', async () => {
    await repair();
    await db.exec(`update sponsor_objectives set status='completed' where season_id='${s3}' and display_order<=8; update team_sponsor_contracts set satisfaction_score=80;`);
    const oldS3=await rows(`select * from sponsor_objectives where season_id='${s3}' order by id`);
    await db.query('select rollover_game_season($1,true)',[s3]);
    const after=await live(); assert.equal(after.objective_season_id,s4); assert.equal(after.start_season_id,s2);
    assert.equal(Number(after.budget_per_season),106000); assert.equal(after.satisfaction_score,0);
    assert.equal(after.pending_sponsor_offer_id,null);
    assert.equal((await rows(`select count(*)::int n from sponsor_objectives where season_id='${s4}' and status='active'`))[0].n,10);
    assert.deepEqual(await rows(`select * from sponsor_objectives where season_id='${s3}' order by id`),oldS3);
    await evaluate(); assert.equal((await rows(`select count(*)::int n from sponsor_objectives where season_id='${s4}' and status='failed'`))[0].n,0);
    assert.equal(await repair(),0);
  });
  await check('Prepared negotiations survive rollover untouched; missing draft slots are completed', async () => {
    await repair();
    await db.query('select prepare_annual_sponsor_objective_offers($1)',[s4]);
    const prepared=(await rows(`select id from sponsor_offers where season_id='${s4}'`))[0].id;
    await db.query("update sponsor_offers set objective_difficulty='ambitious',negotiation_budget_ceiling=200000 where id=$1",[prepared]);
    await db.query("update sponsor_objectives set name='Negotiated Top 2',target_details=jsonb_set(target_details,'{targetRank}','2') where sponsor_offer_id=$1 and display_order=1",[prepared]);
    await db.query('delete from sponsor_objectives where sponsor_offer_id=$1 and display_order=10',[prepared]);
    // Model the real FK cascade for the deliberately removed draft fixture.
    await db.exec('delete from race_result_objectives where objective_id not in (select id from sponsor_objectives)');
    await db.query('select rollover_game_season($1,true)',[s3]);
    assert.equal((await live()).sponsor_offer_id,prepared);
    const goals=await db.query('select * from sponsor_objectives where sponsor_offer_id=$1 order by display_order',[prepared]);
    assert.equal(goals.rows.length,10); assert.equal(goals.rows[0].name,'Negotiated Top 2');
    assert.equal(goals.rows[0].target_details.targetRank,2);
    assert.equal((await rows(`select objective_difficulty from sponsor_offers where id='${prepared}'`))[0].objective_difficulty,'ambitious');
  });
  await check('Expired sponsors are not extended and read-only clients cannot run repair', async () => {
    await db.exec('update team_sponsor_contracts set contract_duration_seasons=1');
    assert.equal(await repair(),0); assert.equal((await live()).sponsor_offer_id,offer);
    for(const role of ['anon','authenticated']) assert.equal((await db.query("select has_function_privilege($1,'repair_due_annual_sponsor_objectives()','EXECUTE') allowed",[role])).rows[0].allowed,false);
  });
  console.log('All isolated annual sponsor checks passed. Sponsor rollover block and evaluators are real; unrelated rollover mechanics are excluded.');
} catch(error) { console.error(error.message,error.where??'',error.stack?.split('\n').slice(0,3).join('\n')); process.exitCode=1; }
finally { await db.close(); }
