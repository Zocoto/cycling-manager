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
function functionSql(name, migration = source) {
  const start = migration.indexOf(`create or replace function ${name}(`);
  assert.ok(start >= 0, `Missing source function: ${name}`);
  return migration.slice(start, migration.indexOf("$$;", start) + 3);
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

// Exercise the urgent tour repair on the same isolated PostgreSQL fixture.
const compactSource = readFileSync(resolve("supabase/migrations/20260722220000_compact_stage_races_into_half_days.sql"), "utf8");
const spacingSource = readFileSync(resolve("supabase/migrations/20260925153000_space_same_country_standard_races.sql"), "utf8");
const tourFix = readFileSync(resolve("supabase/migrations/20261009160000_repair_consecutive_tour_stage_slots.sql"), "utf8");
await db.exec(`
  create table stage_results(stage_id uuid references stages);
  alter table stages add constraint stages_day_slot_unique unique(race_edition_id,season_day_id,day_slot) deferrable initially deferred;
  create table national_federation_race_projects(race_id uuid,country_id uuid,status text,activation_game_year integer,start_day_number integer,start_day_slot text,stage_blueprint jsonb);
  create table development_race_editions(season_id uuid,status text,competition_type text,start_day_number integer,end_day_number integer);
`);
await db.exec(functionSql("public.compact_planned_stage_races", compactSource));
await db.exec(functionSql("private.standard_race_country_overlap_allowed", spacingSource));
await db.exec(functionSql("private.normalize_standard_race_country_spacing", spacingSource));
// Install the historical local generator to verify both runtime replacements.
await db.exec(functionSql("private.ensure_local_race_calendar_for_country")
  .replace("v_catalog record;", "v_catalog private.local_race_country_catalog%rowtype;")
  .replace("and day_number = v_start_day + ((v_stage_number - 1) / 2);", "and day_number = v_start_day + v_stage_number - 1;")
  .replace("      (v_duration + 1) / 2,", "      v_duration,"));

const addTour = async (slug, seasonId, startDay, stageCount, status = "registration_open", result = false) => {
  const race = (await db.query(`insert into races(country_id,name,slug,race_format,status,competition_type,is_grand_tour)
    values($1,$2,$2,'stage_race','active','standard',false) returning id`, [rw,slug])).rows[0].id;
  const edition = (await db.query(`insert into race_editions(race_id,season_id,display_name,status)
    values($1,$2,$3,$4) returning id`, [race,seasonId,slug,status])).rows[0].id;
  for (let number = 1; number <= stageCount; number++) {
    await db.query(`insert into stages(race_edition_id,season_day_id,stage_number,day_slot,name,status,departure_at)
      select $1,id,$2,case when $2::int%2=1 then 'early' else 'late' end,$3,
        case when $4::text in ('in_progress','completed') and $2::int=1 then 'completed' else 'planned' end,
        (calendar_date::timestamp+case when $2::int%2=1 then time '14:00' else time '18:00' end) at time zone 'Europe/Paris'
      from season_days where season_id=$5 and day_number=$6`, [edition,number,slug,status,seasonId,startDay+number-1]);
  }
  if (result) await db.query("insert into stage_results select id from stages where race_edition_id=$1 and stage_number=1", [edition]);
  return edition;
};
const correctedTours = [];
for (const [slug,n,start] of [["hindukush-fixture",3,3],["pennines-fixture",5,15],["zagros-fixture",4,13],["dst-fixture",6,16]]) {
  correctedTours.push(await addTour(slug,s4,start,n));
}
const protectedTours = [];
for (const [slug,status,result,seasonId] of [
  ["started-fixture","in_progress",false,s4], ["completed-fixture","completed",false,s4],
  ["results-fixture","registration_open",true,s4], ["cancelled-fixture","cancelled",false,s4],
  ["s3-fixture","registration_open",false,s3],
]) protectedTours.push(await addTour(slug,seasonId,3,3,status,result));
const readStages = () => db.query("select id,race_edition_id,season_day_id,stage_number,day_slot,departure_at,status from stages order by id").then(r=>r.rows);
const beforeRepair = await readStages();
const protectedBefore = beforeRepair.filter(row=>protectedTours.includes(row.race_edition_id));
await db.exec(tourFix);
const afterRepair = await readStages();
assert.deepEqual(afterRepair.filter(row=>protectedTours.includes(row.race_edition_id)),protectedBefore);
assert.deepEqual(afterRepair.map(row=>row.id),beforeRepair.map(row=>row.id));
const incorrect = await db.query(`select count(*)::int n from stages t join race_editions e on e.id=t.race_edition_id
  join season_days d on d.id=t.season_day_id join stages first_stage on first_stage.race_edition_id=e.id and first_stage.stage_number=1
  join season_days first_day on first_day.id=first_stage.season_day_id
  where e.id=any($1::uuid[]) and (d.day_number<>first_day.day_number+(t.stage_number-1)/2
    or t.day_slot<>case when t.stage_number%2=1 then 'early' else 'late' end
    or to_char(t.departure_at at time zone 'Europe/Paris','HH24:MI')<>case when t.stage_number%2=1 then '14:00' else '18:00' end)`, [correctedTours]);
assert.equal(incorrect.rows[0].n,0);
await db.exec(tourFix);
assert.deepEqual(await readStages(),afterRepair);
assert.equal((await db.query("select has_function_privilege('anon','private.ensure_local_race_calendar_for_country(uuid,uuid)','execute') allowed")).rows[0].allowed,false);
await db.exec(`insert into countries(iso_alpha2,name) values ('XY','New country');`);
await prepareTeam(await country("XY"));
assert.deepEqual((await db.query(`select d.day_number,t.day_slot,to_char(t.departure_at at time zone 'Europe/Paris','HH24:MI') departure_hour
  from stages t join race_editions e on e.id=t.race_edition_id join races r on r.id=e.race_id join season_days d on d.id=t.season_day_id
  where r.slug='local-xy-tour' order by t.stage_number`)).rows,
  [{day_number:12,day_slot:"early",departure_hour:"14:00"},{day_number:12,day_slot:"late",departure_hour:"18:00"},{day_number:13,day_slot:"early",departure_hour:"14:00"}]);

// Force a planned-season country collision across the DST boundary. The smaller
// one-day race moves from October 25 to October 24 and must stay at 14:00 Paris.
await db.exec(`insert into countries(iso_alpha2,name) values ('DY','DST country');`);
const dstCountry = await country("DY");
await db.query(`insert into races(country_id,name,slug,race_format,status,competition_type,is_grand_tour)
  values($1,'DST tour','dst-priority-tour','stage_race','active','standard',false),
  ($1,'DST classic','dst-moving-classic','one_day','active','standard',false)`,[dstCountry]);
await db.query(`insert into race_editions(race_id,season_id,display_name,status,registration_closes_at,withdrawal_closes_at)
  select id,$1,name,'registration_open',timestamptz '2026-10-25 08:00 Europe/Paris',timestamptz '2026-10-25 08:00 Europe/Paris'
  from races where country_id=$2`,[s4,dstCountry]);
await db.query(`insert into stages(race_edition_id,season_day_id,stage_number,day_slot,name,status,departure_at)
  select e.id,d.id,1,'early',e.display_name,'planned',timestamptz '2026-10-25 14:00 Europe/Paris'
  from race_editions e join races r on r.id=e.race_id cross join season_days d
  where e.season_id=$1 and r.country_id=$2 and d.season_id=$1 and d.day_number=17`,[s4,dstCountry]);
// Earlier fixture tours share a country intentionally; isolate this collision.
await db.query("update races set status='inactive' where country_id<>$1",[dstCountry]);
assert.equal((await db.query("select private.normalize_standard_race_country_spacing($1) n",[s4])).rows[0].n,1);
assert.deepEqual((await db.query(`select d.day_number,to_char(t.departure_at at time zone 'Europe/Paris','HH24:MI') departure,
  to_char(e.registration_closes_at at time zone 'Europe/Paris','HH24:MI') registration,
  to_char(e.withdrawal_closes_at at time zone 'Europe/Paris','HH24:MI') withdrawal
  from stages t join race_editions e on e.id=t.race_edition_id join races r on r.id=e.race_id join season_days d on d.id=t.season_day_id
  where r.slug='dst-moving-classic'`)).rows,[{day_number:16,departure:"14:00",registration:"08:00",withdrawal:"08:00"}]);
console.log("Tour SQL repair passed: 3/4/5/6 stages, DST-safe spacing, future local generation, retained IDs/results, protected started/completed/cancelled/S3 tours, ACLs and idempotence.");
await db.close();
