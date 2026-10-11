// Applies only the reviewed task migration, then real catch-up in small,
// committed batches. No fixtures, benchmarks, replay or unrelated migrations.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")),"bin/supabase.exe");
const version="20261011170000";
const file=`supabase/migrations/${version}_preserve_training_decimals_between_seasons.sql`;
if(process.argv[2]!=="--apply-reviewed-fix" || readFileSync("supabase/.temp/project-ref","utf8").trim()!=="ikagfuchasnsakpouosg") throw new Error("Explicit reviewed-fix flag and expected project required.");
function call(args,timeout=30000) {
  return execFileSync(binary,args,{encoding:"utf8",timeout,maxBuffer:200000});
}
function query(sql) {
  const raw=call(["db","query","--linked",sql,"--output","json"]);
  return JSON.parse(raw.slice(raw.indexOf("{"))).rows;
}
const receipt=query(`begin read only; set local statement_timeout='8s'; select 1 database_ok,
  exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
  to_regprocedure('private.apply_training_season_carryover(uuid,uuid,text)') is not null installed; rollback;`)[0];
if(receipt.recorded && !receipt.installed) throw new Error("History/schema mismatch: inspect before any mutation.");
if(!receipt.installed) {
  call(["db","query","--linked","--file",file,"--output","json"],60000);
  console.log("Reviewed training continuity migration committed.");
}
if(!receipt.recorded) {
  call(["migration","repair",version,"--status","applied","--linked","--yes"]);
  console.log(`Recorded only migration ${version}.`);
}
const target=query("begin read only; set local statement_timeout='8s'; select id,game_year from seasons where status='active'; rollback;")[0];
// Never run a historical backfill automatically after a later season change.
if(target?.game_year!==4) throw new Error("Only the audited S4 catch-up is authorized by this script.");
let riders=0,stats=0,finished=false;
for(let batch=1;batch<=50;batch++) {
  const result=query(`begin; set local application_name='cycling-manager-training-fraction-catchup-20261011';
    set local lock_timeout='3s'; set local statement_timeout='15s';
    select private.repair_training_season_carryovers('${target.id}'::uuid,50) result; commit;`)[0]?.result;
  if(!result || result.busy) throw new Error("Catch-up is busy or outcome unknown; inspect state before retrying.");
  riders+=result.repairedRiders;stats+=result.repairedStats;
  console.log(JSON.stringify({batch,...result}));
  if(result.repairedStats===0){finished=true;break;}
}
if(!finished) throw new Error("Batch safety limit reached; audit remaining stats before continuing.");
console.log(JSON.stringify({catchupComplete:true,repairedRiders:riders,repairedStats:stats,database_ok:query("select 1 database_ok")[0].database_ok}));
