// Install only this reviewed migration; never run training or player fixtures.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const version = "20261011133000", name = "enforce_training_potential_stat_caps";
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
    (select bool_and(position('potential_stat_cap_v1' in pg_get_functiondef(signature::regprocedure))>0)
      from unnest(array['public.settle_due_training_sessions()','public.settle_due_free_agent_training(integer)',
        'public.complete_current_youth_training_attempt(uuid,integer)']) signature) installed,
    md5(pg_get_functiondef('public.use_current_team_inventory_item(uuid,uuid)'::regprocedure)) item_function_hash;
  commit;`;
const before = query(check).rows[0];
if (before.recorded && !before.installed) throw new Error("Migration receipt and live functions disagree; stop and inspect.");
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
if (!after.installed || !after.recorded || after.item_function_hash !== before.item_function_hash) throw new Error("Migration or unchanged item path not confirmed; inspect before retrying.");
console.log(JSON.stringify({ version, installed: true, recorded: true, itemPathUnchanged: true, trainingSessionsRun: false, existingRatingsRewritten: false }));
