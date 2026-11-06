// New corrected manifests only. Preserve the reviewed original and its receipts.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {splitManagedS5TypedPreparations} from './lib/managed-s5-time-trial-preparations-20261106.mjs';
const folder='C:/Dev/artifacts/managed-teams-s5-20261106/';
const read=name=>JSON.parse(readFileSync(folder+name+'.json','utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
assert.equal(hash(readFileSync(folder+'season-stage-preparations-native.json')),'90158e8bae92ad13df78bd9ba9f91cf37b1ccb48074a95e1eef5f3cf898ac95e');
const result=splitManagedS5TypedPreparations({manifest:read('season-stage-preparations-native'),stageTypes:read('planning-preparation-stage-types'),
  riders:read('planning-riders-after-programme'),calendar:read('planning-calendar-after-programme'),objectives:read('planning-objectives-after-restoration')});
const written=[];
for(const [name,plan]of [['season-road-preparations-native',result.road],['season-time-trial-preparations-native',result.timeTrials]]){
  const filename=folder+name+'.json';assert.ok(!existsSync(filename),'Preserve the corrected frozen manifest: '+filename);
  const content=JSON.stringify(plan,null,2)+'\n';writeFileSync(filename,content);written.push({filename,sha256:hash(content),actions:plan.actions.length});
}
console.log(JSON.stringify({written,counts:result.counts,productionTouched:false},null,2));
