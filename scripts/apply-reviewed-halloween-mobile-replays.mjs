// Production operation only. No fixtures, games played, or unrelated migrations.
// Run from the existing linked checkout, after explicit deployment approval.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
const version = '20261009110000';
const name = 'halloween_mobile_replays';
const file = fileURLToPath(new URL(`../supabase/migrations/${version}_${name}.sql`, import.meta.url));
const mode = process.argv[2];
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'ikagfuchasnsakpouosg'
    || !['--apply-reviewed-fix', '--grant-after-ui-live'].includes(mode)) {
  throw new Error('Expected linked project and explicit operation flag required.');
}
const literal = value => "'" + value.replaceAll("'", "''") + "'";
function query(sql, isFile = false) {
  let raw;
  try {
    raw = execFileSync(binary, ['db', 'query', '--linked', ...(isFile ? ['--file', sql] : [sql]), '--output', 'json'],
      { encoding: 'utf8', maxBuffer: 100000, timeout: 60000 });
  } catch (error) { throw new Error(String(error.stderr ?? error.code ?? 'Query failed').slice(0, 1500)); }
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
const status = query(`begin read only; set local statement_timeout='5s';
  select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
    to_regclass('public.halloween_mobile_replays') is not null
      and to_regprocedure('public.grant_halloween_mobile_replays(timestamp with time zone)') is not null
      and position('halloween_mobile_replays' in pg_get_functiondef('public.halloween_action(uuid,uuid,text,jsonb)'::regprocedure))>0
      and position('replayAvailable' in pg_get_functiondef('public.get_current_halloween_state()'::regprocedure))>0 installed;
  commit;`)[0];

if (mode === '--apply-reviewed-fix') {
  if (!status.recorded) {
    const sql = readFileSync(file, 'utf8');
    if (!/commit;\s*$/.test(sql)) throw new Error('Reviewed migration must end with COMMIT.');
    if (!status.installed) query(file, true);
    const receipt = query(`begin; set local lock_timeout='3s'; set local statement_timeout='5s';
      insert into supabase_migrations.schema_migrations(version,name,statements)
      values('${version}','${name}',array[${literal(sql)}]::text[]) returning version; commit;`);
    if (receipt[0]?.version !== version) throw new Error('Inspect migration receipt before retrying.');
  } else if (!status.installed) throw new Error('Recorded migration has an inconsistent installed state.');
  console.log(JSON.stringify({ migration: version, installed: true, granted: false }));
} else {
  const cutoff = process.argv[3];
  if (!status.recorded || !status.installed) throw new Error('Reviewed migration must be installed and recorded first.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(cutoff ?? '') || !Number.isFinite(Date.parse(cutoff))) {
    throw new Error('Pass the verified production deployment cutoff as an ISO UTC timestamp.');
  }
  const operation = readFileSync(new URL('../supabase/operations/grant_halloween_mobile_replays.sql', import.meta.url), 'utf8');
  if (operation.split('__HALLOWEEN_UI_CUTOFF__').length !== 2) throw new Error('Reviewed cutoff marker changed.');
  const receipt = query(operation.replace('__HALLOWEEN_UI_CUTOFF__', literal(cutoff)));
  console.log(JSON.stringify(receipt[0]?.receipt));
}
