// Apply this reviewed function replacement only: no gameplay RPCs or fixtures.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
const version = '20261022203000';
const migration = `supabase/migrations/${version}_rebalance_time_trial_all_in.sql`;
const oldHash = '5140d253ae4f9e78ec1620cd55577a50';
const newHash = '9761a90a6c14e72e0cbe4c311129a3c7';
const mode = process.argv[2];
assert(['--verify', '--apply-reviewed-fix'].includes(mode), 'Use --verify or --apply-reviewed-fix');
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'ikagfuchasnsakpouosg', 'Unexpected linked project');
const call = (args, timeout = 15000) => execFileSync(binary, args, {encoding: 'utf8', timeout, maxBuffer: 20000});
const query = sql => {
  const raw = call(['db', 'query', '--linked', `begin read only; set local application_name='tt-effort-delivery-20261022'; set local statement_timeout='3s'; set local lock_timeout='500ms'; ${sql}; rollback;`, '--output', 'json']);
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows[0];
};
const inspect = () => query(`select 1 as database_ok,
  exists(select 1 from supabase_migrations.schema_migrations where version='${version}') as recorded,
  md5(pg_get_functiondef('public.calculate_prepared_stage_form_cost(uuid,uuid,numeric)'::regprocedure)) as prepared_hash,
  md5(pg_get_functiondef('public.calculate_stage_form_cost(uuid,numeric)'::regprocedure)) as base_hash,
  md5(pg_get_functiondef('public.settle_finished_race_conditions()'::regprocedure)) as settlement_hash,
  has_function_privilege('authenticated','public.calculate_prepared_stage_form_cost(uuid,uuid,numeric)','execute') as player_can_read,
  has_function_privilege('service_role','public.calculate_prepared_stage_form_cost(uuid,uuid,numeric)','execute') as service_can_read,
  has_function_privilege('anon','public.calculate_prepared_stage_form_cost(uuid,uuid,numeric)','execute') as anonymous_can_read,
  (select not prosecdef and provolatile='s' from pg_proc where oid='public.calculate_prepared_stage_form_cost(uuid,uuid,numeric)'::regprocedure) as stable_invoker`);
const unchangedCore = state => state.database_ok === 1
  && state.base_hash === '5ac4e8fad7a6d3c2435f667b1bad2e5f'
  && state.settlement_hash === 'e23eec541a0ffd4428200e7079d8230f'
  && state.player_can_read && state.service_can_read && !state.anonymous_can_read
  && state.stable_invoker;
const before = inspect();
if (mode === '--verify') {
  console.log(JSON.stringify(before));
} else {
  assert.match(newHash, /^[a-f0-9]{32}$/u, 'Missing isolated function fingerprint');
  assert(unchangedCore(before), `Core drift: ${JSON.stringify(before)}`);
  if (before.prepared_hash !== newHash) {
    assert(!before.recorded && before.prepared_hash === oldHash, 'Prepared function drift: review before applying');
    const source = readFileSync(migration, 'utf8');
    assert(/set local lock_timeout\s*=\s*'1s'/iu.test(source)
      && /set local statement_timeout\s*=\s*'5s'/iu.test(source), 'Migration must bound lock and statement waits');
    assert.doesNotMatch(source, /\b(?:update|delete|insert|truncate)\s+(?:into\s+|from\s+)?public\./iu);
    call(['db', 'query', '--linked', '--file', path.resolve(migration), '--output', 'json'], 20000);
  }
  const after = inspect();
  assert(unchangedCore(after) && after.prepared_hash === newHash, `Post-install mismatch: ${JSON.stringify(after)}`);
  if (!after.recorded) call(['migration', 'repair', version, '--status', 'applied', '--linked', '--yes']);
  const final = inspect();
  assert(unchangedCore(final) && final.prepared_hash === newHash && final.recorded, 'Final schema/history verification failed');
  console.log(JSON.stringify({version, ...final, productionFixtures: false, historicalFormRewritten: false}));
}
