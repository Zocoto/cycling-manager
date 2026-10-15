// Read-only, bounded production metadata. No player fixtures or gameplay writes.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
if (readFileSync("supabase/.temp/project-ref", "utf8").trim() !== "ikagfuchasnsakpouosg") throw new Error("Unexpected project");
const binary = path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")), "bin/supabase.exe");
const sql = `begin read only; set local statement_timeout='6s'; set local lock_timeout='1s';
select 'function' kind,p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p
where p.oid in ('public.get_active_calendar_stage_equipment_effects(uuid[])'::regprocedure,
 'public.settle_due_fan_club_shop_sales()'::regprocedure,'public.get_current_game_objectives()'::regprocedure,
 'public.calculate_game_objective_progress(text,uuid,uuid,numeric)'::regprocedure,
 'public.claim_current_game_objective(text)'::regprocedure,'private.notify_sporting_director_trophy()'::regprocedure)
union all select 'column',table_name||'.'||column_name,data_type from information_schema.columns where table_schema='public'
and table_name in ('races','race_editions','stages','stage_results','race_results','youth_scouting_candidates',
 'sporting_director_trophies','rider_training_sessions','staff_academy_trainings','equipment_rnd_projects'); rollback;`;
const raw = execFileSync(binary,["db","query","--linked",sql,"--output","json"],{encoding:"utf8",timeout:15000,maxBuffer:500000});
const result = JSON.parse(raw.slice(raw.indexOf("{")));
mkdirSync(".tmp-prospective-achievements",{recursive:true});
writeFileSync(".tmp-prospective-achievements/live-schema.json",JSON.stringify(result.rows,null,2));
console.log(JSON.stringify({readOnly:true,definitions:result.rows.filter(r=>r.kind==="function").map(r=>r.signature),columns:result.rows.filter(r=>r.kind==="column").length}));
