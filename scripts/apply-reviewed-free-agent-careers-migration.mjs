// Install only the reviewed rules. No player actions, fixtures or settlement calls.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const version = "20261009150000";
const name = "extend_free_agent_careers_and_training";
const migrationPath = fileURLToPath(new URL(`../supabase/migrations/${version}_${name}.sql`, import.meta.url));
if (readFileSync("supabase/.temp/project-ref", "utf8").trim() !== "ikagfuchasnsakpouosg" ||
    process.argv.length !== 3 || process.argv[2] !== "--apply-reviewed-fix") {
  throw new Error("The reviewed-install flag and expected linked project are required.");
}
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")), "bin/supabase.exe");
function query(sql, file = false) {
  let output;
  try {
    output = execFileSync(binary, ["db", "query", "--linked", ...(file ? ["--file", sql] : [sql]), "--output", "json"], {
      encoding: "utf8", maxBuffer: 100000, timeout: 60000,
    });
  } catch (error) {
    throw new Error(String(error.stderr ?? error.code ?? "Database query failed").slice(0, 1500));
  }
  const start = output.indexOf("{");
  if (start < 0) throw new Error("Missing database receipt; inspect before retrying.");
  return JSON.parse(output.slice(start));
}
const guard = "\n        and not exists (select 1 from public.free_agent_training_sessions autonomous_session where autonomous_session.rider_id = rider.id and autonomous_session.season_day_id = v_day.id)";
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const markerQuery = `begin read only; set local statement_timeout='5s';
  select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') as recorded,
    to_regclass('public.free_agent_training_state') is not null as state_present,
    to_regclass('public.free_agent_training_sessions') is not null as ledger_present,
    to_regprocedure('public.settle_due_free_agent_training(integer)') is not null as function_present,
    position('has_rider_two_full_unattached_seasons' in pg_get_functiondef('public.archive_inactive_riders_for_season(uuid)'::regprocedure))>0 as retirement_installed,
    position('free_agent_reward.uci_points > 0' in pg_get_functiondef('public.archive_inactive_riders_for_season(uuid)'::regprocedure))>0 as scoring_protected,
    position('autonomous_session' in pg_get_functiondef('public.settle_due_training_sessions()'::regprocedure))>0 as signing_guard,
    position('free_agent_training' in pg_get_functiondef('public.run_game_maintenance_task(text)'::regprocedure))>0 as scheduled,
    md5(replace(pg_get_functiondef('public.settle_due_training_sessions()'::regprocedure),${literal(guard)},'')) as club_formula;
  commit;`;
const complete = receipt => receipt.state_present && receipt.ledger_present && receipt.function_present &&
  receipt.retirement_installed && receipt.scoring_protected && receipt.signing_guard && receipt.scheduled;
const before = query(markerQuery).rows[0];
if (before.recorded && !complete(before)) throw new Error("Recorded migration and installed rules disagree; no changes applied.");
if (!before.recorded && !complete(before) &&
    (before.state_present || before.ledger_present || before.function_present || before.retirement_installed || before.signing_guard || before.scheduled)) {
  throw new Error("Partial installation detected; inspect before applying anything.");
}
if (!before.recorded) {
  const sql = readFileSync(migrationPath, "utf8");
  if (!/commit;\s*$/i.test(sql)) throw new Error("Reviewed migration must end in COMMIT.");
  if (!complete(before)) query(migrationPath, true);
  const installed = query(markerQuery).rows[0];
  if (!complete(installed) || installed.club_formula !== before.club_formula) {
    throw new Error("Installation or preservation of club training is not confirmed; inspect before retrying.");
  }
  query(`begin; set local lock_timeout='3s'; set local statement_timeout='5s';
    insert into supabase_migrations.schema_migrations(version,name,statements)
    values('${version}','${name}',array[${literal(sql)}]::text[])
    on conflict(version) do nothing; commit;`);
}
const receipt = query(markerQuery).rows[0];
if (!complete(receipt) || !receipt.recorded) throw new Error("Installation receipt is not confirmed.");
const state = query(`begin read only; set local statement_timeout='5s';
  select activated_at,last_completed_cutoff from public.free_agent_training_state where singleton; commit;`).rows[0];
console.log(JSON.stringify({ migration:version,installed:true,recorded:true,
  clubFormulaPreserved:receipt.club_formula===before.club_formula,gameplayRun:false,...state }));
