// Install only the reviewed read-only counter. No gameplay fixtures or mutations.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const mode = process.argv[2], linkedWorkdir = path.resolve(process.argv[3] ?? '.');
if (![3, 4].includes(process.argv.length) || !['--inspect', '--apply-reviewed'].includes(mode)
  || readFileSync(path.join(linkedWorkdir, 'supabase/.temp/project-ref'), 'utf8').trim() !== 'ikagfuchasnsakpouosg') throw Error('Exact mode and linked project required');
const version = '20261024120000', name = 'add_onboarding_country_director_counts';
const source = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8').replaceAll('\r\n', '\n');
const sha = createHash('sha256').update(source).digest('hex');
if (sha !== 'ac2e3993cc65a119e801f9e1bc35792f575875a42f56b3458664ec1dca9889a4') throw Error('Reviewed migration changed');
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
const directory = 'artifacts/onboarding-country-counts-20261024';
mkdirSync(directory, { recursive: true });
const quote = value => "'" + value.replaceAll("'", "''") + "'";
function run(sql) {
  const file = path.resolve(directory, 'reviewed-command.sql');
  writeFileSync(file, sql);
  const raw = execFileSync(binary, ['db', 'query', '--linked', '--workdir', linkedWorkdir, '--file', file, '--output', 'json'], { encoding: 'utf8', timeout: 20000, maxBuffer: 100000 });
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
function inspect() {
  return run(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';
    set local application_name='onboarding-country-counts-inspect';
    select 1 database_ok,
      (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') recorded_hash,
      (select name from supabase_migrations.schema_migrations where version='${version}') recorded_name,
      to_regprocedure('public.get_onboarding_country_director_counts()') is not null installed,
      to_regclass('public.alpha_bot_managers') is not null bots_available,
      (select jsonb_object_agg(signature,fingerprint) from (
        select oid::regprocedure::text signature,md5(pg_get_functiondef(oid)) fingerprint from pg_proc
        where pronamespace='public'::regnamespace and proname in ('initialize_sporting_director_career_v2','create_current_amateur_team','save_sporting_director_avatar_cosmetics')
      ) f) protected_functions;commit;`)[0];
}
const before = inspect();
if (mode === '--inspect') { console.log(JSON.stringify(before)); process.exit(0); }
const md5 = createHash('md5').update(source).digest('hex');
if (before.database_ok !== 1 || !before.bots_available || !before.protected_functions) throw Error('Prerequisites unavailable');
if (before.recorded_hash && (before.recorded_hash !== md5 || before.recorded_name !== name)) throw Error('Migration receipt mismatch');
if (!before.recorded_hash) {
  if (before.installed) throw Error('Unrecorded function already exists');
  run(source.replace(/commit;\s*$/, () => `insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(version)},${quote(name)},array[${quote(source)}]);\ncommit;`));
}
const after = inspect();
if (after.recorded_hash !== md5 || !after.installed || JSON.stringify(before.protected_functions) !== JSON.stringify(after.protected_functions)) throw Error('Migration verification failed');
const verification = run(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';
  set local application_name='onboarding-country-counts-verify';
  select count(*)::int playable_countries,sum(director_count)::int counted_directors,
    count(*) filter(where director_count=0)::int empty_countries,
    not has_function_privilege('anon','public.get_onboarding_country_director_counts()','execute') anonymous_denied,
    not has_function_privilege('authenticated','public.get_onboarding_country_director_counts()','execute') client_denied,
    has_function_privilege('service_role','public.get_onboarding_country_director_counts()','execute') server_allowed
  from public.get_onboarding_country_director_counts();commit;`)[0];
if (!verification.anonymous_denied || !verification.client_denied || !verification.server_allowed || !verification.playable_countries) throw Error('Counter verification failed');
const receipt = { migration: version, sha256: sha, ...after, ...verification, gameplayWrites: 0, productionFixtures: 0 };
writeFileSync(path.join(directory, 'migration-receipt.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
