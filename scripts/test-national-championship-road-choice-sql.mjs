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
} finally {
  await db.close();
}
