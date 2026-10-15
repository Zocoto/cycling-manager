// Production: reviewed schema/catalogue only. No fixtures, historical scan,
// backfill, automatic claim or reward. Run isolated SQL tests first.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")),"bin/supabase.exe");
const version="20261015130000";
const file=`supabase/migrations/${version}_prospective_career_achievements.sql`;
if(process.argv[2]!=="--apply-reviewed-fix" || readFileSync("supabase/.temp/project-ref","utf8").trim()!=="ikagfuchasnsakpouosg") throw new Error("Explicit reviewed-fix flag and expected project required.");
const call=(args,timeout=20000)=>execFileSync(binary,args,{encoding:"utf8",timeout,maxBuffer:500000});
const query=sql=>{const raw=call(["db","query","--linked",sql,"--output","json"]);return JSON.parse(raw.slice(raw.indexOf("{"))).rows;};
const receipt=query(`begin read only; set local application_name='career-achievements-preflight-20261015';
  set local statement_timeout='8s'; set local lock_timeout='1s';
  select 1 database_ok,exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
    to_regprocedure('public.record_prospective_career_race(uuid,jsonb,uuid[])') is not null installed; rollback;`)[0];
if(receipt.recorded&&!receipt.installed) throw new Error("History/schema mismatch: inspect without retrying mutation.");
if(!receipt.installed) {
  const expected=JSON.parse(readFileSync(".tmp-prospective-achievements/live-schema.json","utf8")).filter(r=>r.kind==="function");
  const current=query(`begin read only; set local statement_timeout='8s'; set local lock_timeout='1s';
    select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p
    where p.oid in ('public.get_active_calendar_stage_equipment_effects(uuid[])'::regprocedure,
      'public.settle_due_fan_club_shop_sales()'::regprocedure,'public.get_current_game_objectives()'::regprocedure,
      'public.calculate_game_objective_progress(text,uuid,uuid,numeric)'::regprocedure,
      'public.claim_current_game_objective(text)'::regprocedure,'private.notify_sporting_director_trophy()'::regprocedure); rollback;`);
  if(expected.length!==6||current.length!==6||current.some(row=>expected.find(e=>e.signature===row.signature)?.definition!==row.definition)) throw new Error("Deployed SQL changed since isolated verification; review before installing.");
  call(["db","query","--linked","--file",file,"--output","json"],60000);
  console.log("Reviewed prospective achievement migration committed; no retrospective work executed.");
}
const health=query(`begin read only; set local statement_timeout='5s';
  select 1 database_ok,(select count(*) from career_achievement_epoch) epochs,
    (select count(*) from career_achievement_progress) progress_rows,
    (select count(*) from game_objective_claims c join game_objective_definitions d on d.objective_key=c.objective_key where d.metric_key like 'future%') new_claims,
    (select count(*) from game_objective_definitions where objective_key like 'journey\_%' escape '\') definitions,
    (select activated_at from career_achievement_epoch) activated_at; rollback;`)[0];
if(health.database_ok!==1||Number(health.epochs)!==1||Number(health.definitions)!==29) throw new Error("Installation health mismatch: do not promote app.");
if(!receipt.recorded) {
  call(["migration","repair",version,"--status","applied","--linked","--yes"]);
  console.log(`Recorded only migration ${version}.`);
}
console.log(JSON.stringify(health));
