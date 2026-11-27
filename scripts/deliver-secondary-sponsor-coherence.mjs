// Installs only the two reviewed sponsor fixes; never runs gameplay fixtures.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
if (process.argv.length !== 3 || !['--inspect', '--apply-reviewed'].includes(mode)) throw Error('Explicit inspect or reviewed apply mode required.');
if (readFileSync(path.resolve('supabase/.temp/project-ref'), 'utf8').trim() !== 'ikagfuchasnsakpouosg') throw Error('Unexpected linked project.');
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
const reviewed = [
  ['20261127180000', 'use_canonical_secondary_sponsor_library', '35a62b3b01e0a91a2448a5cfb80ed76be1f47d2b80824d1d58cbed5937dba91b'],
  ['20261127181000', 'guard_secondary_sponsor_jersey_season', '96dd65252b5aa19f63bf60204027eaa19d33d9a50f1b7e26cf647b67f0605a56'],
].map(([version, name, expected]) => {
  const sql = readFileSync(path.join(root, `supabase/migrations/${version}_${name}.sql`), 'utf8').replaceAll('\r\n', '\n');
  const sha256 = createHash('sha256').update(sql).digest('hex');
  if (sha256 !== expected || !sql.startsWith('begin;') || !/commit;\s*$/.test(sql)
    || !/set local lock_timeout\s*=\s*'500ms'/.test(sql) || !/set local statement_timeout\s*=\s*'8s'/.test(sql)) throw Error('Reviewed migration changed; no SQL sent.');
  return { version, name, sql, sha256, md5: createHash('md5').update(sql).digest('hex') };
});
const folder = path.join(root, 'artifacts/secondary-sponsor-coherence');
mkdirSync(folder, {recursive:true});
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
let number = 0;
function query(sql, label) {
  const file = path.join(folder, `${number++}-${label}.sql`);
  writeFileSync(file, sql);
  let raw;
  try {
    raw = execFileSync(binary, ['db','query','--linked','--file',file,'--output','json'], {encoding:'utf8', timeout:25000, maxBuffer:100000});
  } catch (error) {
    throw Error(`SQL did not finish normally; check this task's transaction before retrying. ${String(error.stderr ?? error.message).slice(0,1000)}`);
  }
  const result = JSON.parse(raw.slice(raw.indexOf('{')));
  if (!Array.isArray(result.rows)) throw Error('Invalid SQL receipt.');
  return result.rows;
}
function inspect(label) {
  return query(`begin read only;
set local statement_timeout='3s'; set local lock_timeout='500ms';
set local application_name='secondary-sponsor-coherence-inspect-20261127';
with agreements as (select * from public.secondary_sponsor_contracts where status in ('active','planned'))
select 1 database_ok,
  (select count(*)::int from agreements) signed_count,
  (select md5(coalesce(string_agg(to_jsonb(c)::text,'|' order by c.id),'')) from agreements c) contract_hash,
  (select md5(coalesce(string_agg(jsonb_build_array(s.id,s.catalog_key,s.country_id,s.name,s.prestige,s.primary_color,s.accent_color,s.logo_variant)::text,'|' order by s.id),'')) from public.secondary_sponsor_catalog s where s.id in(select secondary_sponsor_id from agreements)) signed_brand_hash,
  (select md5(coalesce(string_agg((to_jsonb(o)-'current_rider_count'-'best_rank'-'status'-'settled_at')::text,'|' order by o.id),'')) from public.secondary_sponsor_objectives o where o.offer_id in(select offer_id from agreements)) signed_objective_terms_hash,
  (select jsonb_object_agg(version,md5(statements[1])) from supabase_migrations.schema_migrations where version in (${reviewed.map(x=>quote(x.version)).join(',')})) receipts;
commit;`, label)[0];
}
const before = inspect('before');
if (before.database_ok !== 1) throw Error('Database unavailable.');
for (const migration of reviewed) {
  const installed = before.receipts?.[migration.version];
  if (installed && installed !== migration.md5) throw Error('Existing migration receipt differs; do not overwrite it.');
}
if (mode === '--inspect') { console.log(JSON.stringify({before, reviewed:reviewed.map(({version,sha256})=>({version,sha256}))})); process.exit(0); }
for (const migration of reviewed) if (!before.receipts?.[migration.version]) {
  const install = migration.sql.replace('begin;', "begin;\nset local application_name='secondary-sponsor-coherence-install-20261127';")
    .replace(/commit;\s*$/, () => `insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(migration.version)},${quote(migration.name)},array[${quote(migration.sql)}]);\ncommit;`);
  query(install, `install-${migration.version}`);
}
const after = inspect('after');
for (const field of ['signed_count','contract_hash','signed_brand_hash','signed_objective_terms_hash']) if (before[field] !== after[field]) throw Error('Signed agreement changed during delivery; inspect before proceeding: '+field);
for (const migration of reviewed) if (after.receipts?.[migration.version] !== migration.md5) throw Error('Migration not recorded correctly.');
const canonical = query(`begin read only;
set local statement_timeout='3s'; set local lock_timeout='500ms';
select 1 database_ok,count(*)::int canonical_count,count(*) filter(where s.available_for_offers)::int selectable_count,
count(*) filter(where s.country_id is distinct from p.country_id or s.name is distinct from p.name or s.catalog_key is distinct from 'library-'||p.catalog_key)::int inconsistent,
(select count(*)::int from public.secondary_sponsor_offers o join public.secondary_sponsor_catalog c on c.id=o.secondary_sponsor_id join public.seasons se on se.id=o.target_season_id where o.status='open' and se.status='planned' and c.source_sponsor_id is null)::int legacy_open_future
from public.secondary_sponsor_catalog s join public.sponsors p on p.id=s.source_sponsor_id;
commit;`, 'canonical')[0];
if (canonical.database_ok !== 1 || canonical.canonical_count < 500 || canonical.inconsistent !== 0 || canonical.legacy_open_future !== 0) throw Error('Canonical library verification failed.');
writeFileSync(path.join(folder,'deployment-receipt.json'),JSON.stringify({before,after,canonical,reviewed:reviewed.map(({version,sha256})=>({version,sha256}))},null,2)+'\n');
console.log(JSON.stringify({before,after,canonical}));
