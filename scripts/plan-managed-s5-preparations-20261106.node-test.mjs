import test from 'node:test';
import assert from 'node:assert/strict';
import {MANAGED_S5_KEYS} from './lib/managed-s5-season-planner-20261106.mjs';
import {buildManagedS5PreparationArtifacts} from './plan-managed-s5-preparations-20261106.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now=Date.parse('2026-11-06T13:00:00Z');
function fixture(){
  const context=MANAGED_S5_KEYS.map((bot_key,i)=>({bot_key,team_id:id(100+i),team_season_id:id(200+i),season_id:id(5),game_year:5,current_day_number:1}));
  const riders=context.flatMap((t,k)=>Array.from({length:4},(_,i)=>({id:id(1000+k*100+i),team_id:t.team_id,status:'active',form:90,age:24,
    potential_steps:6,country_id:'fr',mountain:50,hills:60,flat:55,time_trial:52,cobbles:51,sprint:65,acceleration:65,
    downhill:55,endurance:65,resistance:60,recovery:60,breakaway:50,prologue:51})));
  const calendar=[{id:id(500),competition_type:'standard',race_format:'one_day',profiles:['flat'],
    stages:[{id:id(600),stageNumber:1,profile:'flat',status:'planned',departureAt:'2026-11-08T13:00:00Z'}]}];
  const registrations=context.map((t,i)=>({id:id(700+i),bot_key:t.bot_key,status:'accepted',race_edition_id:id(500),
    rider_ids:riders.filter(r=>r.team_id===t.team_id).map(r=>r.id)}));
  const busy=registrations.flatMap(reg=>reg.rider_ids.map(rider_id=>({registration_id:reg.id,rider_id,registration_status:'accepted',status:'selected'})));
  const registrationManifest={season_id:id(5),actions:registrations.map(r=>({key:r.id,bot_key:r.bot_key,
    args:{p_race_edition_id:r.race_edition_id,p_rider_ids:r.rider_ids}}))};
  const programme={season_id:id(5),finalized:true,riders:riders.map(r=>({...r,after:{committed_stages:20}})),preparation_targets:[]};
  return {context,riders,calendar,registrations,busy,staff:[],objectives:[],programme,registrationManifest};
}
test('verified real rosters produce training before all future stage preparations without mutations',()=>{
  const f=fixture(),original=JSON.stringify(f),a=buildManagedS5PreparationArtifacts(f,{now,finalized:true});
  assert.equal(JSON.stringify(f),original);assert.deepEqual(a.report.verification,{current_riders:32,exact_programme_registrations:8,
    actual_accepted_registrations:8,prepared_future_stages:8});
  assert.equal(a.phases[0].plan.actions.length,16);assert.equal(a.phases[1].plan.actions.length,8);
  assert.ok(a.phases[0].plan.actions.every(a=>a.rpc!=='save_current_team_race_preparation_with_sprint'));
  assert.ok(a.phases[1].plan.actions.every(a=>a.rpc==='save_current_team_race_preparation_with_sprint'));
});
test('a partial application or failed race transaction stops generation instead of preparing hypothetical rosters',()=>{
  const f=fixture();f.registrations.pop();assert.throws(()=>buildManagedS5PreparationArtifacts(f,{now}),/not committed/);
});
test('a current departure or unreviewed roster replacement stops generation',()=>{
  const f=fixture();f.riders[0].team_id=f.context[1].team_id;
  assert.throws(()=>buildManagedS5PreparationArtifacts(f,{now}),/owned roster differs/);
});
test('accepted roster changes require an explicitly updated reviewed manifest',()=>{
  const f=fixture();f.registrations[0].rider_ids=[f.riders[0].id];
  assert.throws(()=>buildManagedS5PreparationArtifacts(f,{now}),/Committed roster mismatch/);
});
test('different snapshot generations cannot silently disagree between busy and accepted data',()=>{
  const f=fixture();f.busy.pop();assert.throws(()=>buildManagedS5PreparationArtifacts(f,{now}),/Busy\/accepted roster/);
});
test('missing fresh condition data and duplicate actual registrations are rejected',()=>{
  const f=fixture();f.riders[0].form=null;assert.throws(()=>buildManagedS5PreparationArtifacts(f,{now}),/current forms/);
  f.riders[0].form=90;f.registrations.push({...f.registrations[0]});
  assert.throws(()=>buildManagedS5PreparationArtifacts(f,{now}),/Duplicate race registration/);
});
test('completed and past stages are excluded while every actual future stage remains prepared',()=>{
  const f=fixture();f.calendar[0].stages.push({id:id(601),stageNumber:2,profile:'flat',status:'completed',departureAt:'2026-11-09T13:00:00Z'},
    {id:id(602),stageNumber:3,profile:'flat',status:'planned',departureAt:'2026-11-05T13:00:00Z'});
  const a=buildManagedS5PreparationArtifacts(f,{now});assert.equal(a.phases[1].plan.actions.length,8);
});
test('unknown races and mismatched registration identities are rejected before any output',()=>{
  const f=fixture();f.calendar=[];assert.throws(()=>buildManagedS5PreparationArtifacts(f,{now}),/missing from fresh calendar/);
  const g=fixture();g.registrations[0].team_season_id=g.context[1].team_season_id;
  assert.throws(()=>buildManagedS5PreparationArtifacts(g,{now}),/team identity mismatch/);
});
