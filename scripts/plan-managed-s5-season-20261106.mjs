// Offline orchestration only. Reads snapshots, plans real future gameplay and
// writes reviewable manifests. Never connects to Supabase or invokes a worker.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MANAGED_S5_KEYS,planManagedS5Season} from './lib/managed-s5-season-planner-20261106.mjs';
import {nativeActionCall} from './lib/managed-s5-action-sql-20261106.mjs';

const defaultFolder='C:/Dev/artifacts/managed-teams-s5-20261106';
const n=value=>{const parsed=Number(value);assert.ok(Number.isFinite(parsed),'Invalid financial value');return parsed;};
const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const sortIds=ids=>[...ids].sort();
const defaultBuildReserves={elodie_martin:141000,thomas_vermeulen:100000};
const defaultReconnaissanceCaps={antoine_morel_29:25000,elodie_martin:15000,giulia_rinaldi:25000,mikkel_sorensen:10000,
  pixel_sprint:20000,rafael_costa:12000,shadow_peloton:7000,thomas_vermeulen:15000};

export function buildManagedS5SeasonArtifacts(snapshots,{now=Date.now(),config={},finalized=false}={}){
  const {context,riders,busy,calendar,registrations,objectives,preparers=[],reconnaissances=[]}=snapshots;
  assert.deepEqual(context.map(t=>t.bot_key).sort(),[...MANAGED_S5_KEYS].sort());
  const finance=snapshots.budgets;
  assert.equal(finance.length,8,'Need one financial snapshot per managed team');
  assert.deepEqual(finance.map(t=>t.bot_key).sort(),[...MANAGED_S5_KEYS].sort());
  const snapshot={context,riders,busy,calendar,registrations,objectives,reconnaissances};
  const dry=planManagedS5Season(snapshot,{now});
  const recoveryBudgets={},reconnaissanceBudgets={},budgetReview=[];
  for(const team of context){
    const current=finance.find(t=>t.bot_key===team.bot_key);
    assert.equal(current.team_id,team.team_id);assert.equal(current.team_season_id,team.team_season_id);
    const buildReserve=n(config.buildReserves?.[team.bot_key]??defaultBuildReserves[team.bot_key]??0);
    const cash=n(current.cash_balance),projected=n(current.projected_budget);
    const available=Math.max(0,Math.min(cash-15000-buildReserve,projected-25000-buildReserve));
    const rosterSize=riders.filter(r=>r.team_id===team.team_id).length;
    const desiredRecovery=n(config.recoveryCaps?.[team.bot_key]??(rosterSize>=12?24000:12000));
    const desiredRecon=n(config.reconnaissanceCaps?.[team.bot_key]??defaultReconnaissanceCaps[team.bot_key]);
    assert.ok([buildReserve,desiredRecovery,desiredRecon].every(v=>v>=0));
    // Preserve a modest reconnaissance allowance before filling the recovery
    // envelope. All actual bookings still obey their exact native price.
    const hasTarget=dry.preparation_targets.some(t=>t.team_id===team.team_id);
    const minimumRecon=hasTarget?Math.min(4000,desiredRecon,available):0;
    const recovery=Math.min(desiredRecovery,Math.max(0,available-minimumRecon));
    const recon=Math.min(desiredRecon,Math.max(0,available-recovery));
    recoveryBudgets[team.team_id]=recovery;reconnaissanceBudgets[team.team_id]=recon;
    budgetReview.push({bot_key:team.bot_key,team_id:team.team_id,cash_balance:cash,projected_budget:projected,
      reserved_building_cost:buildReserve,available_for_camps:available,recovery_envelope:recovery,reconnaissance_envelope:recon});
  }
  const programme=planManagedS5Season(snapshot,{now,recoveryBudgets,reconnaissanceBudgets,preparers});
  assert.deepEqual(programme.actions,dry.actions,'Budget allocation must not silently alter the race programme');
  assert.equal(programme.withdrawals.length,0,'Existing entries need a separate reviewed withdrawal action');
  const header={season_id:programme.season_id,game_year:5,current_day:1,generated_at:programme.generated_at,finalized};
  const flags={min_cash:15000,min_projected:25000};
  const registrationActions=programme.actions.map(a=>{
    assert.equal(a.operation,'register','An existing accepted roster needs an explicit update RPC review');
    assert.equal(a.expected_status,'accepted','Pending Elite WildCards require a separate reviewed driver postcondition');
    const args={p_race_edition_id:a.race_edition_id,p_rider_ids:sortIds(a.rider_ids)};
    return {key:`managed-s5:${a.bot_key}:register:${a.race_edition_id}:${digest(args).slice(0,10)}`,bot_key:a.bot_key,
      rpc:'save_current_team_race_roster',args,...flags,max_cash_cost:0,
      race_name:a.race_name,days:a.days,stage_count:a.stage_count};
  });
  const reconnaissanceActions=programme.reconnaissance_actions.map(a=>({...a,...flags}));
  const recoveryActions=programme.camp_actions.map(a=>({
    key:`managed-s5:${a.bot_key}:recovery:${a.rider_ids[0]}:${a.start_day}`,bot_key:a.bot_key,
    rpc:'book_current_team_form_camps',args:{p_rider_ids:sortIds(a.rider_ids),p_camp_type:a.camp_type,p_start_day_number:a.start_day,p_end_day_number:a.end_day},
    ...flags,max_cash_cost:a.expected_cost,reason:a.reason,
  }));
  for(const action of [...registrationActions,...reconnaissanceActions,...recoveryActions])nativeActionCall(action);
  const phases=[
    {filename:'season-registrations-native.json',plan:{...header,phase:'registrations',actions:registrationActions}},
    {filename:'season-reconnaissances-native.json',plan:{...header,phase:'reconnaissances',requires:'registrations committed and verified',actions:reconnaissanceActions}},
    {filename:'season-recovery-native.json',plan:{...header,phase:'recovery',requires:'registrations and reconnaissances committed and verified',actions:recoveryActions}},
  ];
  for(const line of budgetReview){
    const actual=programme.teams.find(t=>t.bot_key===line.bot_key);
    line.planned_recovery_cost=actual.recovery_cost;line.planned_reconnaissance_cost=actual.reconnaissance_cost;
    line.total_planned_cost=actual.recovery_cost+actual.reconnaissance_cost;
    assert.ok(line.total_planned_cost<=line.available_for_camps+.001);
  }
  return {programme:{...programme,finalized,budget_review:budgetReview,
    phase_order:phases.map((p,index)=>({order:index+1,file:p.filename,actions:p.plan.actions.length})),
    active_preparers_used:[...new Set(reconnaissanceActions.map(a=>a.args.p_preparer_contract_id).filter(Boolean))]},phases};
}

export function prepareManagedS5SeasonFromFiles({folder=defaultFolder,mode='--preview',configFile=null,now=Date.now()}={}){
  assert.ok(['--preview','--final'].includes(mode));const finalized=mode==='--final';
  const inputFiles={},missingFinal=[];
  const read=(name,fallback=null)=>{
    const exact=path.join(folder,name+'.json');
    if(existsSync(exact)){inputFiles[name]=exact;return JSON.parse(readFileSync(exact,'utf8'));}
    if(finalized||!fallback)throw Error(`Required final snapshot missing: ${exact}`);
    missingFinal.push(name);const alternative=path.join(folder,fallback+'.json');
    inputFiles[name]=alternative;return JSON.parse(readFileSync(alternative,'utf8'));
  };
  const context=read('identity-after-roster','identity');
  const riders=read('planning-riders-after-roster','planning-riders');
  const busy=read('planning-busy-after-roster','planning-busy');
  const registrations=read('planning-registrations-after-roster','planning-registrations');
  const calendar=read('planning-calendar-after-roster','planning-calendar');
  const objectives=read('planning-objectives-after-restoration','planning-objectives');
  // The actual native helper results are required in final mode even if empty.
  const preparerFile=path.join(folder,'planning-preparers.json');
  const preparers=existsSync(preparerFile)?read('planning-preparers'):[];
  if(!existsSync(preparerFile)){if(finalized)throw Error('Capture planning-preparers.json using the native preparer helpers before finalizing');missingFinal.push('planning-preparers');}
  const staff=read('staff-after-hiring','staff');
  const budgetFile=path.join(folder,'planning-budget-final.json');
  let budgets;
  if(existsSync(budgetFile)){
    budgets=read('planning-budget-final');
    if(finalized)assert.ok(budgets.every(b=>Number.isFinite(Date.parse(b.checked_at))&&now-Date.parse(b.checked_at)<15*60*1000),'Final budgets are older than 15 minutes; capture them again after support actions');
  }else{
    if(finalized)throw Error('Capture planning-budget-final.json after staff/junior spending before finalizing');
    missingFinal.push('planning-budget-final');
    budgets=context.map(t=>({...t,projected_budget:t.cash_balance}));
  }
  const reconnFile=path.join(folder,'planning-reconnaissances.json');
  const reconnaissances=existsSync(reconnFile)?read('planning-reconnaissances'):[];
  const config=configFile?JSON.parse(readFileSync(configFile,'utf8')):{};
  const result=buildManagedS5SeasonArtifacts({context,riders,busy,calendar,registrations,objectives,preparers,budgets,reconnaissances},{now,config,finalized});
  const manifest={...result.programme,source_snapshots:Object.fromEntries(Object.entries(inputFiles).map(([name,file])=>[name,
    {file,sha256:digest(readFileSync(file,'utf8'))}])),missing_final_inputs:missingFinal,
    staff_contracts_observed:staff.filter(r=>r.kind==='team_staff').reduce((sum,r)=>sum+(r.payload.contracts??[]).length,0)};
  const reportName=finalized?'season-program.json':'season-program-preview.json';
  writeFileSync(path.join(folder,reportName),JSON.stringify(manifest,null,2)+'\n');
  const outputs=[];
  if(finalized)for(const phase of result.phases){
    const source=JSON.stringify(phase.plan,null,2)+'\n',file=path.join(folder,phase.filename);writeFileSync(file,source);
    outputs.push({file,actions:phase.plan.actions.length,sha256:digest(source)});
  }
  return {mode,finalized,report:path.join(folder,reportName),missingFinalInputs:missingFinal,outputs,
    registrations:result.phases[0].plan.actions.length,reconnaissances:result.phases[1].plan.actions.length,recoveryCamps:result.phases[2].plan.actions.length,
    preparersUsed:manifest.active_preparers_used,budgets:manifest.budget_review,warnings:manifest.warnings};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),mode=args[0]??'--preview';
  const option=name=>{const index=args.indexOf(name);return index>=0?args[index+1]:null;};
  console.log(JSON.stringify(prepareManagedS5SeasonFromFiles({mode,folder:option('--folder')??defaultFolder,configFile:option('--config')}),null,2));
}
