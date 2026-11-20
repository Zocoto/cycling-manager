// In-memory PostgreSQL only. No network, production connection, credentials or
// live accounts are accepted. Financial settlement is the only no-op dependency.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2]
  ?? "C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js";
if (!isAbsolute(modulePath)
  || !modulePath.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js")) {
  throw new Error("Provide the absolute path to an isolated local PGlite module.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const ids = {
  season: id(1), team: id(2), teamSeason: id(3), director: id(4), user: id(5),
  rider: id(6), teammate: id(7), outsider: id(8), country: id(9),
  race: id(10), category: id(11), edition: id(12), stage: id(13), registration: id(14),
  staff: id(15), staffContract: id(16),
};
const bookingSignature = "public.book_current_team_stage_reconnaissance(uuid,uuid[],integer,uuid)";
let checks = 0;
const equal = (actual, expected, label) => {
  assert.deepEqual(actual, expected, label);
  checks += 1;
};
const rows = async (sql, parameters = []) => (await db.query(sql, parameters)).rows;
const scalar = async (sql, parameters = []) => Object.values((await rows(sql, parameters))[0])[0];
const readMigration = async (name) => (await readFile(
  new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8",
)).replaceAll("\r\n", "\n");
function realFunction(sql, name) {
  const start = sql.indexOf(`create or replace function ${name}(`);
  assert.ok(start >= 0, `Missing real function ${name}`);
  const end = sql.indexOf("$$;", start);
  assert.ok(end > start, `Missing function terminator ${name}`);
  return sql.slice(start, end + 3);
}
function realTable(sql, name) {
  const start = sql.indexOf(`create table public.${name} (`);
  assert.ok(start >= 0, `Missing real table ${name}`);
  return sql.slice(start, sql.indexOf("\n);", start) + 3);
}
function patchContaining(sql, marker, tag = "migration") {
  const anchor = sql.indexOf(marker);
  assert.ok(anchor >= 0, `Missing migration marker ${marker}`);
  const start = sql.lastIndexOf(`do $${tag}$`, anchor);
  const end = sql.indexOf(`$${tag}$;`, anchor);
  assert.ok(start >= 0 && end > start, `Missing migration block ${marker}`);
  return sql.slice(start, end + tag.length + 3);
}
async function asPlayer() {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ids.user]);
  await db.exec("set role authenticated");
}
async function asAdmin() { await db.exec("reset role"); }
async function book({ start = 6, riderIds = [ids.rider], preparer = null } = {}) {
  await asPlayer();
  return scalar(`select public.book_current_team_stage_reconnaissance(
    $1::uuid, $2::uuid[], $3::integer, $4::uuid
  )`, [ids.stage, riderIds, start, preparer]);
}
async function snapshot() {
  await asAdmin();
  return (await rows(`select
    (select cash_balance::integer from team_seasons where id = $1) as cash,
    (select count(*)::integer from stage_reconnaissances) as missions,
    (select count(*)::integer from rider_form_camps) as camps,
    (select count(*)::integer from stage_reconnaissance_riders) as participants,
    (select count(*)::integer from team_finance_transactions) as transactions
  `, [ids.teamSeason]))[0];
}
async function rejectBooking(options, pattern, label) {
  const before = await snapshot();
  await assert.rejects(() => book(options), pattern, label);
  checks += 1;
  equal(await snapshot(), before, `${label}: all booking and cash writes roll back`);
}
async function fixture({ status = "pending", category = "elite", entryMethod = "requested", targetDay = 10 } = {}) {
  await asAdmin();
  await db.exec(`truncate table seasons, sporting_directors, team_manager_assignments,
    team_seasons, season_days, riders, rider_contracts, staff_members, staff_contracts,
    staff_member_talents, race_categories, races, race_editions, stages,
    race_registrations, race_rosters, rider_injuries, stage_reconnaissances,
    stage_reconnaissance_riders, rider_form_camps, team_finance_transactions,
    race_stage_strategies, race_roster_stage_roles, race_time_trial_rider_plans,
    race_stage_equipment_assignments cascade;
    insert into seasons values ('${ids.season}', 5, 'active', 5, (now() at time zone 'Europe/Paris')::date);
    insert into sporting_directors values ('${ids.director}', '${ids.user}', 'active');
    insert into team_manager_assignments values ('${ids.director}', '${ids.team}', 'general_manager', 'active');
    insert into team_seasons values ('${ids.teamSeason}', '${ids.team}', '${ids.season}', 100000, 'EUR', '${ids.country}');
    insert into season_days select
      ('00000000-0000-4000-8000-' || lpad((100 + day)::text, 12, '0'))::uuid,
      '${ids.season}', day, current_date + day - 1 from generate_series(1,28) day;
    insert into riders values ('${ids.rider}', '${ids.country}'), ('${ids.teammate}', '${ids.country}'), ('${ids.outsider}', '${ids.country}');
    insert into rider_contracts values
      ('${ids.rider}', '${ids.team}', '${ids.season}', '${ids.season}', 'active'),
      ('${ids.teammate}', '${ids.team}', '${ids.season}', '${ids.season}', 'active');
    insert into staff_members values ('${ids.staff}', 'race_preparer', 5, 'Fixture', 'Preparer', '${ids.country}');
    insert into staff_contracts values ('${ids.staffContract}', '${ids.staff}', '${ids.team}', 'active');
    insert into races values ('${ids.race}', 'one_day');
  `);
  await db.query("insert into race_categories values ($1, $2)", [ids.category, category]);
  await db.query("insert into race_editions values ($1,$2,$3,$4,'Fixture Elite','planned')", [ids.edition, ids.season, ids.race, ids.category]);
  await db.query("insert into stages values ($1,$2,$3,'planned')", [ids.stage, ids.edition, id(100 + targetDay)]);
  await db.query("insert into race_registrations values ($1,$2,$3,$4,$5)", [ids.registration, ids.edition, ids.teamSeason, status, entryMethod]);
  await db.query("insert into race_rosters values ($1,$2,'selected'),($1,$3,'confirmed')", [ids.registration, ids.rider, ids.teammate]);
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table seasons(id uuid primary key, game_year integer, status text, current_day_number integer, starts_on date);
    create table sporting_directors(id uuid primary key, auth_user_id uuid, status text);
    create table team_manager_assignments(sporting_director_id uuid, team_id uuid, role text, status text);
    create table team_seasons(id uuid primary key, team_id uuid, season_id uuid references seasons, cash_balance numeric, currency text, registration_country_id uuid);
    create table season_days(id uuid primary key, season_id uuid references seasons, day_number integer, calendar_date date);
    create table riders(id uuid primary key, country_id uuid);
    create table rider_contracts(rider_id uuid references riders, team_id uuid, start_season_id uuid, end_season_id uuid, status text);
    create table staff_members(id uuid primary key, role text, level integer, first_name text, last_name text, country_id uuid);
    create table staff_contracts(id uuid primary key, staff_member_id uuid references staff_members, team_id uuid, status text);
    create table staff_member_talents(staff_member_id uuid, talent_code text);
    create table race_categories(id uuid primary key, code text);
    create table races(id uuid primary key, race_format text);
    create table race_editions(id uuid primary key, season_id uuid references seasons, race_id uuid references races, race_category_id uuid references race_categories, display_name text, status text);
    create table stages(id uuid primary key, race_edition_id uuid references race_editions, season_day_id uuid references season_days, status text);
    create table race_registrations(id uuid primary key, race_edition_id uuid references race_editions, team_season_id uuid references team_seasons, status text, entry_method text);
    create table race_rosters(race_registration_id uuid references race_registrations, rider_id uuid references riders, status text);
    create table rider_injuries(rider_id uuid, started_at timestamptz, expected_recovery_at timestamptz);
    create table race_stage_strategies(race_registration_id uuid);
    create table race_roster_stage_roles(race_registration_id uuid);
    create table race_time_trial_rider_plans(race_registration_id uuid);
    create table race_stage_equipment_assignments(team_season_id uuid, race_edition_id uuid);
    create function public.settle_current_team_finances() returns integer language sql as $$select 0$$;
  `);
  const original = await readMigration("20260723120000_create_race_reconnaissance");
  const datedBooking = await readMigration("20260723130000_schedule_race_reconnaissance_dates");
  const staff = await readMigration("20260727160000_create_unique_staff_talents");
  const affixes = await readMigration("20260909160000_add_operational_staff_affixes");
  const wildcard = await readMigration("20260918160000_prepare_pending_elite_wildcards");
  const interruptions = await readMigration("20260828090000_interrupt_active_rider_camps");
  await db.exec(realTable(await readMigration("20260721120000_create_health_center"), "rider_form_camps"));
  await db.exec(original.slice(original.indexOf("alter table public.rider_form_camps"), original.indexOf("create table public.stage_reconnaissances")));
  await db.exec(realTable(original, "stage_reconnaissances"));
  await db.exec(realTable(original, "stage_reconnaissance_riders"));
  await db.exec(realTable(await readMigration("20260720203000_create_rewards_finances_and_rankings"), "team_finance_transactions"));
  await db.exec(interruptions.slice(0, interruptions.indexOf("create or replace function public.request_current_team_form_camp_interruption")) + "commit;");
  await db.exec(await readMigration("20260925113000_expand_stage_reconnaissance_bonus_range"));
  await db.exec(realFunction(await readMigration("20260930150000_create_s4_local_race_circuit"), "public.calculate_stage_reconnaissance_cost"));
  await db.exec(realFunction(original, "public.settle_current_race_reconnaissances"));
  await db.exec(realFunction(await readMigration("20260926123000_remove_interactive_lock_hotspots"), "public.sync_active_season_day"));
  for (const name of ["get_staff_contract_nationality_multiplier", "get_staff_contract_talent_percentage", "get_staff_contract_talent_flat_bonus", "get_race_preparer_duration_days", "get_race_preparer_rider_capacity", "get_race_preparer_bonus_percentage"]) {
    await db.exec(realFunction(staff, `public.${name}`));
  }
  // The deprecated three-argument overload is present only so the original
  // registration migration can patch both signatures. Player calls use four.
  await db.exec(realFunction(original, "public.book_current_team_stage_reconnaissance"));
  await db.exec(realFunction(datedBooking, "public.book_current_team_stage_reconnaissance"));
  await db.exec(patchContaining(staff, "Point de contrôle de capacité inattendu"));
  await db.exec(realFunction(affixes, "public.get_race_preparer_reconnaissance_price"));
  await db.exec(patchContaining(affixes, "Contrôle de trésorerie de la reconnaissance inattendu"));
  // Apply the real reliability patch only to the booking overloads loaded here.
  const narrowSignatures = `foreach v_signature in array array[
    'public.book_current_team_stage_reconnaissance(uuid,uuid[],uuid)'::regprocedure,
    '${bookingSignature}'::regprocedure
  ] loop`;
  const narrowPatch = (sql) => sql.replace(/foreach v_signature in array array\[[\s\S]*?\]\s*loop/, narrowSignatures);
  await db.exec(narrowPatch(patchContaining(
    await readMigration("20260827120000_fix_interactive_jobs_reliability"),
    "v_patched_definition text;", "remove_interactive_health_settlements",
  )));
  await db.exec(await readMigration("20260916110000_require_race_entry_for_reconnaissance"));
  await db.exec(realFunction(wildcard, "public.is_race_registration_preparable"));
  await db.exec(narrowPatch(patchContaining(wildcard, "Filtre d inscription inattendu")));
  await db.exec(realFunction(wildcard, "public.assert_reconnaissance_riders_registered"));
  await db.exec(realFunction(wildcard, "public.cancel_unawarded_elite_wildcard_preparations"));
  await db.exec(`create trigger cancel_unawarded_elite_wildcard_preparations
    after update of status on race_registrations for each row
    execute function public.cancel_unawarded_elite_wildcard_preparations();
    revoke all on function public.book_current_team_stage_reconnaissance(uuid,uuid[],uuid) from public, authenticated;
    revoke all on function ${bookingSignature} from public;
    grant execute on function ${bookingSignature} to authenticated;
  `);

  for (const status of ["accepted", "pending"]) {
    await fixture({ status });
    const mission = await book({ riderIds: [ids.rider, ids.teammate] });
    equal(await snapshot(), { cash: 80000, missions: 1, camps: 2, participants: 2, transactions: 1 }, `${status}: actual grouped booking writes`);
    equal(await rows("select start_day_number, end_day_number, total_price::integer, bonus_points::float, status from stage_reconnaissances where id=$1", [mission]), [
      { start_day_number: 6, end_day_number: 7, total_price: 20000, bonus_points: 2, status: "planned" },
    ], `${status}: same dates, cost and bonus`);
    equal(await rows("select amount::integer, status, category from team_finance_transactions"), [
      { amount: -20000, status: "posted", category: "training" },
    ], `${status}: a single real financial debit`);
    await rejectBooking({}, /indisponible pendant cette période|connaît déjà cette étape/, `${status}: repeat booking rejected`);
  }

  for (const invalid of [
    { status: "rejected" }, { status: "withdrawn" },
    { category: "world" }, { entryMethod: "invited" },
  ]) {
    await fixture(invalid);
    await rejectBooking({}, /liste acceptée ou la demande de WildCard/, `Ineligible registration ${JSON.stringify(invalid)}`);
  }
  await fixture();
  await asAdmin();
  await db.query("update race_rosters set status='withdrawn' where rider_id=$1", [ids.rider]);
  await rejectBooking({}, /liste acceptée ou la demande de WildCard/, "Withdrawn rider excluded");
  await fixture();
  await rejectBooking({ riderIds: [ids.outsider] }, /effectif actif/, "Outside rider excluded");

  for (const status of ["accepted", "pending"]) {
    for (const targetDay of [6, 7]) {
      await fixture({ status, targetDay });
      await rejectBooking({}, /se terminer avant le départ/, `${status}: J+${targetDay - 5} too close for two days`);
    }
  }
  await fixture({ targetDay: 8 });
  await book();
  equal((await snapshot()).cash, 80000, "J+3 allows a completed two-day camp");
  await fixture({ targetDay: 7 });
  await db.query("insert into staff_member_talents values ($1,'preparer_duration'),($1,'preparer_quality'),($1,'preparer_reconnaissance_cost')", [ids.staff]);
  const express = await book({ preparer: ids.staffContract });
  await asAdmin();
  equal(await rows("select start_day_number,end_day_number,total_price::integer,bonus_points::float from stage_reconnaissances where id=$1", [express]), [
    { start_day_number: 6, end_day_number: 6, total_price: 16000, bonus_points: 2.88 },
  ], "Actual express, affinity, quality and discount staff helpers");

  await fixture({ targetDay: 12 });
  await db.exec(`update races set race_format='stage_race';
    insert into stages values ('${id(17)}','${ids.edition}','${id(105)}','planned');`);
  await rejectBooking({}, /chevauche.*tour qui englobe/, "A later stage cannot be reconnoitred during its own tour");

  for (const campStatus of ["planned", "active", "completed"]) {
    await fixture();
    const mission = await book();
    await asAdmin();
    const currentDay = { planned: 5, active: 6, completed: 8 }[campStatus];
    await db.query("update seasons set current_day_number=$1", [currentDay]);
    await db.query("update rider_form_camps set status=$1", [campStatus]);
    await db.exec("select public.settle_current_race_reconnaissances()");
    await db.exec(`insert into race_stage_strategies values ('${ids.registration}');
      insert into race_roster_stage_roles values ('${ids.registration}');
      insert into race_time_trial_rider_plans values ('${ids.registration}');
      insert into race_stage_equipment_assignments values ('${ids.teamSeason}','${ids.edition}');`);
    await db.query("update race_registrations set status='rejected' where id=$1", [ids.registration]);
    equal(await scalar("select status from stage_reconnaissances where id=$1", [mission]), "cancelled", `${campStatus}: rejection cancels race bonus`);
    const camp = (await rows("select status,end_day_number,interruption_effective_day_number from rider_form_camps"))[0];
    equal(camp, {
      status: campStatus === "planned" ? "cancelled" : campStatus,
      end_day_number: campStatus === "active" ? 6 : 7,
      interruption_effective_day_number: campStatus === "active" ? 7 : null,
    }, `${campStatus}: release and interruption preserve elapsed days`);
    equal((await snapshot()).cash, 80000, `${campStatus}: original cost stays paid`);
    equal(await scalar("select count(*)::integer from team_finance_transactions"), 1, `${campStatus}: no refund or duplicate debit`);
    for (const table of ["race_stage_strategies", "race_roster_stage_roles", "race_time_trial_rider_plans", "race_stage_equipment_assignments"]) {
      equal(await scalar(`select count(*)::integer from ${table}`), 0, `${campStatus}: remove ${table}`);
    }
    await db.exec("select public.settle_current_race_reconnaissances()");
    equal(await scalar("select status from stage_reconnaissances where id=$1", [mission]), "cancelled", `${campStatus}: settlement never revives refused bonus`);
    await db.query("update race_registrations set status='rejected' where id=$1", [ids.registration]);
    equal((await snapshot()).cash, 80000, `${campStatus}: repeated rejection is harmless`);
  }
  console.log(`Passed ${checks} isolated PostgreSQL checks for pending WildCard reconnaissance.`);
} finally {
  await db.close();
}
