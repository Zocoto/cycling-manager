import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2];
if (!modulePath || !isAbsolute(modulePath) || !modulePath.replaceAll("\\", "/").endsWith("/pglite/dist/index.js")) {
  throw new Error("A local PGlite module path is required.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();

const educatorRules = readFileSync(new URL("../supabase/migrations/20261012190000_rework_staff_educator_talents.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261111150000_add_staff_academy_dashboard_alert.sql", import.meta.url), "utf8");
const teamId = "00000000-0000-4000-8000-000000000001";
const educatorId = "00000000-0000-4000-8000-000000000002";
const trainerId = "00000000-0000-4000-8000-000000000003";
const coachId = "00000000-0000-4000-8000-000000000004";

async function expectOpportunity(freeSlotCount, eligibleMemberCount) {
  const result = await db.query("select public.get_current_dashboard_assistant_summary() as summary");
  assert.deepEqual(result.rows[0].summary, {
    staffAcademyOpportunity: { freeSlotCount, eligibleMemberCount },
    equipmentPartnerSignatureAvailable: false,
  });
}

try {
  await db.exec(`
    create schema private;
    create role anon;
    create role authenticated;
    create table team_infrastructures(team_id uuid, infrastructure_code text, level integer);
    create table staff_members(id uuid, role text, level integer, trainer_specialty text);
    create table staff_contracts(id uuid, team_id uuid, staff_member_id uuid, status text);
    create table staff_member_talents(staff_member_id uuid, talent_code text);
    create table staff_talent_catalog(code text, role text, minimum_level integer, is_active boolean);
    create table staff_academy_trainings(team_id uuid, staff_member_id uuid, status text, talent_choice_codes text[]);
    create function get_staff_contract_nationality_multiplier(uuid) returns numeric language sql as $$ select 1 $$;
    create function get_staff_contract_federal_institute_multiplier(uuid) returns numeric language sql as $$ select 1 $$;
    create function get_current_dashboard_assistant_summary() returns jsonb language sql stable security definer as $$
      with current_context as (select '${teamId}'::uuid as team_id),
      journal as (
        select jsonb_build_object(
      'equipmentPartnerSignatureAvailable', (select false)
        ) as items
      )
      select journal.items from current_context cross join journal;
    $$;
  `);
  for (const name of ["get_team_staff_academy_educator_bonuses", "get_staff_academy_available_talents"]) {
    const definition = educatorRules.match(new RegExp(`create (?:or replace )?function public\\.${name}\\([\\s\\S]+?\\$\\$;`));
    assert.ok(definition, `Missing canonical SQL for ${name}`);
    await db.exec(definition[0]);
  }
  await db.exec(migration);
  const privilege = await db.query(`
    select has_function_privilege('authenticated', 'private.get_staff_academy_training_opportunity(uuid)', 'execute') as exposed
  `);
  assert.equal(privilege.rows[0].exposed, false);

  await db.exec(`
    insert into staff_members values
      ('${educatorId}', 'educator', 5, null),
      ('${trainerId}', 'trainer', 5, 'climber'),
      ('${coachId}', 'youth_coach', 4, null);
    insert into staff_contracts values
      (gen_random_uuid(), '${teamId}', '${educatorId}', 'active'),
      (gen_random_uuid(), '${teamId}', '${trainerId}', 'active'),
      (gen_random_uuid(), '${teamId}', '${coachId}', 'active');
    insert into staff_member_talents values
      ('${educatorId}', 'educator_training_cost'),
      ('${educatorId}', 'educator_training_time'),
      ('${educatorId}', 'educator_training_effectiveness');
    insert into staff_talent_catalog values ('trainer_climber', 'trainer', 1, true);
  `);
  await expectOpportunity(0, 0);
  await db.exec(`insert into team_infrastructures values ('${teamId}', 'staff_academy', 1);`);
  await expectOpportunity(1, 1);

  await db.exec(`update staff_contracts set status = 'expired' where staff_member_id = '${educatorId}';`);
  await expectOpportunity(0, 0);
  await db.exec(`update staff_contracts set status = 'active' where staff_member_id = '${educatorId}';`);

  await db.exec(`insert into staff_academy_trainings values ('${teamId}', '${coachId}', 'active', '{}');`);
  await expectOpportunity(0, 0);
  await db.exec("update staff_academy_trainings set talent_choice_codes = '{choice_one,choice_two}';");
  await expectOpportunity(1, 0);
  await db.exec("insert into staff_talent_catalog values ('trainer_rouleur', 'trainer', 1, true);");
  await expectOpportunity(1, 1);

  await db.exec(`
    update staff_academy_trainings set talent_choice_codes = '{}';
    update staff_member_talents set talent_code = 'educator_parallel_training'
    where staff_member_id = '${educatorId}' and talent_code = 'educator_training_cost';
  `);
  await expectOpportunity(1, 1);
  console.log("Staff Academy dashboard opportunity checks passed on isolated PGlite.");
} finally {
  await db.close();
}
