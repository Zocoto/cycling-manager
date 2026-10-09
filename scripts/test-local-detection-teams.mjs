// Isolated PostgreSQL only: no credentials, remote client or production access.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

if (!process.argv[2]) throw new Error("Pass the existing local PGlite module path.");
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const uid = (kind, n) => `${String(kind).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = "2026-10-09T09:30:00Z";
const season = uid(1, 1);
let passed = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); passed++; };

await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;
  create table public.countries(id uuid primary key, continent_code text);
  create table public.race_categories(id uuid primary key, code text, minimum_roster_size int, maximum_roster_size int);
  create table public.races(id uuid primary key, country_id uuid, competition_type text);
  create table public.race_editions(id uuid primary key, season_id uuid, race_id uuid, race_category_id uuid, status text,
    withdrawal_closes_at timestamptz, registration_closes_at timestamptz, detection_teams_finalized_at timestamptz);
  create table public.season_days(id uuid primary key, day_number int, calendar_date date);
  create table public.stages(id uuid primary key, race_edition_id uuid, season_day_id uuid, departure_at timestamptz,
    day_slot text, stage_number int, profile_type text, distance_km numeric);
  create table public.riders(id uuid primary key, country_id uuid, status text);
  create table public.rider_season_ratings(rider_id uuid, season_id uuid, mountain int, hills int, flat int, time_trial int,
    cobbles int, sprint int, acceleration int, downhill int, endurance int, resistance int, recovery int, prologue int);
  create table public.rider_contracts(rider_id uuid, status text);
  create table public.rider_injuries(rider_id uuid, started_at timestamptz, expected_recovery_at timestamptz);
  create table public.rider_form_camps(rider_id uuid, season_id uuid, status text, start_day_number int, end_day_number int);
  create table public.race_registrations(id uuid primary key default gen_random_uuid(), race_edition_id uuid, team_season_id uuid,
    historical_team_name text, detection_team_number smallint, entry_method text, status text, registered_at timestamptz, decided_at timestamptz,
    check (detection_team_number is null or detection_team_number between 1 and 4),
    check (detection_team_number is null or (team_season_id is null and historical_team_name='Équipe de détection '||detection_team_number::text and entry_method='automatic')));
  create unique index detection_team_unique on public.race_registrations(race_edition_id,detection_team_number) where detection_team_number is not null;
  create table public.race_rosters(id uuid primary key default gen_random_uuid(), race_registration_id uuid, rider_id uuid,
    bib_number smallint, race_role text, status text, selected_at timestamptz, unique(race_registration_id,rider_id));
  create table public.stage_results(stage_id uuid, rank int);
  create table public.team_seasons(id uuid, cash_balance numeric);
  insert into public.stage_results values ('${uid(90, 1)}',1);
  insert into public.team_seasons values ('${uid(91, 1)}',123456);
  insert into public.countries values ('${uid(2, 1)}','europe'),('${uid(2, 2)}','europe'),('${uid(2, 3)}','africa');
  insert into public.season_days values ('${uid(3, 1)}',1,'2026-10-09'),('${uid(3, 2)}',2,'2026-10-10');
`);
const original = (await readFile(new URL("../supabase/migrations/20260829143000_add_free_agent_detection_teams.sql", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const start = original.indexOf("create or replace function public.settle_due_free_agent_detection_teams(");
const end = original.indexOf("comment on function public.settle_due_free_agent_detection_teams", start);
if (start < 0 || end < start) throw new Error("Original function extraction failed.");
await db.exec(original.slice(start, end));
const migration = await readFile(new URL("../supabase/migrations/20261009140000_extend_detection_teams_to_local_and_regional.sql", import.meta.url), "utf8");

async function reset() {
  await db.exec("truncate public.race_categories,public.races,public.race_editions,public.stages,public.riders,public.rider_season_ratings,public.rider_contracts,public.rider_injuries,public.rider_form_camps,public.race_registrations,public.race_rosters;");
}
async function rider(index, country = 1, status = "free_agent", rating = 50) {
  await db.query("insert into public.riders values ($1,$2,$3)", [uid(4, index), uid(2, country), status]);
  await db.query("insert into public.rider_season_ratings values ($1,$2,$3,$3,$3,$3,$3,$3,$3,$3,$3,$3,$3,$3)", [uid(4, index), season, rating]);
}
async function setup({ code = "local", teams = 1, pool = 80, country = 1, competition = "standard", status = "registration_closed", closure = "2026-10-09T06:00:00Z", departure = "2026-10-09T12:00:00Z" } = {}) {
  await reset();
  const size = ["local", "regional"].includes(code) ? [4, 6] : [5, 7];
  await db.query("insert into public.race_categories values ($1,$2,$3,$4)", [uid(5, 1), code, ...size]);
  await db.query("insert into public.races values ($1,$2,$3)", [uid(6, 1), uid(2, 1), competition]);
  await db.query("insert into public.race_editions values ($1,$2,$3,$4,$5,$6,$6,null)", [uid(7, 1), season, uid(6, 1), uid(5, 1), status, closure]);
  await db.query("insert into public.stages values ($1,$2,$3,$4,'early',1,'hilly',100)", [uid(8, 1), uid(7, 1), uid(3, 1), departure]);
  for (let team = 1; team <= teams; team++) {
    await rider(10000 + team, 1, "active");
    await db.query("insert into public.race_registrations(id,race_edition_id,team_season_id,status) values ($1,$2,$3,'accepted')", [uid(9, team), uid(7, 1), uid(10, team)]);
    await db.query("insert into public.race_rosters(race_registration_id,rider_id,race_role,status) values ($1,$2,'leader','confirmed')", [uid(9, team), uid(4, 10000 + team)]);
  }
  for (let index = 1; index <= pool; index++) await rider(index, country);
}
const settle = async () => (await db.query("select * from public.settle_due_free_agent_detection_teams($1::timestamptz)", [now])).rows[0];
const count = async (sql, values = []) => Number((await db.query(sql, values)).rows[0].n);
const teams = () => count("select count(*) as n from race_registrations where race_edition_id=$1 and status='accepted'", [uid(7, 1)]);
const selected = () => count("select count(*) as n from race_rosters rr join race_registrations reg on reg.id=rr.race_registration_id where reg.detection_team_number is not null");
const snapshots = async () => ({
  players: (await db.query("select * from race_registrations where team_season_id is not null order by id")).rows,
  rosters: (await db.query("select rr.* from race_rosters rr join race_registrations reg on reg.id=rr.race_registration_id where reg.team_season_id is not null order by rr.id")).rows,
  results: (await db.query("select * from stage_results")).rows,
  wallets: (await db.query("select * from team_seasons")).rows,
});

// Prove the original omission before applying the real reviewed migration.
await setup();
check((await settle()).processed_editions, 0);
check(await teams(), 1);
const beforeMigration = await snapshots();
await db.exec(migration);
check(await snapshots(), beforeMigration);
const definition = (await db.query("select pg_get_functiondef('public.settle_due_free_agent_detection_teams(timestamptz)'::regprocedure) as source")).rows[0].source;
await db.exec(migration);
check((await db.query("select pg_get_functiondef('public.settle_due_free_agent_detection_teams(timestamptz)'::regprocedure) as source")).rows[0].source, definition);

for (const code of ["local", "regional", "national", "continental", "world"]) {
  await setup({ code, teams: code === "regional" ? 2 : 1 });
  const before = await snapshots();
  const receipt = await settle();
  check(receipt.created_teams, code === "regional" ? 3 : 4);
  check(await teams(), 5);
  check(await selected(), code === "local" ? 24 : code === "regional" ? 18 : 28);
  check(await snapshots(), before);
  const persisted = (await db.query("select * from race_rosters order by id")).rows;
  check((await settle()).created_teams, 0);
  check((await db.query("select * from race_rosters order by id")).rows, persisted);
  check(await count("select count(*) as n from (select rider_id from race_rosters group by rider_id having count(*)>1) duplicates"), 0);
  const sizes = (await db.query("select count(*)::int as size from race_rosters rr join race_registrations reg on reg.id=rr.race_registration_id where reg.detection_team_number is not null group by reg.id")).rows.map(row => row.size);
  check(sizes.every(size => size >= (code === "local" || code === "regional" ? 4 : 5) && size <= (code === "local" || code === "regional" ? 6 : 7)), true);
}

await setup({ teams: 5 });
check((await settle()).created_teams, 0);
check(await teams(), 5);
await setup({ teams: 0 });
check((await settle()).skipped_without_managed_team, 1);
check(await teams(), 0);
await setup();
await db.exec("delete from race_rosters");
check((await settle()).skipped_without_managed_team, 1);
check(await selected(), 0);

for (const options of [
  { code: "elite" }, { competition: "world_championship" }, { status: "completed" },
  { status: "running" }, { closure: "2026-10-09T10:00:00Z" }, { departure: "2026-10-09T08:00:00Z" },
]) {
  await setup(options);
  check((await settle()).processed_editions, 0);
  check(await selected(), 0);
}

// Insufficient availability must not fabricate riders or undersized teams.
await setup({ pool: 14 });
check((await settle()).editions_with_insufficient_pool, 1);
check(await teams(), 4);
check(await count("select count(*) as n from riders where status='free_agent'"), 14);
await setup({ pool: 3 });
check((await settle()).created_teams, 0);
check(await teams(), 1);

// Geographic preference still allows a fallback instead of leaving empty slots.
await setup({ pool: 24, country: 3 });
for (let index = 100; index < 124; index++) await rider(index, 1);
await settle();
check(await count("select count(*) as n from race_rosters rr join race_registrations reg on reg.id=rr.race_registration_id join riders r on r.id=rr.rider_id where reg.detection_team_number is not null and r.country_id=$1", [uid(2, 1)]), 24);
await setup({ code: "regional", pool: 24, country: 3 });
for (let index = 100; index < 124; index++) await rider(index, 2);
await settle();
check(await count("select count(*) as n from race_rosters rr join race_registrations reg on reg.id=rr.race_registration_id join riders r on r.id=rr.rider_id where reg.detection_team_number is not null and r.country_id=$1", [uid(2, 2)]), 24);
await setup({ pool: 24, country: 3 });
check((await settle()).created_teams, 4);
check(await teams(), 5);

// Contracted, injured, camping and concurrently registered riders stay excluded.
await setup({ pool: 24 });
for (let index = 200; index <= 203; index++) await rider(index, 1, "free_agent", 99);
await db.query("insert into rider_contracts values ($1,'active')", [uid(4, 200)]);
await db.query("insert into rider_injuries values ($1,'2026-10-09T00:00Z','2026-10-11T00:00Z')", [uid(4, 201)]);
await db.query("insert into rider_form_camps values ($1,$2,'planned',1,2)", [uid(4, 202), season]);
await db.query("insert into race_editions values ($1,$2,$3,$4,'running',null,null,null)", [uid(7, 2), season, uid(6, 1), uid(5, 1)]);
await db.query("insert into stages values ($1,$2,$3,'2026-10-09T12:00Z','early',1,'hilly',100)", [uid(8, 2), uid(7, 2), uid(3, 1)]);
await db.query("insert into race_registrations(id,race_edition_id,status) values ($1,$2,'pending')", [uid(9, 200), uid(7, 2)]);
await db.query("insert into race_rosters(race_registration_id,rider_id,status) values ($1,$2,'selected')", [uid(9, 200), uid(4, 203)]);
check((await settle()).created_teams, 4);
check(await count("select count(*) as n from race_rosters rr join race_registrations reg on reg.id=rr.race_registration_id where reg.detection_team_number is not null and rr.rider_id=any($1::uuid[])", [[200,201,202,203].map(n => uid(4, n))]), 0);
check(await teams(), 5);

// Two categories sharing the same start slot must not share any free rider.
await setup({ pool: 80 });
await rider(20000, 1, "active");
await db.query("insert into race_categories values ($1,'regional',4,6)", [uid(5, 2)]);
await db.query("insert into races values ($1,$2,'standard')", [uid(6, 2), uid(2, 2)]);
await db.query("insert into race_editions values ($1,$2,$3,$4,'registration_closed','2026-10-09T06:00Z','2026-10-09T06:00Z',null)", [uid(7, 2), season, uid(6, 2), uid(5, 2)]);
await db.query("insert into stages values ($1,$2,$3,'2026-10-09T12:00Z','early',1,'hilly',100)", [uid(8, 2), uid(7, 2), uid(3, 1)]);
await db.query("insert into race_registrations(id,race_edition_id,team_season_id,status) values ($1,$2,$3,'accepted')", [uid(9, 100), uid(7, 2), uid(10, 100)]);
await db.query("insert into race_rosters(race_registration_id,rider_id,status) values ($1,$2,'confirmed')", [uid(9, 100), uid(4, 20000)]);
check((await settle()).created_teams, 8);
check(await count("select count(*) as n from race_registrations where race_edition_id=$1 and status='accepted'", [uid(7, 2)]), 5);
check(await teams(), 5);
check(await selected(), 48);
check(await count("select count(*) as n from (select rider_id from race_rosters group by rider_id having count(*)>1) duplicates"), 0);

// Fail closed on an unknown baseline or a partially patched rule.
for (const baseline of [
  original.slice(start, end).replace("case v_edition.category_code", "case  v_edition.category_code"),
  original.slice(start, end).replace("category.code in ('national', 'continental', 'world')", "category.code in ('local', 'regional', 'national', 'continental', 'world')"),
]) {
  await db.exec(baseline);
  const before = (await db.query("select pg_get_functiondef('public.settle_due_free_agent_detection_teams(timestamptz)'::regprocedure) as source")).rows[0].source;
  await assert.rejects(db.exec(migration), /Unexpected detection-team settlement anchor|only partially installed/);
  passed++;
  await db.exec("rollback;");
  check((await db.query("select pg_get_functiondef('public.settle_due_free_agent_detection_teams(timestamptz)'::regprocedure) as source")).rows[0].source, before);
  await db.exec(definition);
}

for (const role of ["anon", "authenticated", "service_role"]) {
  check((await db.query("select has_function_privilege($1,'public.settle_due_free_agent_detection_teams(timestamptz)','execute') as allowed", [role])).rows[0].allowed, role === "service_role");
}
await db.close();
console.log(JSON.stringify({ passed, isolated: true, productionTouched: false }));
