// Applies only this reviewed migration. Never creates production gameplay fixtures.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")), "bin/supabase.exe");
const version = "20261012183000";
if (process.argv[2] !== "--apply-reviewed-fix" ||
    readFileSync("supabase/.temp/project-ref", "utf8").trim() !== "ikagfuchasnsakpouosg") {
  throw new Error("Explicit reviewed-fix flag and expected project required.");
}
function call(args, timeout = 30000) {
  return execFileSync(binary, args, { encoding: "utf8", timeout, maxBuffer: 200000 });
}
function inspect() {
  const raw = call(["db", "query", "--linked", `begin read only;
    set local statement_timeout='5s';
    with definition as (
      select pg_get_functiondef('public.start_current_team_staff_academy_training(uuid,text)'::regprocedure) body
    ) select 1 database_ok,
      exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
      exists(select 1 from pg_constraint where conrelid='public.staff_academy_trainings'::regclass
        and conname='staff_academy_trainings_cost_nonnegative') nonnegative_cost,
      position('0, v_duration' in body)>0
        and position('team_finance_transactions' in body)=0
        and position('cash_balance' in body)=0 free_course,
      position('activeEducatorCount' in body)>0 educator_required,
      has_function_privilege('anon','public.start_current_team_staff_academy_training(uuid,text)','execute') anonymous_can_start
    from definition; rollback;`, "--output", "json"]);
  return JSON.parse(raw.slice(raw.indexOf("{"))).rows[0];
}
const before = inspect();
const installed = (state) => state.nonnegative_cost && state.free_course && state.educator_required && !state.anonymous_can_start;
if (before.recorded && !installed(before)) throw new Error("Migration history/schema mismatch; inspect before any mutation.");
if (!installed(before)) {
  call(["db", "query", "--linked", "--file",
    `supabase/migrations/${version}_make_staff_academy_training_free.sql`, "--output", "json"], 60000);
  console.log("Reviewed free staff academy migration committed.");
}
const after = inspect();
if (!installed(after)) throw new Error("Database verification failed; do not deploy the application.");
if (!after.recorded) call(["migration", "repair", version, "--status", "applied", "--linked", "--yes"]);
console.log(JSON.stringify({ migration: version, ...inspect() }));
