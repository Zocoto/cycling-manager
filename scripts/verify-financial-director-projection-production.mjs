// STRICTLY READ-ONLY. One bounded query, no gameplay RPC, fixture or retry.
// Run only after review: node scripts/verify-financial-director-projection-production.mjs --verify
// --check-query validates the local evidence and SQL shape without a connection.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const PROJECT_REF = 'ikagfuchasnsakpouosg';
const TEAM_SEASON_ID = '7d5c4dd7-a21c-4559-b431-0a30d3462329';
const APPLICATION_NAME = 'df-projection-live-verify';
const mode = process.argv[2];
assert.ok(['--verify', '--check-query'].includes(mode), 'Use --check-query (offline) or --verify (one read-only query).');
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), PROJECT_REF, 'Unexpected linked project.');
const canonical = value => value.replaceAll('\r', '');
const hash = value => createHash('md5').update(value).digest('hex');
const signature = value => value.startsWith('private.') || value.startsWith('public.') ? value : `public.${value}`;
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const baseline = JSON.parse(readFileSync('artifacts/.tmp-financial-director-projection/consistency-functions.json', 'utf8').replace(/^\uFEFF/u, ''));
assert.equal(baseline.length, 5, 'Five reviewed caller/payout baselines are required.');
const bySignature = new Map(baseline.map(row => [signature(row.signature), row]));
const purchaseSignature = 'public.get_current_team_purchase_financial_risk(numeric)';
const restockSignature = 'private.restock_fan_club_shop(uuid,integer)';
const helperSignature = 'private.get_team_financial_director_projection(uuid)';
const rpcSignature = 'public.get_current_team_financial_director_projection()';
const payoutSignatures = [
  'public.settle_due_financial_director_income()',
  'private.credit_financial_director_salary_savings()',
  'private.credit_financial_director_transaction_bonus()',
];
for (const name of [purchaseSignature, restockSignature, ...payoutSignatures]) {
  const row = bySignature.get(name);
  assert.ok(row && /^[a-f0-9]{32}$/u.test(row.definition_hash), `Missing reviewed baseline: ${name}`);
  assert.equal(hash(row.definition), row.definition_hash, `Baseline digest mismatch: ${name}`);
}
assert.equal(baseline.flatMap(row => row.triggers ?? []).length, 2, 'Both payout-trigger baselines are required.');

// Compute the exact expected caller definitions from the reviewed migration.
// This also proves that nothing outside its two anchored additions is changed.
const patches = [...canonical(readFileSync('supabase/migrations/20261021121000_align_df_purchase_projection.sql', 'utf8'))
  .matchAll(/\$old\$([\s\S]*?)\$old\$,\s*\$new\$([\s\S]*?)\$new\$/gu)];
assert.equal(patches.length, 2, 'Unexpected reviewed patch layout.');
const expectedCallerHashes = new Map([purchaseSignature, restockSignature].map((name, index) => {
  const source = canonical(bySignature.get(name).definition);
  const [, anchor, replacement] = patches[index];
  assert.equal(source.split(anchor).length, 2, `Caller anchor drift: ${name}`);
  return [name, hash(source.replace(anchor, replacement))];
}));
const configuredApiSchemas = JSON.parse(readFileSync('supabase/config.toml', 'utf8')
  .match(/\[api\][\s\S]*?^schemas\s*=\s*(\[[^\n]+\])/mu)?.[1] ?? 'null');
assert.ok(Array.isArray(configuredApiSchemas) && !configuredApiSchemas.includes('private'), 'Private schema must not be configured for the API.');

const allSignatures = [...bySignature.keys(), helperSignature, rpcSignature];
const sql = `begin isolation level repeatable read read only;
set local application_name = '${APPLICATION_NAME}';
set local statement_timeout = '4s';
set local lock_timeout = '500ms';
with team_before as materialized (
  select ts.id, ts.cash_balance, ts.opening_cash_balance, ts.status,
    s.current_day_number, s.status as season_status
  from public.team_seasons ts join public.seasons s on s.id = ts.season_id
  where ts.id = '${TEAM_SEASON_ID}'::uuid
), ledger_before as materialized (
  select count(*)::integer as entries,
    coalesce(sum(tx.amount), 0) as checksum_amount,
    coalesce(sum(tx.amount) filter(where tx.status <> 'cancelled'), 0) as net_projection,
    coalesce(sum(-tx.amount) filter(where tx.amount < 0 and tx.status <> 'cancelled'), 0) as gross_expenses
  from public.team_finance_transactions tx where tx.team_season_id = '${TEAM_SEASON_ID}'::uuid
), forecast as materialized (
  select f.* from team_before t
  cross join lateral private.get_team_financial_director_projection(t.id) f
), forecast_summary as materialized (
  select count(*)::integer as entries, coalesce(sum(f.amount), 0) as total,
    count(*) - count(distinct f.source_reference) as duplicate_references,
    count(*) filter(where f.amount <= 0 or f.amount::text in ('NaN', 'Infinity', '-Infinity')) as invalid_amounts,
    count(*) filter(where f.day_number not between 1 and 28
      or f.day_number < (select current_day_number from team_before)
      or (f.effect = 'daily_income' and f.day_number <= (select current_day_number from team_before))) as invalid_days,
    count(*) filter(where exists(select 1 from public.team_finance_transactions tx
      where tx.team_season_id = '${TEAM_SEASON_ID}'::uuid and tx.source_reference = f.source_reference)) as ledger_collisions
  from forecast f
), effect_summary as (
  select f.effect, count(*)::integer as entries, sum(f.amount) as amount,
    min(f.day_number) as first_day, max(f.day_number) as last_day,
    min(f.bonus_percentage) as min_bonus_percentage, max(f.bonus_percentage) as max_bonus_percentage
  from forecast f group by f.effect
), team_after as materialized (
  select ts.cash_balance from public.team_seasons ts cross join forecast_summary checked
  where ts.id = '${TEAM_SEASON_ID}'::uuid and checked.entries >= 0
), ledger_after as materialized (
  select count(*)::integer as entries, coalesce(sum(tx.amount), 0) as checksum_amount
  from public.team_finance_transactions tx cross join forecast_summary checked
  where tx.team_season_id = '${TEAM_SEASON_ID}'::uuid and checked.entries >= 0
), functions as (
  select p.* from pg_catalog.pg_proc p
  where p.oid in (${allSignatures.map(name => `${literal(name)}::regprocedure`).join(', ')})
)
select jsonb_build_object(
  'read_only', current_setting('transaction_read_only') = 'on',
  'application_name', current_setting('application_name'),
  'statement_timeout', current_setting('statement_timeout'),
  'team', (select jsonb_build_object(
    'current_day', t.current_day_number, 'active', t.status = 'active' and t.season_status = 'active',
    'cash_before', t.cash_balance, 'cash_after', (select cash_balance from team_after),
    'gross_expenses', l.gross_expenses, 'ledger_entries_before', l.entries,
    'ledger_entries_after', (select entries from ledger_after),
    'ledger_checksum_before', l.checksum_amount, 'ledger_checksum_after', (select checksum_amount from ledger_after),
    'gross_projection', round(t.opening_cash_balance + l.net_projection, 2),
    'director_forecast', f.total, 'projection_with_director', round(t.opening_cash_balance + l.net_projection + f.total, 2)
  ) from team_before t cross join ledger_before l cross join forecast_summary f),
  'forecast_checks', (select to_jsonb(f) from forecast_summary f),
  'effects', coalesce((select jsonb_agg(to_jsonb(e) order by e.effect) from effect_summary e), '[]'::jsonb),
  'functions', (select jsonb_agg(jsonb_build_object(
    'signature', p.oid::regprocedure::text, 'owner', p.proowner::regrole::text, 'acl', p.proacl::text,
    'definition_hash', md5(pg_catalog.pg_get_functiondef(p.oid)),
    'canonical_hash', md5(replace(pg_catalog.pg_get_functiondef(p.oid), chr(13), '')),
    'language', (select lanname from pg_catalog.pg_language where oid = p.prolang),
    'security_definer', p.prosecdef, 'volatility', p.provolatile, 'configuration', p.proconfig,
    'argument_count', p.pronargs,
    'public_execute', exists(select 1 from pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
      where a.grantee = 0 and a.privilege_type = 'EXECUTE'),
    'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
    'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
    'service_execute', has_function_privilege('service_role', p.oid, 'EXECUTE'),
    'triggers', coalesce((select jsonb_agg(jsonb_build_object('name', t.tgname,
      'enabled', t.tgenabled, 'definition', pg_catalog.pg_get_triggerdef(t.oid)) order by t.tgname)
      from pg_catalog.pg_trigger t where t.tgfoid = p.oid and not t.tgisinternal), '[]'::jsonb)
  ) order by p.oid::regprocedure::text) from functions p),
  'api_schema_settings', coalesce((select jsonb_agg(setting order by setting)
    from (select unnest(setconfig) as setting from pg_catalog.pg_db_role_setting) settings
    where setting like 'pgrst.db_schemas=%'), '[]'::jsonb),
  'session_api_schema_setting', nullif(current_setting('pgrst.db_schemas', true), '')
) as verification;
commit;`;

assert.equal((sql.match(/private\.get_team_financial_director_projection\(t\.id\)/gu) ?? []).length, 1);
assert.ok(!/\b(?:insert|update|delete|call|do|truncate|alter|create|drop|grant|revoke)\s/iu.test(sql), 'Unexpected SQL mutation keyword.');
if (mode === '--check-query') {
  console.log(JSON.stringify({ offlineOnly: true, linkedProjectChecked: true, baselineFunctions: baseline.length,
    forecastCalls: 1, statementTimeout: '4s', queries: 1, sqlBytes: Buffer.byteLength(sql), productionQueryExecuted: false }));
  process.exit(0);
}

const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
let raw;
try {
  raw = execFileSync(binary, ['db', 'query', '--linked', sql, '--output', 'json'],
    { encoding: 'utf8', timeout: 20000, maxBuffer: 100000, stdio: ['ignore', 'pipe', 'pipe'] });
} catch (error) {
  console.error(JSON.stringify({ ok: false, applicationName: APPLICATION_NAME,
    error: 'Read-only verification failed. Verify that this task-owned database session ended before retrying.',
    exitStatus: error.status ?? null, timeout: error.code === 'ETIMEDOUT' }));
  process.exit(1);
}
const rows = JSON.parse(raw.slice(raw.indexOf('{'))).rows;
assert.equal(rows.length, 1, 'Incomplete read-only verification result.');
const result = rows[0].verification;
assert.equal(result.read_only, true, 'Transaction must be read-only.');
assert.equal(result.application_name, APPLICATION_NAME);
assert.equal(result.statement_timeout, '4s');
assert.ok(result.team?.active, 'The exact Fra Team season must still be active.');
assert.equal(result.team.cash_after, result.team.cash_before, 'Forecast changed cash.');
assert.equal(result.team.ledger_entries_after, result.team.ledger_entries_before, 'Forecast changed ledger entries.');
assert.equal(result.team.ledger_checksum_after, result.team.ledger_checksum_before, 'Forecast changed ledger amounts.');
for (const name of ['duplicate_references', 'invalid_amounts', 'invalid_days', 'ledger_collisions']) {
  assert.equal(Number(result.forecast_checks[name]), 0, `Invalid forecast: ${name}`);
}
assert.equal(result.functions.length, allSignatures.length, 'Missing installed functions.');
const installed = new Map(result.functions.map(row => [signature(row.signature), row]));
for (const old of baseline) {
  const name = signature(old.signature);
  const actual = installed.get(name);
  assert.equal(actual.owner, old.owner, `Owner drift: ${name}`);
  assert.equal(actual.acl, old.acl, `Permission drift: ${name}`);
  assert.deepEqual(actual.triggers, old.triggers ?? [], `Payout trigger drift: ${name}`);
  if (expectedCallerHashes.has(name)) {
    assert.equal(actual.canonical_hash, expectedCallerHashes.get(name), `Unexpected caller patch: ${name}`);
  } else {
    assert.equal(actual.definition_hash, old.definition_hash, `Payout changed: ${name}`);
  }
}
for (const name of [helperSignature, rpcSignature]) {
  const actual = installed.get(name);
  assert.equal(actual.owner, bySignature.get(purchaseSignature).owner, `Unexpected projection owner: ${name}`);
  assert.equal(actual.security_definer, true, `Projection must resolve ownership internally: ${name}`);
  assert.equal(actual.volatility, 's', `Projection must be STABLE: ${name}`);
  assert.ok(actual.configuration?.includes('search_path=""'), `Projection search_path must be empty: ${name}`);
  assert.equal(actual.public_execute, false, `PUBLIC exposure: ${name}`);
  assert.equal(actual.anon_execute, false, `Anonymous exposure: ${name}`);
}
const helper = installed.get(helperSignature);
const rpc = installed.get(rpcSignature);
assert.equal(helper.argument_count, 1);
assert.equal(helper.language, 'sql');
assert.equal(helper.authenticated_execute, false, 'Private helper exposed to players.');
assert.equal(helper.service_execute, false, 'Private helper exposed directly to API service role.');
assert.equal(rpc.argument_count, 0, 'Public RPC must not accept a team selector.');
assert.equal(rpc.authenticated_execute, true);
assert.equal(rpc.service_execute, true);
for (const setting of [...result.api_schema_settings, result.session_api_schema_setting].filter(Boolean)) {
  const value = setting.includes('=') ? setting.slice(setting.indexOf('=') + 1) : setting;
  assert.ok(!value.split(',').map(part => part.trim()).includes('private'), 'Private schema is explicitly exposed by server settings.');
}
console.log(JSON.stringify({ ok: true, readOnly: true, boundedToOneTeamSeason: true, queries: 1,
  statementTimeout: result.statement_timeout, cashUnchanged: true, ledgerUnchanged: true,
  payoutFunctionsAndTriggersUnchanged: true, callerPermissionsPreserved: true, privateHelperDirectAccess: false,
  privateSchemaListedInAvailableServerSettings: false, serverApiSchemaSettingsAvailable: result.api_schema_settings.length > 0 || !!result.session_api_schema_setting,
  currentDay: result.team.current_day, cashBalance: result.team.cash_before,
  grossExpenses: result.team.gross_expenses, grossProjection: result.team.gross_projection,
  directorForecast: result.team.director_forecast, projectionWithDirector: result.team.projection_with_director,
  effects: result.effects, productionFixtures: false }));
