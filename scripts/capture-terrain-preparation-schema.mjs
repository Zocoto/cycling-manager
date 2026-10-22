// Bounded, read-only metadata capture. No player rows or gameplay execution.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
if (readFileSync("supabase/.temp/project-ref", "utf8").trim() !== "ikagfuchasnsakpouosg") throw Error("Unexpected linked project");
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")), "bin/supabase.exe");
const sql = `begin read only; set local statement_timeout='4s'; set local lock_timeout='500ms';
set local application_name='terrain-preparation-schema-20261022';
select jsonb_build_object(
 'other_functions',(select jsonb_agg(f.signature) from (
   select p.oid::regprocedure::text signature from pg_proc p
   where p.pronamespace='public'::regnamespace and p.prokind='f'
   and p.proname not like '%legacy%' and p.prosrc like '%wind_tunnel%'
   order by p.proname limit 60) f),
 'functions',(select jsonb_agg(to_jsonb(f)) from (
   select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,md5(pg_get_functiondef(p.oid)) definition_hash
   from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f'
   and p.proname not like '%legacy%'
   and (p.proname in('get_team_infrastructure_base_cost','get_team_infrastructure_base_duration_days',
     'start_current_team_infrastructure_project','settle_due_infrastructure_projects',
     'is_valid_team_infrastructure_specialization','start_current_team_rider_performance_preparation',
     'get_team_infrastructure_specialization','get_team_infrastructure_specialization_power',
     'get_team_infrastructure_efficiency_multiplier','get_current_management_reward_targets','redeem_construction_time_reward') or p.prosrc like '%wind_tunnel_preparation%')
   order by p.proname limit 35) f),
 'constraints',(select jsonb_agg(to_jsonb(c)) from (
   select conrelid::regclass::text table_name,conname,pg_get_expr(conbin,conrelid) expression,convalidated
   from pg_constraint where contype='c' and conrelid in('public.team_infrastructures'::regclass,
     'public.infrastructure_projects'::regclass,'public.rider_form_camps'::regclass,
     'public.rider_performance_preparations'::regclass,'public.team_infrastructure_specializations'::regclass)
   order by conrelid,conname limit 60) c)
) metadata; commit;`;
const raw = execFileSync(binary, ["db", "query", "--linked", sql, "--output", "json"], { encoding: "utf8", timeout: 20000, maxBuffer: 500000 });
const metadata = JSON.parse(raw.slice(raw.indexOf("{"))).rows[0].metadata;
mkdirSync("artifacts/terrain-preparation-20261022", { recursive: true });
writeFileSync("artifacts/terrain-preparation-20261022/schema-before.json", JSON.stringify(metadata, null, 2));
console.log(JSON.stringify({ functions: metadata.functions.map(f => f.signature), otherFunctions: metadata.other_functions, constraints: metadata.constraints.map(c => [c.table_name, c.conname]) }));
