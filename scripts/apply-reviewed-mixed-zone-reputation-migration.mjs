// Install only the reviewed function patch, never player submissions or fixtures.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const version = "20261010190000", name = "fix_mixed_zone_s4_reputation";
if (process.argv.length !== 3 || process.argv[2] !== "--apply-reviewed-fix" || readFileSync("supabase/.temp/project-ref", "utf8").trim() !== "ikagfuchasnsakpouosg") {
  throw new Error("Exact reviewed-fix flag and expected linked project are required.");
}
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")), "bin/supabase.exe");
function query(value, file = false) {
  const raw = execFileSync(binary, ["db", "query", "--linked", ...(file ? ["--file", value] : [value]), "--output", "json"], { encoding: "utf8", maxBuffer: 100000, timeout: 30000 });
  return JSON.parse(raw.slice(raw.indexOf("{")));
}
const check = `begin read only; set local statement_timeout='4s';
  select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
    position('mixed_zone_s4_reputation_v1' in pg_get_functiondef('public.submit_post_race_interview_with_event(uuid,uuid,jsonb,text,text)'::regprocedure))>0 installed;
  commit;`;
const before = query(check).rows[0];
if (before.recorded && !before.installed) throw new Error("Migration receipt and live function disagree; stop and inspect.");
if (!before.recorded) {
  const migrationPath = `supabase/migrations/${version}_${name}.sql`;
  const sql = readFileSync(migrationPath, "utf8");
  if (!/commit;\s*$/i.test(sql)) throw new Error("Reviewed migration must commit atomically.");
  if (!before.installed) query(migrationPath, true);
  const literal = "'" + sql.replaceAll("'", "''") + "'";
  query(`begin; set local lock_timeout='5s'; set local statement_timeout='8s';
    insert into supabase_migrations.schema_migrations(version,name,statements)
    values('${version}','${name}',array[${literal}]::text[]) on conflict(version) do nothing; commit;`);
}
const after = query(check).rows[0];
if (!after.installed || !after.recorded) throw new Error("Migration not confirmed; inspect live state before retrying.");
console.log(JSON.stringify({ version, installed: true, recorded: true, playerSubmissionsRun: false }));
