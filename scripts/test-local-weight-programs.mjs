// Isolated in-memory PostgreSQL: never loads credentials or connects to production.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
if (!process.argv[2]?.endsWith("/dist/index.js")) throw new Error("Pass the local PGlite module, not a database URL.");
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const dose = n => ({riderId:id(n),nutritionistContractId:id(30),interventionCode:"recovery_snack"});
const program = (n,delta) => ({riderId:id(n),weightDeltaKg:delta});
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
    create table public.sporting_directors(id uuid primary key, auth_user_id uuid, status text);
    create table public.team_manager_assignments(sporting_director_id uuid, team_id uuid, role text, status text);
    create table public.seasons(id uuid primary key, game_year integer, status text, current_day_number integer);
    create table public.team_seasons(id uuid primary key, team_id uuid, season_id uuid, cash_balance numeric);
    create table public.season_days(id uuid primary key, season_id uuid, day_number integer, calendar_date date);
    create table public.riders(id uuid primary key, height_cm numeric, weight_kg numeric, baseline_weight_kg numeric);
    create table public.rider_contracts(rider_id uuid,team_id uuid,status text);
    create table public.staff_members(id uuid primary key,role text,level integer,first_name text,last_name text);
    create table public.staff_contracts(id uuid primary key,staff_member_id uuid,team_id uuid,status text);
    create table public.rider_condition_states(rider_id uuid,season_day_id uuid,form numeric,fatigue integer,
      source text,updated_at timestamptz default now(),unique(rider_id,season_day_id));
    create table public.rider_nutrition_interventions(id uuid primary key,rider_id uuid,team_season_id uuid,
      season_day_id uuid,nutritionist_contract_id uuid,intervention_code text,nutritionist_level integer,
      base_form_gain numeric,level_form_bonus numeric,actual_form_gain numeric,base_price numeric,price_paid numeric,
      form_before numeric,form_after numeric,applied_at timestamptz default now(),
      weight_before_kg numeric,weight_delta_kg numeric,weight_after_kg numeric,unique(rider_id,season_day_id));
    create table public.team_finance_transactions(team_season_id uuid,season_day_id uuid,day_number integer,
      amount numeric,category text,status text,description text,source_reference text unique,posted_at timestamptz);
    create table public.rider_weight_events(id uuid primary key default gen_random_uuid(),rider_id uuid,
      team_id uuid,season_id uuid,season_day_id uuid,game_day_index integer,source text,
      weight_before_kg numeric,weight_delta_kg numeric,weight_after_kg numeric,form_cost numeric default 0,
      source_reference text unique,applied_at timestamptz default now(),
      constraint rider_weight_events_source_allowed check(source in ('supplement','weight_cut')));
    create function public.sync_active_season_day() returns void language sql as $$ select $$;
    create function public.settle_current_team_finances() returns void language sql as $$ select $$;
    create function public.get_nutritionist_daily_capacity(integer) returns integer language sql as $$ select 2 $$;
    create function public.get_staff_contract_talent_flat_bonus(uuid,text,integer) returns integer language sql as $$ select 0 $$;
    create function public.get_nutritionist_intervention_price(uuid,numeric,integer) returns numeric language sql as $$ select $2 $$;
    create function public.physiology_seed_fraction(text) returns numeric language sql as $$ select 0 $$;
    insert into public.sporting_directors values('${id(90)}','${id(99)}','active');
    insert into public.team_manager_assignments values('${id(90)}','${id(20)}','general_manager','active');
    insert into public.seasons values('${id(10)}',3,'active',32),('${id(11)}',4,'upcoming',1);
    insert into public.team_seasons values('${id(21)}','${id(20)}','${id(10)}',10000),('${id(22)}','${id(20)}','${id(11)}',10000);
    insert into public.season_days values('${id(100)}','${id(10)}',31,'2026-10-06'),('${id(101)}','${id(10)}',32,'2026-10-07'),
      ('${id(102)}','${id(11)}',1,'2026-10-08'),('${id(103)}','${id(11)}',4,'2026-10-11'),('${id(104)}','${id(11)}',5,'2026-10-12');
    insert into public.staff_members values('${id(31)}','nutritionist',5,'Camille','Nutrition');
    insert into public.staff_contracts values('${id(30)}','${id(31)}','${id(20)}','active');
    select set_config('test.user','${id(99)}',false);
  `);
  for (let n=1;n<=9;n++) {
    await db.query("insert into public.riders values($1,180,72,72)",[id(n)]);
    await db.query("insert into public.rider_contracts values($1,$2,'active')",[id(n),id(n)===id(9)?id(999):id(20)]);
    await db.query("insert into public.rider_condition_states values($1,$2,$3,8,'daily_settlement',now())",[id(n),id(101),n===2||n===4?2:n===1?10:80]);
  }
  // Install the real fast batch and real supplement-risk trigger, not a mock
  // for writes, form caps, eligibility, capacity, cash or retry behaviour.
  await db.exec(await readFile("supabase/migrations/20260927100000_optimize_nutrition_batch_retry.sql","utf8"));
  await db.exec(await readFile("supabase/migrations/20261007120000_increase_supplement_risk_with_regularity.sql","utf8"));
  await db.exec(`create trigger apply_supplement_weight_risk_before_insert before insert on public.rider_nutrition_interventions
    for each row execute function public.apply_supplement_weight_risk()`);
  const migration = await readFile("supabase/migrations/20261008160000_add_atomic_weight_programs.sql","utf8");
  await db.exec(migration);
  const apply = async (supps,programs) => (await db.query("select public.apply_current_team_nutrition_plan($1::jsonb,$2::jsonb) as result",
    [JSON.stringify(supps),JSON.stringify(programs)])).rows[0].result;
  const state = async n => (await db.query(`select rider.weight_kg,rider.baseline_weight_kg,condition.form,condition.fatigue
    from public.riders rider join public.rider_condition_states condition on condition.rider_id=rider.id
    where rider.id=$1 order by condition.updated_at desc,condition.season_day_id desc limit 1`,[id(n)])).rows[0];
  const snapshot = async () => (await db.query(`select
    (select jsonb_agg(r order by id) from public.riders r) as riders,
    (select jsonb_agg(s order by rider_id,season_day_id) from public.rider_condition_states s) as states,
    (select jsonb_agg(e order by id) from public.rider_weight_events e) as events,
    (select jsonb_agg(n order by id) from public.rider_nutrition_interventions n) as nutrition,
    (select jsonb_agg(f order by source_reference) from public.team_finance_transactions f) as ledger,
    (select jsonb_agg(t order by id) from public.team_seasons t) as cash`)).rows[0];
  const before = await snapshot();
  await assert.rejects(()=>apply([dose(3)],[program(2,1)]),/forme.*insuffisante/);
  assert.deepEqual(await snapshot(),before,"invalid last programme rolls back the supplement, random weight, ledger and cash");
  const mixed=await apply([dose(1)],[program(1,0.4)]);
  assert.deepEqual(await state(1),{weight_kg:"72.5",baseline_weight_kg:"72",form:"7.0",fatigue:8});
  const afterMixed=await snapshot();
  assert.equal(Number(afterMixed.cash.find(row=>row.id===id(21)).cash_balance),9500);
  assert.deepEqual(await apply([dose(1)],[program(1,0.4)]),mixed);
  assert.deepEqual(await snapshot(),afterMixed,"lost response retry has no new debit, event, condition or risk roll");
  await assert.rejects(()=>apply([],[program(1,-0.2)]),/délai de cinq jours/);
  await assert.rejects(()=>db.query("select public.apply_current_team_weight_cut($1,0.2)",[id(1)]),/délai de cinq jours/);
  await apply([dose(4)],[program(4,0.2)]);
  assert.equal(Number((await state(4)).form),3,"supplement can supply the form needed for a programme");
  const beforeCapacity=await snapshot();
  await assert.rejects(()=>apply([dose(3)],[program(3,0.2)]),/capacité/);
  assert.deepEqual(await snapshot(),beforeCapacity);
  // Programmes have no supplement quota or financial fee.
  const cashBefore=beforeCapacity.cash;
  await apply([],[program(3,-0.6)]);
  assert.equal(Number((await state(3)).weight_kg),71.4);
  assert.equal(Number((await state(3)).form),68);
  assert.deepEqual((await snapshot()).cash,cashBefore);
  const invalidBefore=await snapshot();
  for (const programs of [[program(5,0.3)],[program(5,0)],[program(5,0.2),program(5,0.4)],
    [program(9,0.2)],Array(36).fill(program(5,0.2)),[{riderId:id(5),weightDeltaKg:"0.2"}]])
    await assert.rejects(()=>apply([],programs));
  await db.exec(`update public.staff_contracts set status='expired'`);
  await assert.rejects(()=>apply([],[program(5,0.2)]),/nutritionniste actif/);
  await db.exec(`update public.staff_contracts set status='active'`);
  assert.deepEqual(await snapshot(),invalidBefore);
  await db.exec(`select set_config('test.user','',false)`);
  await assert.rejects(()=>apply([],[program(5,0.2)]),/Authentification/);
  await db.exec(`select set_config('test.user','${id(99)}',false);set role anon`);
  await assert.rejects(()=>apply([],[program(5,0.2)]),/permission denied/);
  await db.exec("reset role");
  await db.query("update public.riders set weight_kg=58.3 where id=$1",[id(5)]);
  await assert.rejects(()=>apply([],[program(5,-0.2)]),/poids de sécurité/);
  await db.query("update public.riders set weight_kg=119.9 where id=$1",[id(5)]);
  await assert.rejects(()=>apply([],[program(5,0.2)]),/poids maximal/);
  await db.query("update public.riders set weight_kg=72 where id=$1",[id(5)]);
  await db.exec(`update public.seasons set status='completed' where id='${id(10)}';
    update public.seasons set status='active' where id='${id(11)}'`);
  await assert.rejects(()=>apply([],[program(1,-0.2)]),/délai de cinq jours/);
  await db.exec(`update public.seasons set current_day_number=4 where id='${id(11)}'`);
  await assert.rejects(()=>apply([],[program(1,-0.2)]),/délai de cinq jours/);
  await db.exec(`update public.seasons set current_day_number=5 where id='${id(11)}'`);
  await apply([],[program(1,-0.2)]);
  assert.equal(Number((await state(1)).weight_kg),72.3,"exactly five calendar days allows the opposite direction");
  // Previous-day form is copied with fatigue; existing legacy client shares
  // validation and becomes idempotent too.
  const cut=await db.query("select public.apply_current_team_weight_cut($1,0.4) as event",[id(6)]);
  const cutRetry=await db.query("select public.apply_current_team_weight_cut($1,0.4) as event",[id(6)]);
  assert.deepEqual(cut.rows,cutRetry.rows);
  assert.equal(Number((await state(6)).form),67);
  const installedState=await snapshot();
  await db.exec(migration);
  assert.deepEqual(await snapshot(),installedState,"DDL reinstall never replays nutrition or programmes");
  console.log("PASS: real supplement batch/risk, atomic rollback, supplement-before-programme form, shared real-date cooldown across seasons, exact retries, old-client compatibility, costs/capacity/bounds/authorization and unchanged baselines/history on reinstall.");
} finally {await db.close();}
