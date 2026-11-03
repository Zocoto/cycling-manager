// Installs only the reviewed read-only reporting functions and supporting index.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';

const mode = process.argv[2];
if (process.argv.length !== 3 || !['--inspect', '--apply-reviewed-fix'].includes(mode)
  || readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'ikagfuchasnsakpouosg') {
  throw Error('Exact mode and linked project required');
}
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
const version = '20261103100000', name = 'daily_form_camp_reports';
const source = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8').replaceAll('\r\n', '\n');
if (!source.startsWith('begin;') || !source.includes("set local lock_timeout = '3s'")
  || !source.includes("set local statement_timeout = '15s'") || !/commit;\s*$/.test(source)
  || /\b(?:insert into|update public\.|delete from|perform public\.settle_)/i.test(source)) {
  throw Error('Reviewed reporting-only migration bounds changed');
}
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const md5 = createHash('md5').update(source).digest('hex');
const directory = 'artifacts/daily-form-camp-reports-20261103';
mkdirSync(directory, { recursive: true });
function run(sql) {
  const file = path.resolve(directory, 'reviewed-command.sql');
  writeFileSync(file, sql);
  let raw;
  try {
    raw = execFileSync(binary, ['db', 'query', '--linked', '--file', file, '--output', 'json'],
      { encoding: 'utf8', timeout: 25000, maxBuffer: 100000 });
  } catch (error) {
    throw Error(`Bounded database command failed: ${error.status ?? error.code}; ${String(error.stderr ?? '').slice(0, 1000)}`);
  }
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
const read = sql => run(`begin read only;
set local statement_timeout='4s';set local lock_timeout='500ms';
set local application_name='daily-form-camp-report-diagnostic-20261103';${sql};commit;`);
function inspect() {
  return read(`select 1 database_ok,
    exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
    (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') recorded_hash,
    to_regprocedure('public.get_current_team_daily_form_camp_report(integer)') is not null report_exists,
    to_regclass('public.rider_form_camps_daily_report_team_idx') is not null report_index_exists,
    (select md5(pg_get_functiondef('public.settle_current_health_and_form()'::regprocedure))) settlement_fingerprint,
    (select (length(definition)-length(replace(definition,'''equipmentPartnerSignatureAvailable'', (','')))
      /length('''equipmentPartnerSignatureAvailable'', (') from
      (select pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure) definition) fn) assistant_anchor_count,
    (select position('formCampReport' in pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure))>0) assistant_has_report`)[0];
}
const before = inspect();
if (mode === '--inspect') { console.log(JSON.stringify(before)); process.exit(0); }
if (before.database_ok !== 1 || !before.settlement_fingerprint) throw Error('Database health or dependency not verified');
if (before.recorded && before.recorded_hash !== md5) throw Error('Migration receipt differs; never replay');
if (!before.recorded && (before.report_exists || before.report_index_exists || before.assistant_has_report || before.assistant_anchor_count !== 1)) {
  throw Error('Unexpected database state; stop before migration');
}
if (!before.recorded) {
  run(source.replace(/commit;\s*$/, () => `insert into supabase_migrations.schema_migrations(version,name,statements)
values(${quote(version)},${quote(name)},array[${quote(source)}]);\ncommit;`));
}
const after = inspect();
const permissions = read(`select
  has_function_privilege('authenticated','public.get_current_team_daily_form_camp_report(integer)','execute') authenticated_reader,
  not has_function_privilege('anon','public.get_current_team_daily_form_camp_report(integer)','execute') anonymous_denied,
  not has_function_privilege('service_role','public.get_current_team_daily_form_camp_report(integer)','execute') service_role_denied,
  not has_function_privilege('authenticated','private.get_team_daily_form_camp_report(uuid,uuid)','execute') direct_team_access_denied,
  (select proconfig @> array['statement_timeout=3000ms'] from pg_proc
    where oid='public.get_current_team_daily_form_camp_report(integer)'::regprocedure) bounded_reader,
  public.get_current_team_daily_form_camp_report(null) is null unauthenticated_identity_empty`)[0];
if (!after.recorded || after.recorded_hash !== md5 || !after.report_exists || !after.report_index_exists || !after.assistant_has_report
  || before.settlement_fingerprint !== after.settlement_fingerprint || !Object.values(permissions).every(Boolean)) {
  throw Error('Receipt or reporting-only verification failed; stop before app deployment');
}
const receipt = { migration: version, sha256: createHash('sha256').update(source).digest('hex'), before, after, permissions,
  gameplayWrites: 0, testMutations: 0, appliedAt: new Date().toISOString() };
writeFileSync(`${directory}/installation-receipt.json`, JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
