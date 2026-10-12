// Applies only the reviewed educator migration. No gameplay fixtures or rehearsals.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")), "bin/supabase.exe");
const version = "20261012190000";
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
      (select count(*)=3 from information_schema.columns where table_schema='public'
        and table_name='staff_academy_trainings' and column_name in
        ('educator_mentorship_reduction_days','educator_talent_choice_count','talent_choice_codes')) snapshot_columns,
      to_regprocedure('public.choose_current_team_staff_academy_talent(uuid,text)') is not null choice_rpc,
      coalesce(has_function_privilege('authenticated',
        to_regprocedure('public.choose_current_team_staff_academy_talent(uuid,text)'), 'execute'), false) owner_can_choose,
      coalesce(has_function_privilege('anon',
        to_regprocedure('public.choose_current_team_staff_academy_talent(uuid,text)'), 'execute'), false) anonymous_can_choose,
      position('mentorshipReductionDays' in body)>0
        and position('talent_choice_codes' in body)>0 snapshots_used,
      position('team_finance_transactions' in body)=0 and position('cash_balance' in body)=0 free_course,
      position('activeEducatorCount' in body)>0 educator_required,
      (select count(*)=2 from public.staff_talent_catalog where
        (code='educator_training_cost' and display_name='Orientation professionnelle') or
        (code='educator_training_effectiveness' and display_name='Mentorat ciblé')) renamed_talents,
      exists(select 1 from pg_trigger where tgrelid='public.staff_academy_trainings'::regclass
        and tgname='notify_staff_academy_talent_choice' and not tgisinternal) choice_mail
    from definition; rollback;`, "--output", "json"]);
  return JSON.parse(raw.slice(raw.indexOf("{"))).rows[0];
}
const installed = (state) => state.snapshot_columns && state.choice_rpc && state.snapshots_used &&
  state.free_course && state.educator_required && state.renamed_talents && state.choice_mail &&
  state.owner_can_choose && !state.anonymous_can_choose;
const before = inspect();
if (before.recorded && !installed(before)) throw new Error("Migration history/schema mismatch; inspect before any mutation.");
if (!installed(before)) {
  call(["db", "query", "--linked", "--file",
    `supabase/migrations/${version}_rework_staff_educator_talents.sql`, "--output", "json"], 60000);
  console.log("Reviewed educator affix migration committed.");
}
const after = inspect();
if (!installed(after)) throw new Error("Database verification failed; do not deploy the application.");
if (!after.recorded) call(["migration", "repair", version, "--status", "applied", "--linked", "--yes"]);
console.log(JSON.stringify({ migration: version, ...inspect() }));
