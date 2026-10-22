// Disposable PostgreSQL/WASM only: no URL, credentials, network or live DB.
// The two real historical functions are loaded from versioned SQL. The test
// recreates the CRLF body verified in production so the exact MD5 guard runs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

if (process.argv.slice(2).some(argument => argument !== '--isolated')) {
  throw new Error('Only --isolated is accepted; external databases are forbidden.');
}
const modulePath = process.env.TIME_TRIAL_SQL_TEST_MODULE ?? resolve('artifacts/.tmp-performance-preparations/node_modules/@electric-sql/pglite/dist/index.js');
const {PGlite} = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const migration = readFileSync('supabase/migrations/20261022203000_rebalance_time_trial_all_in.sql', 'utf8');
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const RIDER = id(1);
const STAGE = id(2);
const REGISTRATION = id(3);
const CUTOFF = '2026-10-22 14:30:00+00';
let checks = 0;
const check = (actual, expected, message) => {assert.deepEqual(actual, expected, message); checks++;};
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const scalar = async (sql, params = []) => Object.values((await rows(sql, params))[0])[0];
const cost = async (recovery = 50, rider = RIDER) => Number(await scalar('select public.calculate_prepared_stage_form_cost($1,$2,$3)', [STAGE, rider, recovery]));
const oldCost = async (recovery = 50, rider = RIDER) => Number(await scalar('select public.fixture_original_prepared_cost($1,$2,$3)', [STAGE, rider, recovery]));
const baseCost = async (recovery = 50) => Number(await scalar('select public.calculate_stage_form_cost($1,$2)', [STAGE, recovery]));
const scaled = async (base, effort, relay = 1) => Number(await scalar('select round(greatest(1,$1::numeric*$2::numeric*$3::numeric),1)', [base, effort, relay]));

function historicalFunction(path, name) {
  const source = readFileSync(path, 'utf8');
  const start = source.search(new RegExp(`create (?:or replace )?function public\\.${name}\\(`, 'iu'));
  assert(start >= 0, `${name} historical definition missing`);
  const tail = source.slice(start);
  const opener = /\bas\s+(\$[a-z_]*\$)/iu.exec(tail);
  assert(opener, `${name} body delimiter missing`);
  const bodyStart = opener.index + opener[0].length;
  const bodyEnd = tail.indexOf(opener[1], bodyStart);
  assert(bodyEnd >= 0, `${name} body terminator missing`);
  const body = tail.slice(bodyStart, bodyEnd).replace(/\r?\n/gu, '\r\n');
  return `${tail.slice(0, bodyStart)}${body}${opener[1]};`;
}

async function fixture({type = 'individual_time_trial', profile = 'time_trial', distance = 40, effort = 'all_in', version = '2026.10-time-trial-effort-balance-v50', departure = CUTOFF, roster = 1, share = null, climbShare = 0, cobbles = false} = {}) {
  await db.exec('truncate public.stages, public.stage_segments, public.race_time_trial_rider_plans, public.official_stage_simulations');
  await db.query('insert into public.stages(id,stage_type,profile_type,distance_km,departure_at) values($1,$2,$3,$4,$5)', [STAGE, type, profile, distance, departure]);
  if (climbShare > 0 || cobbles) {
    await db.query('insert into public.stage_segments(stage_id,distance_km,terrain_type,surface_type) values($1,$2,$3,$4),($1,$5,$6,$4)', [STAGE, distance * climbShare, 'climb', cobbles ? 'cobbles' : 'asphalt', distance * (1 - climbShare), 'flat']);
  }
  if (effort !== null) {
    for (let number = 0; number < roster; number++) {
      await db.query('insert into public.race_time_trial_rider_plans values($1,$2,$3,$4,$5)', [REGISTRATION, STAGE, number === 0 ? RIDER : id(10 + number), effort, share]);
    }
  }
  if (version !== null) await db.query('insert into public.official_stage_simulations values($1,$2)', [STAGE, version]);
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.stages(id uuid primary key,stage_type text,profile_type text,distance_km numeric,departure_at timestamptz);
    create table public.stage_segments(stage_id uuid,distance_km numeric,terrain_type text,surface_type text);
    create index fixture_segments_stage_idx on public.stage_segments(stage_id);
    create table public.race_time_trial_rider_plans(race_registration_id uuid,stage_id uuid,rider_id uuid,effort_mode text,relay_share_pct numeric,primary key(race_registration_id,stage_id,rider_id));
    create index fixture_plans_stage_idx on public.race_time_trial_rider_plans(stage_id);
    create table public.official_stage_simulations(stage_id uuid primary key,engine_version text not null);
    create table public.stage_rider_condition_effects(stage_id uuid,rider_id uuid,form_delta numeric,form_before numeric,form_after numeric,primary key(stage_id,rider_id));
    create table public.rider_condition_states(rider_id uuid,form numeric,fatigue int);
    insert into public.stage_rider_condition_effects values('${id(90)}','${RIDER}',-6.8,75,68.2);
    insert into public.rider_condition_states values('${RIDER}',68.2,10);
  `);
  await db.exec(historicalFunction('supabase/migrations/20260801150000_rebalance_rider_form_management.sql', 'calculate_stage_form_cost'));
  await db.exec(historicalFunction('supabase/migrations/20260814160000_add_time_trial_race_preparations.sql', 'calculate_prepared_stage_form_cost'));
  await db.exec(`
    revoke all on function public.calculate_prepared_stage_form_cost(uuid,uuid,numeric) from public,anon;
    grant execute on function public.calculate_prepared_stage_form_cost(uuid,uuid,numeric) to authenticated,service_role;
  `);
  const original = await scalar("select pg_get_functiondef('public.calculate_prepared_stage_form_cost(uuid,uuid,numeric)'::regprocedure)");
  check(await scalar("select md5(pg_get_functiondef('public.calculate_prepared_stage_form_cost(uuid,uuid,numeric)'::regprocedure))"), '5140d253ae4f9e78ec1620cd55577a50', 'Exercise the actual reviewed production hash guard');
  await db.exec(original.replace('public.calculate_prepared_stage_form_cost(', 'public.fixture_original_prepared_cost('));
  const baseDefinition = await scalar("select pg_get_functiondef('public.calculate_stage_form_cost(uuid,numeric)'::regprocedure)");
  const acl = await rows("select proacl::text,proowner,prosecdef,provolatile,proconfig from pg_proc where oid='public.calculate_prepared_stage_form_cost(uuid,uuid,numeric)'::regprocedure");
  const historicalLedger = await rows('select * from public.stage_rider_condition_effects');
  const historicalState = await rows('select * from public.rider_condition_states');

  assert.doesNotMatch(migration, /\b(?:update|delete|insert|truncate)\s+(?:into\s+|from\s+)?public\./iu); checks++;
  assert.doesNotMatch(migration, /(?:create|alter|drop)\s+(?:or\s+replace\s+)?(?:table|function)\s+public\.(?:settle_finished|calculate_stage_form_cost)/iu); checks++;
  await db.exec(migration);
  check(await scalar("select pg_get_functiondef('public.calculate_stage_form_cost(uuid,numeric)'::regprocedure)"), baseDefinition, 'Base form formula is byte-for-byte unchanged');
  check(await rows("select proacl::text,proowner,prosecdef,provolatile,proconfig from pg_proc where oid='public.calculate_prepared_stage_form_cost(uuid,uuid,numeric)'::regprocedure"), acl, 'ACL, owner and invoker/stability mode preserved');
  check(await rows('select * from public.stage_rider_condition_effects'), historicalLedger, 'No historical cost or ledger row changed');
  check(await rows('select * from public.rider_condition_states'), historicalState, 'No historical form changed');

  // Full matrix: the two non-all-in modes remain identical to the actual old
  // function, including recovery clamps, distance bands, relief and rounding.
  for (const type of ['individual_time_trial', 'prologue', 'team_time_trial']) {
    for (const distance of [8, 20, 40, 60]) {
      for (const recovery of [-5, 0, 50, 100, 105, null]) {
        for (const effort of ['normal', 'conserve', null]) {
          await fixture({type, distance, effort, roster: type === 'team_time_trial' ? 4 : 1, share: type === 'team_time_trial' ? 25 : null});
          check(await cost(recovery), await oldCost(recovery), `${type}/${distance}/${recovery}/${effort} unchanged`);
        }
        await fixture({type, distance, roster: type === 'team_time_trial' ? 4 : 1, share: type === 'team_time_trial' ? 25 : null});
        check(await cost(recovery), await scaled(await baseCost(recovery), 2), `${type}/${distance}/${recovery} all-in costs twice normal`);
      }
    }
  }

  // An old locked engine always takes precedence over a later departure.
  for (const version of ['2026.10-explicit-missions-before-auto-leaders-v48', '2026.10-optional-ordered-sprint-trains-v49', 'legacy', '2026.10-v50-suffix', 'v50']) {
    await fixture({version, departure: '2027-01-01 14:00:00+00'});
    check(await cost(), await oldCost(), `${version} keeps the old locked cost`);
  }
  for (const version of ['2026.10-time-trial-effort-balance-v50', '2026.11-future-change-v51', '2099.01-future-v999999999999999999999999999']) {
    await fixture({version, departure: '2026-01-01 14:00:00+00'});
    check(await cost(), 10, `${version} retains the rebalance, independent of replay time`);
  }
  for (const [departure, expected] of [[null, 6.8], ['2026-10-22 14:29:59.999999+00', 6.8], [CUTOFF, 10], ['2026-10-23 12:00:00+00', 10]]) {
    await fixture({version: null, departure});
    check(await cost(), expected, `No-snapshot/CN cutoff ${departure}`);
  }

  // Team relay loads are unchanged, not applied twice or flattened by all-in.
  for (const share of [0, 5, 25, 50, 100]) {
    const relay = Math.max(0.55, Math.min(1.8, 0.65 + share * 4 / 100 * 0.35));
    for (const effort of ['conserve', 'normal', 'all_in']) {
      await fixture({type: 'team_time_trial', distance: 8, roster: 4, share, effort});
      check(await cost(100), await scaled(await baseCost(100), effort === 'all_in' ? 2 : effort === 'conserve' ? 0.7 : 1, relay), `TTT ${share}%/${effort} relay and minimum/rounding`);
      if (effort !== 'all_in') check(await cost(100), await oldCost(100));
    }
  }
  for (const climbShare of [0.09, 0.1, 0.249, 0.25, 1]) {
    await fixture({climbShare});
    check(await cost(), await scaled(await baseCost(), 2), `Climb share ${climbShare} preserves the base profile cost`);
  }
  for (const profile of ['flat', 'sprint', 'hilly', 'mountain', 'cobbles']) {
    await fixture({type: 'road', profile, distance: 230, cobbles: true});
    check(await cost(), await oldCost(), `${profile} road unchanged even with an all-in fixture plan`);
    check(await cost(), await baseCost(), `${profile} road bypasses TT effort`);
  }
  await fixture();
  check(await cost(50, id(999)), await baseCost(), 'Missing rider plan defaults to normal');
  await assert.rejects(() => db.query('select public.calculate_prepared_stage_form_cost($1,$2,50)', [id(999), RIDER]), /Étape introuvable/u); checks++;

  // Existing effects remain untouched after repeated reads of the new formula.
  check(await rows('select * from public.stage_rider_condition_effects'), historicalLedger);
  check(await rows('select * from public.rider_condition_states'), historicalState);

  // A second or stale application fails closed rather than overwriting changes.
  await assert.rejects(() => db.exec(migration), /calcul de forme CLM a changé/u); checks++;
  await db.exec('rollback');
  check(await cost(), 10, 'Failed replay leaves the reviewed new function intact');
  console.log(`PASS ${checks} isolated time-trial form SQL checks; no live database accessed.`);
} finally {
  await db.close();
}
