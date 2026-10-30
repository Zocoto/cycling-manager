// Applies only the reviewed nutrition-affix migration; no gameplay fixtures.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';

const mode = process.argv[2];
assert(['--inspect', '--apply'].includes(mode), 'Choose --inspect or --apply.');
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'ikagfuchasnsakpouosg');
const version = '20261030120000', name = 'add_nutrition_weight_program_form_preservation';
const source = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8').replaceAll('\r\n', '\n');
const hash = value => createHash('md5').update(value).digest('hex');
const quote = value => `'${value.replaceAll("'", "''")}'`;
const require = createRequire(import.meta.url);
const binary = join(dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin', 'supabase.exe');
function query(sql) {
  const directory = mkdtempSync(join(tmpdir(), 'nutrition-affix-reviewed-'));
  const file = join(directory, 'query.sql');
  try {
    writeFileSync(file, sql);
    const output = execFileSync(binary, ['db', 'query', '--linked', '--file', file, '--output', 'json'], {
      encoding: 'utf8', timeout: 30000, maxBuffer: 200000,
    });
    assert(output.includes('{'), 'No database receipt; inspect before retrying.');
    return JSON.parse(output.slice(output.indexOf('{'))).rows;
  } finally {
    rmSync(file, { force: true }); rmdirSync(directory);
  }
}
const plan = 'public.apply_current_team_nutrition_plan(jsonb,jsonb)';
const preview = 'public.get_team_medical_staff_effective_quotes(uuid,uuid)';
function inspect() {
  return query(`begin read only;
    set local application_name='nutrition-affix-reviewed-receipt-20261030';
    set local statement_timeout='3s'; set local lock_timeout='500ms';
    select true as database_ok,
      (select md5(statements[1]) from supabase_migrations.schema_migrations where version=${quote(version)}) as recorded_hash,
      (select jsonb_object_agg(oid::regprocedure::text,jsonb_build_object('definition',replace(pg_get_functiondef(oid),chr(13),''),
        'acl',proacl::text,'definer',prosecdef,'config',proconfig))
        from pg_proc where oid in(${quote(plan)}::regprocedure,${quote(preview)}::regprocedure,
          'public.apply_current_team_weight_cut(uuid,numeric)'::regprocedure)) as existing_functions,
      (select jsonb_build_object('private',prosecdef and proconfig @> array['search_path=""']
        and not has_function_privilege('anon',oid,'execute') and not has_function_privilege('authenticated',oid,'execute')
        and not has_function_privilege('service_role',oid,'execute')) from pg_proc
        where oid=to_regprocedure('private.get_team_weight_program_form_preservation(uuid)')) as helper,
      (select jsonb_build_object('role',role,'minimum_level',minimum_level,'active',is_active)
        from public.staff_talent_catalog where code='nutrition_weight_program_form_preservation') as talent;
    commit;`)[0];
}
const find = (row, name) => Object.values(row.existing_functions).find(item => item.definition.includes(`FUNCTION public.${name}(`));
function verifyInstalled(row) {
  assert(row.database_ok && row.helper?.private);
  assert.deepEqual(row.talent, { role: 'nutritionist', minimum_level: 1, active: true });
  assert(find(row, 'apply_current_team_nutrition_plan').definition.includes('v_form_preservation_percentage'));
  assert(find(row, 'get_team_medical_staff_effective_quotes').definition.includes('weightProgramFormPreservationPercentage'));
}
const summarize = row => ({ database_ok: row.database_ok, recorded: Boolean(row.recorded_hash), helper: row.helper,
  talent: row.talent, function_hashes: Object.fromEntries(Object.entries(row.existing_functions).map(([key, value]) => [key, hash(value.definition)])) });
const before = inspect();
assert(before.database_ok);
if (before.recorded_hash) assert.equal(before.recorded_hash, hash(source), 'Recorded migration differs.');
if (mode === '--inspect') { console.log(JSON.stringify(summarize(before))); process.exit(0); }
if (!before.recorded_hash) {
  assert.equal(before.helper, null, 'Unrecorded helper exists; stop.');
  assert.equal(before.talent, null, 'Unrecorded talent exists; stop.');
  const fragment = tag => { const parts = source.split(`$${tag}$`); assert.equal(parts.length, 3); return parts[1]; };
  const expected = structuredClone(before.existing_functions);
  for (const item of Object.values(expected)) {
    const tags = item.definition.includes('FUNCTION public.apply_current_team_nutrition_plan(')
      ? ['declaration', 'loop', 'cost'] : item.definition.includes('FUNCTION public.get_team_medical_staff_effective_quotes(') ? ['preview'] : [];
    for (const tag of tags) {
      const old = fragment(`old_${tag}`), replacement = fragment(`new_${tag}`);
      assert.equal(item.definition.split(old).length, 2);
      item.definition = item.definition.replace(old, replacement);
    }
  }
  assert.equal(Object.keys(expected).length, 3);
  query(source.replace(/commit;\s*$/, () => `insert into supabase_migrations.schema_migrations(version,name,statements)
    values(${quote(version)},${quote(name)},array[${quote(source)}]);\ncommit;`));
  const after = inspect();
  verifyInstalled(after);
  assert.equal(after.recorded_hash, hash(source));
  assert.deepEqual(after.existing_functions, expected, 'Unexpected edits outside the reviewed function fragments.');
  console.log(JSON.stringify({ ...summarize(after), existing_permissions_and_wrapper_preserved: true }));
} else { verifyInstalled(before); console.log(JSON.stringify({ ...summarize(before), already_applied: true })); }
