// Install only the reviewed category extension. Never run gameplay or fixtures.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const version = "20261009140000";
const name = "extend_detection_teams_to_local_and_regional";
const migrationPath = fileURLToPath(new URL(`../supabase/migrations/${version}_${name}.sql`, import.meta.url));
const linkedProject = readFileSync("supabase/.temp/project-ref", "utf8").trim();
if (linkedProject !== "ikagfuchasnsakpouosg" || process.argv.length !== 3 || process.argv[2] !== "--apply-reviewed-fix") {
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
  if (start < 0) throw new Error("Missing database query receipt; inspect before retrying.");
  return JSON.parse(output.slice(start));
}
const markerQuery = `begin read only; set local statement_timeout='4s';
  with definition as (select pg_catalog.pg_get_functiondef(
    'public.settle_due_free_agent_detection_teams(timestamp with time zone)'::regprocedure) as source)
  select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') as recorded,
    position($marker$category.code in ('local', 'regional', 'national', 'continental', 'world')$marker$ in source)>0
    and position($marker$when v_edition.category_code in ('local', 'national') then$marker$ in source)>0
    and position($marker$when v_edition.category_code in ('regional', 'continental') then$marker$ in source)>0 as installed
  from definition; commit;`;
const existing = query(markerQuery).rows[0];
if (existing.recorded && !existing.installed) throw new Error("Recorded migration and installed rule disagree; no changes applied.");
if (existing.recorded) {
  console.log(JSON.stringify({ migration: version, installed: true, alreadyRecorded: true, gameplayRun: false }));
} else {
  const sql = readFileSync(migrationPath, "utf8");
  if (!/commit;\s*$/i.test(sql)) throw new Error("Reviewed migration must end in COMMIT.");
  if (!existing.installed) query(migrationPath, true);
  const literal = value => "'" + value.replaceAll("'", "''") + "'";
  query(`begin; set local lock_timeout='3s'; set local statement_timeout='5s';
    insert into supabase_migrations.schema_migrations(version,name,statements)
    values('${version}','${name}',array[${literal(sql)}]::text[])
    on conflict(version) do nothing; commit;`);
  const receipt = query(markerQuery).rows[0];
  if (!receipt.installed || !receipt.recorded) throw new Error("Installation is not confirmed; inspect before retrying.");
  console.log(JSON.stringify({ migration: version, installed: true, recorded: true, gameplayRun: false }));
}
