// Install only the exact reviewed alert migration. No gameplay fixtures/actions.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const version = '20261011120000', name = 'add_physiotherapist_dashboard_alert';
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'ikagfuchasnsakpouosg' ||
    process.argv.length !== 3 || process.argv[2] !== '--apply-reviewed-fix') throw new Error('Expected linked project and reviewed flag required.');
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
const migration = fileURLToPath(new URL(`../supabase/migrations/${version}_${name}.sql`, import.meta.url));
const sql = readFileSync(migration, 'utf8');
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const normalize = text => text.replaceAll('\r\n', '\n');
function query(sql, file = false) {
  let output;
  try { output = execFileSync(binary, ['db','query','--linked',...(file ? ['--file',sql] : [sql]),'--output','json'], { encoding:'utf8',timeout:45000,maxBuffer:200000 }); }
  catch (error) { throw new Error(String(error.stderr ?? error.code ?? 'Query failed').slice(0,1500)); }
  const start = output.indexOf('{');
  if (start < 0) throw new Error('Missing receipt: inspect outcome before retrying.');
  return JSON.parse(output.slice(start));
}
const marker = `begin read only; set local statement_timeout='5s';
  select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') as recorded,
    pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure) as definition,
    md5(pg_get_functiondef('public.get_physiotherapist_contract_rider_capacity(uuid,integer)'::regprocedure)) as capacity_rule,
    md5(pg_get_functiondef('public.assign_current_team_physiotherapist_matrix(jsonb)'::regprocedure)) as assignment_rule,
    has_function_privilege('authenticated','public.get_current_dashboard_assistant_summary()','execute') as player_access,
    has_function_privilege('anon','public.get_current_dashboard_assistant_summary()','execute') as anonymous_access;
  commit;`;
const before = query(marker).rows[0];
const installed = row => row.definition.includes("'physiotherapistOpportunity'") && row.player_access && !row.anonymous_access;
if (before.recorded && !installed(before)) throw new Error('Recorded and installed rules disagree.');
if (!before.recorded) {
  if (!installed(before)) {
    const previous = normalize(sql.match(/\$previous\$([\s\S]*?)\$previous\$/)[1]);
    const replacement = normalize(sql.match(/\$replacement\$([\s\S]*?)\$replacement\$/)[1]);
    const definition = normalize(before.definition);
    if (definition.split(previous).length !== 2) throw new Error('Non-unique or absent production anchor.');
    query(migration, true);
    const after = query(marker).rows[0];
    if (normalize(after.definition) !== definition.replace(previous, replacement) || !installed(after) ||
        after.capacity_rule !== before.capacity_rule || after.assignment_rule !== before.assignment_rule) {
      throw new Error('Installation/preservation not confirmed: inspect before retrying.');
    }
  }
  query(`begin; set local lock_timeout='3s'; set local statement_timeout='5s'; insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${literal(sql)}]::text[]) on conflict(version) do nothing; commit;`);
}
const receipt = query(marker).rows[0];
if (!receipt.recorded || !installed(receipt)) throw new Error('Final migration receipt not confirmed.');
console.log(JSON.stringify({ migration:version, installed:true, recorded:true,
  existingCapacityAndAssignmentsPreserved:receipt.capacity_rule===before.capacity_rule && receipt.assignment_rule===before.assignment_rule,
  noExtraDashboardQuery:true, gameplayRun:false }));
