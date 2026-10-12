// All gameplay fixtures run ONLY in a disposable local PGlite database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

if (!process.env.STAFF_ACADEMY_SQL_TEST_MODULE) throw new Error("An isolated PGlite module is required.");
const { PGlite } = await import(pathToFileURL(process.env.STAFF_ACADEMY_SQL_TEST_MODULE).href);
const db = new PGlite();
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const migration = readFileSync("supabase/migrations/20261012183000_make_staff_academy_training_free.sql", "utf8");
const start = (type = "level", contract = 5) => db.query(
  "select start_current_team_staff_academy_training($1,$2) id", [id(contract), type],
);
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
try {
  await db.exec(`
    create schema auth;
    create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql as $$ select '${id(1)}'::uuid $$;
    create table sporting_directors(id uuid,auth_user_id uuid,status text);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table seasons(id uuid,status text,game_year integer,current_day_number integer);
    create table team_seasons(id uuid,team_id uuid,season_id uuid,cash_balance numeric);
    create table team_infrastructures(team_id uuid,infrastructure_code text,level integer);
    create table staff_contracts(id uuid,staff_member_id uuid,team_id uuid,status text);
    create table staff_members(id uuid,role text,level integer,trainer_specialty text);
    create table staff_member_talents(staff_member_id uuid,talent_code text,slot_number integer);
    create table staff_talent_catalog(code text,role text,is_active boolean,minimum_level integer);
    create table test_bonuses(educators integer,duration integer,capacity integer,federal integer);
    insert into test_bonuses values(1,0,0,0);
    create function get_team_staff_academy_educator_bonuses(uuid) returns jsonb language sql as $$
      select jsonb_build_object('activeEducatorCount',educators,'durationReductionPercentage',duration,
        'extraCapacity',capacity,'costReductionPercentage',40) from test_bonuses $$;
    create function settle_due_infrastructure_projects() returns void language plpgsql as $$ begin end $$;
    create function settle_due_staff_academy_trainings() returns void language plpgsql as $$ begin end $$;
    create table staff_academy_trainings(
      id uuid default gen_random_uuid(),team_id uuid,team_season_id uuid,started_season_id uuid,
      staff_contract_id uuid,staff_member_id uuid,improvement_type text,previous_level integer,
      previous_talent_count integer,target_slot integer,cost numeric not null,
      duration_days integer,started_day_number integer,starts_game_day_index integer,
      completes_game_day_index integer,educator_cost_reduction_percentage numeric,
      educator_duration_reduction_percentage numeric,federal_duration_reduction_percentage numeric default 0,
      status text default 'active',constraint staff_academy_trainings_cost_positive check(cost>0));
    create table team_finance_transactions(amount numeric,description text);
    insert into team_finance_transactions values(-525000,'Historical paid course');
    insert into sporting_directors values('${id(1)}','${id(1)}','active');
    insert into team_manager_assignments values('${id(1)}','${id(2)}','general_manager','active');
    insert into seasons values('${id(3)}','active',4,5);
    insert into team_seasons values('${id(4)}','${id(2)}','${id(3)}',-402000);
    insert into team_infrastructures values('${id(2)}','staff_academy',1);
    insert into staff_members values('${id(6)}','mechanic',1,null),('${id(8)}','youth_coach',1,'sprint');
    insert into staff_contracts values('${id(5)}','${id(6)}','${id(2)}','active'),
      ('${id(7)}','${id(8)}','${id(2)}','active');
    insert into staff_member_talents values('${id(6)}','mechanic_incident_time',1);
    insert into staff_talent_catalog values('mechanic_wheel_efficiency','mechanic',true,1),
      ('youth_coach_sprint','youth_coach',true,1);
    insert into staff_academy_trainings(cost,status) values(525000,'completed');
    create function get_staff_contract_federal_training_reduction(uuid) returns numeric language sql as $$
      select federal from test_bonuses $$;
  `);
  const federal = readFileSync("supabase/migrations/20260908210000_activate_federal_staff_institute_specializations.sql", "utf8");
  const triggerStart = federal.indexOf("create or replace function public.apply_federal_staff_to_academy_training()");
  await db.exec(federal.slice(triggerStart, federal.indexOf("$$;", triggerStart) + 3));
  await db.exec(`create trigger federal before insert on staff_academy_trainings
    for each row execute function apply_federal_staff_to_academy_training();`);
  await db.exec(migration);

  const assertMoneyUnchanged = async () => {
    assert.equal(Number(await scalar("select cash_balance from team_seasons")), -402000);
    assert.equal(Number(await scalar("select count(*) from team_finance_transactions")), 1);
    assert.equal(Number(await scalar("select cost from staff_academy_trainings where status='completed'")), 525000);
  };
  const clearNew = () => db.exec("delete from staff_academy_trainings where status='active'");
  const created = async (type) => {
    const result = await start(type);
    return (await db.query("select * from staff_academy_trainings where id=$1", [result.rows[0].id])).rows[0];
  };
  for (const [type, duration] of [["level",5],["talent",9]]) {
    const row = await created(type);
    assert.equal(Number(row.cost), 0);
    assert.equal(Number(row.educator_cost_reduction_percentage), 0);
    assert.equal(row.duration_days, duration);
    assert.equal(row.completes_game_day_index-row.starts_game_day_index, duration);
    assert.equal(await scalar(`select status from staff_contracts where id='${id(5)}'`), "active");
    await assertMoneyUnchanged();
    await assert.rejects(start(), /emplacement/);
    await db.exec("update test_bonuses set capacity=1");
    await assert.rejects(start(), /déjà une formation/);
    await clearNew();
    await db.exec("update test_bonuses set capacity=0");
  }

  await db.exec("update test_bonuses set educators=0");
  for (const type of ["level","talent"]) await assert.rejects(start(type), /formateur actif/);
  assert.equal(Number(await scalar("select count(*) from staff_academy_trainings where status='active'")), 0);
  await db.exec("update test_bonuses set educators=1,duration=35,federal=25");
  const reduced = await created("level");
  assert.equal(reduced.duration_days, 3); // ceil(ceil(5 * .65) * .75)
  assert.equal(Number(reduced.federal_duration_reduction_percentage), 25);
  await clearNew();
  await assert.rejects(start("talent",7), /Aucune nouvelle ligne/); // no duplicate youth specialty
  await assert.rejects(start("invalid"), /invalide/);
  await assert.rejects(start(null), /invalide/);
  await assert.rejects(start("level",99), /équipe active/);
  await db.exec("update staff_members set level=5 where role='mechanic'");
  await assert.rejects(start(), /cinq étoiles/);
  await db.exec(`insert into staff_member_talents values('${id(6)}','another',2),('${id(6)}','third',3)`);
  await assert.rejects(start("talent"), /trois lignes/);
  await db.exec("update team_infrastructures set level=0");
  await assert.rejects(start(), /Construisez/);
  await db.exec("update team_manager_assignments set status='inactive'");
  await assert.rejects(start(), /Aucune équipe active/);
  await assert.rejects(db.exec("insert into staff_academy_trainings(cost) values(-1)"), /cost_nonnegative/);
  await assertMoneyUnchanged();
  console.log("PASS: free level/talent courses, negative balance, no ledger/debit, required educator, duration/federal bonuses, capacity, eligibility, ownership and paid history.");
} finally {
  await db.close();
}
