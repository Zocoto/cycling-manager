// Applies only this reviewed additive migration, never outstanding migrations.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const mode = process.argv[2];
assert(['--inspect', '--apply'].includes(mode), 'Choose --inspect or --apply.');
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'ikagfuchasnsakpouosg');
const version = '20261030100000';
const name = 'add_empty_team_roster_recovery';
const source = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8');
const hash = value => createHash('md5').update(value).digest('hex');
const quote = value => `'${value.replaceAll("'", "''")}'`;
const require = createRequire(import.meta.url);
const binary = join(require.resolve('@supabase/cli-windows-x64/package.json'), '..', 'bin', 'supabase.exe');
function query(sql) {
  const directory = mkdtempSync(join(tmpdir(), 'empty-roster-reviewed-'));
  const file = join(directory, 'query.sql');
  try {
    writeFileSync(file, sql);
    const output = execFileSync(binary, ['db', 'query', '--linked', '--file', file, '--output', 'json'], {
      encoding: 'utf8', timeout: 30000, maxBuffer: 200000,
    });
    assert(output.includes('{'), 'No database receipt; inspect before retrying.');
    return JSON.parse(output.slice(output.indexOf('{'))).rows;
  } finally {
    // Only the two locally created exact paths are removed; no recursive delete.
    rmSync(file, { force: true });
    rmdirSync(directory);
  }
}
function inspect() {
  return query(`begin read only;
    set local application_name='empty-roster-reviewed-receipt-20261030';
    set local statement_timeout='3s'; set local lock_timeout='500ms';
    select true as database_ok,
      (select md5(statements[1]) from supabase_migrations.schema_migrations where version=${quote(version)}) as recorded_hash,
      pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure) as assistant_definition,
      (select jsonb_build_object('acl',proacl::text,'definer',prosecdef,'config',proconfig)
        from pg_proc where oid='public.get_current_dashboard_assistant_summary()'::regprocedure) as assistant_attributes,
      to_regclass('private.empty_team_roster_recoveries') is not null as receipt_exists,
      coalesce((select relrowsecurity from pg_class where oid=to_regclass('private.empty_team_roster_recoveries')),false) as receipt_rls,
      (select jsonb_object_agg(oid::regprocedure::text,jsonb_build_object(
        'definer',prosecdef,'safe_path',proconfig @> array['search_path=""'],
        'anonymous',has_function_privilege('anon',oid,'execute'),
        'authenticated',has_function_privilege('authenticated',oid,'execute')))
        from pg_proc where oid in(
          to_regprocedure('public.get_current_empty_roster_recovery_state()'),
          to_regprocedure('public.recover_current_empty_team_roster(jsonb,uuid)'),
          to_regprocedure('private.can_recover_empty_team_roster(uuid,uuid,uuid)'))) as functions;
    commit;`)[0];
}
const before = inspect();
assert(before.database_ok);
if (before.recorded_hash) assert.equal(before.recorded_hash, hash(source), 'Recorded migration differs.');
const summary = row => ({ database_ok: row.database_ok, recorded: Boolean(row.recorded_hash),
  receipt_rls: row.receipt_rls, functions: row.functions, assistant_hash: hash(row.assistant_definition) });
function verifyInstalled(row) {
  assert(row.database_ok && row.receipt_exists && row.receipt_rls);
  assert.equal(Object.keys(row.functions).length, 3);
  for (const [signature, attributes] of Object.entries(row.functions)) {
    assert(attributes.definer && attributes.safe_path && !attributes.anonymous);
    // regprocedure omits public when it is already on the session search path.
    assert.equal(attributes.authenticated, !signature.startsWith('private.'));
  }
}
if (mode === '--inspect') {
  console.log(JSON.stringify(summary(before)));
  process.exit(0);
}
if (!before.recorded_hash) {
  assert.equal(before.receipt_exists, false, 'Unrecorded recovery table exists: stop.');
  assert.equal(before.functions, null, 'Unrecorded recovery functions exist: stop.');
  const anchor = source.match(/v_anchor constant text := \$anchor\$([\s\S]*?)\$anchor\$/)?.[1];
  const replacement = source.match(/\$replacement\$([\s\S]*?)\$replacement\$/)?.[1];
  assert(anchor && replacement);
  assert.equal(before.assistant_definition.split(anchor).length, 2);
  query(source.replace(/commit;\s*$/, () => `insert into supabase_migrations.schema_migrations(version,name,statements)
    values(${quote(version)},${quote(name)},array[${quote(source)}]);\ncommit;`));
  const after = inspect();
  assert.equal(after.recorded_hash, hash(source));
  assert.equal(after.assistant_definition, before.assistant_definition.replace(anchor, replacement));
  assert.deepEqual(after.assistant_attributes, before.assistant_attributes);
  verifyInstalled(after);
  console.log(JSON.stringify({ ...summary(after), existing_assistant_preserved: true }));
} else {
  verifyInstalled(before);
  console.log(JSON.stringify({ ...summary(before), already_applied: true }));
}
