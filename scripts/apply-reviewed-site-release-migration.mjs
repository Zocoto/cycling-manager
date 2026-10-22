// Installs exactly the reviewed additive settings migration. Never changes the live label as a test.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';
const mode = process.argv[2];
if (process.argv.length !== 3 || !['--inspect', '--apply-reviewed-fix'].includes(mode)
  || readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'ikagfuchasnsakpouosg') throw Error('Exact mode and linked project required');
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
const version = '20261022230000', name = 'add_site_release_management';
const source = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8').replaceAll('\r\n', '\n');
if (!source.startsWith('begin;') || !source.includes("set local lock_timeout = '1s'") || !source.includes("set local statement_timeout = '5s'")
  || !source.includes("set local application_name = 'site-release-management-20261022'") || !/commit;\s*$/.test(source)) throw Error('Migration bounds changed');
const quote = text => "'" + text.replaceAll("'", "''") + "'";
const hash = createHash('md5').update(source).digest('hex');
const run = sql => {
  mkdirSync('artifacts/site-release-20261022', { recursive: true });
  const file = path.resolve('artifacts/site-release-20261022/reviewed-command.sql');
  writeFileSync(file, sql);
  let raw;
  try { raw = execFileSync(binary, ['db', 'query', '--linked', '--file', file, '--output', 'json'], { encoding: 'utf8', timeout: 20000, maxBuffer: 100000 }); }
  catch (error) { throw Error(`Bounded database command failed: ${error.status ?? error.code}; ${String(error.stderr ?? '').slice(0, 1000)}`); }
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
};
const read = sql => run(`begin read only;set local statement_timeout='4s';set local lock_timeout='500ms';
set local application_name='site-release-install-diagnostic-20261022';${sql};commit;`);
function inspect() {
  return read(`select 1 database_ok,
    exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
    (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') recorded_hash,
    to_regclass('private.site_release_settings') is not null settings_exists,
    to_regprocedure('private.current_game_role()') is not null role_dependency,
    (select count(*)::int from private.user_game_roles where role='owner' and revoked_at is null) owner_count,
    (select jsonb_object_agg(signature,fingerprint) from (select oid::regprocedure::text signature,md5(pg_get_functiondef(oid)) fingerprint
      from pg_proc where oid in(to_regprocedure('public.save_game_news_draft(uuid,integer,jsonb)'),
        to_regprocedure('public.publish_game_news(uuid,integer)'),to_regprocedure('public.get_game_news_editor(uuid)'),
        to_regprocedure('public.get_current_user_game_role()'),to_regprocedure('public.get_current_game_header_indicators_v3()'))) untouched) unchanged_functions`)[0];
}
const before = inspect();
if (mode === '--inspect') { console.log(JSON.stringify(before)); process.exit(0); }
if (before.database_ok !== 1 || !before.role_dependency || before.owner_count !== 1 || Object.keys(before.unchanged_functions ?? {}).length !== 5) throw Error('Dependencies or health not verified');
if (before.recorded && before.recorded_hash !== hash) throw Error('Migration receipt differs; never replay');
if (!before.recorded && before.settings_exists) throw Error('Unrecorded settings schema; manual reconciliation required');
if (!before.recorded) run(source.replace(/commit;\s*$/, () => `insert into supabase_migrations.schema_migrations(version,name,statements)
values(${quote(version)},${quote(name)},array[${quote(source)}]);\ncommit;`));
const after = inspect();
const feature = read(`select current.version,current.revision,
  (select count(*)::int from private.site_release_settings) settings_count,
  exists(select 1 from private.site_release_events where revision=current.revision and version=current.version) current_history_consistent,
  has_function_privilege('anon','public.get_active_site_release()','execute') public_reader,
  not has_function_privilege('anon','public.set_active_site_release(text,text,integer)','execute') anonymous_write_denied,
  not has_function_privilege('service_role','public.set_active_site_release(text,text,integer)','execute') service_write_denied,
  not has_table_privilege('authenticated','private.site_release_settings','update') direct_update_denied,
  not has_table_privilege('authenticated','private.site_release_events','select') direct_history_denied,
  (select count(*)::int from pg_class where oid in('private.site_release_settings'::regclass,'private.site_release_events'::regclass) and relrowsecurity) rls_tables
from public.get_active_site_release() current`)[0];
if (!after.recorded || after.recorded_hash !== hash || JSON.stringify(before.unchanged_functions) !== JSON.stringify(after.unchanged_functions)
  || feature.settings_count !== 1 || !feature.current_history_consistent || !feature.public_reader || !feature.anonymous_write_denied
  || !feature.service_write_denied || !feature.direct_update_denied || !feature.direct_history_denied || feature.rls_tables !== 2) throw Error('Receipt verification failed; stop before app deployment');
const receipt = { migration: version, sha256: createHash('sha256').update(source).digest('hex'), ...after, ...feature, gameplayWrites: 0, testMutations: 0 };
writeFileSync('artifacts/site-release-20261022/installation-receipt.json', JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
