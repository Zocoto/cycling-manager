// Apply ONLY this reviewed fix. Gameplay DDL remains a single transaction.
// Record history separately to stay below Windows' command-line size limit;
// the committed function marker supports safe recovery of that small receipt.
// Do not use db push: unrelated historical migrations may be pending remotely.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
const reviewed = {
  '20261009070000': 'harden_automatic_season_rollover',
  '20261009080000': 'preserve_roster_tactics_on_academy_promotion',
  '20261009090000': 'finalize_nations_cup_rollover_and_budgets',
};
const version = process.argv[3] ?? '20261009070000';
const name = reviewed[version];
if (!name) throw new Error('Only explicitly reviewed rollover migrations are accepted.');
const project = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
if (project !== 'ikagfuchasnsakpouosg' || process.argv[2] !== '--apply-reviewed-fix') {
  throw new Error('Explicit reviewed-fix flag and the expected linked project are required.');
}
function query(sql, file = false) {
  let raw;
  try {
    raw = execFileSync(binary, ['db', 'query', '--linked', ...(file ? ['--file', sql] : [sql]), '--output', 'json'],
      { encoding: 'utf8', maxBuffer: 100000, timeout: 90000 });
  } catch (error) {
    throw new Error(String(error.stderr ?? error.code ?? 'Query failed').slice(0, 1500));
  }
  const start = raw.indexOf('{');
  return JSON.parse(raw.slice(start));
}
const marker = version === '20261009090000'
  ? "to_regprocedure('public.repair_nations_cup_opening_budgets(uuid)') is not null"
  : version === '20261009070000'
  ? "to_regprocedure('public.get_season_rollover_health()') is not null"
  : `(select count(*) from pg_constraint where conname in (
      'race_roster_stage_roles_roster_fkey','race_time_trial_rider_plans_roster_fkey',
      'race_stage_strategies_lieutenant_roster_fkey','race_stage_strategies_danger_pacer_roster_fkey',
      'race_stage_strategies_protector_roster_fkey','race_stage_strategies_breakaway_rider_roster_fkey')
      and confupdtype='c' and convalidated)=6`;
const existing = query(`begin read only; set local statement_timeout='8s';
  select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
    ${marker} hardened; rollback;`);
if (existing.rows[0].recorded) {
  console.log(`Migration ${version} is already recorded; no changes applied.`);
} else {
  const sql = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8');
  const literal = value => "'" + value.replaceAll("'", "''") + "'";
  const receipt = `begin; set local lock_timeout='5s'; set local statement_timeout='8s';
    insert into supabase_migrations.schema_migrations(version,name,statements)
    values('${version}','${name}',array[${literal(sql)}]::text[]) returning version; commit;`;
  if (!/commit;\s*$/.test(sql)) throw new Error('Migration must end with COMMIT.');
  if (!existing.rows[0].hardened) {
    query(`supabase/migrations/${version}_${name}.sql`, true);
  }
  const result = query(receipt);
  if (!result.rows.some(row => row.version === version)) throw new Error('Migration receipt was not returned; inspect live state before retrying.');
  console.log(`Applied and recorded reviewed migration ${version}; no gameplay fixtures executed.`);
}
