// Run the real staff-naturalization assistant migration against isolated PostgreSQL.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ?? "";
if (!isAbsolute(modulePath) || !modulePath.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js")) {
  throw new Error("Pass the absolute path to a local PGlite installation.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const teamId = id(1), otherTeamId = id(2), seasonId = id(5), countryId = id(10), foreignCountryId = id(11);
const source = await readFile(new URL("../supabase/migrations/20261120103000_add_staff_naturalization_assistant_alert.sql", import.meta.url), "utf8");
let assertions = 0;
function check(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  assertions += 1;
}
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
const summary = () => scalar("select public.get_current_dashboard_assistant_summary()");
async function opportunity(expected) {
  const value = await summary();
  check(value.staffNaturalizationOpportunity, expected, "staff naturalization opportunity matches actual availability");
  check(value.equipmentPartnerSignatureAvailable, false, "existing summary property is preserved");
  check(value.items, [{ id: "existing-journal-item" }], "existing journal is preserved");
}
const expected = (eligibleMemberCount, remainingCount) => ({
  eligibleMemberCount,
  remainingCount,
  targetCountryName: "Belgique",
});
async function reset() {
  await db.exec(`
    update public.team_seasons set status='active', registration_country_id='${countryId}' where team_id='${teamId}' and season_id='${seasonId}';
    update public.countries set is_active=true;
    update public.team_infrastructures set level=1 where team_id='${teamId}';
    update public.staff_contracts set status='active';
    update public.staff_members set country_id='${foreignCountryId}';
    update public.fixture_staff_naturalization_bonuses set specialization_power=0, federal_bonus=0;
    delete from public.staff_naturalizations;
  `);
}
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema private;
    create table public.countries(id uuid primary key, name text, iso_alpha2 text, is_active boolean);
    create table public.team_seasons(id uuid primary key,team_id uuid,season_id uuid,registration_country_id uuid,status text);
    create table public.team_infrastructures(team_id uuid,infrastructure_code text,level integer);
    create table public.staff_members(id uuid primary key,country_id uuid,status text);
    create table public.staff_contracts(id uuid primary key,team_id uuid,staff_member_id uuid,status text);
    create table public.staff_naturalizations(id uuid default gen_random_uuid(),team_id uuid,season_id uuid);
    create table public.fixture_staff_naturalization_bonuses(team_id uuid primary key,specialization_power numeric,federal_bonus integer);
    create function public.get_team_specialization_power(uuid,text,text) returns numeric language sql stable as
      $$ select coalesce((select specialization_power from public.fixture_staff_naturalization_bonuses where team_id=$1),0) $$;
    create function public.get_team_federal_staff_naturalization_bonus(uuid) returns integer language sql stable as
      $$ select coalesce((select federal_bonus from public.fixture_staff_naturalization_bonuses where team_id=$1),0) $$;
    create function public.get_current_dashboard_assistant_summary()
    returns jsonb language sql stable security definer set search_path='' as $summary$
      with current_context as (select '${teamId}'::uuid as team_id,'${seasonId}'::uuid as season_id)
      select jsonb_build_object(
      'items',jsonb_build_array(jsonb_build_object('id','existing-journal-item')),
      'equipmentPartnerSignatureAvailable', (
        select false
      )
      );
    $summary$;
    revoke all on function public.get_current_dashboard_assistant_summary() from public,anon;
    grant execute on function public.get_current_dashboard_assistant_summary() to authenticated;
    insert into public.countries values ('${countryId}','Belgique','BE',true),('${foreignCountryId}','France','FR',true);
    insert into public.team_seasons values ('${id(100)}','${teamId}','${seasonId}','${countryId}','active'),
      ('${id(101)}','${otherTeamId}','${seasonId}','${foreignCountryId}','active');
    insert into public.team_infrastructures values ('${teamId}','international_welcome_center',1),
      ('${otherTeamId}','international_welcome_center',5);
    insert into public.staff_members values ('${id(20)}','${foreignCountryId}','active'),('${id(21)}','${foreignCountryId}','active'),
      ('${id(22)}','${foreignCountryId}','active');
    insert into public.staff_contracts values ('${id(30)}','${teamId}','${id(20)}','active'),
      ('${id(31)}','${teamId}','${id(21)}','active'),('${id(32)}','${otherTeamId}','${id(22)}','active');
    insert into public.fixture_staff_naturalization_bonuses values ('${teamId}',0,0),('${otherTeamId}',0,0);
  `);
  const originalGrants = await scalar("select proacl::text from pg_proc where oid='public.get_current_dashboard_assistant_summary()'::regprocedure");
  await db.exec(source);
  check(await scalar("select proacl::text from pg_proc where oid='public.get_current_dashboard_assistant_summary()'::regprocedure"), originalGrants, "dashboard access grants preserved");
  await opportunity(expected(2, 1));

  await db.exec("set role authenticated");
  await opportunity(expected(2, 1));
  await db.exec("reset role");
  check(await scalar("select has_function_privilege('authenticated','private.get_dashboard_staff_naturalization_opportunity(uuid,uuid)','execute')"), false, "private helper is not exposed to players");
  check(await scalar("select has_function_privilege('anon','public.get_current_dashboard_assistant_summary()','execute')"), false, "anonymous dashboard access remains blocked");

  await db.exec(`update public.team_infrastructures set level=0 where team_id='${teamId}'`);
  await opportunity(null);
  await db.exec(`update public.fixture_staff_naturalization_bonuses set federal_bonus=1 where team_id='${teamId}'`);
  await opportunity(expected(2, 1));
  await db.exec(`update public.fixture_staff_naturalization_bonuses set federal_bonus=2 where team_id='${teamId}'`);
  await opportunity(expected(2, 2));
  await db.exec(`update public.team_infrastructures set level=5 where team_id='${teamId}';
    update public.fixture_staff_naturalization_bonuses set specialization_power=1 where team_id='${teamId}'`);
  await opportunity(expected(2, 8));

  await reset();
  await db.exec(`insert into public.staff_naturalizations(team_id,season_id) values ('${teamId}','${seasonId}')`);
  await opportunity(null);
  await db.exec(`update public.team_infrastructures set level=3 where team_id='${teamId}'`);
  await opportunity(expected(2, 2));
  await db.exec(`insert into public.staff_naturalizations(team_id,season_id) values ('${teamId}','${id(4)}'),('${otherTeamId}','${seasonId}')`);
  await opportunity(expected(2, 2));
  await db.exec(`insert into public.staff_naturalizations(team_id,season_id) values ('${teamId}','${seasonId}'),('${teamId}','${seasonId}')`);
  await opportunity(null);

  await reset();
  await db.exec(`update public.staff_members set country_id='${countryId}' where id='${id(20)}'`);
  await opportunity(expected(1, 1));
  await db.exec(`update public.staff_members set country_id='${countryId}' where id='${id(21)}'`);
  await opportunity(null);
  await reset();
  await db.exec(`update public.staff_contracts set status='terminated' where team_id='${teamId}'`);
  await opportunity(null);
  await reset();
  await db.exec(`update public.team_seasons set status='completed' where team_id='${teamId}'`);
  await opportunity(null);
  await reset();
  await db.exec(`update public.countries set is_active=false where id='${countryId}'`);
  await opportunity(null);
  await reset();
  await db.exec(`delete from public.team_seasons where team_id='${teamId}' and season_id='${seasonId}'`);
  await opportunity(null);

  console.log(JSON.stringify({ isolated: true, productionActions: false, assertions, exactQuota: true, seasonAndTeamScoped: true }));
} finally {
  await db.close();
}

