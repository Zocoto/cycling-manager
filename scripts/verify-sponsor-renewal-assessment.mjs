// Isolated PostgreSQL only. Pass a local PGlite module path; no environment or network access.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const read = name => readFileSync(`supabase/migrations/${name}.sql`, 'utf8');
const def = (source, name) => {
  const match = new RegExp(`create (?:or replace )?function public\\.${name}\\(`, 'i').exec(source);
  assert(match, name);
  return source.slice(match.index, source.indexOf('$$;', match.index) + 3);
};
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const s1=id(1), s2=id(2), s3=id(3), s4=id(4), s5=id(5), team=id(10), director=id(11), user=id(12), sponsor=id(13), otherSponsor=id(14), contract=id(15), offer=id(16), alternative=id(17);
const db = new PGlite();
let assertions = 0;
const rows = async (sql, params=[]) => (await db.query(sql, params)).rows;
const assess = async () => (await rows('select get_sponsor_renewal_assessment($1,$2,$3) as value', [contract,director,s5]))[0].value;
const error = async (sql, params, expression) => {
  await db.exec('savepoint expected_error');
  await assert.rejects(db.query(sql,params), expression);
  await db.exec('rollback to savepoint expected_error');
};
const check = async (name, run) => {
  await db.exec('begin');
  try { await run(); console.log('PASS '+name); assertions++; }
  finally { await db.exec('rollback'); }
};
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$ select current_setting('request.jwt.claim.sub',true)::uuid $$;
    create table seasons(id uuid primary key,game_year int unique,name text,status text,current_day_number int);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text,reputation_points int);
    create table team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text,created_at timestamptz default now());
    create table team_seasons(id uuid primary key default gen_random_uuid(),team_id uuid,season_id uuid);
    create table sponsors(id uuid primary key,catalog_key text unique);
    create table sponsor_offers(id uuid primary key default gen_random_uuid(),sponsor_id uuid,season_id uuid,sporting_director_id uuid,budget_per_season numeric,currency_code text,contract_duration_seasons int,status text,available_from timestamptz,available_until timestamptz);
    create table team_sponsor_contracts(id uuid primary key default gen_random_uuid(),team_id uuid,sponsor_id uuid,sponsor_offer_id uuid,start_season_id uuid,end_season_id uuid,objective_season_id uuid,role text,status text,budget_per_season numeric,contract_duration_seasons int,currency_code text,selected_jersey_id uuid,selected_jersey_style text,signed_at timestamptz,activated_at timestamptz,created_at timestamptz default now(),reputation_investment_cost int default 0,reputation_budget_bonus_percent int default 0);
    create index contract_team_idx on team_sponsor_contracts(team_id,role,status);
    create table sponsor_annual_objective_history(team_sponsor_contract_id uuid,season_id uuid,satisfaction_score int,primary key(team_sponsor_contract_id,season_id));
    create table sponsor_satisfaction_events(team_sponsor_contract_id uuid,season_id uuid,event_type text,points int);
    create table test_objective_scores(contract_id uuid primary key,score int);
    create function get_sponsor_objective_satisfaction_score(uuid) returns integer language sql stable as $$ select score from public.test_objective_scores where contract_id=$1 $$;
    create table test_reputation_spends(director_id uuid,amount int,source_key text unique);
    create function private.spend_reputation(uuid,uuid,integer,text,text,jsonb) returns void language plpgsql as $$ begin
      insert into test_reputation_spends values($1,$3,$4);
      update sporting_directors set reputation_points=reputation_points-$3 where id=$1;
    end $$;
  `);
  await db.exec(def(read('20261001060000_stabilize_annual_sponsor_page'), 'get_sponsor_performance_satisfaction_score'));
  await db.exec(def(read('20260727180000_defer_first_sponsor_to_next_season'), 'sign_sponsor_offer').replace('public.sign_sponsor_offer(', 'public.sign_sponsor_offer_before_s4_reputation('));
  await db.exec(def(read('20260927203000_add_s4_sponsor_reputation_investment'), 'sign_sponsor_offer'));
  await db.exec(read('20261019180000_add_sponsor_contract_renewal_assessment'));
  const profileKey = (await rows('select catalog_key from sponsor_renewal_profiles order by catalog_key limit 1'))[0].catalog_key;
  await db.query('insert into sponsors values($1,$2),($3,\'alternative\')', [sponsor,profileKey,otherSponsor]);
  await db.exec(`
    insert into seasons values('${s1}',1,'S1','completed',28),('${s2}',2,'S2','completed',28),('${s3}',3,'S3','completed',28),('${s4}',4,'S4','active',25),('${s5}',5,'S5','planned',1);
    insert into sporting_directors values('${director}','${user}','active',1000);
    insert into team_manager_assignments(team_id,sporting_director_id,role,status) values('${team}','${director}','general_manager','active');
    insert into team_seasons(team_id,season_id) values('${team}','${s5}');
    insert into sponsor_offers(id,sponsor_id,season_id,sporting_director_id,budget_per_season,currency_code,contract_duration_seasons,status)
      values('${offer}','${sponsor}','${s5}','${director}',100000,'EUR',2,'open'),('${alternative}','${otherSponsor}','${s5}','${director}',200000,'EUR',2,'open');
    insert into team_sponsor_contracts(id,team_id,sponsor_id,start_season_id,objective_season_id,role,status,budget_per_season,contract_duration_seasons)
      values('${contract}','${team}','${sponsor}','${s2}','${s4}','principal','active',123456,3);
    insert into test_objective_scores values('${contract}',25);
    select set_config('request.jwt.claim.sub','${user}',false);
  `);
  await db.query('update sponsor_renewal_profiles set prestige=5,minimum_reputation=750 where catalog_key=$1', [profileKey]);
  await check('Prestige, reputation tiers and strict threshold equality (90 decisions)', async () => {
    for (let prestige=1;prestige<=5;prestige++) for (const factor of [0,1,1.99,2,3.99,4]) {
      const minimum=[0,0,30,75,300,750][prestige], reference=Math.max(30,minimum);
      await db.query('update sponsor_renewal_profiles set prestige=$1,minimum_reputation=$2 where catalog_key=$3',[prestige,minimum,profileKey]);
      await db.query('update sporting_directors set reputation_points=$1',[Math.floor(factor*reference)]);
      const discount=factor>=4?10:factor>=2?5:0, threshold=20+5*prestige-discount;
      for (const score of [threshold-1,threshold,threshold+1]) {
        await db.query('update test_objective_scores set score=$1',[score]);
        const result=await assess();
        assert.equal(result.minimumSatisfaction,threshold); assert.equal(result.reputationDiscount,discount);
        assert.equal(result.averageSatisfaction,score); assert.equal(result.refused,score<threshold); assertions++;
      }
    }
  });
  await check('Global contract bilan includes available past seasons, excludes earlier contracts and current duplicate', async () => {
    await db.query('insert into sponsor_annual_objective_history values($1,$2,90),($1,$3,0),($1,$4,99)',[contract,s2,s1,s4]);
    const result=await assess();
    assert.equal(result.averageSatisfaction,57.5); assert.equal(result.seasonsEvaluated,2); assert.equal(result.refused,false);
  });
  await check('A missing archive is ignored; no invented zero for missing years', async () => {
    const result=await assess(); assert.equal(result.seasonsEvaluated,1); assert.equal(result.averageSatisfaction,25); assert(result.refused);
  });
  await check('A poor earlier season prevents a last-season-only renewal', async () => {
    await db.exec(`insert into sponsor_annual_objective_history values('${contract}','${s2}',0),('${contract}','${s3}',0); update test_objective_scores set score=100;`);
    const result=await assess(); assert.equal(result.averageSatisfaction,33.33); assert(result.refused);
  });
  await check('Current objectives + capped performance + capped commitments; old season excluded', async () => {
    await db.exec(`insert into sponsor_satisfaction_events values('${contract}','${s4}','race_result',40),('${contract}','${s4}','pre_race_commitment',20),('${contract}','${s3}','race_result',100);`);
    assert.equal((await assess()).averageSatisfaction,58);
    await db.exec('update test_objective_scores set score=99'); assert.equal((await assess()).averageSatisfaction,100);
  });
  await check('Only expiring principal active contracts; no continuing, secondary or terminated assessment', async () => {
    await db.exec('update team_sponsor_contracts set contract_duration_seasons=4'); assert.equal(await assess(),null);
    await db.exec("update team_sponsor_contracts set contract_duration_seasons=3,role='secondary'"); assert.equal(await assess(),null);
    await db.exec("update team_sponsor_contracts set role='principal',status='terminated'"); assert.equal(await assess(),null);
  });
  await check('Stale annual rollover is an explicit error, never a false zero', async () => {
    await db.query('update team_sponsor_contracts set objective_season_id=$1',[s3]);
    await error('select get_sponsor_renewal_assessment($1,$2,$3)',[contract,director,s5],/actualisé/);
  });
  await check('Assessment is private to the service; wrong ownership rejected', async () => {
    await db.exec('set local role authenticated');
    await error('select public.get_sponsor_renewal_assessment($1,$2,$3)',[contract,director,s5],/permission denied/);
    await db.exec('reset role');
    await db.exec("update team_manager_assignments set status='ended'");
    await error('select get_sponsor_renewal_assessment($1,$2,$3)',[contract,director,s5],/ne vous appartient/);
  });
  await check('Stale form / direct signature refuses atomically: no offer, money or reputation changes', async () => {
    const before=await rows('select * from sponsor_offers order by id');
    await error('select sign_sponsor_offer($1,100)',[offer],/refuse la reconduction/);
    assert.deepEqual(await rows('select * from sponsor_offers order by id'),before);
    assert.equal((await rows('select count(*)::int n from team_sponsor_contracts'))[0].n,1);
    assert.equal((await rows('select reputation_points from sporting_directors'))[0].reputation_points,1000);
    assert.deepEqual(await rows('select * from test_reputation_spends'),[]);
  });
  await check('An improvement immediately reopens renewal and preserves reputation investment exactly once', async () => {
    await db.exec('update test_objective_scores set score=60; update sporting_directors set reputation_points=1200;');
    const result=(await rows('select sign_sponsor_offer($1,100) as id',[offer]))[0].id;
    assert.equal((await rows('select budget_per_season from team_sponsor_contracts where id=$1',[result]))[0].budget_per_season,'110000.00');
    // Even a later drop in satisfaction must not cancel the signed agreement.
    await db.exec('update test_objective_scores set score=0');
    assert.equal((await rows('select sign_sponsor_offer($1,100) as id',[offer]))[0].id,result);
    assert.equal((await rows('select count(*)::int n from test_reputation_spends'))[0].n,1);
    assert.equal((await rows('select reputation_points from sporting_directors'))[0].reputation_points,1100);
    await db.query('update team_sponsor_contracts set budget_per_season=111000 where id=$1',[result]);
    await db.query("update team_sponsor_contracts set status='active' where id=$1",[result]);
  });
  await check('Refusal leaves an alternative sponsor signable', async () => {
    const result=(await rows('select sign_sponsor_offer($1,0) as id',[alternative]))[0].id;
    assert.equal((await rows('select sponsor_id from team_sponsor_contracts where id=$1',[result]))[0].sponsor_id,otherSponsor);
  });
  await check('First contract is unaffected', async () => {
    await db.exec('delete from team_sponsor_contracts');
    assert((await rows('select sign_sponsor_offer($1,0) as id',[offer]))[0].id);
  });
  await check('Existing multi-year commitment still blocks new signing with the original error', async () => {
    await db.exec('update team_sponsor_contracts set contract_duration_seasons=4');
    await error('select sign_sponsor_offer($1,0)',[offer],/couvre déjà/);
  });
  await check('Existing J21 opening remains enforced', async () => {
    await db.exec("update seasons set current_day_number=20 where status='active'");
    await error('select sign_sponsor_offer($1,0)',[offer],/jour 21/);
  });
  await check('No per-visit writes from the assessment', async () => {
    const before=await rows('select * from team_sponsor_contracts order by id');
    const first=await assess(); for (let n=0;n<20;n++) assert.deepEqual(await assess(),first);
    assert.deepEqual(await rows('select * from team_sponsor_contracts order by id'),before);
  });
  console.log(`Verified ${assertions} isolated PostgreSQL cases/assertions.`);
} catch (error) { console.error(error.message, error.where ?? ''); process.exitCode=1; }
finally { await db.close(); }
