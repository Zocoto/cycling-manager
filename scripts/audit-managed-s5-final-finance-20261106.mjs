import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createManagedFinanceAuditSql,verifyManagedFinanceAudit} from './lib/managed-s5-finance-audit-20261106.mjs';

const folder=path.resolve(process.argv[3]??'C:/Dev/artifacts/managed-teams-s5-20261106');
const read=name=>JSON.parse(readFileSync(path.join(folder,name),'utf8'));
const identity=read('identity.json');
const mode=process.argv[2];
if(mode==='prepare'){
  const file=path.join(folder,'final-finance-contracts-equipment.sql');
  writeFileSync(file,createManagedFinanceAuditSql(identity),'utf8');console.log(JSON.stringify({prepared:file,production_touched:false}));
}else{
  assert.equal(mode,'verify','Usage: node script.mjs prepare|verify [artifact-folder] [additional-plan.json...]');
  const receipts=readFileSync(path.join(folder,'receipts.jsonl'),'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const names=new Set(['roster-equipment-actions.json',...receipts.map(r=>r.plan),...process.argv.slice(4)]);
  for(const name of names)assert.equal(path.basename(name),name,'Manifest must belong to artifact folder');
  const report=verifyManagedFinanceAudit({snapshot:read('final-finance-contracts-equipment.json'),identity,rosterPlan:read('recruitment-plan.json'),
    baseline:read('contracts-equipment.json'),manifests:[...names].map(read),localReceipts:receipts});
  report.source_sha256=Object.fromEntries(['final-finance-contracts-equipment.json','recruitment-plan.json','contracts-equipment.json',...names]
    .map(name=>[name,createHash('sha256').update(readFileSync(path.join(folder,name))).digest('hex')]));
  const output=path.join(folder,'final-finance-contracts-equipment-verification.json');writeFileSync(output,JSON.stringify(report,null,2)+'\n','utf8');
  console.log(JSON.stringify({report:output,status:report.status,counts:report.counts,teams:report.teams}));
}
