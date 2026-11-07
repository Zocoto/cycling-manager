// Exercise both calendar RPCs in an isolated PostgreSQL instance.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2] ??
  'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js';
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const uuid = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const originalRpc = 'public.get_current_team_sponsor_objective_races()';
const calendarRpc = 'public.get_current_team_calendar_sponsor_objective_races()';

async function readAs(director, rpc) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    director === null ? '' : uuid(director),
  ]);
  await db.exec('set role authenticated');
  try {
    const result = await db.query(`select * from ${rpc} order by race_edition_id, 1`);
    return result.rows.map(({ race_edition_id, sponsor_role }) => {
      const edition = Number(race_edition_id.slice(-12));
      return sponsor_role ? `${edition}:${sponsor_role}` : edition;
    }).sort();
  } finally {
    await db.exec('reset role');
  }
}

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create function fixture_id(value integer) returns uuid language sql immutable as $$
      select ('00000000-0000-4000-8000-' || lpad(value::text, 12, '0'))::uuid;
    $$;
    create table sporting_directors(id uuid primary key, auth_user_id uuid, status text);
    create table team_manager_assignments(sporting_director_id uuid, team_id uuid, role text, status text);
    create table seasons(id uuid primary key, status text);
    create table race_editions(id uuid primary key, season_id uuid);
    create table team_sponsor_contracts(team_id uuid, sponsor_offer_id uuid, role text, status text);
    create table sponsor_objectives(id uuid primary key, sponsor_offer_id uuid, season_id uuid, objective_type text, status text);
    create table race_result_objectives(objective_id uuid, race_edition_id uuid);
    create table secondary_sponsor_contracts(offer_id uuid unique, team_id uuid, season_id uuid, status text, unique(team_id, season_id));
    create table secondary_sponsor_objectives(offer_id uuid, race_edition_id uuid, status text, unique(offer_id, race_edition_id));

    insert into sporting_directors values
      (fixture_id(1), fixture_id(51), 'active'),
      (fixture_id(2), fixture_id(52), 'active'),
      (fixture_id(3), fixture_id(53), 'inactive'),
      (fixture_id(4), fixture_id(54), 'active'),
      (fixture_id(5), fixture_id(55), 'active');
    insert into team_manager_assignments values
      (fixture_id(1), fixture_id(11), 'general_manager', 'active'),
      (fixture_id(2), fixture_id(12), 'general_manager', 'active'),
      (fixture_id(3), fixture_id(11), 'general_manager', 'active'),
      (fixture_id(4), fixture_id(11), 'general_manager', 'completed'),
      (fixture_id(5), fixture_id(11), 'assistant', 'active');
    insert into seasons values (fixture_id(21), 'active'), (fixture_id(22), 'planned');
    insert into race_editions
    select fixture_id(edition), fixture_id(21) from generate_series(101, 108) as edition;
    insert into race_editions values (fixture_id(109), fixture_id(22));

    insert into team_sponsor_contracts values (fixture_id(11), fixture_id(31), 'principal', 'active');
    insert into sponsor_objectives values
      (fixture_id(41), fixture_id(31), fixture_id(21), 'race_result', 'active'),
      (fixture_id(42), fixture_id(31), fixture_id(21), 'race_result', 'active');
    insert into race_result_objectives values
      (fixture_id(41), fixture_id(101)), (fixture_id(42), fixture_id(102));

    insert into secondary_sponsor_contracts values
      (fixture_id(61), fixture_id(11), fixture_id(21), 'active'),
      (fixture_id(62), fixture_id(12), fixture_id(21), 'active'),
      (fixture_id(63), fixture_id(11), fixture_id(22), 'active');
    insert into secondary_sponsor_objectives values
      (fixture_id(61), fixture_id(102), 'active'),
      (fixture_id(61), fixture_id(103), 'active'),
      (fixture_id(61), fixture_id(104), 'draft'),
      (fixture_id(61), fixture_id(105), 'achieved'),
      (fixture_id(61), fixture_id(106), 'failed'),
      (fixture_id(61), fixture_id(107), 'cancelled'),
      (fixture_id(61), fixture_id(109), 'active'),
      (fixture_id(62), fixture_id(108), 'active'),
      (fixture_id(63), fixture_id(107), 'active');
  `);

  const baseline = readFileSync(new URL(
    '../supabase/migrations/20260814150000_add_roster_aid_and_cash_based_recruitment.sql',
    import.meta.url,
  ), 'utf8');
  const legacySql = baseline.slice(
    baseline.indexOf(`create or replace function ${originalRpc}`),
    baseline.indexOf('-- The registration summary already returns rider nationality.'),
  );
  await db.exec(legacySql);
  const originalDefinition = `select pg_get_functiondef('${originalRpc}'::regprocedure) as definition`;
  const before = (await db.query(originalDefinition)).rows;
  assert.deepEqual(await readAs(51, originalRpc), [101, 102]);

  await db.exec(readFileSync(new URL(
    '../supabase/migrations/20261107103000_expose_calendar_secondary_sponsor_objectives.sql',
    import.meta.url,
  ), 'utf8'));

  assert.deepEqual((await db.query(originalDefinition)).rows, before, 'Legacy RPC must stay unchanged');
  assert.deepEqual(await readAs(51, originalRpc), [101, 102]);
  assert.deepEqual(await readAs(51, calendarRpc), [
    '101:principal', '102:principal', '102:secondary', '103:secondary',
  ]);
  assert.deepEqual(await readAs(52, calendarRpc), ['108:secondary']);
  for (const director of [53, 54, 55, 56, null]) {
    assert.deepEqual(await readAs(director, calendarRpc), [], `Unauthorized director ${director}`);
  }
  await db.exec("update secondary_sponsor_contracts set status = 'planned' where offer_id = fixture_id(61)");
  assert.deepEqual(await readAs(51, calendarRpc), ['101:principal', '102:principal']);

  const grants = await db.query(`
    select has_function_privilege('anon', '${calendarRpc}', 'execute') as anon,
           has_function_privilege('authenticated', '${calendarRpc}', 'execute') as authenticated
  `);
  assert.deepEqual(grants.rows, [{ anon: false, authenticated: true }]);

  console.log('Calendar sponsor RPC checks passed (principal, overlap, season, team, statuses and grants).');
} finally {
  await db.close();
}
