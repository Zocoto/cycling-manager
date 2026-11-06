import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {MANAGED_S5_KEYS} from './lib/managed-s5-season-planner-20261106.mjs';
import {buildManagedS5SeasonArtifacts,prepareManagedS5SeasonFromFiles} from './plan-managed-s5-season-20261106.mjs';
const now=Date.parse('2026-11-06T13:00:00Z'),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const axes=['mountain','hills','flat','time_trial','cobbles','sprint','acceleration','downhill','endurance','resistance','recovery','breakaway','prologue'];
function fixture(){
  const context=MANAGED_S5_KEYS.map((bot_key,i)=>({bot_key,team_id:id(100+i),team_season_id:id(200+i),season_id:id(5),game_year:5,
    current_day_number:1,reputation_points:250,division_code:'world',registration_country_id:'fr',continent_code:'europe',cash_balance:300000}));
  const riders=context.flatMap((t,k)=>Array.from({length:4},(_,i)=>({id:id(1000+k*100+i),team_id:t.team_id,bot_key:t.bot_key,status:'active',
    ...Object.fromEntries(axes.map(a=>[a,a==='hills'?65+i:55])),camp_days:[],season_race_days:0})));
  const calendar=[2,3,6,10,20].map((day,i)=>({id:id(500+i),display_name:`Race ${day}`,category:'national',country_id:'fr',continent_code:'europe',
    competition_type:'standard',race_format:'one_day',status:'planned',registration_policy:'open',minimum_reputation:0,
    registration_closes_at:'2026-12-01T00:00:00Z',withdrawal_closes_at:'2026-12-01T00:00:00Z',field_limit:30,entries:0,
    first_day:day,last_day:day,days:[day],stage_count:1,minimum_roster_size:3,maximum_roster_size:4,profiles:['hilly'],
    stages:[{id:id(600+i),profile:'hilly',day,stageNumber:1,status:'planned',departureAt:new Date(Date.UTC(2026,10,day+5,13)).toISOString()}]}));
  const budgets=context.map(t=>({bot_key:t.bot_key,team_id:t.team_id,team_season_id:t.team_season_id,cash_balance:300000,projected_budget:300000,checked_at:new Date(now).toISOString()}));
  const preparers=[{team_id:context[0].team_id,bot_key:context[0].bot_key,contract_id:id(9000),level:5,duration_days:1,rider_capacity:5,
    cost_reduction_percentage:20,resulting_bonus:2.8}];
  return {context,riders,calendar,busy:[],registrations:[],objectives:[],budgets,preparers,reconnaissances:[]};
}
test('the final programme reserves both requested buildings before allocating camp money',()=>{
  const f=fixture(),p=buildManagedS5SeasonArtifacts(f,{now,finalized:true});
  const elodie=p.programme.budget_review.find(t=>t.bot_key==='elodie_martin'),thomas=p.programme.budget_review.find(t=>t.bot_key==='thomas_vermeulen');
  assert.equal(elodie.reserved_building_cost,141000);assert.equal(elodie.available_for_camps,134000);
  assert.equal(thomas.reserved_building_cost,100000);assert.equal(thomas.available_for_camps,175000);
  assert.ok(p.programme.budget_review.every(t=>t.total_planned_cost<=t.available_for_camps));
});
test('tight finances shrink the camp envelopes without consuming the protected projection',()=>{
  const f=fixture(),row=f.budgets.find(t=>t.bot_key==='shadow_peloton');row.cash_balance=50000;row.projected_budget=40000;
  const p=buildManagedS5SeasonArtifacts(f,{now});const actual=p.programme.budget_review.find(t=>t.bot_key===row.bot_key);
  assert.equal(actual.available_for_camps,15000);assert.ok(actual.recovery_envelope+actual.reconnaissance_envelope<=15000);
  assert.ok(actual.total_planned_cost<=15000);
});
test('a paid building reserve can be explicitly released without changing the race schedule',()=>{
  const f=fixture(),a=buildManagedS5SeasonArtifacts(f,{now}),b=buildManagedS5SeasonArtifacts(f,{now,config:{buildReserves:{elodie_martin:0,thomas_vermeulen:0}}});
  assert.deepEqual(a.programme.actions,b.programme.actions);
  assert.equal(b.programme.budget_review.find(t=>t.bot_key==='elodie_martin').available_for_camps,275000);
});
test('native manifests keep registrations before reconnaissance before recovery',()=>{
  const p=buildManagedS5SeasonArtifacts(fixture(),{now,finalized:true});
  assert.deepEqual(p.phases.map(x=>x.plan.phase),['registrations','reconnaissances','recovery']);
  assert.ok(p.phases[0].plan.actions.every(a=>a.rpc==='save_current_team_race_roster'&&a.max_cash_cost===0));
  assert.ok(p.phases[1].plan.actions.length>0);assert.ok(p.phases[1].plan.actions.every(a=>a.rpc==='book_current_team_stage_reconnaissance'));
  assert.ok(p.phases[2].plan.actions.every(a=>a.rpc==='book_current_team_form_camps'));
});
test('the real employed preparer is used with its shorter duration, group and native discount',()=>{
  const f=fixture(),p=buildManagedS5SeasonArtifacts(f,{now});
  const recon=p.phases[1].plan.actions.find(a=>a.bot_key===f.context[0].bot_key);
  assert.equal(recon.args.p_preparer_contract_id,id(9000));assert.equal(recon.start_day,recon.end_day);
  assert.equal(recon.expected_cost,3200);assert.equal(recon.expected_bonus,2.8);
  assert.deepEqual(p.programme.active_preparers_used,[id(9000)]);
});
test('foreign or duplicate financial snapshots cannot drive a final budget',()=>{
  const f=fixture();f.budgets[0].team_id=id(9999);assert.throws(()=>buildManagedS5SeasonArtifacts(f,{now}),/equal/);
  f.budgets[0]=f.budgets[1];assert.throws(()=>buildManagedS5SeasonArtifacts(f,{now}),/equal/);
});
test('preview writes a report but never an executable native manifest before final snapshots exist',()=>{
  const f=fixture(),folder=mkdtempSync('C:/Dev/tmp/managed-s5-season-preview-');
  const sources={'identity-after-roster':f.context,'planning-riders-after-roster':f.riders,'planning-busy-after-roster':f.busy,
    'planning-registrations-after-roster':f.registrations,'planning-calendar-after-roster':f.calendar,'planning-objectives':f.objectives,'staff':[]};
  for(const [name,value]of Object.entries(sources))writeFileSync(folder+'/'+name+'.json',JSON.stringify(value));
  const result=prepareManagedS5SeasonFromFiles({folder,mode:'--preview',now});
  assert.equal(result.finalized,false);assert.ok(result.missingFinalInputs.includes('staff-after-hiring'));
  assert.equal(result.outputs.length,0);assert.equal(existsSync(folder+'/season-registrations-native.json'),false);
  assert.equal(existsSync(folder+'/season-program-preview.json'),true);
});
test('finalization requires fresh final budgets and does not accept a missing budget file',()=>{
  const f=fixture(),folder=mkdtempSync('C:/Dev/tmp/managed-s5-season-final-');
  const sources={'identity-after-roster':f.context,'planning-riders-after-roster':f.riders,'planning-busy-after-roster':f.busy,
    'planning-registrations-after-roster':f.registrations,'planning-calendar-after-roster':f.calendar,'planning-objectives-after-restoration':f.objectives,
    'staff-after-hiring':[],'planning-preparers':f.preparers,'planning-budget-final':f.budgets};
  for(const [name,value]of Object.entries(sources))writeFileSync(folder+'/'+name+'.json',JSON.stringify(value));
  let result=prepareManagedS5SeasonFromFiles({folder,mode:'--final',now});assert.equal(result.outputs.length,3);assert.equal(result.finalized,true);
  assert.throws(()=>prepareManagedS5SeasonFromFiles({folder,mode:'--final',now:now+16*60*1000}),/older than 15/);
  unlinkSync(folder+'/planning-budget-final.json');
  assert.throws(()=>prepareManagedS5SeasonFromFiles({folder,mode:'--final',now}),/after staff\/junior spending/);
});
