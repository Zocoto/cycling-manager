// Apply only the reviewed function and migration receipt; never run player mutations here.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const mode = process.argv[2];
assert.ok(process.argv.length === 3 && ['--inspect', '--apply-reviewed', '--verify'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'ikagfuchasnsakpouosg');
const version = '20261105180000', name = 'batch_team_squad_statuses';
const sql = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8').replaceAll('\r\n', '\n');
assert.equal(createHash('sha256').update(sql).digest('hex'), '84e69fc707e23a4b8177ea8f5468999a738d3fc8c8871247c9bcbce5b774fcf7');
const folder = 'artifacts/batch-team-squad-statuses-20261105';
mkdirSync(folder, { recursive: true });
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
function call(args) {
  return execFileSync(binary, args, { encoding: 'utf8', timeout: 25000, maxBuffer: 150000 });
}
function inspect() {
  const raw = call(['db', 'query', '--linked', `begin read only;
    set local statement_timeout='3s';set local lock_timeout='500ms';
    set local application_name='squad_statuses_delivery';
    select md5(pg_get_functiondef('public.set_current_team_rider_squad_status(uuid,text)'::regprocedure)) legacy_hash,
      (select proacl::text from pg_proc where oid='public.set_current_team_rider_squad_status(uuid,text)'::regprocedure) legacy_acl,
      (select indisunique and indisvalid from pg_index where indexrelid='public.rider_contracts_one_active_per_rider_idx'::regclass) unique_active_contract,
      (select name from supabase_migrations.schema_migrations where version='${version}' limit 1) receipt,
      p.oid is not null installed, p.prosecdef security_definer, p.proconfig settings,
      case when p.oid is not null then has_function_privilege('authenticated',p.oid,'execute') end authenticated,
      case when p.oid is not null then has_function_privilege('anon',p.oid,'execute') end anon,
      case when p.oid is not null then has_function_privilege('service_role',p.oid,'execute') end service_role
    from (select to_regprocedure('public.set_current_team_rider_squad_statuses(jsonb)') oid) lookup
    left join pg_proc p on p.oid=lookup.oid;commit;`, '--output', 'json']);
  const row = JSON.parse(raw.slice(raw.indexOf('{'))).rows[0];
  assert.ok(row.legacy_hash && row.unique_active_contract);
  return row;
}
const before = inspect();
if (mode === '--inspect') {
  writeFileSync(`${folder}/before.json`, JSON.stringify(before, null, 2));
  console.log(JSON.stringify(before));
} else {
  const baseline = JSON.parse(readFileSync(`${folder}/before.json`, 'utf8'));
  if (mode === '--apply-reviewed' && !before.installed) {
    assert.equal(before.receipt, null);
    const file = `${folder}/apply-reviewed.sql`;
    const receipt = `insert into supabase_migrations.schema_migrations(version,name,statements)
      values('${version}','${name}',array['${sql.replaceAll("'", "''")}']::text[]);\ncommit;`;
    assert.ok(sql.endsWith('commit;\n'));
    writeFileSync(file, sql.slice(0, -'commit;\n'.length) + receipt);
    call(['db', 'query', '--linked', '--file', file, '--output', 'json']);
  }
  const after = inspect();
  assert.equal(after.legacy_hash, baseline.legacy_hash);
  assert.equal(after.legacy_acl, baseline.legacy_acl);
  assert.equal(after.receipt, name);
  assert.ok(after.installed && after.security_definer && after.authenticated);
  assert.equal(after.anon, false);
  assert.equal(after.service_role, false);
  assert.deepEqual(after.settings, ['search_path=""', 'statement_timeout=3s', 'lock_timeout=500ms']);
  writeFileSync(`${folder}/${mode.slice(2)}.json`, JSON.stringify(after, null, 2));
  console.log(JSON.stringify({ ...after, legacyUnchanged: true, gameplayMutationRun: false }));
}
