// Only the reviewed validation migration is applied. Never execute gameplay
// fixtures, preparation saves, simulations or a broad migration push here.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const mode = process.argv[2];
assert(process.argv.length === 3 && ['--inspect', '--apply-reviewed-fix'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'ikagfuchasnsakpouosg');
const version = '20261027190000';
const name = 'validate_effective_race_attack_segments';
const source = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8').replaceAll('\r\n', '\n');
assert(source.startsWith('begin;') && /commit;\s*$/.test(source));
assert(source.includes("set local lock_timeout = '3s'") && source.includes("set local statement_timeout = '8s'"));
assert(source.includes("set local application_name = 'cyclostratege-effective-attack-segments-20261027'"));
const hash = value => createHash('md5').update(value).digest('hex');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
function query(sql) {
  const output = execFileSync(binary, ['db', 'query', '--linked', sql, '--output', 'json'], {
    encoding: 'utf8', timeout: 30000, maxBuffer: 100000,
  });
  const start = output.indexOf('{');
  assert(start >= 0, 'Missing database receipt; inspect before retrying.');
  return JSON.parse(output.slice(start)).rows;
}
function patchLiteral(key) {
  const expression = source.match(new RegExp(`${key} constant text :=([\\s\\S]*?);`))?.[1];
  assert(expression, `Missing reviewed ${key} fragment.`);
  return expression.split(/\s*\|\|\s*/).map(part => {
    part = part.trim();
    if (part === 'chr(10)') return '\n';
    assert(/^'(?:[^']|'')*'$/.test(part), 'Unexpected patch expression.');
    return part.slice(1, -1).replaceAll("''", "'");
  }).join('');
}
const oldFragment = patchLiteral('v_old');
const newFragment = patchLiteral('v_new');
const canonical = 'public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)';
const helper = 'private.is_effective_race_attack_segment_available(uuid,integer)';
function inspect() {
  return query(`begin read only;
    set local application_name='effective-attack-segments-receipt-20261027';
    set local statement_timeout='3s'; set local lock_timeout='500ms';
    select true as database_ok,
      (select md5(statements[1]) from supabase_migrations.schema_migrations where version=${quote(version)}) as recorded_hash,
      pg_get_functiondef(${quote(canonical)}::regprocedure) as canonical_definition,
      (select jsonb_build_object('acl',proacl::text,'definer',prosecdef,'config',proconfig)
       from pg_proc where oid=${quote(canonical)}::regprocedure) as canonical_attributes,
      (select jsonb_object_agg(oid::regprocedure::text,md5(pg_get_functiondef(oid))) from pg_proc
       where oid in(to_regprocedure('public.save_current_team_race_preparation_with_sprint(uuid,uuid,jsonb,jsonb)'),
         to_regprocedure('public.save_national_federation_race_preparation(text,uuid,uuid,jsonb,jsonb)'),
         to_regprocedure('public.save_national_federation_race_preparation_with_sprint(text,uuid,uuid,jsonb,jsonb)'),
         to_regprocedure('public.save_current_team_time_trial_preparation(uuid,uuid,jsonb)'))) as protected_functions,
      (select md5(string_agg(concat_ws(':',segment.id,segment.segment_number,segment.distance_km,
         segment.terrain_type,segment.surface_type,segment.average_gradient_pct),'|' order by segment.segment_number))
       from public.stage_segments segment where segment.stage_id='8855a85c-467b-4e8c-9535-cd59e97a9e3d') as incident_route_hash,
      coalesce((select prosecdef and proconfig @> array['search_path=""']
        and not has_function_privilege('anon',oid,'execute')
        and not has_function_privilege('authenticated',oid,'execute')
        and has_function_privilege('service_role',oid,'execute')
       from pg_proc where oid=to_regprocedure(${quote(helper)})),false) as helper_ready;
    commit;`)[0];
}
const before = inspect();
assert(before.database_ok && Object.keys(before.protected_functions).length === 4);
if (before.recorded_hash) assert.equal(before.recorded_hash, hash(source), 'Recorded migration differs; stop.');
const expectedDefinition = before.canonical_definition.includes(oldFragment)
  ? before.canonical_definition.replace(oldFragment, newFragment) : before.canonical_definition;
assert.equal(expectedDefinition.split(oldFragment).length, 1);
assert.equal(expectedDefinition.split(newFragment).length, 2);
if (mode === '--inspect') {
  console.log(JSON.stringify({database_ok:true, recorded:Boolean(before.recorded_hash), helper_ready:before.helper_ready,
    canonical_hash:hash(before.canonical_definition), protected_functions:before.protected_functions}));
  process.exit(0);
}
if (!before.recorded_hash) {
  query(source.replace(/commit;\s*$/, () => `insert into supabase_migrations.schema_migrations(version,name,statements)
    values(${quote(version)},${quote(name)},array[${quote(source)}]);\ncommit;`));
}
const after = inspect();
assert(after.database_ok && after.helper_ready);
assert.equal(after.recorded_hash, hash(source));
assert.equal(after.canonical_definition, expectedDefinition, 'Unexpected change outside the reviewed validation fragment.');
assert.deepEqual(after.canonical_attributes, before.canonical_attributes);
assert.deepEqual(after.protected_functions, before.protected_functions);
assert.equal(after.incident_route_hash, before.incident_route_hash);
const effective = query(`begin read only;
  set local application_name='effective-attack-segments-course-check-20261027';
  set local statement_timeout='3s'; set local lock_timeout='500ms';
  select private.is_effective_race_attack_segment_available('8855a85c-467b-4e8c-9535-cd59e97a9e3d',20) as segment_20,
    private.is_effective_race_attack_segment_available('8855a85c-467b-4e8c-9535-cd59e97a9e3d',21) as segment_21,
    private.is_effective_race_attack_segment_available('8855a85c-467b-4e8c-9535-cd59e97a9e3d',22) as segment_22;
  commit;`)[0];
assert.deepEqual(effective, {segment_20:true,segment_21:true,segment_22:false});
console.log(JSON.stringify({migration:version, database_ok:true, helper_ready:true,
  canonical_hash:hash(after.canonical_definition), protected_functions_unchanged:true,
  route_unchanged:true, ...effective}));
