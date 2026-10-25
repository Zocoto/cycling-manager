/** Isolated PostgreSQL tests only: this script never connects to Supabase. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.TRAINING_PARTIAL_SQL_TEST_MODULE
  ?? 'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js';
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const team = id(100), otherTeam = id(101), season = id(102), user = id(103);
const trainer = id(200), secondTrainer = id(201), departedTrainer = id(202), foreignTrainer = id(203);
const rider = n => id(1000 + n);
const plan = (n, trainerId = null, extra = {}) => ({
  rider_id: rider(n), intensity: 58, domain: 'stage_racer', trainer_contract_id: trainerId, ...extra,
});
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const same = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const save = async plans => (await db.query(
  'select public.save_current_rider_training_plans_v2($1::jsonb) as result', [JSON.stringify(plans)],
)).rows[0].result;
const rows = async () => (await db.query('select * from rider_training_plan_versions where effective_from_day_number=18 order by rider_id')).rows;
const baseline = async assignments => {
  for (const [n, trainerId] of assignments) await db.query(
    `insert into rider_training_plan_versions(rider_id,team_id,season_id,intensity,domain,trainer_contract_id,effective_from_day_number)
      values($1,$2,$3,50,'climber',$4,1)`, [rider(n), team, season, trainerId],
  );
};
const reset = async () => {
  await db.exec(`delete from rider_training_plan_versions;
    update sporting_directors set status='active';
    update staff_contracts set status=case when id='${departedTrainer}' then 'terminated' else 'active' end;
    update staff_members set role='trainer',level=1;
    update rider_contracts set status='active';
    select set_config('test.auth_user','${user}',false);
    select set_config('test.fail_rider','',false);`);
};
try {
  await db.exec(`
    create schema auth;
    create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('test.auth_user',true),'')::uuid $$;
    create table teams(id uuid primary key);
    create table seasons(id uuid primary key,status text);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table team_manager_assignments(id uuid primary key,sporting_director_id uuid,team_id uuid,role text,status text);
    create table rider_contracts(id uuid primary key,rider_id uuid,team_id uuid,status text);
    create table staff_members(id uuid primary key,role text,level integer,first_name text,last_name text);
    create table staff_contracts(id uuid primary key,staff_member_id uuid,team_id uuid,status text);
    create table rider_training_plan_versions(id uuid primary key default gen_random_uuid(),
      rider_id uuid not null,team_id uuid not null references teams(id),season_id uuid not null references seasons(id),
      intensity integer not null check(intensity between 0 and 100),domain text not null check(domain in(
        'climber','puncheur','stage_racer','northern_classics','rouleur','breakaway','sprinter')),
      trainer_contract_id uuid references staff_contracts(id),effective_from_day_number integer not null,
      created_at timestamptz not null default now(),unique(rider_id,season_id,effective_from_day_number));
    create function public.get_training_effective_day_number(uuid) returns integer language sql as $$ select 18 $$;
    create function test_training_failure() returns trigger language plpgsql as $$
    begin
      if new.rider_id::text = current_setting('test.fail_rider',true) then
        if new.intensity=77 then raise exception 'Synthetic rider-local failure'; end if;
        if new.intensity=78 then raise exception 'Synthetic serialization failure' using errcode='40001'; end if;
      end if;
      return new;
    end $$;
    create trigger training_test_failure before insert or update on rider_training_plan_versions
      for each row execute function test_training_failure();
    insert into teams values('${team}'),('${otherTeam}');
    insert into seasons values('${season}','active');
    insert into sporting_directors values('${id(104)}','${user}','active');
    insert into team_manager_assignments values('${id(105)}','${id(104)}','${team}','general_manager','active');
  `);
  for (let n = 1; n <= 35; n++) await db.query(
    `insert into rider_contracts values($1,$2,$3,'active')`, [id(2000 + n), rider(n), team],
  );
  await db.query(`insert into rider_contracts values($1,$2,$3,'active')`, [id(2099), rider(99), otherTeam]);
  for (const [n, contractId, contractTeam, status] of [
    [300, trainer, team, 'active'], [301, secondTrainer, team, 'active'],
    [302, departedTrainer, team, 'terminated'], [303, foreignTrainer, otherTeam, 'active'],
  ]) {
    await db.query(`insert into staff_members values($1,'trainer',1,'Trainer',$2)`, [id(n), String(n)]);
    await db.query('insert into staff_contracts values($1,$2,$3,$4)', [contractId, id(n), contractTeam, status]);
  }
  const migration = readFileSync('supabase/migrations/20261025100000_isolate_training_plan_save_failures.sql', 'utf8');
  await db.exec(migration);
  await reset();

  let result = await save([plan(1, trainer), plan(2)]);
  same(result.effective_day, 18, 'effective day retained');
  same(result.results.map(row => row.status), ['saved', 'saved']);
  same((await rows()).length, 2);
  same((await rows())[0].team_id, team);

  await reset(); await baseline([[1, departedTrainer]]);
  result = await save([plan(1, departedTrainer), plan(2)]);
  same(result.results.map(row => row.status), ['saved', 'saved']);
  same(result.results[0].trainer_reset, true);
  same(result.results[0].trainer_contract_id, null);
  same((await rows())[0].trainer_contract_id, null);
  same((await db.query('select trainer_contract_id from rider_training_plan_versions where effective_from_day_number=1')).rows[0].trainer_contract_id,
    departedTrainer, 'historical trainer remains intact');

  for (const invalidTrainer of [departedTrainer, foreignTrainer]) {
    await reset(); result = await save([plan(1, invalidTrainer), plan(2)]);
    same(result.results.map(row => row.status), ['error', 'saved']);
    same(result.results[0].code, 'inactive_trainer');
    same((await rows()).map(row => row.rider_id), [rider(2)]);
  }
  await reset(); await baseline([[1, foreignTrainer]]);
  result = await save([plan(1, foreignTrainer)]);
  same(result.results[0].trainer_reset, true, 'only an already retained foreign trainer is cleared');

  await reset(); result = await save([plan(99), plan(2)]);
  same(result.results.map(row => row.status), ['error', 'saved']);
  same(result.results[0].code, 'inactive_rider');
  same((await rows()).map(row => row.rider_id), [rider(2)]);
  await reset(); await db.query(`update rider_contracts set status='terminated' where rider_id=$1`, [rider(1)]);
  result = await save([plan(1), plan(2)]);
  same(result.results[0].code, 'inactive_rider');
  same((await rows()).map(row => row.rider_id), [rider(2)]);

  for (const invalid of [
    plan(1, null, { intensity: 101 }), plan(1, null, { intensity: -1 }),
    plan(1, null, { intensity: 1.5 }), plan(1, null, { intensity: null }),
    plan(1, null, { intensity: '1e2' }), plan(1, null, { intensity: '9'.repeat(500) }),
    plan(1, null, { domain: 'invalid' }), plan(1, 'invalid'),
    plan(1, null, { rider_id: 'invalid' }), {}, null, [], 'invalid',
  ]) {
    await reset(); result = await save([invalid, plan(2)]);
    same(result.results.map(row => row.status), ['error', 'saved'], `invalid entry: ${JSON.stringify(invalid).slice(0, 90)}`);
    same((await rows()).map(row => row.rider_id), [rider(2)]);
  }
  await reset(); result = await save([plan(1), plan(1, trainer), plan(2)]);
  same(result.results.map(row => row.code), ['duplicate_rider', 'duplicate_rider', 'saved']);
  same((await rows()).map(row => row.rider_id), [rider(2)]);
  await reset(); result = await save([plan(1), plan(1, null, { rider_id: rider(1).toUpperCase(), intensity: 101 }), plan(2)]);
  same(result.results.map(row => row.code), ['duplicate_rider', 'duplicate_rider', 'saved'], 'invalid duplicate still cannot conceal a contradictory instruction');
  same((await rows()).map(row => row.rider_id), [rider(2)]);

  await reset(); await baseline([[1, trainer], [2, trainer], [3, trainer], [4, trainer]]);
  result = await save([plan(5, trainer), plan(6)]);
  same(result.results.map(row => row.code), ['trainer_capacity', 'saved']);
  same((await rows()).map(row => row.rider_id), [rider(6)]);

  await reset(); await baseline([[1, trainer], [2, trainer], [3, trainer], [4, trainer],
    [5, secondTrainer], [6, secondTrainer], [7, secondTrainer], [8, secondTrainer]]);
  result = await save([plan(1, secondTrainer), plan(5, trainer)]);
  same(result.results.map(row => row.status), ['saved', 'saved'], 'full-trainer reciprocal swap');
  same((await rows()).map(row => row.trainer_contract_id), [secondTrainer, trainer]);

  await reset(); await baseline([[1, trainer], [2, trainer], [3, trainer], [4, trainer]]);
  result = await save([plan(5, trainer), plan(1)]);
  same(result.results.map(row => row.status), ['saved', 'saved'], 'release can appear after incoming move');

  await reset(); await baseline([[1, trainer], [2, trainer], [3, trainer]]);
  result = await save([plan(5, trainer), plan(6, trainer), plan(7)]);
  same(result.results.map(row => row.code), ['saved', 'trainer_capacity', 'saved'], 'last incoming request loses quota contention');

  await reset(); await baseline([[1, trainer], [2, trainer], [3, trainer], [4, trainer],
    [5, secondTrainer], [6, secondTrainer], [7, secondTrainer], [8, secondTrainer]]);
  result = await save([plan(1, secondTrainer), plan(9, trainer), plan(10)]);
  same(result.results.map(row => row.code), ['trainer_capacity', 'trainer_capacity', 'saved'], 'rejected release causes dependent quota rejection');
  same((await rows()).map(row => row.rider_id), [rider(10)]);

  for (const incomingFirst of [false, true]) {
    await reset(); await baseline([[1, trainer], [2, trainer], [3, trainer], [4, trainer]]);
    await db.query(`select set_config('test.fail_rider',$1,false)`, [rider(1)]);
    const releasing = plan(1, null, { intensity: 77 }), incoming = plan(5, trainer);
    result = await save(incomingFirst ? [incoming, plan(6), releasing] : [releasing, incoming, plan(6)]);
    const codes = new Map(result.results.map(row => [row.rider_id, row.code]));
    same(codes.get(rider(1)), 'save_failed');
    same(codes.get(rider(5)), 'trainer_capacity');
    same(codes.get(rider(6)), 'saved');
    same((await rows()).map(row => row.rider_id), [rider(6)], 'tentative earlier writes rolled back before quota recomputation');
  }
  await reset(); await baseline([[1, trainer], [2, trainer], [3, trainer], [4, trainer]]);
  await db.query(`select set_config('test.fail_rider',$1,false)`, [rider(5)]);
  result = await save([plan(1), plan(5, trainer, { intensity: 77 }), plan(6)]);
  same(result.results.map(row => row.code), ['saved', 'save_failed', 'saved']);
  same((await rows()).map(row => row.rider_id), [rider(1), rider(6)]);

  await reset(); await baseline([[1, trainer], [2, trainer], [3, trainer], [4, trainer], [5, trainer]]);
  result = await save([plan(1, trainer), plan(6)]);
  same(result.results.map(row => row.status), ['saved', 'saved'], 'existing overbooking is not worsened by unchanged assignment');

  await reset(); result = await save(Array.from({ length: 35 }, (_, n) => plan(n + 1)));
  same(result.results.length, 35); same((await rows()).length, 35);
  await save(Array.from({ length: 35 }, (_, n) => plan(n + 1)));
  same((await rows()).length, 35, 'repeat request upserts without duplicates');

  for (const invalidBatch of [null, {}, [], Array.from({ length: 36 }, (_, n) => plan(n + 1)),
    [plan(1, null, { surplus: 'x'.repeat(100001) })]]) {
    await reset(); await assert.rejects(save(invalidBatch)); checks++;
    same((await rows()).length, 0, 'invalid batch makes no writes');
  }
  await reset(); await db.exec(`select set_config('test.auth_user','',false);`);
  await assert.rejects(save([plan(1)]), /Authentification/); checks++;
  await reset(); await db.exec(`update sporting_directors set status='inactive'`);
  await assert.rejects(save([plan(1)]), /Aucune équipe active/); checks++;

  await reset(); await db.query(`select set_config('test.fail_rider',$1,false)`, [rider(2)]);
  await assert.rejects(save([plan(1), plan(2, null, { intensity: 78 })]), /serialization failure/); checks++;
  same((await rows()).length, 0, 'global transient failures roll back all writes');

  await reset();
  await assert.rejects(db.query('select save_current_rider_training_plans($1::jsonb)',
    [JSON.stringify([plan(1), plan(2, foreignTrainer)])]), /staff actif/); checks++;
  same((await rows()).length, 0, 'legacy bulk stays atomic');
  await baseline([[1, departedTrainer]]);
  same((await db.query('select save_current_rider_training_plan($1,58,$2,$3) as day',
    [rider(1), 'stage_racer', departedTrainer])).rows[0].day, 18);
  same((await rows())[0].trainer_contract_id, null, 'legacy single also repairs retained stale trainer');
  same((await db.query('select save_current_rider_training_plans($1::jsonb) as day',
    [JSON.stringify([plan(2)])])).rows[0].day, 18, 'legacy integer result preserved');

  for (const signature of ['public.save_current_rider_training_plans_v2(jsonb)',
    'public.save_current_rider_training_plans(jsonb)', 'public.save_current_rider_training_plan(uuid,integer,text,uuid)']) {
    for (const [role, expected] of [['anon', false], ['authenticated', true], ['service_role', true]]) {
      same((await db.query('select has_function_privilege($1,$2,$3) as allowed', [role, signature, 'execute'])).rows[0].allowed, expected);
    }
  }
  check(migration.includes("set search_path = ''"), 'empty search path');
  check(migration.includes("set lock_timeout = '2500ms'"), 'bounded lock wait');
  check(migration.includes("set statement_timeout = '12s'"), 'bounded execution');
  console.log(`PASS: ${checks} isolated training SQL checks (stale trainers, partial saves, quotas, swaps, failure rollback, auth, compatibility and bounds).`);
} catch (error) {
  console.error('FAIL:', error.message, error.where ?? '');
  process.exitCode = 1;
} finally {
  await db.close();
}
