import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// In-memory PostgreSQL only: no application credentials or Supabase connection.
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const database = new PGlite();
const query = async (sql, parameters = []) => (await database.query(sql, parameters)).rows;
const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const original = readFileSync("supabase/migrations/20260727160000_create_unique_staff_talents.sql", "utf8");
const migration = readFileSync("supabase/migrations/20261122130000_ensure_trainer_secondary_specialties.sql", "utf8");
function originalFunction(name) {
  const start = original.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1);
  return original.slice(start, original.indexOf("\n$$;", start) + 4);
}
const talents = member => query("select slot_number,talent_code,unlocked_by from staff_member_talents where staff_member_id=$1 order by slot_number", [id(member)]);
const insertCoach = (member, { specialty = "mountain", level = 5 } = {}) => query(
  "insert into staff_members(id,country_id,first_name,last_name,role,level,trainer_specialty) values ($1,$2,'Future','Coach','trainer',$3,$4)",
  [id(member), id(5), level, specialty],
);

try {
  await database.exec(`
    create schema private;
    create role anon;
    create role authenticated;
    create role service_role;
    create table staff_members(
      id uuid primary key, country_id uuid not null, first_name text, last_name text,
      role text not null, level smallint not null check(level between 1 and 5),
      trainer_specialty text, created_at timestamptz default now()
    );
    create table staff_contracts(id uuid primary key,staff_member_id uuid,team_id uuid,status text);
    create table riders(id uuid primary key,country_id uuid);
    create table seasons(id uuid primary key,status text);
    create table team_seasons(team_id uuid,season_id uuid,registration_country_id uuid);
    create table staff_academy_trainings(
      id uuid primary key, staff_member_id uuid, status text, improvement_type text,
      target_slot smallint, talent_choice_codes text[] not null default '{}'
    );
  `);
  // Use the real catalog, table constraints and role-validation trigger.
  await database.exec(original.slice(original.indexOf("create table public.staff_talent_catalog"),
    original.indexOf("-- AFFINITÉ NATIONALE ET VALEURS RÉUTILISABLES")));
  await database.exec("alter table staff_talent_catalog add column minimum_level integer not null default 1");
  await database.exec(originalFunction("get_staff_contract_nationality_multiplier"));
  await database.exec(originalFunction("get_trainer_talent_progress_multiplier"));

  for (const [member, first, last, specialty, level] of [
    [100, "Nuno", "Kyaw", "mountain", 5], [101, "Toma", "Fujii", "flat", 5],
    [102, "Existing", "Specialist", "mountain", 5], [103, "Existing", "Three talents", "mountain", 5],
    [105, "Pending", "Academy choice", "mountain", 5], [106, "Young", "Coach", "mountain", 1],
  ]) {
    await query(`insert into staff_members(id,country_id,first_name,last_name,role,level,trainer_specialty,created_at)
      values($1,$2,$3,$4,'trainer',$5,$6,'2026-07-25T12:00:00Z')`, [id(member), id(5), first, last, level, specialty]);
  }
  await query("insert into staff_members(id,country_id,role,level) values($1,$2,'doctor',5)", [id(104), id(5)]);
  for (const [member, slot, code] of [[102, 1, "trainer_sprint"],
    [103, 1, "trainer_hills"], [103, 2, "trainer_flat"], [103, 3, "trainer_endurance"]]) {
    await query("insert into staff_member_talents(staff_member_id,slot_number,talent_code,unlocked_by) values($1,$2,$3,'professions_building')", [id(member), slot, code]);
  }
  await query(`insert into staff_academy_trainings values($1,$2,'active','talent',1,
    array['trainer_hills','trainer_flat','trainer_sprint'])`, [id(500), id(105)]);
  await database.exec("update staff_talent_catalog set minimum_level=3 where code='trainer_time_trial'");
  const existingBefore = [...await talents(102), ...await talents(103)];
  const membersBefore = await query("select * from staff_members order by id");
  const academyBefore = await query("select * from staff_academy_trainings order by id");
  assert.deepEqual(await talents(100), [], "reproduce the historical missing secondary line");
  assert.deepEqual(await talents(101), []);

  await database.exec(migration);
  for (const member of [100, 101, 105, 106]) {
    const assigned = await talents(member);
    assert.equal(assigned.length, 1);
    assert.equal(assigned[0].unlocked_by, "generation");
    const profile = (await query("select trainer_specialty,level from staff_members where id=$1", [id(member)]))[0];
    assert.notEqual(assigned[0].talent_code, `trainer_${profile.trainer_specialty}`);
    const candidate = (await query("select role,is_active,minimum_level from staff_talent_catalog where code=$1", [assigned[0].talent_code]))[0];
    assert.equal(candidate.role, "trainer");
    assert.equal(candidate.is_active, true);
    assert.ok(candidate.minimum_level <= profile.level);
  }
  assert.deepEqual([...await talents(102), ...await talents(103)], existingBefore, "preserve trained and existing talents");
  assert.deepEqual(await talents(104), [], "do not grant talents to another staff role");
  assert.deepEqual(await query("select * from staff_members order by id"), membersBefore, "names, levels, specialties and profiles remain intact");
  assert.deepEqual(await query("select * from staff_academy_trainings order by id"), academyBefore);
  const reserved = (await talents(105))[0];
  assert.equal(reserved.slot_number, 2, "leave the active course's reserved slot empty");
  assert.ok(!["trainer_hills", "trainer_flat", "trainer_sprint"].includes(reserved.talent_code), "preserve every offered course choice");
  // The pending choice still settles into its original slot without conflict.
  await query("insert into staff_member_talents(staff_member_id,slot_number,talent_code,unlocked_by) values($1,1,'trainer_hills','professions_building')", [id(105)]);

  // Verify the actual training effect function, not only a newly visible label.
  await query("insert into seasons values($1,'active')", [id(1)]);
  await query("insert into team_seasons values($1,$2,$3)", [id(10), id(1), id(5)]);
  await query("insert into riders values($1,$2),($3,$4)", [id(200), id(6), id(201), id(5)]);
  await query("insert into staff_contracts values($1,$2,$3,'active')", [id(300), id(100), id(10)]);
  const nunoTalent = (await talents(100))[0].talent_code;
  const stat = nunoTalent.replace("trainer_", "");
  const effect = (rider, domain) => query("select get_trainer_talent_progress_multiplier($1,$2,$3)::text as multiplier", [id(300), id(rider), domain]);
  assert.equal(Number((await effect(200, stat))[0].multiplier), 1.2);
  assert.equal(Number((await effect(201, stat))[0].multiplier), 1.22, "keep nationality affinity");
  assert.equal(Number((await effect(200, "mountain"))[0].multiplier), 1, "do not duplicate the primary specialty");

  // Existing generation writes a selected talent AFTER the staff row. The
  // commit-time fallback must not occupy its slot or change that explicit roll.
  await database.exec("begin");
  await insertCoach(110);
  assert.deepEqual(await talents(110), [], "fallback waits until the transaction ends");
  await query("insert into staff_member_talents(staff_member_id,slot_number,talent_code,unlocked_by) values($1,1,'trainer_cobbles','generation')", [id(110)]);
  await database.exec("commit");
  assert.deepEqual(await talents(110), [{ slot_number: 1, talent_code: "trainer_cobbles", unlocked_by: "generation" }]);
  await insertCoach(111);
  assert.equal((await talents(111)).length, 1, "a future writer cannot leave a new coach talentless");
  await query("delete from staff_member_talents where staff_member_id=$1", [id(111)]);
  await query("update staff_members set level=4 where id=$1", [id(111)]);
  assert.equal((await talents(111)).length, 1, "an update also repairs a talentless coach");
  for (const [index, specialty] of ["mountain", "hills", "flat", "sprint", "time_trial", "cobbles", "endurance"].entries()) {
    await insertCoach(120 + index, { specialty, level: 1 });
    const assigned = await talents(120 + index);
    assert.equal(assigned.length, 1);
    assert.notEqual(assigned[0].talent_code, `trainer_${specialty}`);
    assert.notEqual(assigned[0].talent_code, "trainer_time_trial", "respect catalog level requirements on new generation too");
  }

  await query("insert into staff_members(id,country_id,role,level) values($1,$2,'doctor',1)", [id(112), id(5)]);
  await query("update staff_members set role='trainer',trainer_specialty='flat' where id=$1", [id(112)]);
  assert.equal((await talents(112)).length, 1, "changing role also establishes the trainer invariant");
  await database.exec("begin");
  await insertCoach(113);
  await query("update staff_members set role='doctor',trainer_specialty=null where id=$1", [id(113)]);
  await database.exec("commit");
  assert.deepEqual(await talents(113), [], "a queued trigger must inspect the current role");
  await database.exec("begin");
  await insertCoach(114);
  await query("delete from staff_members where id=$1", [id(114)]);
  await database.exec("commit");
  assert.deepEqual(await talents(114), [], "a deleted coach cannot receive an orphan talent");

  const beforeRetry = await talents(100);
  assert.equal((await query("select private.ensure_trainer_secondary_specialty($1) as result", [id(100)]))[0].result, null);
  assert.deepEqual(await talents(100), beforeRetry, "retries do not reroll or grant another talent");
  await query("update staff_members set level=4 where id=$1", [id(100)]);
  assert.deepEqual(await talents(100), beforeRetry, "level changes preserve the chosen talent");
  await database.exec("set role authenticated");
  await assert.rejects(query("select private.ensure_trainer_secondary_specialty($1)", [id(100)]), /permission denied/);
  await database.exec("reset role;set role anon");
  await assert.rejects(query("select private.ensure_trainer_secondary_specialty($1)", [id(100)]), /permission denied/);
  await database.exec("reset role");

  console.log("Trainer secondary specialties SQL passed: legacy catch-up, preserved profiles/talents/courses, compatible distinct specialties, real training bonuses, explicit generation, deferred fallback, role/deletion handling, idempotence and permissions.");
} finally {
  await database.close();
}
