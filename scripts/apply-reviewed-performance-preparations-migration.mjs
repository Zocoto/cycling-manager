// DDL only. Never execute player fixtures, settlements or race simulations here.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

const version = "20261020090000";
const name = "rebalance_performance_preparations";
const applicationName = "cyclostratege-preparation-rebalance-20261020";
if (process.argv.length !== 3 || process.argv[2] !== "--apply-reviewed-fix" ||
  readFileSync("supabase/.temp/project-ref", "utf8").trim() !== "ikagfuchasnsakpouosg") {
  throw new Error("An exact reviewed-fix flag and the expected linked project are required.");
}
const migrationPath = `supabase/migrations/${version}_${name}.sql`;
const migration = readFileSync(migrationPath, "utf8");
if (!/^begin;/i.test(migration.trim()) || !/commit;\s*$/i.test(migration)) {
  throw new Error("The reviewed migration must be atomic.");
}
const definitions = [
  ["get_performance_preparation_policy", "integer"],
  ["start_current_team_rider_performance_preparation", "uuid,text"],
].map(([functionName, argumentsSql]) => {
  const body = migration.match(new RegExp(
    `create or replace function public\\.${functionName}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`, "i",
  ))?.[1];
  if (!body) throw new Error("Missing reviewed function definition.");
  return {
    signature: `public.${functionName}(${argumentsSql})`,
    hash: createHash("md5").update(body.replace(/\s/g, "")).digest("hex"),
  };
});
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")), "bin/supabase.exe");
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
function query(value, file = false) {
  const output = execFileSync(binary, ["db", "query", "--linked",
    ...(file ? ["--file", value] : [value]), "--output", "json"], {
    encoding: "utf8", maxBuffer: 100_000, timeout: 30_000,
  });
  const start = output.indexOf("{");
  if (start < 0) throw new Error("Missing database receipt; inspect before retrying.");
  return JSON.parse(output.slice(start));
}
const check = `begin read only;
  set local statement_timeout='4s';
  set local application_name='${applicationName}';
  select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') as recorded,
    ${definitions.map(({ signature, hash }) => `coalesce((select md5(regexp_replace(prosrc, '[[:space:]]', '', 'g')) = '${hash}' from pg_catalog.pg_proc where oid=to_regprocedure('${signature}')), false)`).join(" and\n    ")}
    and to_regclass('public.rider_performance_preparations_facility_active_idx') is null
    and exists(select 1 from pg_catalog.pg_index where indexrelid=to_regclass('public.rider_performance_preparations_facility_planned_idx') and not indisunique) as installed,
    md5(pg_get_functiondef('public.settle_due_rider_performance_preparations()'::regprocedure)) as settlement_hash,
    md5(pg_get_functiondef('public.get_team_infrastructure_efficiency_multiplier(uuid,text)'::regprocedure)) as architect_hash;
  commit;`;

try {
  const before = query(check).rows[0];
  if (before.recorded && !before.installed) throw new Error("Migration receipt and installed definitions disagree; stop and inspect.");
  if (!before.installed) query(migrationPath, true);
  if (!before.recorded) {
    query(`begin; set local lock_timeout='3s'; set local statement_timeout='5s';
      set local application_name='${applicationName}';
      insert into supabase_migrations.schema_migrations(version,name,statements)
      values('${version}','${name}',array[${literal(migration)}]::text[])
      on conflict(version) do nothing; commit;`);
  }
  const after = query(check).rows[0];
  if (!after.installed || !after.recorded || after.settlement_hash !== before.settlement_hash ||
    after.architect_hash !== before.architect_hash) throw new Error("Reviewed installation is not confirmed.");
  console.log(JSON.stringify({ version, installed: true, recorded: true,
    settlementUnchanged: true, architectUnchanged: true, fixturesRun: false,
    historicalRatingsOrDatesUpdated: false, racesRecalculated: false }));
} catch (error) {
  // A disconnected CLI must never leave a task-owned migration transaction behind.
  try {
    const active = query(`begin read only; set local statement_timeout='4s';
      select count(*)::integer as active from pg_catalog.pg_stat_activity
      where application_name='${applicationName}' and pid<>pg_backend_pid()
        and (state='active' or xact_start is not null); commit;`).rows[0];
    console.error(JSON.stringify({ taskOwnedTransactionsRemaining: active.active }));
  } catch {
    console.error("Unable to verify task-owned transaction completion; stop and inspect connectivity.");
  }
  throw new Error(String(error.stderr ?? error.message).slice(0, 1_500));
}
