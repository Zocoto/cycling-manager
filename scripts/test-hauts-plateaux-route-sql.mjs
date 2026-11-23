// Exercise the real migration and provisioning hook in isolated PostgreSQL/WASM.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2];
if (!modulePath) throw new Error('Pass the path to the installed PGlite module.');

const { PGlite } = await import(pathToFileURL(modulePath).href);
const migration = readFileSync(new URL(
  '../supabase/migrations/20261123160000_restore_future_hauts_plateaux_route.sql',
  import.meta.url,
), 'utf8');
const db = new PGlite();
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;

const route = [
  [28, 'flat', 0],
  [24, 'flat', 0],
  [20, 'flat', 0],
  [18, 'flat', 0],
  [12, 'climb', 4.5],
  [10, 'climb', 6.5],
  [10, 'climb', 8],
  [10, 'climb', 9.5],
];
const obsoleteTail = [
  [10, 'climb', 5.6],
  [10, 'climb', 5.7],
  [10, 'descent', -4],
  [10, 'flat', 0],
  [10, 'climb', 6],
  [10, 'descent', -3.1],
  [10, 'flat', 0],
  [10, 'climb', 6.3],
  [8, 'climb', 6.4],
];
const canonicalPrimes = [
  [2, 'intermediate_sprint', null, [20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
  [8, 'mountain', 'HC', [20, 15, 12, 10, 8, 6, 4, 2]],
];
const snapshot = async stageId => ({
  segments: await rows(`
    select id, segment_number, distance_km::float8 as km, terrain_type, surface_type,
      average_gradient_pct::float8 as gradient
    from stage_segments where stage_id=$1 order by segment_number
  `, [stageId]),
  primes: await rows(`
    select p.id, s.segment_number, p.prime_type, p.mountain_category, p.points_scale
    from stage_segment_primes p join stage_segments s on s.id=p.stage_segment_id
    where s.stage_id=$1 order by s.segment_number, p.prime_type
  `, [stageId]),
});

async function addStage(year, {
  slug = 'tour-des-hauts-plateaux', stageNumber = 1, editionStatus = 'registration_open',
  stageStatus = 'planned', profile = 'mountain', prefix = route,
} = {}) {
  const [edition] = await rows(`
    insert into race_editions (race_id, season_id, status)
    select r.id, s.id, $3 from races r cross join seasons s
    where r.slug=$1 and s.game_year=$2
    on conflict (race_id, season_id) do update set status=excluded.status returning id
  `, [slug, year, editionStatus]);
  const [stage] = await rows(`
    insert into stages (race_edition_id, stage_number, stage_type, profile_type, distance_km, status)
    values ($1,$2,'road',$3,132,$4) returning id
  `, [edition.id, stageNumber, profile, stageStatus]);
  for (const [index, [km, terrain, gradient]] of [...prefix, ...obsoleteTail].entries()) {
    await db.query(`
      insert into stage_segments (stage_id, segment_number, distance_km, terrain_type, surface_type, average_gradient_pct)
      values ($1,$2,$3,$4,'asphalt',$5)
    `, [stage.id, index + 1, km, terrain, gradient]);
  }
  return stage.id;
}

async function addPrime(stageId, [segment, type, category, scale]) {
  await db.query(`
    insert into stage_segment_primes (stage_segment_id, prime_type, mountain_category, points_scale)
    select id, $3, $4, $5 from stage_segments where stage_id=$1 and segment_number=$2
  `, [stageId, segment, type, category, scale]);
}

function checkRoute(after, before) {
  assert.deepEqual(after.segments, before.segments.slice(0, 8), 'keep authored segments and their IDs');
  assert.equal(after.segments.reduce((km, segment) => km + segment.km, 0), 132);
  assert.equal(after.segments.reduce((metres, segment) => metres + segment.km * Math.max(0, segment.gradient) * 10, 0), 2940);
  assert.deepEqual(after.primes.map(prime => [
    prime.segment_number, prime.prime_type, prime.mountain_category, prime.points_scale,
  ]), canonicalPrimes, 'restore only the authored sprint and summit primes');
}

try {
  await db.exec(`
    create schema private;
    create role anon;
    create role authenticated;
    create role service_role;
    create table seasons(id uuid primary key default gen_random_uuid(), game_year integer unique, status text);
    create table races(id uuid primary key default gen_random_uuid(), slug text unique, race_format text, competition_type text);
    create table race_editions(
      id uuid primary key default gen_random_uuid(), race_id uuid references races, season_id uuid references seasons,
      status text, unique (race_id, season_id)
    );
    create table stages(
      id uuid primary key default gen_random_uuid(), race_edition_id uuid references race_editions,
      stage_number smallint, stage_type text, profile_type text, distance_km numeric, status text,
      unique (race_edition_id, stage_number)
    );
    create table stage_segments(
      id uuid primary key default gen_random_uuid(), stage_id uuid references stages, segment_number integer,
      distance_km numeric, terrain_type text, surface_type text, average_gradient_pct numeric,
      unique (stage_id, segment_number)
    );
    create table stage_segment_primes(
      id uuid primary key default gen_random_uuid(), stage_segment_id uuid references stage_segments on delete cascade,
      prime_type text, mountain_category text, points_scale smallint[], unique (stage_segment_id, prime_type)
    );
    create table stage_results(stage_id uuid references stages);
    create table official_stage_simulations(stage_id uuid references stages);
    insert into seasons(game_year,status) values
      (5,'active'),(6,'planned'),(7,'planned'),(8,'planned'),(9,'planned'),(10,'planned'),(11,'completed');
    insert into races(slug,race_format,competition_type) values
      ('tour-des-hauts-plateaux','stage_race','standard'),('tour-voisin','stage_race','standard');

    -- Model the existing clone's upsert of stage segments and its final hook call.
    create function private.apply_s5_hybrid_calendar(uuid) returns void language plpgsql as $$
    begin
      null;
    end;
    $$;
    create function public.provision_season_race_calendar(p_source_season_id uuid,p_target_season_id uuid)
    returns void language plpgsql as $$
    begin
      insert into public.stage_segments (stage_id, segment_number, distance_km, terrain_type, surface_type, average_gradient_pct)
      select target.id, x.segment_number, x.distance_km, x.terrain_type, x.surface_type, x.average_gradient_pct
      from public.race_editions source_edition
      join public.race_editions target_edition on target_edition.race_id=source_edition.race_id
      join public.stages source on source.race_edition_id=source_edition.id
      join public.stages target on target.race_edition_id=target_edition.id and target.stage_number=source.stage_number
      join public.stage_segments x on x.stage_id=source.id
      where source_edition.season_id=p_source_season_id and target_edition.season_id=p_target_season_id
      on conflict (stage_id, segment_number) do update set distance_km=excluded.distance_km;
      perform private.apply_s5_hybrid_calendar(p_target_season_id);
    end;
    $$;
  `);

  const historic = await addStage(5, {editionStatus: 'completed', stageStatus: 'completed'});
  const future = await addStage(6);
  const otherStage = await addStage(6, {stageNumber: 2});
  const otherTour = await addStage(6, {slug: 'tour-voisin'});
  const frozen = await addStage(8);
  const withResults = await addStage(9);
  const redesigned = await addStage(10, {prefix: [[27, 'flat', 0], [25, 'flat', 0], ...route.slice(2)]});
  const completedSeason = await addStage(11);
  for (const stage of [historic, future]) {
    await addPrime(stage, canonicalPrimes[0]);
    await addPrime(stage, [3, 'mountain', '3', [2, 1]]);
    await addPrime(stage, [8, 'mountain', '2', [5, 3, 2, 1]]);
    await addPrime(stage, [17, 'mountain', '2', [5, 3, 2, 1]]);
  }
  await db.query('insert into official_stage_simulations values ($1), ($2)', [historic, frozen]);
  await db.query('insert into stage_results values ($1), ($2)', [historic, withResults]);

  const protectedStages = [historic, otherStage, otherTour, frozen, withResults, redesigned, completedSeason];
  const snapshots = new Map();
  for (const id of [future, ...protectedStages]) snapshots.set(id, await snapshot(id));
  assert.equal(snapshots.get(future).segments.reduce((km, segment) => km + segment.km, 0), 220);

  await db.exec(migration);
  const repaired = await snapshot(future);
  checkRoute(repaired, snapshots.get(future));
  assert.equal(repaired.primes[0].id, snapshots.get(future).primes[0].id);
  assert.equal(repaired.primes[1].id, snapshots.get(future).primes[2].id);
  for (const id of protectedStages) assert.deepEqual(await snapshot(id), snapshots.get(id));

  const next = await addStage(7, {editionStatus: 'registration_closed'});
  const nextBefore = await snapshot(next);
  await db.query(`
    select public.provision_season_race_calendar(s.id, t.id)
    from seasons s cross join seasons t where s.game_year=5 and t.game_year=7
  `);
  const nextAfter = await snapshot(next);
  checkRoute(nextAfter, nextBefore);

  await db.exec(migration);
  assert.deepEqual(await snapshot(future), repaired, 'the backfill is idempotent');
  assert.deepEqual(await snapshot(next), nextAfter, 'the hook preserves the repaired route on rerun');
  const [hook] = await rows(`
    select pg_get_functiondef('public.provision_season_race_calendar(uuid,uuid)'::regprocedure) as definition
  `);
  assert.equal(hook.definition.match(/perform private\.repair_hauts_plateaux_opening_route\(/g)?.length, 1);
  assert.ok(hook.definition.indexOf('perform private.apply_s5_hybrid_calendar') < hook.definition.indexOf('perform private.repair_hauts_plateaux_opening_route'));
  console.log('Hauts Plateaux course migration passed in isolated PGlite.');
} finally {
  await db.close();
}
