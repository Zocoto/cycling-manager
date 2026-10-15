// Bounded read-only incident diagnostics. Never writes or runs gameplay jobs.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { config } from "dotenv";
config({path:".env.local",quiet:true});
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")),"bin/supabase.exe");
function query(sql) {
  const raw=execFileSync(binary,["db","query","--linked",`begin read only; set local application_name='latency-audit-20261015'; set local statement_timeout='5s'; set local lock_timeout='1s'; ${sql}; rollback;`,"--output","json"],{encoding:"utf8",timeout:15000,maxBuffer:100000});
  return JSON.parse(raw.slice(raw.indexOf("{"))).rows;
}
try {
  console.log(JSON.stringify({activity:query(`select pid,application_name,state,wait_event_type,wait_event,round(extract(epoch from clock_timestamp()-query_start)) seconds,
    pg_blocking_pids(pid) blockers,left(regexp_replace(query,'''[^'']*''','?', 'g'),180) query
    from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and state<>'idle'
    order by query_start limit 12`)}));
  console.log(JSON.stringify({samples:query(`select route,metric,device,ok,round(value::numeric) value,recorded_at
    from public.performance_samples order by recorded_at desc limit 35`)}));
  for(const [name,url,headers] of [
    ["database-rest",`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/seasons?select=status&status=eq.active&limit=1`,{apikey:process.env.SUPABASE_SECRET_KEY,Authorization:`Bearer ${process.env.SUPABASE_SECRET_KEY}`}],
    ["home","https://cyclostratege.fr",{}],
    ["login","https://cyclostratege.fr/connexion",{}],
  ]) {
    const start=performance.now();
    const response=await fetch(url,{headers,signal:AbortSignal.timeout(12000)});
    const headerMs=Math.round(performance.now()-start); await response.arrayBuffer();
    console.log(JSON.stringify({http:name,status:response.status,headerMs,totalMs:Math.round(performance.now()-start)}));
    if(!response.ok) throw new Error(`Unhealthy ${name}: stop diagnostics`);
  }
} catch(error) {console.error(error.message);process.exitCode=1;}
