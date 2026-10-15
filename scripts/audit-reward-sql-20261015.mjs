import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")),"bin/supabase.exe");
const sql=`begin read only; set local application_name='reward-latency-audit-20261015'; set local statement_timeout='5s'; set local lock_timeout='1s';
 select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p
 where p.oid in ('public.get_current_game_objectives_pre_prospective()'::regprocedure,
   'public.calculate_game_objective_progress_pre_prospective(text,uuid,uuid,numeric)'::regprocedure,
   'public.get_current_game_objective_summary_cached()'::regprocedure); rollback;`;
const raw=execFileSync(binary,["db","query","--linked",sql,"--output","json"],{encoding:"utf8",timeout:15000,maxBuffer:200000});
const rows=JSON.parse(raw.slice(raw.indexOf("{"))).rows;
mkdirSync(".tmp-latency-audit",{recursive:true});
writeFileSync(".tmp-latency-audit/reward-sql.json",JSON.stringify(rows,null,2));
console.log(JSON.stringify({readOnly:true,signatures:rows.map(r=>r.signature)}));
