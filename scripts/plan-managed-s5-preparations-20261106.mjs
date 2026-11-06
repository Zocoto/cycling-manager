// Offline only: consumes committed programme snapshots, never calls a database.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,statSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {planManagedS5Preparations} from './lib/managed-s5-preparation-planner-20261106.mjs';
import {nativeActionCall} from './lib/managed-s5-action-sql-20261106.mjs';

const defaultFolder='C:/Dev/artifacts/managed-teams-s5-20261106';
const frozenHashes={
  'season-registrations-native.json':'647a19abedcc55a18ce8463423c88c7ac57d357eb3c3147b65f17cc3804467d9',
  'season-reconnaissances-native.json':'e8dabbee0b99683d3af422e60034e460aab8b9d321b20b5fa077fe9f9641dde8',
  'season-recovery-native.json':'94506c5793002bc8b70f2cc9226a209cba370be5ad6f5097ba1f21134e2d3701',
};
const hash=content=>createHash('sha256').update(content).digest('hex');
const sorted=values=>[...values].sort();
const key=(team,race)=>`${team}:${race}`;

export function buildManagedS5PreparationArtifacts(snapshots,{now=Date.now(),finalized=false}={}){
  const {context,riders,calendar,registrations,busy,staff,objectives,programme,registrationManifest}=snapshots;
  assert.equal(programme.finalized,true,'Need the frozen final programme');
  assert.equal(programme.season_id,context[0].season_id,'Programme season mismatch');
  assert.equal(registrationManifest.season_id,programme.season_id,'Registration manifest season mismatch');
  assert.equal(new Set(riders.map(r=>r.id)).size,riders.length,'Duplicate current rider');
  assert.deepEqual(sorted(riders.map(r=>`${r.team_id}:${r.id}`)),sorted(programme.riders.map(r=>`${r.team_id}:${r.id}`)),
    'Current owned roster differs from the approved programme');
  assert.ok(riders.every(r=>r.status==='active'&&Number.isFinite(Number(r.form))&&r.form!=null),'Fresh active riders and current forms required');
  const teamByKey=new Map(context.map(t=>[t.bot_key,t]));
  const teamBySeasonId=new Map(context.map(t=>[t.team_season_id,t]));
  const races=new Map(calendar.map(r=>[r.id,r]));
  const normalized=registrations.map(r=>{
    const team=teamByKey.get(r.bot_key)??teamBySeasonId.get(r.team_season_id);
    assert.ok(team,'Foreign registration snapshot');
    assert.ok(!r.team_season_id||r.team_season_id===team.team_season_id,'Registration team identity mismatch');
    return {...r,team_id:team.team_id,team_season_id:team.team_season_id,bot_key:team.bot_key};
  });
  assert.equal(new Set(normalized.map(r=>key(r.team_season_id,r.race_edition_id))).size,normalized.length,'Duplicate race registration');
  for(const expected of registrationManifest.actions){
    const team=teamByKey.get(expected.bot_key);assert.ok(team);
    const real=normalized.find(r=>r.team_season_id===team.team_season_id&&r.race_edition_id===expected.args.p_race_edition_id);
    assert.equal(real?.status,'accepted',`Programme registration not committed: ${expected.key}`);
    assert.deepEqual(sorted(real.rider_ids),sorted(expected.args.p_rider_ids),`Committed roster mismatch: ${expected.key}`);
    assert.ok(races.has(real.race_edition_id),'Accepted programme race missing from fresh calendar');
  }
  for(const entry of normalized.filter(r=>r.status==='accepted')){
    const currentBusy=busy.filter(b=>b.registration_id===entry.id&&b.registration_status==='accepted'&&['selected','confirmed'].includes(b.status));
    assert.deepEqual(sorted(currentBusy.map(b=>b.rider_id)),sorted(entry.rider_ids),`Busy/accepted roster snapshot mismatch: ${entry.id}`);
  }
  const plan=planManagedS5Preparations({context,riders,calendar,registrations:normalized,busy,staff,objectives,plan:programme},{now});
  assert.equal(plan.warnings.length,0,'Preparation warnings need review before application');
  const stageActions=plan.actions.filter(a=>a.rpc==='save_current_team_race_preparation_with_sprint');
  const trainingActions=plan.actions.filter(a=>a.rpc!=='save_current_team_race_preparation_with_sprint');
  assert.equal(trainingActions.length,16,'Eight form thresholds and eight atomic roster training batches required');
  assert.equal(plan.training.reduce((sum,t)=>sum+t.rider_count,0),riders.length);
  const expectedStages=normalized.filter(r=>r.status==='accepted'&&races.get(r.race_edition_id)?.competition_type==='standard')
    .reduce((sum,r)=>sum+races.get(r.race_edition_id).stages.filter(s=>s.status==='planned'&&Date.parse(s.departureAt)>now).length,0);
  assert.equal(stageActions.length,expectedStages,'Not all accepted future standard stages were prepared');
  for(const action of plan.actions)nativeActionCall(action);
  const header={season_id:plan.season_id,game_year:5,current_day:1,generated_at:plan.generated_at,finalized};
  const phases=[
    {filename:'season-training-native.json',plan:{...header,phase:'training',actions:trainingActions}},
    {filename:'season-stage-preparations-native.json',plan:{...header,phase:'stage_preparations',requires:'training committed and verified',actions:stageActions}},
  ];
  return {report:{...plan,finalized,verification:{current_riders:riders.length,exact_programme_registrations:registrationManifest.actions.length,
    actual_accepted_registrations:normalized.filter(r=>r.status==='accepted').length,prepared_future_stages:expectedStages},
    phase_order:phases.map((phase,index)=>({order:index+1,file:phase.filename,actions:phase.plan.actions.length}))},phases};
}

export function prepareManagedS5PreparationsFromFiles({folder=defaultFolder,mode='preview',now=Date.now()}={}){
  assert.ok(['preview','final'].includes(mode));
  const sources={},read=name=>{
    const filename=path.join(folder,name),content=readFileSync(filename);
    sources[name]={sha256:hash(content),modified_at:statSync(filename).mtime.toISOString()};
    return JSON.parse(content.toString('utf8'));
  };
  for(const [name,digest]of Object.entries(frozenHashes))assert.equal(hash(readFileSync(path.join(folder,name))),digest,`Frozen manifest changed: ${name}`);
  const context=read(existsSync(path.join(folder,'identity-after-programme.json'))?'identity-after-programme.json':'identity-after-roster.json');
  const names=['planning-riders-after-programme.json','planning-busy-after-programme.json',
    'planning-registrations-after-programme.json','planning-calendar-after-programme.json'];
  const values=names.map(name=>read(name));
  for(const name of names){
    const age=now-Date.parse(sources[name].modified_at);
    assert.ok(age>=-60000&&age<=30*60*1000,`Refresh post-programme snapshot: ${name}`);
  }
  const snapshots={context,riders:values[0],busy:values[1],registrations:values[2],calendar:values[3],
    staff:read('staff-after-hiring.json'),objectives:read('planning-objectives-after-restoration.json'),
    programme:read('season-program.json'),registrationManifest:read('season-registrations-native.json')};
  assert.equal(snapshots.riders.length,90,'Expected all 90 real recruited riders');
  const artifacts=buildManagedS5PreparationArtifacts(snapshots,{now,finalized:mode==='final'});
  artifacts.report.source_snapshots=sources;
  const writes=mode==='final'?[...artifacts.phases,{filename:'season-preparations.json',plan:artifacts.report}]
    :[{filename:'season-preparations-preview.json',plan:artifacts.report}];
  if(mode==='final')for(const file of writes)assert.ok(!existsSync(path.join(folder,file.filename)),`Final output already exists; preserve it: ${file.filename}`);
  const written=writes.map(file=>{
    const content=JSON.stringify(file.plan,null,2)+'\n',filename=path.join(folder,file.filename);
    writeFileSync(filename,content);return {filename,sha256:hash(content),actions:file.plan.actions.length};
  });
  return {mode,written,verification:artifacts.report.verification,training:artifacts.report.training.map(t=>({bot_key:t.bot_key,
    riders:t.rider_count,minimum_form:t.minimum_form,coached:t.rider_count-t.uncoached,uncoached:t.uncoached,trainer_usage:t.trainer_usage})),
  warnings:artifacts.report.warnings,productionTouched:false};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
  const args=process.argv.slice(2),folderIndex=args.indexOf('--folder');
  console.log(JSON.stringify(prepareManagedS5PreparationsFromFiles({mode:args.includes('--final')?'final':'preview',
    folder:folderIndex>=0?args[folderIndex+1]:defaultFolder}),null,2));
}
