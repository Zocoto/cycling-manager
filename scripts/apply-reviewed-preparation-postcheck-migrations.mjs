// Only these two reviewed migrations and their receipts. Never run fixtures,
// settlements, race recalculations, db push or an external SQL test harness.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

if (process.argv.length !== 3 || process.argv[2] !== "--apply-reviewed-fix" ||
  readFileSync("supabase/.temp/project-ref", "utf8").trim() !== "ikagfuchasnsakpouosg") {
  throw new Error("Exact reviewed-fix flag and expected linked project are required.");
}

const migrations = [
  { version: "20261020120500", name: "guard_cancelled_performance_preparations", applicationName: "cyclostratege-preparation-postcheck-20261020" },
  { version: "20261020121000", name: "bound_performance_preparation_context", applicationName: "cyclostratege-preparation-context-window-20261020" },
].map((migration) => {
  const file = `supabase/migrations/${migration.version}_${migration.name}.sql`;
  const sql = readFileSync(file, "utf8");
  if (!/^begin;/i.test(sql.trim()) || !/commit;\s*$/i.test(sql) ||
    !sql.includes("set local lock_timeout = '3s'") ||
    !sql.includes("set local statement_timeout = '8s'") ||
    !sql.includes(`set local application_name = '${migration.applicationName}'`)) {
    throw new Error("Reviewed migration must be atomic with its exact bounds and application name.");
  }
  return { ...migration, file, sql };
});
const base = readFileSync("supabase/migrations/20261020090000_rebalance_performance_preparations.sql", "utf8");
const hash = (body) => createHash("md5").update(body.replace(/\s/g, "")).digest("hex");
const functionBody = (source, name) => {
  const body = source.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`, "i"))?.[1];
  if (!body) throw new Error(`Missing reviewed function body: ${name}`);
  return body;
};
const patchLiteral = (name) => {
  const literal = migrations[0].sql.match(new RegExp(`${name} constant text := E'((?:''|[^'])*)';`))?.[1];
  if (literal === undefined) throw new Error("Missing exact booking guard patch.");
  return literal.replaceAll("\\n", "\n").replaceAll("''", "'");
};
const oldGuard = patchLiteral("v_old");
const newGuard = patchLiteral("v_new");
const baseBookingBody = functionBody(base, "start_current_team_rider_performance_preparation");
if (baseBookingBody.split(oldGuard).length !== 2) throw new Error("Unexpected reviewed base booking guard.");
const expectedBookingHash = hash(baseBookingBody.replace(oldGuard, newGuard));
const expectedCancellationHash = hash(functionBody(migrations[0].sql, "cancel_performance_preparation_from_camp"));
const coreMarker = "/* performance-preparation-context-window-v1 */";
const wrapperMarker = "/* performance-preparation-context-legacy-v1 */";
const lowerBound = "preparation.bonus_end_game_day >= coalesce(p_min_game_day, -2147483648)";
const upperBound = "preparation.bonus_start_game_day <= coalesce(p_max_game_day, 2147483647)";
const predicate = /preparation\.rider_id\s*=\s*rider\.id\s+and\s+preparation\.status\s*<>\s*'cancelled'/g;
const expectedWrapperHash = hash(`${wrapperMarker}\nselect * from public.get_race_calendar_rider_context(p_rider_ids, null::integer, null::integer);`);

const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")), "bin/supabase.exe");
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
function query(value, file = false) {
  const output = execFileSync(binary, ["db", "query", "--linked", ...(file ? ["--file", value] : [value]), "--output", "json"], {
    encoding: "utf8", maxBuffer: 100_000, timeout: 30_000,
  });
  const start = output.indexOf("{");
  if (start < 0) throw new Error("Missing database receipt; inspect before retrying.");
  return JSON.parse(output.slice(start)).rows;
}
function inspect(applicationName) {
  return query(`begin read only;
    set local statement_timeout='4s'; set local lock_timeout='500ms';
    set local application_name=${literal(applicationName)};
    select 1 as database_ok,
      exists(select 1 from supabase_migrations.schema_migrations where version='20261020120500') as cancellation_recorded,
      exists(select 1 from supabase_migrations.schema_migrations where version='20261020121000') as context_recorded,
      (select md5(regexp_replace(prosrc,'[[:space:]]','','g')) from pg_catalog.pg_proc where oid=to_regprocedure('public.start_current_team_rider_performance_preparation(uuid,text)')) as booking_hash,
      (select md5(regexp_replace(prosrc,'[[:space:]]','','g')) from pg_catalog.pg_proc where oid=to_regprocedure('public.cancel_performance_preparation_from_camp()')) as cancellation_hash,
      exists(select 1 from pg_catalog.pg_trigger where tgname='cancel_performance_preparation_after_camp_cancellation'
        and tgrelid='public.rider_form_camps'::regclass and not tgisinternal and tgenabled<>'D' and tgtype=17
        and tgfoid=to_regprocedure('public.cancel_performance_preparation_from_camp()')
        and position('new.status = ''cancelled''' in pg_get_triggerdef(oid))>0
        and position('old.status IS DISTINCT FROM new.status' in pg_get_triggerdef(oid))>0) as cancellation_trigger,
      exists(select 1 from pg_catalog.pg_index where indexrelid=to_regclass('public.rider_performance_preparations_camp_active_idx')
        and indrelid='public.rider_performance_preparations'::regclass and indisvalid and indisready and not indisunique and indnatts=1
        and pg_get_indexdef(indexrelid,1,true)='form_camp_id' and position('status <> ''cancelled''' in pg_get_expr(indpred,indrelid))>0) as cancellation_index,
      exists(select 1 from pg_catalog.pg_proc where oid=to_regprocedure('public.cancel_performance_preparation_from_camp()')
        and not has_function_privilege('anon',oid,'execute') and not has_function_privilege('authenticated',oid,'execute')
        and prosecdef and proconfig @> array['search_path=""','lock_timeout=3s','statement_timeout=5s']) as cancellation_acl,
      exists(select 1 from pg_catalog.pg_proc where oid=to_regprocedure('public.start_current_team_rider_performance_preparation(uuid,text)')
        and not has_function_privilege('anon',oid,'execute') and has_function_privilege('authenticated',oid,'execute') and has_function_privilege('service_role',oid,'execute')) as booking_acl,
      (select prosrc from pg_catalog.pg_proc where oid=to_regprocedure('public.get_race_calendar_rider_context(uuid[])')) as legacy_body,
      (select prosrc from pg_catalog.pg_proc where oid=to_regprocedure('public.get_race_calendar_rider_context(uuid[],integer,integer)')) as core_body,
      (select pg_get_function_result(oid) from pg_catalog.pg_proc where oid=to_regprocedure('public.get_race_calendar_rider_context(uuid[])')) as legacy_result,
      (select pg_get_function_result(oid) from pg_catalog.pg_proc where oid=to_regprocedure('public.get_race_calendar_rider_context(uuid[],integer,integer)')) as core_result,
      (select count(*)=2 from pg_catalog.pg_proc where oid in(to_regprocedure('public.get_race_calendar_rider_context(uuid[])'),to_regprocedure('public.get_race_calendar_rider_context(uuid[],integer,integer)'))
        and pronargdefaults=0 and pronargs in(1,3) and prosecdef and provolatile='s' and proconfig @> array['search_path=""']
        and prolang=(select oid from pg_catalog.pg_language where lanname='sql')
        and not has_function_privilege('anon',oid,'execute') and not has_function_privilege('authenticated',oid,'execute')
        and has_function_privilege('service_role',oid,'execute')) as context_acl_and_arguments,
      exists(select 1 from pg_catalog.pg_index where indexrelid=to_regclass('public.rider_performance_preparations_rider_window_idx')
        and indrelid='public.rider_performance_preparations'::regclass and indisvalid and indisready and not indisunique and indnatts=3
        and pg_get_indexdef(indexrelid,1,true)='rider_id' and pg_get_indexdef(indexrelid,2,true)='bonus_end_game_day'
        and pg_get_indexdef(indexrelid,3,true)='bonus_start_game_day' and position('status <> ''cancelled''' in pg_get_expr(indpred,indrelid))>0) as context_index,
      md5(pg_get_functiondef('public.settle_due_rider_performance_preparations()'::regprocedure)) as settlement_hash,
      md5(pg_get_functiondef('public.get_team_infrastructure_efficiency_multiplier(uuid,text)'::regprocedure)) as architect_hash;
    commit;`)[0];
}
const cancellationInstalled = (state) => state.booking_hash === expectedBookingHash &&
  state.cancellation_hash === expectedCancellationHash && state.cancellation_trigger &&
  state.cancellation_index && state.cancellation_acl && state.booking_acl;
const contextInstalled = (state, expectedCoreHash) => !!state.core_body && !!state.legacy_body &&
  hash(state.core_body) === expectedCoreHash && hash(state.legacy_body) === expectedWrapperHash &&
  state.core_body.includes(coreMarker) && state.core_body.includes(lowerBound) && state.core_body.includes(upperBound) &&
  state.legacy_result === state.core_result && state.context_acl_and_arguments && state.context_index;

try {
  const baseline = inspect(migrations[0].applicationName);
  if (baseline.database_ok !== 1 || !baseline.settlement_hash || !baseline.architect_hash) throw new Error("Missing baseline safety receipts.");
  if (![hash(baseBookingBody), expectedBookingHash].includes(baseline.booking_hash) ||
    (baseline.cancellation_hash !== null && baseline.cancellation_hash !== expectedCancellationHash)) {
    throw new Error("Booking/cancellation source drift since review; refusing to apply.");
  }
  let expectedCoreHash;
  if (baseline.core_body) {
    expectedCoreHash = hash(baseline.core_body);
    if (!contextInstalled(baseline, expectedCoreHash)) throw new Error("Unexpected or partial existing context migration.");
  } else {
    if (!baseline.legacy_body || baseline.legacy_body.includes(wrapperMarker) || baseline.legacy_body.includes(coreMarker) ||
      [...baseline.legacy_body.matchAll(predicate)].length !== 1) throw new Error("Unexpected legacy preparation predicate.");
    expectedCoreHash = hash(baseline.legacy_body.replace(predicate, `$&\n      ${coreMarker}\n      and ${lowerBound}\n      and ${upperBound}`));
  }
  for (const migration of migrations) {
    const isCancellation = migration.version === "20261020120500";
    const installed = (state) => isCancellation ? cancellationInstalled(state) : contextInstalled(state, expectedCoreHash);
    const recorded = (state) => isCancellation ? state.cancellation_recorded : state.context_recorded;
    const before = inspect(migration.applicationName);
    if (recorded(before) && !installed(before)) throw new Error(`Schema/history mismatch for ${migration.version}.`);
    if (!installed(before)) query(migration.file, true);
    const applied = inspect(migration.applicationName);
    if (!installed(applied) || applied.settlement_hash !== baseline.settlement_hash || applied.architect_hash !== baseline.architect_hash) {
      throw new Error(`Reviewed installation not confirmed for ${migration.version}.`);
    }
    if (!recorded(applied)) {
      query(`begin; set local lock_timeout='3s'; set local statement_timeout='5s';
        set local application_name=${literal(migration.applicationName)};
        insert into supabase_migrations.schema_migrations(version,name,statements)
        values(${literal(migration.version)},${literal(migration.name)},array[${literal(migration.sql)}]::text[])
        on conflict(version) do nothing; commit;`);
    }
    const after = inspect(migration.applicationName);
    if (!installed(after) || !recorded(after) || after.settlement_hash !== baseline.settlement_hash || after.architect_hash !== baseline.architect_hash) {
      throw new Error(`Final migration receipt not confirmed for ${migration.version}.`);
    }
    console.log(JSON.stringify({ version: migration.version, installed: true, recorded: true, settlementUnchanged: true,
      architectUnchanged: true, fixturesRun: false, racesRecalculated: false, historicalRatingsOrDatesUpdated: false }));
  }
} catch (error) {
  try {
    const active = query(`begin read only; set local statement_timeout='4s';
      set local application_name='cyclostratege-preparation-postcheck-20261020';
      select count(*)::integer as active from pg_catalog.pg_stat_activity
      where application_name in(${migrations.map((migration) => literal(migration.applicationName)).join(",")})
        and pid<>pg_backend_pid() and (state='active' or xact_start is not null); commit;`)[0];
    console.error(JSON.stringify({ taskOwnedTransactionsRemaining: active.active }));
  } catch {
    console.error("Unable to verify task-owned transaction completion; stop and inspect connectivity.");
  }
  throw new Error(String(error.stderr ?? error.message).slice(0, 1_500));
}
