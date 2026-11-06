// Optional reviewed transport wrapper. Root alone runs --apply after review.
// Each original four-action transaction remains independent and idempotent.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {managedS5BatchSql,managedS5ActionBatches,MANAGED_S5_ACTION_KEYS,MANAGED_S5_SEASON} from './lib/managed-s5-action-sql-20261106.mjs';
import {managedS5GroupedSql} from './lib/managed-s5-grouped-sql-20261106.mjs';
const [mode,planFile,reviewedHash]=process.argv.slice(2);
assert.ok(['--prepare','--apply'].includes(mode));assert.ok(planFile&&reviewedHash&&process.argv.length===5);
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const folder='C:/Dev/artifacts/managed-teams-s5-20261106';
const teams=JSON.parse(readFileSync(path.join(folder,'identity.json'),'utf8'));
assert.deepEqual(teams.map(t=>t.bot_key).sort(),[...MANAGED_S5_ACTION_KEYS].sort());
const source=readFileSync(planFile,'utf8');assert.equal(createHash('sha256').update(source).digest('hex'),reviewedHash);
const plan=JSON.parse(source);assert.equal(plan.season_id,MANAGED_S5_SEASON);assert.equal(plan.game_year,5);assert.equal(plan.current_day,1);
assert.ok(Array.isArray(plan.actions)&&plan.actions.length<=1500);assert.equal(new Set(plan.actions.map(a=>a.bot_key+':'+a.key)).size,plan.actions.length);
const batches=managedS5ActionBatches(plan.actions),compiled=batches.map(batch=>managedS5BatchSql(batch,teams));
const groups=[];
for(let index=0;index<batches.length;index+=4){
  const transactions=batches.slice(index,index+4),sql=managedS5GroupedSql(compiled.slice(index,index+4));
  groups.push({first_batch:index+1,transactions,actions:transactions.flat(),sql});
}
const require=createRequire(import.meta.url);
const cli=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
for(let index=0;index<groups.length;index++){
  const group=groups[index],file=path.join(folder,`${path.basename(planFile,'.json')}-group-${index+1}.sql`);writeFileSync(file,group.sql);
  if(mode==='--prepare')continue;
  let raw;
  try{raw=execFileSync(cli,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:45000,maxBuffer:1200000});}
  catch(error){throw new Error(`Group ${index+1} stopped. Earlier independent transactions may be committed; inspect durable receipts and replay the same group/plan. ${String(error.stderr||error.message).slice(0,4000)}`);}
  const rows=JSON.parse(raw.slice(raw.indexOf('{'))).rows;
  assert.equal(rows.length,group.actions.length,'Unknown grouped result; stop and inspect durable receipts');
  assert.deepEqual(rows.map(r=>r.bot_key+':'+r.action_key).sort(),group.actions.map(a=>a.bot_key+':'+a.key).sort(),'Unexpected grouped receipt');
  for(const row of rows){
    assert.ok(['applied','already_done'].includes(row.status));
    assert.ok(Number.isInteger(row.batch_number)&&row.batch_number>=1&&row.batch_number<=group.transactions.length);
    appendFileSync(path.join(folder,'receipts.jsonl'),JSON.stringify({at:new Date().toISOString(),plan:path.basename(planFile),group:index+1,...row})+'\n');
  }
  console.log(JSON.stringify({group:index+1,totalGroups:groups.length,firstBatch:group.first_batch,transactions:group.transactions.length,
    actions:rows.map(r=>({bot_key:r.bot_key,key:r.action_key,status:r.status,result:r.result}))}));
}
console.log(JSON.stringify({mode,plan:planFile,actions:plan.actions.length,independentTransactions:batches.length,cliCalls:groups.length}));
