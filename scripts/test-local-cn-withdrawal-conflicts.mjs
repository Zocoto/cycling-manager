// Credential-free, in-memory PostgreSQL only: never run fixtures on Supabase.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
if (!process.argv[2]?.replaceAll("\\", "/").endsWith("/dist/index.js")) {
  throw new Error("Pass a local PGlite module path, never a database URL.");
}
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const migrationFile = "20261009180000_clear_stale_national_championship_rosters.sql";
const source = async (name) => (await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8")).replaceAll("\r", "");
function functionSource(sql, name) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `Missing ${name}`);
  const end = sql.indexOf("$$;", start);
  assert.notEqual(end, -1);
  return sql.slice(start, end + 3);
}
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create table seasons(id uuid primary key,status text);
  create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,status text);
  create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
  create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
  create table riders(id uuid primary key,country_id uuid,status text);
  create table rider_contracts(rider_id uuid,team_id uuid,status text);
  create table races(id uuid primary key,country_id uuid,competition_type text);
  create table race_editions(id uuid primary key,race_id uuid,season_id uuid,status text,display_name text);
  create table season_days(id uuid primary key,season_id uuid,day_number int,calendar_date date);
  create table stages(race_edition_id uuid,stage_number int,season_day_id uuid,day_slot text,departure_at timestamptz);
  create table race_registrations(id uuid primary key default gen_random_uuid(),race_edition_id uuid,team_season_id uuid,historical_team_name text,entry_method text,status text,registered_at timestamptz,decided_at timestamptz,unique(race_edition_id,team_season_id));
  create table race_rosters(id uuid primary key default gen_random_uuid(),race_registration_id uuid,rider_id uuid,race_role text,status text,selected_at timestamptz,unique(race_registration_id,rider_id));
  create table national_championship_rider_preferences(race_edition_id uuid,rider_id uuid,team_season_id uuid,is_selected bool,updated_at timestamptz,primary key(race_edition_id,rider_id));
  create table national_championship_rider_withdrawals(race_edition_id uuid,rider_id uuid,team_season_id uuid,withdrawn_at timestamptz,primary key(race_edition_id,rider_id));
  create table rider_injuries(rider_id uuid,started_at timestamptz,expected_recovery_at timestamptz);
  create table rider_form_camps(rider_id uuid,season_id uuid,status text,completed_at timestamptz,start_day_number int,end_day_number int);
  create table test_country_rankings(rider_id uuid,country_id uuid,team_season_id uuid,national_rank bigint,uci_points bigint);
  create function get_national_championship_country_rankings(p_season_id uuid)
    returns table(rider_id uuid,country_id uuid,team_season_id uuid,national_rank bigint,uci_points bigint)
    language sql stable as $$ select * from public.test_country_rankings $$;
  insert into seasons values ('${id(1)}','active'),('${id(2)}','completed');
  insert into team_seasons values ('${id(3)}','${id(4)}','${id(1)}','active'),('${id(5)}','${id(6)}','${id(1)}','active');
  insert into sporting_directors values ('${id(7)}','${id(8)}','active');
  insert into team_manager_assignments values ('${id(7)}','${id(4)}','general_manager','active');
  insert into riders values ('${id(10)}','${id(50)}','active'),('${id(11)}','${id(50)}','active'),('${id(12)}','${id(50)}','free_agent');
  insert into rider_contracts values ('${id(10)}','${id(4)}','active'),('${id(11)}','${id(6)}','active');
  insert into test_country_rankings values ('${id(10)}','${id(50)}','${id(3)}',1,100),('${id(11)}','${id(50)}','${id(5)}',2,90),('${id(12)}','${id(50)}',null,3,80);
  insert into races values ('${id(20)}','${id(50)}','national_road'),('${id(21)}','${id(50)}','national_time_trial'),('${id(22)}','${id(50)}','ordinary');
  insert into race_editions values
    ('${id(30)}','${id(20)}','${id(1)}','registration_open','Road CN'),
    ('${id(31)}','${id(21)}','${id(1)}','registration_open','TT CN'),
    ('${id(32)}','${id(22)}','${id(1)}','registration_open','Ordinary late'),
    ('${id(33)}','${id(22)}','${id(1)}','registration_open','Ordinary early'),
    ('${id(34)}','${id(20)}','${id(2)}','completed','Historical CN'),
    ('${id(35)}','${id(22)}','${id(1)}','registration_open','Other day');
  insert into season_days values ('${id(40)}','${id(1)}',8,current_date+8),('${id(41)}','${id(1)}',9,current_date+9),('${id(42)}','${id(2)}',8,current_date-30);
  insert into stages values
    ('${id(30)}',1,'${id(40)}','late',now()+interval '8 days'),
    ('${id(31)}',1,'${id(40)}','early',now()+interval '8 days'),
    ('${id(32)}',1,'${id(40)}','late',now()+interval '8 days'),
    ('${id(33)}',1,'${id(40)}','early',now()+interval '8 days'),
    ('${id(34)}',1,'${id(42)}','late',now()-interval '30 days'),
    ('${id(35)}',1,'${id(41)}','late',now()+interval '9 days'),
    ('${id(36)}',1,'${id(41)}','early',now()-interval '1 hour');
`);
const unified = await source("20260817120000_unify_national_championship_registrations.sql");
await db.exec(functionSource(unified, "prioritize_national_championship_rider").replace(
  "on other_stage.season_day_id = target_stage.season_day_id",
  "on other_stage.season_day_id = target_stage.season_day_id and other_stage.day_slot = target_stage.day_slot"));
let synchronizer = functionSource(unified, "sync_national_championship_registrations");
// Reproduce the notification removal and the team isolation already deployed.
const noticeStart = synchronizer.indexOf("  insert into public.national_championship_notifications (");
synchronizer = synchronizer.slice(0, noticeStart) + synchronizer.slice(synchronizer.indexOf("  return v_synced;", noticeStart));
await db.exec(synchronizer);
await db.exec(synchronizer
  .replace("public.sync_national_championship_registrations(\n  p_season_id uuid,", "public.sync_team_national_championship_registrations(\n  p_season_id uuid,\n  p_team_season_id uuid,")
  .replace("where registration.id = roster.race_registration_id", "where registration.id = roster.race_registration_id\n    and registration.team_season_id = p_team_season_id")
  .replace("    where (\n      preference.is_selected = true", "    where candidate.team_season_id = p_team_season_id\n    and (\n      preference.is_selected = true"));
await db.exec(functionSource(unified, "save_current_team_national_championship_selections")
  .replace("perform public.sync_national_championship_registrations(v_season_id, now());", "perform public.sync_team_national_championship_registrations(v_season_id, v_team_season_id, now());"));

async function registration(edition, team, historical = null) {
  return (await db.query("insert into race_registrations(race_edition_id,team_season_id,historical_team_name,status) values($1,$2,$3,'accepted') returning id", [id(edition), team ? id(team) : null, historical])).rows[0].id;
}
const freeRoad = await registration(30, null, "Coureurs libres");
const freeTT = await registration(31, null, "Coureurs libres");
const formerRoad = await registration(30, 5);
const ownRoad = await registration(30, 3);
const historical = await registration(34, 3);
const ordinaryLate = await registration(32, 3);
const ordinaryEarly = await registration(33, 3);
const otherDay = await registration(35, 3);
async function roster(reg, rider = 10, status = "confirmed") {
  await db.query("insert into race_rosters(race_registration_id,rider_id,status) values($1,$2,$3) on conflict(race_registration_id,rider_id) do update set status=excluded.status", [reg, id(rider), status]);
}
async function preference(edition, rider, selected, team = 3) {
  await db.query("insert into national_championship_rider_preferences values($1,$2,$3,$4,now()) on conflict(race_edition_id,rider_id) do update set is_selected=excluded.is_selected", [id(edition), id(rider), id(team), selected]);
}
async function status(reg, rider = 10) {
  return (await db.query("select status from race_rosters where race_registration_id=$1 and rider_id=$2", [reg, id(rider)])).rows[0]?.status;
}
async function active(edition, rider = 10) {
  return (await db.query("select registration.team_season_id from race_rosters roster join race_registrations registration on registration.id=roster.race_registration_id where registration.race_edition_id=$1 and roster.rider_id=$2 and roster.status in('selected','confirmed')", [id(edition), id(rider)])).rows;
}
const save = async (road, timeTrial) => db.query("select save_current_team_national_championship_selections($1::jsonb)", [JSON.stringify([{ rider_id: id(10), road, time_trial: timeTrial }])]);
const syncTeam = async () => db.query("select sync_team_national_championship_registrations($1,$2)", [id(1), id(3)]);
const syncGlobal = async () => db.query("select sync_national_championship_registrations($1)", [id(1)]);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id(8)]);
await preference(30, 10, false); await preference(31, 10, false);
await preference(34, 10, false); await preference(30, 11, true, 5);
await roster(freeRoad); await roster(freeTT); await roster(formerRoad);
await roster(ownRoad, 10, "withdrawn"); await roster(historical);
await roster(formerRoad, 11); await roster(freeRoad, 12); await roster(otherDay);

// The old team-scoped synchronizer reproduces the player's bug exactly.
await syncTeam();
assert.equal(await status(freeRoad), "confirmed");
assert.equal(await status(freeTT), "confirmed");
const migration = await source(migrationFile);
await db.exec(migration);
assert.equal(await status(freeRoad), "withdrawn");
assert.equal(await status(freeTT), "withdrawn");
assert.equal(await status(formerRoad), "withdrawn");
assert.equal(await status(formerRoad, 11), "confirmed");
assert.equal(await status(freeRoad, 12), "confirmed");
assert.equal(await status(historical), "confirmed");
assert.equal(await status(otherDay), "confirmed");

// Use the actual race-conflict trigger: a successful roster write is required,
// not merely hiding a conflict in the UI.
await db.exec(functionSource(await source("20260820210000_scope_race_conflicts_to_half_day_slots.sql"), "enforce_pending_race_roster_conflicts"));
await db.exec("create trigger test_roster_conflicts before insert or update on race_rosters for each row execute function enforce_pending_race_roster_conflicts()");
await roster(ordinaryLate); await roster(ordinaryEarly);
assert.equal(await status(ordinaryLate), "confirmed");
assert.equal(await status(ordinaryEarly), "confirmed");
await roster(ordinaryLate, 10, "withdrawn"); await roster(ordinaryEarly, 10, "withdrawn");

// New withdrawals clean stale free/former-team entries immediately; the scoped
// operation must leave another manager's entries alone.
await roster(freeRoad); await roster(freeTT); await roster(formerRoad);
await preference(30, 11, false, 5);
await save(false, false);
assert.deepEqual(await active(30), []); assert.deepEqual(await active(31), []);
assert.equal(await status(formerRoad, 11), "confirmed");
await save(false, false); // Idempotence.
await roster(ordinaryLate); await roster(ordinaryEarly);

// Reselection keeps one correct team identity, never the former/free entry.
await save(true, true);
assert.deepEqual(await active(30), [{ team_season_id: id(3) }]);
assert.deepEqual(await active(31), [{ team_season_id: id(3) }]);
assert.equal(await status(ordinaryLate), "withdrawn");
assert.equal(await status(ordinaryEarly), "withdrawn");
assert.equal(await status(otherDay), "confirmed");
await roster(freeTT);
await syncTeam();
assert.equal(await status(freeTT), "withdrawn"); // Selected, but wrong owner.
await roster(freeTT); await roster(formerRoad);
await syncGlobal();
assert.equal(await status(freeTT), "withdrawn");
assert.equal(await status(formerRoad), "withdrawn");
assert.deepEqual(await active(30), [{ team_season_id: id(3) }]);
assert.deepEqual(await active(31), [{ team_season_id: id(3) }]);
await roster(freeRoad); await roster(formerRoad);
await db.query("select withdraw_current_team_national_championship_rider($1,$2)", [id(30), id(10)]);
await db.query("select withdraw_current_team_national_championship_rider($1,$2)", [id(30), id(10)]);
assert.deepEqual(await active(30), []);
assert.deepEqual(await active(31), [{ team_season_id: id(3) }]);
assert.equal((await db.query("select is_selected from national_championship_rider_preferences where race_edition_id=$1 and rider_id=$2", [id(30), id(10)])).rows[0].is_selected, false);
await syncTeam(); await syncGlobal();
assert.deepEqual(await active(30), []); // Even top-200 default cannot re-enroll.
assert.deepEqual(await active(31), [{ team_season_id: id(3) }]);
await db.query("update race_registrations set status='accepted' where id in($1,$2)", [ordinaryLate, ordinaryEarly]);
await roster(ordinaryLate); // Road withdrawn => late is available.
await assert.rejects(roster(ordinaryEarly), /TT CN/); // TT still really blocks.
assert.equal(await status(historical), "confirmed");
await assert.rejects(db.query("select withdraw_current_team_national_championship_rider($1,$2)", [id(30), id(11)]), /effectif actif/);
await db.query("insert into race_editions values($1,$2,$3,'in_progress','Started CN')", [id(36), id(20), id(1)]);
await assert.rejects(db.query("select withdraw_current_team_national_championship_rider($1,$2)", [id(36), id(10)]), /déjà débuté/);
await db.query("select set_config('request.jwt.claim.sub','',false)");
await assert.rejects(db.query("select withdraw_current_team_national_championship_rider($1,$2)", [id(30), id(10)]), /connecté/);
assert.equal((await db.query("select has_function_privilege('anon','withdraw_current_team_national_championship_rider(uuid,uuid)','execute') as allowed")).rows[0].allowed, false);
assert.equal((await db.query("select has_function_privilege('authenticated','withdraw_current_team_national_championship_rider(uuid,uuid)','execute') as allowed")).rows[0].allowed, true);
await db.close();
console.log("Isolated PostgreSQL: stale free/former-team CN entries reproduced and repaired; grid/individual withdrawal, reselection, scheduling, real roster writes, history and permissions verified.");
