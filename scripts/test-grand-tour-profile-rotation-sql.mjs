import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const pglitePath = process.env.PGLITE_MODULE;
assert.ok(pglitePath, "Set PGLITE_MODULE to an installed PGlite module");
const { PGlite } = await import(pathToFileURL(path.resolve(pglitePath)).href);
const db = new PGlite();

async function migration(file) {
  return (await readFile(new URL("../supabase/migrations/" + file, import.meta.url), "utf8"))
    .replaceAll("\r\n", "\n");
}

function extractFunction(definition, name) {
  const start = definition.indexOf("create or replace function " + name + "(");
  const end = definition.indexOf("\n$$;", start);
  assert.ok(start >= 0 && end > start, "Function does not exist: " + name);
  return definition.slice(start, end + 4);
}

const source = extractFunction(
  await migration("20260722220000_compact_stage_races_into_half_days.sql"),
  "public.provision_season_race_calendar",
).replace("  perform public.compact_planned_stage_races(p_target_season_id);", [
  "  perform private.remove_obsolete_cloned_stage_segments(p_source_season_id,p_target_season_id);",
  "  perform private.repair_hauts_plateaux_opening_route(p_target_season_id);",
  "  perform public.compact_planned_stage_races(p_target_season_id);",
].join("\n"));
const cleanup = extractFunction(
  await migration("20261029140000_refine_s5_cobbled_profiles.sql"),
  "private.remove_obsolete_cloned_stage_segments",
);

try {
  await db.exec(`
    create schema private;
    create role anon;
    create role authenticated;
    create role service_role;
    create table public.seasons(id uuid primary key default gen_random_uuid(), game_year int, status text);
    create table public.races(id uuid primary key default gen_random_uuid(), slug text, race_format text, competition_type text, is_grand_tour boolean);
    create table public.season_days(id uuid primary key default gen_random_uuid(), season_id uuid, day_number int, calendar_date date);
    create table public.race_editions(
      id uuid primary key default gen_random_uuid(), race_id uuid references public.races(id), season_id uuid references public.seasons(id),
      race_category_id uuid, edition_number int, display_name text, status text, minimum_reputation int, registration_policy text, field_limit int,
      unique(race_id, season_id)
    );
    create table public.stages(
      id uuid primary key default gen_random_uuid(), race_edition_id uuid references public.race_editions(id), season_day_id uuid,
      stage_number smallint, name text, stage_type text, distance_km numeric(6,2), status text,
      departure_at timestamptz, profile_type text, profile_variant text, day_slot text, unique(race_edition_id, stage_number)
    );
    create table public.stage_segments(
      id uuid primary key default gen_random_uuid(), stage_id uuid references public.stages(id),
      segment_number smallint, distance_km numeric(5,2), terrain_type text, surface_type text, average_gradient_pct numeric(5,2),
      unique(stage_id, segment_number)
    );
    create table public.stage_segment_primes(
      stage_segment_id uuid references public.stage_segments(id) on delete cascade, prime_type text, mountain_category text,
      points_scale smallint[] not null, primary key(stage_segment_id, prime_type)
    );
    create table public.race_results(race_edition_id uuid references public.race_editions(id));
    create table public.race_registrations(race_edition_id uuid references public.race_editions(id));
    create table public.stage_results(stage_id uuid references public.stages(id));
    create table public.official_stage_simulations(stage_id uuid references public.stages(id));
    create table public.race_stage_strategies(stage_id uuid references public.stages(id));
    create table public.race_time_trial_rider_plans(stage_id uuid references public.stages(id));
    create table public.race_roster_stage_roles(stage_id uuid references public.stages(id));
    create table public.race_stage_equipment_assignments(stage_id uuid references public.stages(id));
    create table public.stage_reconnaissances(target_stage_id uuid references public.stages(id));
    create table public.season_events(
      season_day_id uuid, event_type text, title text, description text, href text, is_filter_persistent boolean, participation_rule text,
      unique(season_day_id,event_type)
    );
    create function public.compact_planned_stage_races(uuid) returns void language plpgsql as $$begin null; end;$$;
    create function private.repair_hauts_plateaux_opening_route(uuid) returns void language plpgsql as $$begin null; end;$$;
    insert into public.seasons(game_year,status) values (5,'active'),(6,'planned'),(7,'planned'),(8,'planned');
    insert into public.season_days(season_id,day_number,calendar_date)
    select id, d, current_date + (game_year-5)*28 + d-1
    from public.seasons cross join generate_series(1,28) as d;
    insert into public.races(slug,race_format,competition_type,is_grand_tour) values
      ('corsa-delle-regioni','stage_race','standard',true),
      ('boucle-des-provinces','stage_race','standard',true),
      ('ruta-de-las-sierras','stage_race','standard',true),
      ('petit-tour','stage_race','standard',false);
    insert into public.race_editions(race_id,season_id,edition_number,display_name,status)
    select race.id, season.id, season.game_year, race.slug, case when season.game_year = 5 then 'completed' else 'registration_open' end
    from public.races race cross join public.seasons season where season.game_year in (5,6,8);
    insert into public.stages(race_edition_id,season_day_id,stage_number,name,stage_type,distance_km,status,departure_at,profile_type,day_slot)
    select e.id,d.id,n,case when n=12 and r.slug='boucle-des-provinces' then 'Paris · Champs-Élysées' else 'Étape '||n end,
      'road',164,case when s.status='active' then 'completed' else 'planned' end,
      d.calendar_date + case when n%2=1 then time '14:00' else time '18:00' end,'flat',case when n%2=1 then 'early' else 'late' end
    from public.race_editions e join public.races r on r.id=e.race_id join public.seasons s on s.id=e.season_id
    cross join lateral generate_series(1,case when r.is_grand_tour then 12 else 4 end) n
    join public.season_days d on d.season_id=s.id and d.day_number=3+(n-1)/2;
    insert into public.stage_segments(stage_id,segment_number,distance_km,terrain_type,surface_type,average_gradient_pct)
    select stage.id,seg,41,'flat','asphalt',0 from public.stages stage cross join generate_series(1,4) seg;
    insert into public.stage_segment_primes(stage_segment_id,prime_type,points_scale)
    select id,'intermediate_sprint',array[42]::smallint[] from public.stage_segments where segment_number=1;
    -- The planned editions each exercise an independent freeze condition.
    insert into public.race_stage_strategies
    select stage.id from public.stages stage join public.race_editions e on e.id=stage.race_edition_id
    join public.races race on race.id=e.race_id join public.seasons s on s.id=e.season_id
    where s.game_year=8 and race.slug='boucle-des-provinces' and stage.stage_number=1;
    insert into public.race_registrations
    select e.id from public.race_editions e join public.races race on race.id=e.race_id join public.seasons s on s.id=e.season_id
    where s.game_year=8 and race.slug='corsa-delle-regioni';
    insert into public.official_stage_simulations
    select stage.id from public.stages stage join public.race_editions e on e.id=stage.race_edition_id
    join public.races race on race.id=e.race_id join public.seasons s on s.id=e.season_id
    where s.game_year=8 and race.slug='ruta-de-las-sierras' and stage.stage_number=1;
  `);
  await db.exec(cleanup);
  await db.exec(source);

  const fingerprint = async (year, condition = "true", geometry = true) => (await db.query(`
    select stage.id, stage.season_day_id, stage.day_slot, stage.name, stage.departure_at,
      ${geometry ? `stage.stage_type, stage.distance_km::float, stage.profile_type,
      (select jsonb_agg(to_jsonb(seg) || jsonb_build_object('primes',
        (select jsonb_agg(to_jsonb(prime) order by prime.prime_type)
         from public.stage_segment_primes prime where prime.stage_segment_id=seg.id)) order by seg.segment_number)
       from public.stage_segments seg where seg.stage_id=stage.id) as sectors,` : ""}
      race.slug, stage.stage_number, e.id as edition_id
    from public.stages stage join public.race_editions e on e.id=stage.race_edition_id
    join public.races race on race.id=e.race_id join public.seasons s on s.id=e.season_id
    where s.game_year=$1 and (${condition}) order by race.slug, stage.stage_number
  `, [year])).rows;

  const original = await fingerprint(5);
  const frozen = await fingerprint(8);
  const unaffected = await fingerprint(6, "not race.is_grand_tour or stage.stage_number=12");
  const timetable = await fingerprint(6, "race.is_grand_tour", false);
  await db.exec(await migration("20261124210000_rotate_grand_tour_profiles.sql"));
  assert.deepEqual(await fingerprint(5), original);
  assert.deepEqual(await fingerprint(8), frozen);
  assert.deepEqual(await fingerprint(6, "not race.is_grand_tour or stage.stage_number=12"), unaffected);
  assert.deepEqual(await fingerprint(6, "race.is_grand_tour", false), timetable);
  const year6 = await fingerprint(6, "race.is_grand_tour and stage.stage_number<12");
  assert.equal(year6.length, 33);
  for (const row of year6) {
    assert.equal(row.sectors.reduce((total, sector) => total + sector.distance_km, 0), row.distance_km);
    const primes = row.sectors.flatMap(sector => sector.primes ?? []);
    assert.equal(primes.filter(prime => prime.prime_type === "intermediate_sprint").length, row.stage_type === "road" ? 1 : 0);
    assert.equal(primes.some(prime => prime.points_scale.includes(42)), false);
    assert.ok(row.sectors.reduce((total, sector) => total + 10 * sector.distance_km * Math.max(0, sector.average_gradient_pct), 0) <= 4400);
  }
  assert.equal(year6.filter(row => row.stage_type === "team_time_trial").length, 1);
  assert.equal(year6.filter(row => row.stage_type === "prologue").length, 1);
  assert.equal(year6.find(row => row.stage_type === "prologue").stage_number, 1);

  const yearIds = Object.fromEntries((await db.query("select game_year,id from public.seasons")).rows.map(row => [row.game_year, row.id]));
  await db.query("select private.apply_grand_tour_profile_rotation($1)", [yearIds[6]]);
  assert.deepEqual(await fingerprint(6, "race.is_grand_tour and stage.stage_number<12"), year6);

  await db.query("select public.provision_season_race_calendar($1,$2)", [yearIds[6], yearIds[7]]);
  const year7 = await fingerprint(7, "race.is_grand_tour");
  assert.equal(year7.length, 36);
  assert.notDeepEqual(year7.map(row => row.stage_type), (await fingerprint(6, "race.is_grand_tour")).map(row => row.stage_type));
  await db.query("insert into public.race_registrations values ($1)", [year7[0].edition_id]);
  await db.query("select public.provision_season_race_calendar($1,$2)", [yearIds[6], yearIds[7]]);
  assert.deepEqual(await fingerprint(7, "race.is_grand_tour"), year7, "Manual retry preserves profile, sectors and primes");
  await db.query("select public.provision_season_race_calendar($1,$2)", [yearIds[6], yearIds[8]]);
  assert.deepEqual(await fingerprint(8, "race.is_grand_tour"), frozen.filter(row => row.slug !== "petit-tour"),
    "Manual retry also preserves editions skipped because their preparations were in progress");

  const cycles = await db.query(`
    select variant, count(*) filter (where profile_type='mountain')::int as mountains,
      count(*) filter (where stage_type='individual_time_trial')::int as itt,
      count(*) filter (where stage_type='team_time_trial')::int as ttt,
      count(*) filter (where stage_type='prologue')::int as prologues
    from generate_series(6,9) year cross join lateral private.grand_tour_rotation_plan('corsa-delle-regioni',year)
    group by variant order by variant
  `);
  assert.deepEqual(cycles.rows, [
    { variant: "mountain", mountains: 5, itt: 1, ttt: 0, prologues: 0 },
    { variant: "prologue", mountains: 4, itt: 1, ttt: 0, prologues: 1 },
    { variant: "team_time_trial", mountains: 4, itt: 1, ttt: 1, prologues: 0 },
    { variant: "time_trials", mountains: 3, itt: 2, ttt: 0, prologues: 0 },
  ]);
  console.log("Grand Tour rotations passed in isolated PGlite.");
} finally {
  await db.close();
}
