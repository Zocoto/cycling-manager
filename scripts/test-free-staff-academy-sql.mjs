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
    create function settle_due_staff_academy_trainings() returns integer language plpgsql as $$ begin return 0; end $$;
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

  // The approved affix conversion is tested on the same isolated database,
  // including courses started before the conversion and real completion hooks.
  await db.exec(`
    alter table staff_members add column first_name text default 'Test', add column last_name text default 'Staff';
    alter table staff_member_talents add column unlocked_by text default 'market',
      add unique(staff_member_id,slot_number), add unique(staff_member_id,talent_code);
    alter table staff_talent_catalog add column display_name text default '';
    alter table staff_academy_trainings add column created_at timestamptz default now(),
      add column updated_at timestamptz default now(), add column completed_at timestamptz,
      add column awarded_talent_code text;
    create unique index one_active_course on staff_academy_trainings(staff_member_id) where status='active';
    create schema private;
    create table test_messages(reference text unique,subject text,link text);
    create function private.create_team_operational_message(uuid,text,text,text,text,text,text,text,text,boolean,timestamptz)
    returns uuid language plpgsql as $$ begin
      insert into public.test_messages values($9,$4,$7) on conflict do nothing;
      return gen_random_uuid();
    end $$;
    create function sync_active_season_day() returns void language plpgsql as $$ begin end $$;
    create function get_staff_contract_nationality_multiplier(uuid) returns numeric language sql as $$ select 1::numeric $$;
    create function get_staff_contract_federal_institute_multiplier(uuid) returns numeric language sql as $$ select 1::numeric $$;
    update team_manager_assignments set status='active';
    update team_infrastructures set level=2;
    update staff_members set level=1;
    delete from staff_member_talents where slot_number>1;
    update test_bonuses set educators=1,duration=0,capacity=0,federal=0;
    insert into staff_members(id,role,level) values('${id(13)}','educator',2);
    insert into staff_contracts values('${id(14)}','${id(13)}','${id(2)}','active');
    insert into staff_member_talents(staff_member_id,talent_code,slot_number) values
      ('${id(13)}','educator_training_cost',1),('${id(13)}','educator_training_effectiveness',2),
      ('${id(13)}','educator_training_time',3);
    insert into staff_talent_catalog(code,role,is_active,minimum_level,display_name) values
      ('educator_training_cost','educator',true,1,'Réseau de formation'),
      ('educator_training_effectiveness','educator',true,1,'Excellence pédagogique'),
      ('educator_training_time','educator',true,1,'Pédagogie accélérée'),
      ('educator_parallel_training','educator',true,3,'Double cursus'),
      ('mechanic_frame_efficiency','mechanic',true,1,'Cadre'),
      ('mechanic_wheel_interchangeability','mechanic',true,1,'Roues interchangeables');
  `);
  const historicalTalent = (await start("talent")).rows[0].id;
  const historicalLevel = (await start("level",7)).rows[0].id;
  const beforeConversion = (await db.query("select id,duration_days,completes_game_day_index from staff_academy_trainings where status='active' order by id")).rows;
  const notifications = readFileSync("supabase/migrations/20260828200000_add_dashboard_ds_assistant.sql", "utf8");
  const notificationStart = notifications.indexOf("create or replace function private.notify_completed_staff_academy_training()");
  await db.exec(notifications.slice(notificationStart, notifications.indexOf("$$;", notificationStart)+3));
  await db.exec(`create trigger notify_completed after update of status on staff_academy_trainings
    for each row execute function private.notify_completed_staff_academy_training();`);
  await db.exec(readFileSync("supabase/migrations/20261012190000_rework_staff_educator_talents.sql", "utf8"));
  assert.deepEqual((await db.query("select id,duration_days,completes_game_day_index from staff_academy_trainings where status='active' order by id")).rows, beforeConversion);
  assert.equal(Number(await scalar("select count(*) from staff_academy_trainings where status='active' and educator_talent_choice_count=1 and educator_mentorship_reduction_days=0")),2);
  assert.equal(await scalar("select display_name from staff_talent_catalog where code='educator_training_cost'"), "Orientation professionnelle");
  const settle = () => db.query("select settle_due_staff_academy_trainings() processed");
  const choose = (training, code) => db.query("select choose_current_team_staff_academy_talent($1,$2) id",[training,code]);
  await db.exec("update seasons set current_day_number=28");
  await settle();
  for (const historic of [historicalTalent,historicalLevel]) {
    const row = (await db.query("select status,talent_choice_codes from staff_academy_trainings where id=$1",[historic])).rows[0];
    assert.equal(row.status,"completed");
    assert.deepEqual(row.talent_choice_codes,[]);
  }
  await assertMoneyUnchanged();
  await db.exec(`delete from staff_member_talents where staff_member_id='${id(6)}' and slot_number>1;
    update team_infrastructures set level=1; update seasons set current_day_number=1;`);

  for (let teacherLevel=1;teacherLevel<=5;teacherLevel++) {
    await db.exec(`update staff_members set level=${teacherLevel} where id='${id(13)}'`);
    const bonuses = await scalar(`select get_team_staff_academy_educator_bonuses('${id(2)}')`);
    assert.equal(Number(bonuses.costReductionPercentage),0);
    assert.equal(Number(bonuses.durationReductionPercentage),teacherLevel*3);
    assert.equal(Number(bonuses.mentorshipReductionDays),Math.ceil(teacherLevel/2));
    assert.equal(Number(bonuses.talentChoiceCount),teacherLevel>=4 ? 3 : 2);
    const row=await created("level");
    assert.equal(row.duration_days,[4,4,3,3,3][teacherLevel-1]);
    assert.equal(Number(row.educator_mentorship_reduction_days),[1,1,2,2,2][teacherLevel-1]);
    assert.equal(Number(row.educator_talent_choice_count),1);
    await clearNew();
  }
  const oriented=await created("talent");
  assert.equal(Number(oriented.educator_talent_choice_count),3);
  assert.equal(Number(oriented.educator_mentorship_reduction_days),0);
  await assert.rejects(choose(oriented.id,"mechanic_wheel_efficiency"),/Aucun choix/);
  await db.exec("update seasons set current_day_number=28");
  await settle();
  const pending=(await db.query("select * from staff_academy_trainings where id=$1",[oriented.id])).rows[0];
  assert.equal(pending.status,"active");
  assert.equal(pending.talent_choice_codes.length,3);
  assert.equal(new Set(pending.talent_choice_codes).size,3);
  assert.ok(!pending.talent_choice_codes.includes("mechanic_incident_time"));
  assert.equal(Number(await scalar(`select count(*) from staff_member_talents where staff_member_id='${id(6)}'`)),1);
  assert.equal(Number(await scalar(`select count(*) from test_messages where reference='dashboard-staff-training-choice:${oriented.id}'`)),1);
  await settle();
  assert.deepEqual((await db.query("select talent_choice_codes from staff_academy_trainings where id=$1",[oriented.id])).rows[0].talent_choice_codes,pending.talent_choice_codes);
  await assert.rejects(choose(oriented.id,"doctor_recovery_time"),/parmi les propositions/);
  await assert.rejects(choose(oriented.id,null),/parmi les propositions/);
  await assert.rejects(start(),/déjà une formation/);
  await start("level",7); // waiting choice no longer consumes the Academy's only slot
  await db.exec(`create or replace function auth.uid() returns uuid language sql as $$ select '${id(99)}'::uuid $$`);
  await assert.rejects(choose(oriented.id,pending.talent_choice_codes[0]),/votre équipe/);
  await db.exec(`create or replace function auth.uid() returns uuid language sql as $$ select '${id(1)}'::uuid $$`);
  const selected=pending.talent_choice_codes[0];
  await choose(oriented.id,selected);
  await choose(oriented.id,selected); // network retries / double clicks are idempotent
  await assert.rejects(choose(oriented.id,pending.talent_choice_codes[1]),/Aucun choix/);
  assert.equal(Number(await scalar(`select count(*) from staff_member_talents where staff_member_id='${id(6)}'`)),2);
  assert.equal(Number(await scalar(`select count(*) from test_messages where reference='dashboard-staff-training-completed:${oriented.id}'`)),1);
  await clearNew();

  // If one compatible talent remains, it is applied automatically.
  await db.exec(`insert into staff_member_talents(staff_member_id,talent_code,slot_number)
    values('${id(6)}','${pending.talent_choice_codes[1]}',3); update seasons set current_day_number=1;`);
  // A separate unowned one-line staff can learn its only compatible talent.
  await db.exec(`insert into staff_talent_catalog(code,role,is_active,minimum_level) values('youth_coach_flat','youth_coach',true,1)`);
  const oneChoice=(await start("talent",7)).rows[0].id;
  await db.exec("update seasons set current_day_number=28");
  await settle();
  const auto=(await db.query("select status,awarded_talent_code,talent_choice_codes from staff_academy_trainings where id=$1",[oneChoice])).rows[0];
  assert.equal(auto.status,"completed");
  assert.equal(auto.awarded_talent_code,"youth_coach_flat");
  assert.deepEqual(auto.talent_choice_codes,[]);

  // Double cursus does not stack, and the educator requirement stays in force.
  await db.exec(`insert into staff_members(id,role,level) values('${id(17)}','educator',3),('${id(19)}','educator',5);
    insert into staff_contracts values('${id(18)}','${id(17)}','${id(2)}','active'),('${id(20)}','${id(19)}','${id(2)}','active');
    insert into staff_member_talents(staff_member_id,talent_code,slot_number)
    values('${id(17)}','educator_parallel_training',1),('${id(19)}','educator_parallel_training',1);`);
  assert.equal(Number((await scalar(`select get_team_staff_academy_educator_bonuses('${id(2)}')`)).extraCapacity),1);
  await db.exec(`update staff_contracts set status='inactive' where staff_member_id in ('${id(13)}','${id(17)}','${id(19)}')`);
  await assert.rejects(start("level",7),/formateur actif/);
  assert.equal(Number(await scalar("select cash_balance from team_seasons")),-402000);
  assert.equal(Number(await scalar("select count(*) from team_finance_transactions")),1);
  console.log("PASS: educator tiers, existing affix conversion, unchanged ongoing courses, fixed choices, available capacity, mail, ownership, duplicate prevention, automatic single choice and double-click idempotency.");
} catch (error) {
  console.error(JSON.stringify({ message: error.message, code: error.code, detail: error.detail, where: error.where }));
  process.exitCode = 1;
} finally {
  await db.close();
}
