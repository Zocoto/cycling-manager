// Exactly one reviewed additive DDL migration. Never fixtures or gameplay jobs.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
const mode = process.argv[2];
if (process.argv.length !== 3 || !["--inspect", "--apply-reviewed-fix"].includes(mode) || readFileSync("supabase/.temp/project-ref", "utf8").trim() !== "ikagfuchasnsakpouosg") throw Error("Expected exact mode and linked project.");
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")), "bin/supabase.exe");
const version = "20261022110000";
const name = "add_terrain_preparation_facilities";
const file = `supabase/migrations/${version}_${name}.sql`;
const sql = readFileSync(file, "utf8");
const literal = value => "'" + value.replaceAll("'", "''") + "'";
if (!sql.startsWith("begin;") || !sql.includes("set local lock_timeout = '1s'") || !sql.includes("set local statement_timeout = '8s'") || !sql.includes("set local application_name = 'cyclostratege-terrain-preparation-20261022'") || !/commit;\s*$/.test(sql)) throw Error("Migration bounds or atomicity changed.");
function query(statement) {
  const raw = execFileSync(binary, ["db", "query", "--linked", statement, "--output", "json"], { encoding: "utf8", timeout: 30000, maxBuffer: 100000 });
  return JSON.parse(raw.slice(raw.indexOf("{"))).rows;
}
function inspect() {
  return query(`begin read only; set local statement_timeout='4s'; set local lock_timeout='500ms';
    set local application_name='terrain-preparation-receipt-20261022';
    select 1 as database_ok,
      exists(select 1 from supabase_migrations.schema_migrations where version='${version}') as recorded,
      (select jsonb_object_agg(signature,hash) from (
        select oid::regprocedure::text signature,md5(pg_get_functiondef(oid)) hash from pg_proc
        where oid in(to_regprocedure('public.cancel_performance_preparation_from_camp()'),
          to_regprocedure('public.get_performance_preparation_policy(integer)'),
          to_regprocedure('public.get_team_infrastructure_efficiency_multiplier(uuid,text)'),
          to_regprocedure('public.get_race_calendar_rider_context(uuid[],integer,integer)'))
      ) untouched) as untouched_hashes,
      (select count(*)::integer from pg_constraint where conname in(
        'team_infrastructures_code_allowed','infrastructure_projects_code_allowed',
        'rider_form_camps_type_allowed','rider_form_camps_gain_allowed',
        'rider_performance_preparations_preparation_type_check','rider_performance_preparations_rating_bonus_check')
        and connamespace='public'::regnamespace and position('cobbles_' in pg_get_expr(conbin,conrelid))>0) as expanded_checks,
      exists(select 1 from pg_proc where oid=to_regprocedure('public.start_current_team_rider_performance_preparation(uuid,text)')
        and prosrc like '%mountain_base%' and prosrc like '%get_terrain_performance_preparation_policy%'
        and prosrc like '%roster.status in (''selected'', ''confirmed'')%'
        and not has_function_privilege('anon',oid,'execute') and has_function_privilege('authenticated',oid,'execute')) as booking_ready,
      exists(select 1 from pg_proc where oid=to_regprocedure('public.get_terrain_performance_preparation_policy(uuid,text,integer)')
        and not has_function_privilege('anon',oid,'execute') and not has_function_privilege('authenticated',oid,'execute')
        and has_function_privilege('service_role',oid,'execute')) as policy_acl;
    commit;`)[0];
}
const before = inspect();
if (mode === "--inspect") { console.log(JSON.stringify(before)); process.exit(0); }
if (!before.recorded) {
  const atomic = sql.replace(/commit;\s*$/, `insert into supabase_migrations.schema_migrations(version,name,statements) values (${literal(version)},${literal(name)},array[${literal(sql)}]);\ncommit;`);
  query(atomic);
}
const after = inspect();
if (!after.recorded || after.database_ok !== 1 || after.expanded_checks !== 6 || !after.booking_ready || !after.policy_acl || JSON.stringify(before.untouched_hashes) !== JSON.stringify(after.untouched_hashes)) throw Error("Unexpected migration receipt; stop before application deployment.");
const catalogs = query(`begin read only; set local statement_timeout='4s'; set local lock_timeout='500ms';
  set local application_name='terrain-preparation-price-receipt-20261022';
  select code,level,public.get_team_infrastructure_base_cost(code,level) cost,
    public.get_team_infrastructure_base_duration_days(code,level) days,
    public.is_valid_team_infrastructure_specialization(code,prefix||'_precision') precision_valid,
    public.is_valid_team_infrastructure_specialization(code,prefix||'_durability') durability_valid,
    public.is_valid_team_infrastructure_specialization(code,prefix||'_group') group_valid
  from (values('cobbles_center','cobbles'),('hills_circuit','hills'),('mountain_base','mountain')) f(code,prefix)
  cross join generate_series(1,5) level order by code,level; commit;`);
const expectedCosts = { cobbles_center:[150000,375000,750000,1300000,2000000], hills_circuit:[450000,950000,1650000,2650000,4000000], mountain_base:[500000,1050000,1850000,2950000,4400000] };
if (catalogs.length !== 15 || catalogs.some(row => Number(row.cost) !== expectedCosts[row.code]?.[row.level-1] || row.days !== (row.code === 'cobbles_center' ? [7,11,16,22,28] : [9,14,20,27,35])[row.level-1] || !row.precision_valid || !row.durability_valid || !row.group_valid)) throw Error("Catalog mismatch; stop before deployment.");
const receipt = { migration:version, sha256:createHash('sha256').update(sql).digest('hex'), ...after, catalogs };
writeFileSync("artifacts/terrain-preparation-20261022/deployment-receipt.json", JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));
