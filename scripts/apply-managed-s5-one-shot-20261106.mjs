// Real authorized actions only. Every committed action has a durable receipt.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {managedS5BatchSql,managedS5ActionBatches,MANAGED_S5_ACTION_KEYS,MANAGED_S5_SEASON} from './lib/managed-s5-action-sql-20261106.mjs';
const [mode,planFile,reviewedHash]=process.argv.slice(2);
assert.ok(['--prepare','--apply'].includes(mode));assert.ok(planFile&&reviewedHash&&process.argv.length===5);
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const folder='C:/Dev/artifacts/managed-teams-s5-20261106';
const teams=JSON.parse(readFileSync(path.join(folder,'identity.json'),'utf8'));
assert.deepEqual(teams.map(t=>t.bot_key).sort(),[...MANAGED_S5_ACTION_KEYS].sort());
const source=readFileSync(planFile,'utf8');assert.equal(createHash('sha256').update(source).digest('hex'),reviewedHash);
const plan=JSON.parse(source);assert.equal(plan.season_id,MANAGED_S5_SEASON);assert.equal(plan.game_year,5);assert.equal(plan.current_day,1);
assert.ok(Array.isArray(plan.actions)&&plan.actions.length<=1500);assert.equal(new Set(plan.actions.map(a=>a.bot_key+':'+a.key)).size,plan.actions.length);
const batches=managedS5ActionBatches(plan.actions);
const require=createRequire(import.meta.url);
const cli=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
// Validate the complete plan before the first real action, including later
// equipment/development phases that might use a different argument shape.
const compiledBatches=batches.map(batch=>managedS5BatchSql(batch,teams));
for(let index=0;index<batches.length;index++){
  const batch=batches[index];const sql=compiledBatches[index];
  const file=path.join(folder,`${path.basename(planFile,'.json')}-batch-${index+1}.sql`);writeFileSync(file,sql);
  if(mode==='--prepare')continue;
  let raw;
  try {raw=execFileSync(cli,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:25000,maxBuffer:300000});}
  catch(error){throw new Error(`Batch ${index+1} stopped; inspect receipts before retrying. ${String(error.stderr||error.message).slice(0,4000)}`);}
  const rows=JSON.parse(raw.slice(raw.indexOf('{'))).rows;assert.equal(rows.length,batch.length,'Unknown transaction result: stop and inspect');
  assert.deepEqual(rows.map(r=>r.bot_key+':'+r.action_key).sort(),batch.map(a=>a.bot_key+':'+a.key).sort(),'Unexpected transaction receipt');
  for(const row of rows){assert.ok(['applied','already_done'].includes(row.status));appendFileSync(path.join(folder,'receipts.jsonl'),JSON.stringify({at:new Date().toISOString(),plan:path.basename(planFile),...row})+'\n');}
  console.log(JSON.stringify({batch:index+1,totalBatches:batches.length,team:batch[0].bot_key,actions:rows.map(r=>({key:r.action_key,status:r.status,result:r.result}))}));
}
console.log(JSON.stringify({mode,plan:planFile,actions:plan.actions.length,batches:batches.length}));
