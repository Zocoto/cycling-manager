// Apply only these two reviewed, bounded catalog migrations, never gameplay fixtures.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

assert.equal(process.argv[2], '--apply', 'Explicit --apply is required.');
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const baseline=JSON.parse(readFileSync('artifacts/.tmp-financial-director-projection/consistency-functions.json','utf8'));
const literal=value=>`'${value.replaceAll("'","''")}'`;
const preflight=`begin read only;set local application_name='df-projection-migration-preflight';set local statement_timeout='4s';set local lock_timeout='500ms';
select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid)) hash,p.proowner::regrole::text owner,p.proacl::text acl
from pg_proc p where p.oid in (${baseline.map(row=>`${literal(row.signature)}::regprocedure`).join(',')});commit;`;
const run=(args,timeout=25000)=>execFileSync(binary,args,{encoding:'utf8',timeout,maxBuffer:150000,stdio:['ignore','pipe','pipe']});
const raw=run(['db','query','--linked',preflight,'--output','json']);
const rows=JSON.parse(raw.slice(raw.indexOf('{'))).rows;
assert.equal(rows.length,baseline.length);
for(const old of baseline){
  const row=rows.find(item=>item.signature===old.signature);
  assert.ok(row,`Missing baseline ${old.signature}`);
  assert.equal(row.hash,old.definition_hash,`Production drift: ${old.signature}`);
  assert.equal(row.owner,old.owner);
  assert.equal(row.acl,old.acl);
}
console.log('Preflight read-only: five function definitions and permissions unchanged.');
for(const name of ['20261021120000_project_financial_director_income','20261021121000_align_df_purchase_projection']){
  const file=`supabase/migrations/${name}.sql`;
  const sql=readFileSync(file,'utf8');
  assert.ok(sql.trimStart().startsWith('begin;') && sql.trimEnd().endsWith('commit;'));
  assert.ok(sql.includes("set local lock_timeout = '1s'") && sql.includes("set local statement_timeout = '5s'"));
  run(['db','query','--linked','--file',file,'--output','json']);
  console.log(`Applied reviewed migration: ${name}`);
  run(['migration','repair',name.slice(0,14),'--status','applied','--linked','--yes']);
  console.log(`Recorded migration: ${name.slice(0,14)}`);
}
