// Exact reviewed correction only. No production fixture or gameplay replay.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
if (process.argv.length !== 3 || !['--inspect', '--apply-reviewed-fix'].includes(mode)) throw Error('Choose an explicit inspect or apply mode.');
if (readFileSync(path.resolve('supabase/.temp/project-ref'), 'utf8').trim() !== 'ikagfuchasnsakpouosg') throw Error('Unexpected linked project.');
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
const version = '20261127120000';
const name = 'relinquish_ineligible_champion_jerseys_on_nationality_change';
const sql = readFileSync(path.join(root, `supabase/migrations/${version}_${name}.sql`), 'utf8').replaceAll('\r\n', '\n');
const sha256 = createHash('sha256').update(sql).digest('hex');
const sourceMd5 = createHash('md5').update(sql).digest('hex');
const expectedSha256 = '0bbd6b5f76a624868a78fa1277391d3e5e711fe0c2a17ec6a61a4fb705ee1b72';
if (sha256 !== expectedSha256 || !sql.startsWith('begin;') || !/commit;\s*$/.test(sql)
  || !sql.includes("set local lock_timeout = '500ms'") || !sql.includes("set local statement_timeout = '8s'")) throw Error('Reviewed migration or limits changed; no SQL sent.');
const artifactDirectory = path.join(root, 'artifacts/champion-jersey-nationality-20261127');
const rider = '2856644f-3612-4e0a-ac73-44df175d4c11';
const affectedIds = ['b667cc74-2ac5-4b0c-a6c0-fee07a72a965', '22a862fd-e11c-4944-86e8-0dfba9303674'];
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
let queryNumber = 0;
function query(statement, label) {
  mkdirSync(artifactDirectory, { recursive: true });
  const file = path.join(artifactDirectory, `${queryNumber++}-${label}.sql`);
  writeFileSync(file, statement, 'utf8');
  let raw;
  try {
    raw = execFileSync(binary, ['db', 'query', '--linked', '--file', file, '--output', 'json'], {
      encoding: 'utf8', timeout: 25000, maxBuffer: 30000,
    });
  } catch (error) {
    throw Error(`SQL did not finish normally. Verify the task-owned transaction before retrying. ${String(error.stderr ?? error.message).slice(0, 900)}`);
  }
  const start = raw.indexOf('{');
  if (start < 0) throw Error('Missing SQL receipt.');
  const response = JSON.parse(raw.slice(start));
  if (!Array.isArray(response.rows)) throw Error('Invalid SQL receipt.');
  return response.rows;
}
function inspect(label) {
  return query(`begin read only;
set local statement_timeout = '3s'; set local lock_timeout = '500ms';
set local application_name = 'cyclostratege-champion-country-inspect-20261127';
select 1 as database_ok,
  (select country_id::text from public.riders where id=${quote(rider)}::uuid) current_country_id,
  (select count(*)::int from public.rider_national_championship_titles where rider_id=${quote(rider)}::uuid) historical_title_count,
  (select md5(coalesce(string_agg((to_jsonb(t)-'relinquished_at')::text,'|' order by t.id),'')) from public.rider_national_championship_titles t where t.rider_id=${quote(rider)}::uuid) historical_identity_hash,
  (select md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by t.id),'')) from public.rider_national_championship_titles t where t.rider_id=${quote(rider)}::uuid and t.id not in (${affectedIds.map(id => quote(id) + '::uuid').join(',')})) other_title_hash,
  (select count(*)::int from public.rider_national_championship_titles where id in (${affectedIds.map(id => quote(id) + '::uuid').join(',')}) and relinquished_at is null) target_active_titles,
  (select count(*)::int from public.rider_national_championship_titles t join public.riders r on r.id=t.rider_id join public.countries c on c.id=r.country_id
    where t.relinquished_at is null and ((t.championship_type in ('road','time_trial') and t.country_id is distinct from r.country_id)
      or (t.championship_type ~ '^continental_(africa|america|asia|europe|oceania)_(road|time_trial)$' and split_part(t.championship_type,'_',2) is distinct from c.continent_code))) incompatible_active_titles,
  exists(select 1 from supabase_migrations.schema_migrations where version=${quote(version)}) recorded,
  (select md5(statements[1]) from supabase_migrations.schema_migrations where version=${quote(version)}) recorded_hash,
  (select count(*)::int from pg_trigger where not tgisinternal and tgname in ('guard_champion_jersey_eligibility','relinquish_ineligible_champion_jerseys_on_country_change')) guard_trigger_count;
commit;`, label)[0];
}
const before = inspect('before');
if (before.database_ok !== 1 || before.current_country_id !== 'f8733a8a-2a87-4179-a04c-98ee7955644a' || before.historical_title_count !== 5
  || before.incompatible_active_titles > 2) throw Error('Unexpected case or repair scope; no migration applied.');
if (before.recorded && before.recorded_hash !== sourceMd5) throw Error('The migration version already contains different SQL; never overwrite its history.');
if (mode === '--inspect') { console.log(JSON.stringify({ migration: version, sha256, ...before })); process.exit(0); }
if (!before.recorded) {
  const installation = sql.replace('begin;', "begin;\nset local application_name = 'cyclostratege-champion-country-fix-20261127';")
    .replace(/commit;\s*$/, () => `insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(version)},${quote(name)},array[${quote(sql)}]);\ncommit;`);
  query(installation, 'reviewed-install');
}
const after = inspect('after');
if (!after.recorded || after.recorded_hash !== sourceMd5 || after.guard_trigger_count !== 2 || after.target_active_titles !== 0 || after.incompatible_active_titles !== 0
  || after.current_country_id !== before.current_country_id || after.historical_title_count !== before.historical_title_count
  || after.historical_identity_hash !== before.historical_identity_hash || after.other_title_hash !== before.other_title_hash) throw Error('Unexpected correction receipt; inspect before any further action.');
const receipt = { migration: version, sha256, alreadyRecorded: before.recorded, before, after };
writeFileSync(path.join(artifactDirectory, 'deployment-receipt.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(receipt));
