import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")),"bin/supabase.exe");
function query(sql) {
  const raw=execFileSync(binary,["db","query","--linked",`begin read only; set local application_name='latency-stats-20261015'; set local statement_timeout='3s'; set local lock_timeout='1s'; ${sql}; rollback;`,"--output","json"],{encoding:"utf8",timeout:12000,maxBuffer:100000});
  return JSON.parse(raw.slice(raw.indexOf("{"))).rows;
}
const namespace=query("select n.nspname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relname='pg_stat_statements' and c.relkind='v' limit 1")[0]?.nspname;
if(!namespace||!/^[a-z_]+$/.test(namespace)) throw new Error("Statistics view unavailable");
const rows=query(`select calls,round(mean_exec_time::numeric,1) mean_ms,round(max_exec_time::numeric,1) max_ms,
 round(total_exec_time::numeric) total_ms,left(regexp_replace(query,'''[^'']*''','?', 'g'),650) query
 from ${namespace}.pg_stat_statements where calls>0 order by total_exec_time desc limit 12`);
mkdirSync(".tmp-latency-audit",{recursive:true});
writeFileSync(".tmp-latency-audit/statements.json",JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows));
