// Applies only the reviewed private S5 manifest swap. No fixture or lineup write.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
if (process.argv.length === 3 && mode === '--help') {
  console.log('Usage: node <absolute-script-path> --inspect | --apply-reviewed-fix\nPrivate S5 manifest only; no lineup, reward or gameplay RPC is executed.');
  process.exit(0);
}
if (process.argv.length !== 3 || !['--inspect', '--apply-reviewed-fix'].includes(mode)) throw Error('An explicit exact mode is required.');
if (readFileSync(path.resolve('supabase/.temp/project-ref'), 'utf8').trim() !== 'ikagfuchasnsakpouosg') throw Error('Unexpected linked project; no SQL sent.');
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
const version = '20261121124531';
const name = 'swap_private_s5_gala_sprint_and_cobbles';
const sql = readFileSync(path.join(root, `supabase/migrations/${version}_${name}.sql`), 'utf8').replaceAll('\r\n', '\n');
const sha256 = createHash('sha256').update(sql).digest('hex');
const sourceMd5 = createHash('md5').update(sql).digest('hex');
const expectedSha256 = '7abb5a881c4d410af6f2bb8bf444183e496006a60531d88cca0f5f928d3abf72';
if (sha256 !== expectedSha256 || !sql.startsWith('begin;') || !/commit;\s*$/.test(sql)
  || !sql.includes("set local lock_timeout = '1s'") || !sql.includes("set local statement_timeout = '10s'")
  || !sql.includes("set local application_name = 'cyclostratege-gala-s5-profile-swap-20261121'")) throw Error('Reviewed source or bounds changed; no SQL sent.');
const artifactDirectory = path.join(root, 'artifacts/gala-s5-profile-swap-20261121');
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const rowsOf = values => values.map(value => `(${quote(value)})`).join(',');
const protectedFunctions = [
  'public.get_current_season_four_gala_context()', 'public.save_current_season_four_gala_registration(text,jsonb)',
  'public.withdraw_current_season_four_gala_registration()', 'public.save_current_season_four_gala_course(text,text,uuid[])',
  'public.change_current_season_four_gala_program(text,text)', 'public.get_current_season_five_gala_context()',
  'public.save_current_season_five_gala_registration(text,jsonb,text)', 'public.withdraw_current_season_five_gala_registration()',
];
let queryNumber = 0;
function query(statement, label) {
  mkdirSync(artifactDirectory, { recursive: true });
  const file = path.join(artifactDirectory, `${String(queryNumber++).padStart(2, '0')}-${label}.sql`);
  writeFileSync(file, statement, 'utf8');
  let raw;
  try {
    raw = execFileSync(binary, ['db', 'query', '--linked', '--file', file, '--output', 'json'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 25000, maxBuffer: 100000,
    });
  } catch (error) {
    throw Error(`SQL command failed (${error.code ?? error.status ?? 'unknown'}). Stop before retrying and verify that the task-owned transaction ended. ${String(error.stderr ?? '').slice(0, 1000)}`);
  }
  const start = raw.indexOf('{');
  if (start < 0) throw Error('Unexpected SQL response; stop before retrying.');
  const response = JSON.parse(raw.slice(start));
  if (!Array.isArray(response.rows)) throw Error('Unexpected SQL response rows; stop before retrying.');
  return response.rows;
}
const bounded = body => `begin read only;
set local statement_timeout = '3s'; set local lock_timeout = '500ms';
set local application_name = 'cyclostratege-gala-s5-swap-inspect-20261121';
${body}; commit;`;
function inspect(label) {
  return query(bounded(`with edition as (
    select e.* from public.season_gala_editions e join public.seasons s on s.id=e.source_season_id and s.game_year=5
  ) select 1 database_ok,
    exists(select 1 from supabase_migrations.schema_migrations where version=${quote(version)}) recorded,
    (select md5(statements[1]) from supabase_migrations.schema_migrations where version=${quote(version)}) recorded_hash,
    (select md5(statements[1]) from supabase_migrations.schema_migrations where version='20261121121547') installed_registration_hash,
    (select count(*)::int from edition where visibility='private' and status='open' and target_game_year=6
      and registration_closes_at=timestamptz '2026-12-04 12:00 Europe/Paris') correct_private_editions,
    (select count(*)::int from public.season_gala_events event join edition e on e.id=event.edition_id) event_count,
    (select count(*)::int from public.season_gala_events event join edition e on e.id=event.edition_id
      where event_key in('pt-flanders','ct-hamburg')) old_keys,
    (select count(*)::int from public.season_gala_events event join edition e on e.id=event.edition_id
      where (event_key,program,position,pcm_race_id,pcm_stage_id,stage_file,startlist_filename) in(
        ('ct-flanders','continental',3,11,1011,'topclas_rondevv_2024.cds','topclas_rondevv.xml'),
        ('pt-hamburg','pro-tour',3,26,1026,'topclas_hamburg_2023.cds','topclas_hamburg.xml'))) new_keys,
    (select md5(coalesce(string_agg(to_jsonb(event)::text,'|' order by event_key),''))
      from public.season_gala_events event join edition e on e.id=event.edition_id
      where event_key in('pt-zoncolan','pt-liege','ct-alpe','ct-fleche')) untouched_course_hash,
    (select md5(coalesce(string_agg((to_jsonb(event)-'event_key'-'program')::text,'|' order by pcm_race_id),''))
      from public.season_gala_events event join edition e on e.id=event.edition_id where pcm_race_id in(11,26)) moved_course_metadata_hash,
    (select count(*)::int from public.season_gala_entry_riders roster join edition e on e.id=roster.edition_id
      where event_key in('pt-flanders','ct-hamburg')) old_target_lineups,
    (select count(*)::int from public.season_gala_entries entry join edition e on e.id=entry.edition_id) registration_count,
    (select count(*)::int from public.season_gala_entry_admissions admission join public.season_gala_entries entry on entry.id=admission.entry_id
      join edition e on e.id=entry.edition_id) admission_count,
    (select count(*)::int from public.season_gala_entry_riders roster join edition e on e.id=roster.edition_id) lineup_count,
    (select count(distinct pcm_race_id)::int from public.season_gala_events event join edition e on e.id=event.edition_id) distinct_pcm_races,
    (select count(distinct startlist_filename)::int from public.season_gala_events event join edition e on e.id=event.edition_id) distinct_startlists,
    (select bool_and(to_regprocedure(signature) is not null) from (values ${rowsOf(protectedFunctions)}) functions(signature)) protected_functions_present,
    (select jsonb_object_agg(signature,md5(pg_get_functiondef(to_regprocedure(signature))))
      from (values ${rowsOf(protectedFunctions)}) functions(signature)) protected_function_hashes,
    (select count(*)::int from public.season_gala_registrations where season_id=(select id from public.seasons where game_year=4)) s4_registration_count`), label)[0];
}

const before = inspect('before');
if (before.database_ok !== 1 || before.installed_registration_hash !== '178aa966ab403982795a7108c2f2d9b9'
  || before.correct_private_editions !== 1 || before.event_count !== 6 || !before.protected_functions_present
  || before.distinct_pcm_races !== 6 || before.distinct_startlists !== 6 || before.old_target_lineups !== 0) {
  throw Error('Preflight failed or affected lineups exist; no migration applied.');
}
if (before.recorded && before.recorded_hash !== sourceMd5) throw Error('Recorded migration differs; do not replay or edit history.');
if (!((before.old_keys === 2 && before.new_keys === 0) || (before.old_keys === 0 && before.new_keys === 2))) throw Error('Unexpected mixed manifest; stop for review.');
if (mode === '--inspect') { console.log(JSON.stringify({ migration: version, sha256, sourceMd5, ...before })); process.exit(0); }
if (!before.recorded) query(sql.replace(/commit;\s*$/, () => `insert into supabase_migrations.schema_migrations(version,name,statements)
values(${quote(version)},${quote(name)},array[${quote(sql)}]);
commit;`), 'reviewed-install');
const after = inspect('after');
if (!after.recorded || after.recorded_hash !== sourceMd5 || after.old_keys !== 0 || after.new_keys !== 2
  || after.correct_private_editions !== 1 || after.event_count !== 6 || after.distinct_pcm_races !== 6 || after.distinct_startlists !== 6
  || after.untouched_course_hash !== before.untouched_course_hash || after.moved_course_metadata_hash !== before.moved_course_metadata_hash
  || after.registration_count !== before.registration_count || after.admission_count !== before.admission_count || after.lineup_count !== before.lineup_count
  || after.s4_registration_count !== before.s4_registration_count
  || JSON.stringify(after.protected_function_hashes) !== JSON.stringify(before.protected_function_hashes)) {
  throw Error('Unexpected swap receipt; stop before application deployment. No lineup correction was attempted.');
}
const receipt = { migration: version, sha256, sourceMd5, alreadyRecorded: before.recorded, ...after };
writeFileSync(path.join(artifactDirectory, 'deployment-receipt.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(receipt));
