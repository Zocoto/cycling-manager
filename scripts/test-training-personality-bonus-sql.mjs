// Isolated PostgreSQL/WASM only. No network, live database or account is used.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ?? process.env.TRAINING_SQL_TEST_MODULE
  ?? resolve("artifacts/.tmp-performance-preparations/node_modules/@electric-sql/pglite/dist/index.js");
const { PGlite } = await import(pathToFileURL(modulePath).href);
const migration = readFileSync("supabase/migrations/20261127090000_record_training_personality_bonus.sql", "utf8");
const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
let checks = 0;
function check(actual, expected, message) { assert.deepEqual(actual, expected, message); checks++; }

// The ledger INSERT anchors are the active engines' real formatting. These
// reduced engines retain the existing Assidu formula and expose its credited
// values so the migration can be checked without reproducing game services.
const proBody = `
declare
  v_rider record; v_season record; v_day record; v_plan record;
  v_status text; v_intensity integer := 60; v_domain text := 'climber';
  v_minimum_form integer := 40; v_trainer_level integer := 1;
  v_trainer_specialty text := 'mountain'; v_trainer_country_match boolean := false;
  v_physio_level integer := 0; v_previous_form numeric := 90;
  v_form_delta numeric := -5; v_next_form numeric := 85;
  v_session_id uuid; v_gain numeric; v_processed integer := 0; v_completed integer := 0;
begin
  select '${id(90)}'::uuid as id into v_season;
  select day_id as id from public.fixture_context into v_day;
  select null::uuid as trainer_contract_id into v_plan;
  for v_rider in select * from public.fixture_riders order by id loop
    v_status := v_rider.session_status;
    v_session_id := null;
      insert into public.rider_training_sessions (
        rider_id,
        team_id,
        season_id,
        season_day_id,
        status,
        intensity,
        domain,
        minimum_form,
        trainer_contract_id,
        trainer_level,
        trainer_specialty,
        trainer_country_match,
        physiotherapist_level,
        form_before,
        form_delta,
        form_after
      ) values (
        v_rider.id,
        v_rider.team_id,
        v_season.id,
        v_day.id,
        v_status,
        v_intensity,
        v_domain,
        v_minimum_form,
        v_plan.trainer_contract_id,
        v_trainer_level,
        v_trainer_specialty,
        v_trainer_country_match,
        v_physio_level,
        v_previous_form,
        v_form_delta,
        v_next_form
      )
      on conflict (rider_id, season_day_id) do nothing
      returning id into v_session_id;
    if v_session_id is null then continue; end if;
    v_gain := 0;
    if v_status = 'completed' then
      v_gain := 100 * case when v_rider.personality_key = 'assidu' then 1.05 else 1 end;
      v_completed := v_completed + 1;
    end if;
    update public.rider_training_sessions set rating_changes=jsonb_build_object('mountain',v_gain),
      progress_milli=jsonb_build_object('mountain',v_gain), decline_milli='{"mountain":0}'::jsonb
    where id=v_session_id;
    v_processed := v_processed + 1;
  end loop;
  return query select v_processed,v_completed,1;
end;
`;
const juniorBody = `
declare v_context record; v_projected_gain numeric := 100;
  v_raw_changes jsonb; v_ratings_after jsonb;
begin
  select academy.*, academy.id as academy_rider_id, '${id(90)}'::uuid as season_id,
    context.day_id as season_day_id, 1 as day_number, 'climber'::text as attempt_training_priority,
    'manual_am'::text as slot, 'rhythm'::text as game_type, academy.id as attempt_id
  into v_context from public.fixture_academy academy cross join public.fixture_context context
  where academy.id=p_attempt_id;
  v_projected_gain := v_projected_gain * case when v_context.personality_key = 'assidu' then 1.05 else 1 end;
  v_raw_changes := jsonb_build_object('mountain',v_projected_gain);
  v_ratings_after := jsonb_build_object('mountain',65+v_projected_gain/1000);
  insert into public.youth_academy_training_sessions (
    academy_rider_id,
    season_id,
    season_day_id,
    day_number,
    training_priority,
    training_mode,
    slot,
    game_type,
    score,
    rating_changes,
    ratings_after
  ) values (
    v_context.academy_rider_id,
    v_context.season_id,
    v_context.season_day_id,
    v_context.day_number,
    v_context.attempt_training_priority,
    'manual',
    v_context.slot,
    v_context.game_type,
    p_score,
    v_raw_changes,
    v_ratings_after
  );

  update public.youth_academy_training_attempts set status='completed' where id=v_context.attempt_id;
  return v_raw_changes;
end;
`;
const createPro = body => `create or replace function public.settle_due_training_sessions()
  returns table(processed_sessions integer,completed_sessions integer,current_day_number integer)
  language plpgsql security definer set search_path=public as $body$${body}$body$;`;
const createJunior = body => `create or replace function public.complete_current_youth_training_attempt(p_attempt_id uuid,p_score integer)
  returns jsonb language plpgsql security definer set search_path=public as $body$${body}$body$;`;

async function fixture(db, manualBody = juniorBody, professionalBody = proBody) {
  await db.exec(`
    create table public.rider_training_sessions (
      id uuid primary key default gen_random_uuid(),rider_id uuid,team_id uuid,season_id uuid,season_day_id uuid,
      status text,intensity integer,domain text,minimum_form integer,trainer_contract_id uuid,trainer_level integer,
      trainer_specialty text,trainer_country_match boolean,physiotherapist_level integer,
      form_before numeric,form_delta numeric,form_after numeric,progress_milli jsonb,decline_milli jsonb,rating_changes jsonb,
      unique(rider_id,season_day_id));
    create table public.youth_academy_training_sessions (
      id uuid primary key default gen_random_uuid(),academy_rider_id uuid,season_id uuid,season_day_id uuid,
      day_number integer,training_priority text,training_mode text,slot text,game_type text,score integer,
      rating_changes jsonb,ratings_after jsonb,unique(academy_rider_id,season_day_id,slot));
    create table public.youth_academy_training_attempts(id uuid primary key,status text);
    create table public.fixture_context(day_id uuid);
    insert into public.fixture_context values('${id(91)}');
    create table public.fixture_riders(id uuid primary key,team_id uuid,personality_key text,session_status text);
    create table public.fixture_academy(id uuid primary key,personality_key text);
    insert into public.fixture_riders values
      ('${id(1)}','${id(80)}','assidu','completed'),('${id(2)}','${id(80)}','fidele','completed'),
      ('${id(3)}','${id(80)}','assidu','skipped_low_form'),('${id(4)}','${id(80)}','assidu','skipped_injury'),
      ('${id(5)}','${id(80)}','assidu','skipped_form_camp'),('${id(6)}','${id(80)}','assidu','skipped_reconnaissance');
    insert into public.fixture_academy values('${id(11)}','assidu'),('${id(12)}','fidele');
    insert into public.youth_academy_training_attempts values('${id(11)}','started'),('${id(12)}','started');
    ${createPro(professionalBody)}
    ${createJunior(manualBody)}
  `);
}
async function runSessions(db) {
  await db.query("select * from public.settle_due_training_sessions()");
  await db.query("select public.complete_current_youth_training_attempt($1,900)",[id(11)]);
  await db.query("select public.complete_current_youth_training_attempt($1,900)",[id(12)]);
}
async function credited(db, day) {
  return (await db.query(`select rider_id::text as rider,status,form_before::text,form_delta::text,form_after::text,
    progress_milli,decline_milli,rating_changes from public.rider_training_sessions where season_day_id=$1 order by rider_id`,[day])).rows;
}
async function juniorCredited(db, day) {
  return (await db.query(`select academy_rider_id::text as rider,training_mode,slot,score,rating_changes,ratings_after
    from public.youth_academy_training_sessions where season_day_id=$1 order by academy_rider_id`,[day])).rows;
}

let db = new PGlite();
try {
  await fixture(db);
  await runSessions(db);
  const before = await credited(db,id(91));
  const beforeJunior = await juniorCredited(db,id(91));
  const attributes = (await db.query(`select oid::regprocedure::text as signature,prosecdef,proconfig,proacl
    from pg_proc where oid in ('public.settle_due_training_sessions()'::regprocedure,
    'public.complete_current_youth_training_attempt(uuid,integer)'::regprocedure) order by oid::regprocedure::text`)).rows;
  await db.exec(migration);
  check((await db.query(`select count(*)::integer as count from public.rider_training_sessions
    where personality_bonus_percentage is not null`)).rows[0].count,0,"Legacy professional snapshots stay unknown");
  check((await db.query(`select count(*)::integer as count from public.youth_academy_training_sessions
    where personality_bonus_percentage is not null`)).rows[0].count,0,"Legacy junior snapshots stay unknown");
  check(await credited(db,id(91)),before,"Existing professional gains and form are untouched");
  check(await juniorCredited(db,id(91)),beforeJunior,"Existing junior gains and ratings are untouched");
  const columns=(await db.query(`select table_name,is_nullable,column_default,data_type from information_schema.columns
    where table_schema='public' and table_name in ('rider_training_sessions','youth_academy_training_sessions')
    and column_name='personality_bonus_percentage' order by table_name`)).rows;
  check(columns.map(column=>[column.is_nullable,column.column_default,column.data_type]),
    [["YES",null,"smallint"],["YES",null,"smallint"]],"Both columns have no default and permit unknown history");
  check((await db.query(`select convalidated from pg_constraint where conname in
    ('rider_training_sessions_personality_bonus_allowed','youth_training_sessions_personality_bonus_allowed') order by conname`)).rows,
    [{convalidated:false},{convalidated:false}],"Constraints do not scan historical sessions");
  check((await db.query(`select oid::regprocedure::text as signature,prosecdef,proconfig,proacl from pg_proc
    where oid in ('public.settle_due_training_sessions()'::regprocedure,
    'public.complete_current_youth_training_attempt(uuid,integer)'::regprocedure) order by oid::regprocedure::text`)).rows,
    attributes,"Function permissions and configuration stay intact");
  await db.exec(`update public.fixture_context set day_id='${id(92)}'`);
  await runSessions(db);
  check(await credited(db,id(92)),before,"Professional credited gains and recovery are unchanged");
  check(await juniorCredited(db,id(92)),beforeJunior,"Manual junior credited gains are unchanged");
  check((await db.query(`select personality_bonus_percentage as bonus from public.rider_training_sessions
    where season_day_id=$1 order by rider_id`,[id(92)])).rows.map(row=>row.bonus),[5,0,0,0,0,0],
    "Only a completed Assidu professional session records 5; every skipped session records 0");
  check((await db.query(`select personality_bonus_percentage as bonus from public.youth_academy_training_sessions
    where season_day_id=$1 order by academy_rider_id`,[id(92)])).rows.map(row=>row.bonus),[5,0],
    "Manual juniors record the same character context used in their existing gain formula");
  await db.exec(`update public.fixture_riders set personality_key='fidele' where id='${id(1)}';
    update public.fixture_academy set personality_key='fidele' where id='${id(11)}';`);
  check((await db.query(`select personality_bonus_percentage as bonus from public.rider_training_sessions
    where rider_id=$1 and season_day_id=$2`,[id(1),id(92)])).rows[0].bonus,5,"Later character changes do not rewrite professional history");
  check((await db.query(`select personality_bonus_percentage as bonus from public.youth_academy_training_sessions
    where academy_rider_id=$1 and season_day_id=$2`,[id(11),id(92)])).rows[0].bonus,5,"Later character changes do not rewrite junior history");
  check((await db.query("select * from public.settle_due_training_sessions()")).rows[0].processed_sessions,0,
    "The professional engine keeps its existing duplicate-session guard");
  const afterFirst=(await db.query(`select pg_get_functiondef('public.settle_due_training_sessions()'::regprocedure) as pro,
    pg_get_functiondef('public.complete_current_youth_training_attempt(uuid,integer)'::regprocedure) as junior`)).rows;
  await db.exec(migration);
  check((await db.query(`select pg_get_functiondef('public.settle_due_training_sessions()'::regprocedure) as pro,
    pg_get_functiondef('public.complete_current_youth_training_attempt(uuid,integer)'::regprocedure) as junior`)).rows,
    afterFirst,"Reapplying the migration does not stack or duplicate the snapshot");
  await assert.rejects(()=>db.exec(`insert into public.rider_training_sessions(personality_bonus_percentage) values(7)`),error=>error.code==='23514'); checks++;
  await assert.rejects(()=>db.exec(`insert into public.youth_academy_training_sessions(personality_bonus_percentage) values(-5)`),error=>error.code==='23514'); checks++;
} finally { await db.close(); }

// A drift in the second engine must roll back even the schema and first patch.
db = new PGlite();
try {
  const drifted = juniorBody.replace("    ratings_after\n  ) values (","    ratings_after /* intentional fixture drift */\n  ) values (");
  await fixture(db,drifted);
  const before=(await db.query(`select pg_get_functiondef('public.settle_due_training_sessions()'::regprocedure) as pro`)).rows;
  await assert.rejects(()=>db.exec(migration),/Unexpected training ledger definition/); checks++;
  await db.exec("rollback");
  check((await db.query(`select count(*)::integer as count from information_schema.columns where
    table_schema='public' and column_name='personality_bonus_percentage'`)).rows[0].count,0,"Anchor drift rolls back both nullable columns");
  check((await db.query(`select pg_get_functiondef('public.settle_due_training_sessions()'::regprocedure) as pro`)).rows,
    before,"Anchor drift rolls back the previously patched professional function too");
  await db.exec(createJunior(juniorBody));
  const changedFormula=proBody.replace("then 1.05 else 1 end", "then 1.07 else 1 end");
  await db.exec(createPro(changedFormula));
  await assert.rejects(()=>db.exec(migration),/Missing or duplicated existing Assidu formula/); checks++;
  await db.exec("rollback");
  check((await db.query(`select count(*)::integer as count from information_schema.columns where
    table_schema='public' and column_name='personality_bonus_percentage'`)).rows[0].count,0,"A changed training multiplier also rolls back the schema");
  check((await db.query(`select position('then 1.07 else 1 end' in pg_get_functiondef('public.settle_due_training_sessions()'::regprocedure))>0 as unchanged`)).rows[0].unchanged,
    true,"The recording migration never attempts to repair or alter a drifted gain formula");
} finally { await db.close(); }
console.log(`Passed ${checks} isolated training personality snapshot SQL checks.`);
