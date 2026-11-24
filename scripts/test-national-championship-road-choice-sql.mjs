// In-memory PostgreSQL only. Pass the local PGlite module path, never a DB URL.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2];
assert.ok(modulePath?.replaceAll("\\", "/").endsWith("/dist/index.js"), "Provide the local PGlite module path");
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [fr, be, season5, season6, president, member, frTeamSeason, beTeamSeason] =
  [1, 2, 3, 4, 5, 6, 7, 8].map(id);
const migration = async (name) =>
  (await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8")).replaceAll("\r", "");
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const choose = (country, target, preset) =>
  db.query("select save_national_championship_road_choice($1, $2, $3)", [country, target, preset]);
const viewChoice = async () => (await one("select get_national_championship_road_choice('FR') as data")).data;
const assistant = async () => (await one("select get_current_dashboard_assistant_summary() as payload")).payload;
const provision = (country, season) => db.query("select ensure_national_championship_editions($1,$2)", [country, season]);

async function asDirector(director, run) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [director]);
  await db.exec("set role authenticated");
  try {
    return await run();
  } finally {
    await db.exec("reset role");
  }
}

async function route(country, season, suffix = "route") {
  return one(`
    select e.id as edition_id, s.id, s.distance_km::int, s.profile_type, s.profile_variant,
      jsonb_agg(g.id order by g.segment_number) as sector_ids,
      jsonb_agg(jsonb_build_array(g.distance_km, g.terrain_type, g.surface_type, g.average_gradient_pct)
        order by g.segment_number) as segments
    from races r join race_editions e on e.race_id = r.id
    join stages s on s.race_edition_id = e.id
    join stage_segments g on g.stage_id = s.id
    where r.country_id = $1 and e.season_id = $2 and r.slug like '%-' || $3
    group by e.id, s.id
  `, [country, season, suffix]);
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table countries(id uuid primary key, iso_alpha2 text unique, name text, is_active boolean);
    create table seasons(id uuid primary key, game_year int, name text, ends_on date, status text);
    create table team_seasons(id uuid primary key, season_id uuid, registration_country_id uuid);
    create table national_federation_terms(country_id uuid, president_director_id uuid,
      start_game_year int, end_game_year int, governance_mode text);
    create table season_days(id uuid primary key default gen_random_uuid(), season_id uuid,
      day_number int, calendar_date date);
    create table race_categories(id uuid primary key, code text, is_active boolean);
    create table races(id uuid primary key default gen_random_uuid(), country_id uuid, name text,
      short_name text, race_format text, status text, slug text unique, competition_type text);
    create table race_editions(id uuid primary key default gen_random_uuid(), race_id uuid,
      season_id uuid, race_category_id uuid, edition_number int, display_name text, status text,
      registration_closes_at timestamptz, withdrawal_closes_at timestamptz,
      minimum_reputation int, registration_policy text, field_limit int, unique(race_id,season_id));
    create table stages(id uuid primary key default gen_random_uuid(), race_edition_id uuid, season_day_id uuid,
      stage_number int, name text, stage_type text, distance_km numeric, status text,
      departure_at timestamptz, profile_type text, day_slot text, profile_variant text,
      unique(race_edition_id, stage_number),
      constraint stages_profile_variant_check check (
        profile_variant in ('sprint_cobbles','selective_cobbles','hilly_cobbles')));
    create table stage_segments(id uuid primary key default gen_random_uuid(), stage_id uuid,
      segment_number int, distance_km numeric, terrain_type text, surface_type text,
      average_gradient_pct numeric, unique(stage_id,segment_number));
    create table race_registrations(race_edition_id uuid);
    create table stage_results(stage_id uuid);
    create table official_stage_simulations(stage_id uuid);
    create function get_current_federation_identity(p_country_code text)
    returns table(country_id uuid, sporting_director_id uuid) language sql stable as $$
      select id, auth.uid() from public.countries where iso_alpha2 = upper(p_country_code)
        and iso_alpha2 = 'FR' and auth.uid() in ('${president}', '${member}')
    $$;
    create function get_current_dashboard_assistant_summary()
    returns jsonb language sql stable security definer as $$
      with current_context as (
        select case when auth.uid() = '${president}' then '${frTeamSeason}'::uuid
          else '${beTeamSeason}'::uuid end as team_season_id, auth.uid() as sporting_director_id
      )
      select jsonb_build_object(
      'federationSelectionReminder', (select null::jsonb),
      'federationVoteReminder', jsonb_build_object('countryCode', 'fr'))
    $$;
    insert into countries values ('${fr}','FR','France',true), ('${be}','BE','Belgique',true);
    insert into seasons values
      ('${season5}', 5, 'Saison 5', (now() at time zone 'Europe/Paris')::date + 7, 'active'),
      ('${season6}', 6, 'Saison 6', (now() at time zone 'Europe/Paris')::date + 35, 'planned');
    insert into team_seasons values ('${frTeamSeason}','${season5}','${fr}'), ('${beTeamSeason}','${season5}','${be}');
    insert into national_federation_terms values ('${fr}','${president}',5,6,'elected');
    insert into race_categories values ('${id(9)}','national',true);
    insert into season_days(season_id,day_number,calendar_date) values
      ('${season5}',8,(now() at time zone 'Europe/Paris')::date - 13),
      ('${season6}',8,(now() at time zone 'Europe/Paris')::date + 14);
  `);

  const original = await migration("20260808163000_rework_national_championships.sql");
  const generatorStart = original.indexOf("create or replace function public.ensure_national_championship_editions(");
  const generatorEnd = original.indexOf("$$;", generatorStart);
  assert.ok(generatorStart >= 0 && generatorEnd >= 0);
  await db.exec(original.slice(generatorStart, generatorEnd + 3));
  await provision(fr, season5);
  await provision(fr, season6);
  const activeBefore = await route(fr, season5);
  const plannedBefore = await route(fr, season6);
  const plannedClm = await route(fr, season6, "clm");
  await db.exec(await migration("20261110110000_choose_national_championship_road_route.sql"));

  await assert.rejects(choose("FR", 6, "flat"), /Authentification requise/);
  await asDirector(president, async () => {
    const state = await viewChoice();
    assert.equal(state.window, "upcoming");
    assert.equal(state.currentPreset, "hilly");
    assert.equal(state.nextPreset, null);
    assert.equal(state.viewerIsPresident, true);
    assert.equal(Object.keys(state.presets).length, 6);
    for (const segments of Object.values(state.presets)) {
      assert.equal(segments.reduce((distance, [km]) => distance + km, 0), 178);
    }
    assert.deepEqual(state.presets.hilly, activeBefore.segments);
    assert.equal((await assistant()).nationalChampionshipRouteReminder, null);
    await assert.rejects(choose("FR", 6, "flat"), /sept derniers jours/);
  });

  await db.exec(`update seasons set ends_on=(now() at time zone 'Europe/Paris')::date + 6 where id='${season5}'`);
  await asDirector(member, async () => {
    assert.equal((await viewChoice()).viewerIsPresident, false);
    assert.equal((await assistant()).nationalChampionshipRouteReminder, null);
    await assert.rejects(choose("FR", 6, "flat"), /président élu/);
  });
  await asDirector(president, async () => {
    const payload = await assistant();
    assert.deepEqual(payload.federationVoteReminder, { countryCode: "fr" });
    assert.equal(payload.nationalChampionshipRouteReminder.countryCode, "fr");
    assert.equal(payload.nationalChampionshipRouteReminder.targetGameYear, 6);
    await assert.rejects(choose("BE", 6, "flat"), /président élu/);
    await assert.rejects(choose("FR", 5, "flat"), /saison a changé/);
    await assert.rejects(choose("FR", 6, "time_trial"), /indisponible/);
    await choose("FR", 6, "flat");
    assert.equal((await viewChoice()).nextPreset, "flat");
    assert.equal((await assistant()).nationalChampionshipRouteReminder, null);
  });

  await db.exec(`update seasons set ends_on=(now() at time zone 'Europe/Paris')::date where id='${season5}'`);
  const selectedSegments = await asDirector(president, async () => {
    await choose("FR", 6, "flat_hilly");
    const state = await viewChoice();
    assert.equal(state.nextPreset, "flat_hilly");
    assert.equal(state.currentPreset, "hilly");
    return state.presets.flat_hilly;
  });
  await db.exec(`update seasons set ends_on=(now() at time zone 'Europe/Paris')::date - 1 where id='${season5}'`);
  await asDirector(president, async () => {
    assert.equal((await viewChoice()).window, "closed");
    await assert.rejects(choose("FR", 6, "mountain"), /sept derniers jours/);
  });
  assert.deepEqual(await route(fr, season5), activeBefore);
  assert.deepEqual(await route(fr, season6), plannedBefore);

  await db.exec(`update seasons set status='completed' where id='${season5}';
    update seasons set status='active' where id='${season6}';`);
  await provision(fr, season6);
  await provision(be, season6);
  const activated = await route(fr, season6);
  assert.equal(activated.id, plannedBefore.id);
  assert.equal(activated.edition_id, plannedBefore.edition_id);
  assert.equal(activated.profile_type, "flat");
  assert.equal(activated.profile_variant, "flat_hilly");
  assert.deepEqual(activated.segments, selectedSegments);
  assert.deepEqual(activated.sector_ids.slice(0, plannedBefore.sector_ids.length), plannedBefore.sector_ids);
  assert.deepEqual(await route(fr, season6, "clm"), plannedClm);
  assert.equal((await route(be, season6)).profile_type, "hilly");
  await provision(fr, season6);
  assert.deepEqual(await route(fr, season6), activated);

  await db.exec(`insert into race_registrations values ('${activated.edition_id}');
    update private.national_championship_road_choices set preset_key='mountain' where country_id='${fr}';`);
  await provision(fr, season6);
  assert.deepEqual(await route(fr, season6), activated);
  console.log("CN route: presets, access, Paris window, dashboard reminder, rollover and stage preservation passed.");

  const season7 = id(10);
  const season8 = id(11);
  const season9 = id(20);
  const es = id(12);
  const countryInputs = [
    [es,"ES","Espagne","europe"], [id(13),"CH","Suisse","europe"], [id(14),"ZA","Afrique du Sud","africa"],
    [id(15),"JP","Japon","asia"], [id(16),"CA","Canada","america"], [id(17),"AU","Australie","oceania"],
  ];
  await db.exec(`
    alter table countries add column continent_code text;
    alter table races add column championship_continent_code text;
    alter table race_editions add column host_country_id uuid, add column is_neutral_host boolean not null default false;
    create table race_results(race_edition_id uuid);
    create table race_stage_strategies(stage_id uuid);
    create table race_stage_equipment_assignments(stage_id uuid);
    create table race_roster_stage_roles(stage_id uuid);
    create table stage_reconnaissances(target_stage_id uuid);
    create table stage_segment_primes(stage_segment_id uuid, prime_type text, mountain_category text, points_scale integer[],
      unique(stage_segment_id,prime_type));
    create table national_federation_hosting_candidacies(target_game_year integer,event_key text,status text);
    create table national_federation_hosting_decisions(target_game_year integer,event_key text,decision text);
    create table national_federation_selection_lists(season_id uuid,country_id uuid,slot_key text);
    create table season_events(season_day_id uuid, event_type text, title text, description text,
      href text, is_filter_persistent boolean, participation_rule text, unique(season_day_id,event_type));
    create function compact_planned_stage_races(uuid) returns void language sql as 'select null::void';
    create function repair_missing_standard_race_deadlines(uuid) returns void language sql as 'select null::void';
    insert into race_categories values ('${id(18)}','world',true), ('${id(19)}','continental',true);
    insert into seasons values ('${season7}',7,'Saison 7',current_date+63,'planned'),
      ('${season8}',8,'Saison 8',current_date+91,'planned'), ('${season9}',9,'Saison 9',current_date+119,'planned');
    insert into season_days(season_id,day_number,calendar_date)
      select s.id, n, s.ends_on - (28-n) from seasons s cross join (values(8),(22),(26)) days(n)
      where s.id in ('${season7}','${season8}','${season9}');
  `);
  for (const country of countryInputs) {
    await db.query("insert into countries values ($1,$2,$3,true,$4)", country);
  }
  const internationalSource = await migration("20260723161000_create_international_championship_selections.sql");
  const baseSource = internationalSource.match(/create or replace function public\.ensure_international_championship_editions\([\s\S]*?\n\$\$;/)?.[0];
  assert.ok(baseSource);
  await db.exec(baseSource.replace("ensure_international_championship_editions(", "ensure_international_championship_editions_base("));
  const calendarSource = await migration("20260722220000_compact_stage_races_into_half_days.sql");
  const calendar = calendarSource.match(/create or replace function public\.provision_season_race_calendar\([\s\S]*?\n\$\$;/)?.[0];
  assert.ok(calendar);
  await db.exec(calendar.replace("  perform public.compact_planned_stage_races(p_target_season_id);",
    "  perform public.compact_planned_stage_races(p_target_season_id);\n  perform public.repair_missing_standard_race_deadlines(p_target_season_id);"));
  await db.query("select ensure_international_championship_editions_base($1)", [season7]);
  await provision(es, season7);
  await provision(be, season7);
  await provision(fr, season7);
  const readRoad = (slug, season) => one(`
    select stage.id,edition.id as edition_id,stage.stage_type,stage.profile_type,stage.profile_variant,stage.distance_km::int,
      stage.departure_at,stage.day_slot,
      (select jsonb_agg(jsonb_build_array(sector.distance_km,sector.terrain_type,sector.surface_type,sector.average_gradient_pct)
        order by sector.segment_number) from stage_segments sector where sector.stage_id=stage.id) as geometry
    from races race join race_editions edition on edition.race_id=race.id
    join stages stage on stage.race_edition_id=edition.id
    where race.slug=$1 and edition.season_id=$2
  `, [slug,season]);
  const world = "championnats-du-monde";
  const europe = "championnats-continentaux-europe";
  const africa = "championnats-continentaux-afrique";
  const asia = "championnats-continentaux-asie";
  const beforeWorld = await readRoad(world,season7);
  const holdingEurope = await readRoad(europe,season7);
  const holdingAfrica = await readRoad(africa,season7);
  const beforeSpain = await readRoad("cn-es-route",season7);
  const beforeSpainTT = await readRoad("cn-es-clm",season7);
  const holdingFrance = await readRoad("cn-fr-route",season7);
  const holdingBelgium = await readRoad("cn-be-route",season7);
  await db.query("update stage_segments set distance_km=9 where stage_id=$1 and segment_number=1", [(await readRoad(asia,season7)).id]);
  const holdingAsia = await readRoad(asia,season7);
  await db.exec(`
    insert into national_federation_hosting_candidacies values (7,'continental_championship_pro:europe','pending');
    insert into national_federation_hosting_decisions values (7,'continental_championship_pro:africa','neutral');
    insert into race_registrations values ('${holdingBelgium.edition_id}');
    insert into private.national_championship_road_choices values ('${fr}',7,'mountain');
  `);
  await db.exec(await migration("20261124200000_rotate_default_championship_road_profiles.sql"));
  const rotatedWorld = await readRoad(world,season7);
  const rotatedSpain = await readRoad("cn-es-route",season7);
  assert.deepEqual({
    ...rotatedWorld,
    geometry: beforeWorld.geometry,
    profile_type: beforeWorld.profile_type,
    profile_variant: beforeWorld.profile_variant,
  }, beforeWorld);
  assert.notDeepEqual(rotatedWorld.geometry, beforeWorld.geometry);
  assert.equal(rotatedWorld.geometry.reduce((distance,[km]) => distance+km,0),210);
  assert.equal(rotatedSpain.id,beforeSpain.id);
  assert.equal(rotatedSpain.geometry.reduce((distance,[km]) => distance+km,0),178);
  assert.deepEqual(await readRoad("cn-es-clm",season7),beforeSpainTT);
  assert.deepEqual(await readRoad(europe,season7),holdingEurope);
  assert.deepEqual(await readRoad(africa,season7),holdingAfrica);
  assert.deepEqual(await readRoad(asia,season7),holdingAsia);
  assert.deepEqual(await readRoad("cn-fr-route",season7),holdingFrance);
  assert.deepEqual(await readRoad("cn-be-route",season7),holdingBelgium);
  await asDirector(president, async () => {
    const state = await viewChoice();
    assert.equal(state.currentPreset,"flat_hilly");
    assert.equal(state.nextPreset,"mountain");
    assert.ok(state.presets[state.defaultNextPreset]);
  });
  await db.query("select provision_season_race_calendar($1,$2)", [season7,season8]);
  const nextWorld = await readRoad(world,season8);
  const nextSpain = await readRoad("cn-es-route",season8);
  assert.notDeepEqual(nextWorld.geometry,rotatedWorld.geometry);
  assert.notEqual(nextWorld.profile_type + nextWorld.profile_variant, rotatedWorld.profile_type + rotatedWorld.profile_variant);
  assert.equal(nextWorld.geometry.reduce((distance,[km]) => distance+km,0),210);
  assert.notDeepEqual(nextSpain.geometry,rotatedSpain.geometry);
  await db.query("select provision_season_race_calendar($1,$2)", [season7,season8]);
  assert.equal((await one("select registration_closes_at from race_editions where id=$1", [nextWorld.edition_id])).registration_closes_at,null);
  await db.query("select ensure_international_championship_editions_base($1)", [season8]);
  assert.deepEqual(await readRoad(world,season8),nextWorld);
  assert.ok((await one("select registration_closes_at from race_editions where id=$1", [nextWorld.edition_id])).registration_closes_at);
  await provision(es,season8);
  assert.deepEqual(await readRoad("cn-es-route",season8),nextSpain);
  assert.ok((await one("select registration_closes_at from race_editions where id=$1", [nextSpain.edition_id])).registration_closes_at);
  await assert.rejects(db.query("select provision_season_race_calendar($1,$2)", [season7,season7]), /distinctes/);
  assert.deepEqual(await readRoad(europe,season7),holdingEurope);

  await db.query("select ensure_international_championship_editions_base($1)", [season9]);
  const directlyGeneratedWorld = await readRoad(world,season9);
  assert.notDeepEqual(directlyGeneratedWorld.geometry,nextWorld.geometry);
  assert.equal(directlyGeneratedWorld.geometry.reduce((distance,[km]) => distance+km,0),210);
  await db.query("select ensure_international_championship_editions_base($1)", [season9]);
  assert.deepEqual(await readRoad(world,season9),directlyGeneratedWorld);
  const cycles = await db.query(`
    select year, private.default_championship_road_preset(year,'national_road','es') as national,
      private.default_championship_road_preset(year,'world_championship','championnats-du-monde') as world,
      private.default_championship_road_preset(year,'continental_championship','championnats-continentaux-europe') as continental
    from generate_series(6,18) years(year)
  `);
  for (const family of ["national","world","continental"]) {
    assert.ok(new Set(cycles.rows.map(row=>row[family])).size>=4);
    assert.ok(cycles.rows.slice(1).every((row,index)=>row[family]!==cycles.rows[index][family]));
  }
  console.log("CN/CM/CC: independent rotations, fixed distances and slots, preserved protected routes, planned cloning and retry passed.");
} finally {
  await db.close();
}
