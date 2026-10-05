// Isolated PostgreSQL-in-WASM. Never connects to Supabase or a live database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(process.env.LOCAL_CALENDAR_SQL_TEST_MODULE
  ? pathToFileURL(process.env.LOCAL_CALENDAR_SQL_TEST_MODULE).href
  : "@electric-sql/pglite");
const db = new PGlite();
const source = readFileSync(resolve("supabase/migrations/20260930150000_create_s4_local_race_circuit.sql"), "utf8");
const fix = readFileSync(resolve("supabase/migrations/20261005200000_fix_local_calendar_country_fallback.sql"), "utf8");
function functionSql(name) {
  const start = source.indexOf(`create or replace function ${name}(`);
  assert.ok(start >= 0, `Missing source function: ${name}`);
  return source.slice(start, source.indexOf("$$;", start) + 3);
}
const s3 = "11111111-1111-4111-8111-111111111113";
const s4 = "11111111-1111-4111-8111-111111111114";
const incomplete = "11111111-1111-4111-8111-111111111115";
await db.exec(`
  create schema private;
  create role anon;
  create table public.seasons(id uuid primary key, game_year integer, status text, current_day_number integer);
  create table public.countries(id uuid primary key default gen_random_uuid(), iso_alpha2 text unique, name text);
  create table public.season_days(id uuid primary key default gen_random_uuid(), season_id uuid references seasons,
    day_number integer, calendar_date date, unique(season_id,day_number));
  create table public.race_categories(id uuid primary key default gen_random_uuid(), code text unique);
  create table public.races(id uuid primary key default gen_random_uuid(), country_id uuid references countries,
    name text not null, short_name text, race_format text, status text, slug text unique, competition_type text, is_grand_tour boolean);
  create table public.race_editions(id uuid primary key default gen_random_uuid(), race_id uuid references races,
    season_id uuid references seasons, race_category_id uuid references race_categories, edition_number integer,
    display_name text not null, status text, minimum_reputation numeric, registration_policy text, field_limit integer,
    registration_closes_at timestamptz, withdrawal_closes_at timestamptz, unique(race_id,season_id));
  create table public.stages(id uuid primary key default gen_random_uuid(), race_edition_id uuid references race_editions,
    season_day_id uuid references season_days, day_slot text, stage_number integer, name text not null,
    stage_type text, distance_km numeric, status text, departure_at timestamptz, profile_type text,
    unique(race_edition_id,stage_number));
  create table public.stage_segments(stage_id uuid references stages on delete cascade, segment_number integer,
    distance_km numeric check(distance_km>0), terrain_type text, surface_type text, average_gradient_pct numeric,
    primary key(stage_id,segment_number));
  create table public.team_seasons(id uuid primary key default gen_random_uuid(), team_id uuid, season_id uuid references seasons,
    registration_country_id uuid references countries, status text, unique(team_id,season_id));
  create table public.race_registrations(id uuid primary key, team_season_id uuid, race_edition_id uuid, status text, decided_at timestamptz);
  create table public.race_rosters(race_registration_id uuid, status text);
  insert into seasons values ('${s3}',3,'active',25), ('${s4}',4,'planned',1), ('${incomplete}',4,'planned',1);
  insert into race_categories(code) values ('local');
  insert into season_days(season_id,day_number,calendar_date)
    select season.id,n,date '2026-10-09'+(n-1) from seasons season cross join generate_series(1,28) n where season.id<>'${incomplete}';
`);
const catalogStart = source.indexOf("create table if not exists private.local_race_country_catalog");
const catalogEnd = source.indexOf("create or replace function private.find_free_standard_race_start_day");
await db.exec(source.slice(catalogStart, catalogEnd));
await db.exec(`insert into countries(iso_alpha2,name) select country_code,country_code from private.local_race_country_catalog;
  insert into countries(iso_alpha2,name) values ('RW','Rwanda'),('ZZ','Fallback nation');`);
await db.exec(functionSql("private.find_free_standard_race_start_day"));
await db.exec(functionSql("private.ensure_local_race_calendar_for_country"));
await db.exec(functionSql("private.sync_s4_local_calendar_for_team_season"));
await db.exec(`revoke all on function private.ensure_local_race_calendar_for_country(uuid,uuid) from public;
  create trigger sync_s4_local_calendar_for_team_season after insert or update of registration_country_id,status
  on public.team_seasons for each row execute function private.sync_s4_local_calendar_for_team_season();`);

const country = (code) => db.query("select id from countries where iso_alpha2=$1", [code]).then(r => r.rows[0].id);
const rw = await country("RW");
const prepareTeam = (countryId, seasonId = s4, status = "planned") => db.query(
  "insert into team_seasons(team_id,season_id,registration_country_id,status) values(gen_random_uuid(),$1,$2,$3)",
  [seasonId, countryId, status]);
await assert.rejects(() => prepareTeam(rw), /record "v_catalog" has no field/);
assert.equal((await db.query("select count(*)::int n from team_seasons")).rows[0].n, 0);
assert.equal((await db.query("select count(*)::int n from races")).rows[0].n, 0);
console.log("Reproduced sponsor-blocking team-season trigger error; failed insert is atomic.");

await db.exec(fix);
const definition = (await db.query("select pg_get_functiondef('private.ensure_local_race_calendar_for_country(uuid,uuid)'::regprocedure) d")).rows[0].d;
assert.ok(definition.includes("v_catalog private.local_race_country_catalog%rowtype;"));
await db.exec(fix); // Applying twice must retain the exact function and permissions.
assert.equal((await db.query("select pg_get_functiondef('private.ensure_local_race_calendar_for_country(uuid,uuid)'::regprocedure) d")).rows[0].d, definition);
assert.equal((await db.query("select has_function_privilege('anon','private.ensure_local_race_calendar_for_country(uuid,uuid)','execute') allowed")).rows[0].allowed, false);
await prepareTeam(rw);
const fallbackNames = (await db.query("select name from races where country_id=$1 order by slug", [rw])).rows.map(r => r.name);
assert.deepEqual(fallbackNames, ["Rwanda Circuit", "Rwanda Cup", "Rwanda Classic", "Rwanda Challenge", "Rwanda Local Tour"]);
const calendarCounts = async (countryId) => (await db.query(`select count(distinct e.id)::int editions,count(s.id)::int stages
  from race_editions e join races r on r.id=e.race_id left join stages s on s.race_edition_id=e.id
  where e.season_id=$1 and r.country_id=$2`, [s4, countryId])).rows[0];
assert.deepEqual(await calendarCounts(rw), { editions: 5, stages: 7 });
const rwStageIds = (await db.query("select s.id from stages s join race_editions e on e.id=s.race_edition_id join races r on r.id=e.race_id where r.country_id=$1 order by s.id", [rw])).rows;
await prepareTeam(rw); // A second team must not recreate or move the country's calendar.
assert.deepEqual(await calendarCounts(rw), { editions: 5, stages: 7 });
assert.deepEqual((await db.query("select s.id from stages s join race_editions e on e.id=s.race_edition_id join races r on r.id=e.race_id where r.country_id=$1 order by s.id", [rw])).rows, rwStageIds);
assert.deepEqual((await db.query("select s.profile_type from stages s join race_editions e on e.id=s.race_edition_id join races r on r.id=e.race_id where r.slug='local-rw-tour' order by s.stage_number")).rows.map(s => s.profile_type), ["sprint", "hilly", "hilly"]);

const countries = (await db.query("select id,iso_alpha2 from countries where iso_alpha2<>'RW'")).rows;
for (const c of countries) {
  await prepareTeam(c.id);
  assert.deepEqual(await calendarCounts(c.id), { editions: 5, stages: 7 }, c.iso_alpha2);
}
assert.deepEqual((await db.query("select s.profile_type from stages s join race_editions e on e.id=s.race_edition_id join races r on r.id=e.race_id where r.slug='local-be-tour' order by s.stage_number")).rows.map(s => s.profile_type), ["sprint", "hilly", "cobbles"]);
assert.equal((await db.query(`select count(*)::int n from private.local_race_country_catalog c
  join countries country on country.iso_alpha2=c.country_code join races r on r.country_id=country.id and r.slug='local-'||lower(c.country_code)||'-tour'
  where r.name=c.tour_name`)).rows[0].n, countries.length - 1);
await prepareTeam(rw, s3, "active");
await prepareTeam(rw, incomplete);
assert.equal((await db.query("select count(*)::int n from race_editions where season_id<>$1", [s4])).rows[0].n, 0);
assert.equal((await db.query(`select count(*)::int n from stage_segments where distance_km<=0`)).rows[0].n, 0);
assert.equal((await db.query(`select count(*)::int n from race_editions where registration_closes_at is null or withdrawal_closes_at is null`)).rows[0].n, 0);
console.log(`Isolated SQL checks passed: ${countries.length + 1} countries, catalog and fallback names/profiles, team-season insertion, 5 editions/7 stages, idempotence, privileges, S3 untouched and incomplete calendar guard.`);
await db.close();
