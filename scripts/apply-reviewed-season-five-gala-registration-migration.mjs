// Applies exactly one reviewed DDL migration, never a registration or fixture.
// Run from the linked production checkout; source/artifacts resolve from here.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
if (process.argv.length === 3 && mode === '--help') {
  console.log('Usage: node <absolute-script-path> --inspect | --apply-reviewed-fix\nRun from the checkout linked to ikagfuchasnsakpouosg. No fixtures or gameplay RPCs are executed.');
  process.exit(0);
}
if (process.argv.length !== 3 || !['--inspect', '--apply-reviewed-fix'].includes(mode)) {
  throw Error('An exact explicit mode is required: --inspect or --apply-reviewed-fix.');
}
const linkedProject = readFileSync(path.resolve('supabase/.temp/project-ref'), 'utf8').trim();
if (linkedProject !== 'ikagfuchasnsakpouosg') throw Error('Unexpected linked project; no SQL sent.');

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
const version = '20261121121547';
const name = 'wire_season_five_gala_registrations';
const expectedSha256 = '4ad766e7e37dc9d895b7be448a3c9ae246c3cc0fda5c5dc625b01ee67b893187';
const sql = readFileSync(path.join(root, `supabase/migrations/${version}_${name}.sql`), 'utf8').replaceAll('\r\n', '\n');
const sha256 = createHash('sha256').update(sql).digest('hex');
const sourceMd5 = createHash('md5').update(sql).digest('hex');
if (sha256 !== expectedSha256 || !sql.startsWith('begin;') || !/commit;\s*$/.test(sql)
  || !sql.includes("set local lock_timeout = '1s'")
  || !sql.includes("set local statement_timeout = '10s'")
  || !sql.includes("set local application_name = 'cyclostratege-gala-s5-registration-20261121'")) {
  throw Error('The reviewed migration source or bounds changed; no SQL sent.');
}

const artifactDirectory = path.join(root, 'artifacts/gala-s5-registration-20261121');
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const featureTables = [
  'public.season_gala_editions', 'public.season_gala_events', 'public.season_gala_entries',
  'public.season_gala_entry_admissions', 'public.season_gala_entry_riders',
];
const publicFunctions = [
  'public.get_current_season_five_gala_context()',
  'public.save_current_season_five_gala_registration(text,jsonb,text)',
  'public.withdraw_current_season_five_gala_registration()',
];
const oldFunctions = [
  'public.get_current_season_four_gala_context()',
  'public.save_current_season_four_gala_registration(text,jsonb)',
  'public.withdraw_current_season_four_gala_registration()',
  'public.save_current_season_four_gala_course(text,text,uuid[])',
  'public.change_current_season_four_gala_program(text,text)',
];
const rowsOf = values => values.map(value => `(${quote(value)})`).join(',');
let queryNumber = 0;
function query(statement, label) {
  mkdirSync(artifactDirectory, { recursive: true });
  const file = path.join(artifactDirectory, `${String(queryNumber++).padStart(2, '0')}-${label}.sql`);
  writeFileSync(file, statement, 'utf8');
  let raw;
  try {
    raw = execFileSync(binary, ['db', 'query', '--linked', '--file', file, '--output', 'json'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 25000, maxBuffer: 160000,
    });
  } catch (error) {
    throw Error(`SQL command failed (${error.code ?? error.status ?? 'unknown'}). Stop before retrying and verify that the task-owned transaction has ended. ${String(error.stderr ?? '').slice(0, 1200)}`);
  }
  const jsonStart = raw.indexOf('{');
  if (jsonStart < 0) throw Error('Unrecognized database response; stop before retrying.');
  const response = JSON.parse(raw.slice(jsonStart));
  if (!Array.isArray(response.rows)) throw Error('Database response has no row array; stop before retrying.');
  return response.rows;
}
const bounded = body => `begin read only;
set local statement_timeout = '3s';
set local lock_timeout = '500ms';
set local application_name = 'cyclostratege-gala-s5-inspect-20261121';
${body};
commit;`;

function inspect(label) {
  return query(bounded(`select 1 database_ok,
    exists(select 1 from supabase_migrations.schema_migrations where version=${quote(version)}) recorded,
    (select md5(statements[1]) from supabase_migrations.schema_migrations where version=${quote(version)}) recorded_hash,
    (select count(*)::integer from public.seasons where game_year=5) source_season_count,
    (select status from public.seasons where game_year=5) source_season_status,
    (select count(*)::integer from (values ${rowsOf(featureTables)}) tables(signature) where to_regclass(signature) is not null) feature_table_count,
    (select bool_and(to_regprocedure(signature) is not null) from (values ${rowsOf(oldFunctions)}) functions(signature)) legacy_functions_present,
    (select jsonb_object_agg(signature,md5(pg_get_functiondef(to_regprocedure(signature))))
      from (values ${rowsOf(oldFunctions)}) functions(signature)) legacy_function_hashes,
    (select count(*)::integer from public.season_gala_registrations
      where season_id=(select id from public.seasons where game_year=4)) s4_registration_count`), label)[0];
}

function inspectFeature(label) {
  return query(bounded(`select
    (select count(*)::integer from public.season_gala_editions e join public.seasons s on s.id=e.source_season_id
      where s.game_year=5 and e.target_game_year=6 and e.status='open' and e.visibility='private'
        and e.registration_opens_at=timestamptz '2026-11-21 00:00 Europe/Paris'
        and e.registration_closes_at=timestamptz '2026-12-04 12:00 Europe/Paris') correct_private_s5_editions,
    (select count(*)::integer from public.season_gala_events event
      join public.season_gala_editions e on e.id=event.edition_id join public.seasons s on s.id=e.source_season_id and s.game_year=5) event_count,
    (select count(*)::integer from public.season_gala_events event
      join public.season_gala_editions e on e.id=event.edition_id join public.seasons s on s.id=e.source_season_id and s.game_year=5
      join (values
        ('pt-zoncolan','pro-tour',1,135,14135,'top_giro_14_2021.cds','top_giro.xml',23,8,8),
        ('pt-liege','pro-tour',2,87,1087,'topclas_lbl_2019.cds','topclas_lbl.xml',25,7,7),
        ('pt-flanders','pro-tour',3,11,1011,'topclas_rondevv_2024.cds','topclas_rondevv.xml',25,7,7),
        ('ct-alpe','continental',1,25,12025,'top_tdf_12_2022.cds','top_tdf.xml',23,7,8),
        ('ct-fleche','continental',2,15,1015,'topclas_fleche_2024.cds','topclas_fleche.xml',25,6,8),
        ('ct-hamburg','continental',3,26,1026,'topclas_hamburg_2023.cds','topclas_hamburg.xml',24,7,7)
      ) expected(event_key,program,position,pcm_race_id,pcm_stage_id,stage_file,startlist_filename,native_capacity,native_min_riders,native_max_riders)
      on (event.event_key,event.program,event.position,event.pcm_race_id,event.pcm_stage_id,event.stage_file,event.startlist_filename,
        event.native_capacity,event.native_min_riders,event.native_max_riders)
       =(expected.event_key,expected.program,expected.position,expected.pcm_race_id,expected.pcm_stage_id,expected.stage_file,expected.startlist_filename,
        expected.native_capacity,expected.native_min_riders,expected.native_max_riders)
      where event.min_riders=7 and event.max_riders=8) matching_verified_events,
    (select count(*)::integer from pg_class where oid in (select to_regclass(signature) from (values ${rowsOf(featureTables)}) tables(signature)) and relrowsecurity) rls_tables,
    (select bool_and(not has_table_privilege(role,signature,privilege)) from (values ${rowsOf(featureTables)}) tables(signature)
      cross join (values ('anon'),('authenticated')) roles(role)
      cross join (values ('select'),('insert'),('update'),('delete')) privileges(privilege)) raw_access_denied,
    (select bool_and(has_function_privilege('authenticated',signature,'execute') and not has_function_privilege('anon',signature,'execute'))
      from (values ${rowsOf(publicFunctions)}) functions(signature)) rpc_permissions_correct,
    (select bool_and(not has_function_privilege('authenticated',signature,'execute') and not has_function_privilege('anon',signature,'execute'))
      from (values ('private.current_season_five_gala_team()'),('private.season_five_gala_team_identity(uuid)'),
        ('private.season_five_gala_roster(uuid,uuid)'),('private.season_five_gala_can_access(uuid)')) functions(signature)) helpers_private,
    (select count(*)::integer from public.season_gala_entries entry join public.season_gala_editions e on e.id=entry.edition_id
      join public.seasons s on s.id=e.source_season_id and s.game_year=5) registration_count,
    (select count(*)::integer from public.season_gala_entry_admissions admission join public.season_gala_entries entry on entry.id=admission.entry_id
      join public.season_gala_editions e on e.id=entry.edition_id join public.seasons s on s.id=e.source_season_id and s.game_year=5) admission_count,
    (select count(*)::integer from public.season_gala_entry_riders roster join public.season_gala_editions e on e.id=roster.edition_id
      join public.seasons s on s.id=e.source_season_id and s.game_year=5) lineup_count`), label)[0];
}

const before = inspect('before');
if (before.database_ok !== 1 || before.source_season_count !== 1 || !['active', 'completed'].includes(before.source_season_status)
  || !before.legacy_functions_present) throw Error('Preflight dependency check failed; no migration applied.');
if (before.recorded && (before.recorded_hash !== sourceMd5 || before.feature_table_count !== 5)) {
  throw Error('Recorded migration differs from the reviewed source or has incomplete storage; do not replay.');
}
if (!before.recorded && before.feature_table_count !== 0) throw Error('Unrecorded feature tables already exist; stop for review.');

if (mode === '--inspect') {
  const feature = before.recorded ? inspectFeature('feature-inspection') : null;
  console.log(JSON.stringify({ migration: version, sha256, sourceMd5, ...before, feature }));
  process.exit(0);
}

if (!before.recorded) {
  // Callback replacement is intentional: preserve every PL/pgSQL $$ byte in
  // the stored source rather than expanding replacement-string dollar tokens.
  const install = sql.replace(/commit;\s*$/, () => `insert into supabase_migrations.schema_migrations(version,name,statements)
values(${quote(version)},${quote(name)},array[${quote(sql)}]);
commit;`);
  query(install, 'reviewed-install');
}
const after = inspect('after');
const feature = inspectFeature('feature-receipt');
if (!after.recorded || after.recorded_hash !== sourceMd5 || after.feature_table_count !== 5
  || JSON.stringify(before.legacy_function_hashes) !== JSON.stringify(after.legacy_function_hashes)
  || before.s4_registration_count !== after.s4_registration_count
  || feature.correct_private_s5_editions !== 1 || feature.event_count !== 6 || feature.matching_verified_events !== 6
  || feature.rls_tables !== 5 || !feature.raw_access_denied || !feature.rpc_permissions_correct || !feature.helpers_private
  || (!before.recorded && (feature.registration_count !== 0 || feature.admission_count !== 0 || feature.lineup_count !== 0))) {
  throw Error('Unexpected migration receipt; stop before application deployment. No fixture or correction was attempted.');
}
const receipt = { migration: version, sha256, sourceMd5, alreadyRecorded: before.recorded, ...after, ...feature };
mkdirSync(artifactDirectory, { recursive: true });
writeFileSync(path.join(artifactDirectory, 'deployment-receipt.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(receipt));
