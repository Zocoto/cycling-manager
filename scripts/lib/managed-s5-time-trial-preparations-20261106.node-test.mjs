import test from 'node:test';
import assert from 'node:assert/strict';
import {splitManagedS5TypedPreparations} from './managed-s5-time-trial-preparations-20261106.mjs';
import {nativeActionCall,managedS5ActionSql,MANAGED_S5_SEASON} from './managed-s5-action-sql-20261106.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture(){
  const riders=[70,60,55,50].map((rating,i)=>({id:id(100+i),bot_key:'antoine_morel_29',time_trial:rating,flat:rating,endurance:rating,form:95,fatigue:0}));
  const stageTypes=['road','individual_time_trial','prologue','team_time_trial'].map((stage_type,i)=>({id:id(200+i),stage_type}));
  const roles=riders.map((r,i)=>({riderId:r.id,role:i===0?'leader':'domestique'}));
  const manifest={season_id:MANAGED_S5_SEASON,actions:stageTypes.map((stage,i)=>({key:'original:'+i,bot_key:'antoine_morel_29',
    rpc:'save_current_team_race_preparation_with_sprint',args:{p_race_edition_id:id(300),p_stage_id:stage.id,p_roles:roles,p_strategy:{objective:'balanced'}},
    min_cash:15000,min_projected:25000,max_cash_cost:0}))};
  const calendar=[{id:id(300),stages:stageTypes.map((stage,i)=>({id:stage.id,stageNumber:i+1}))}];
  return {manifest,stageTypes,riders,calendar,objectives:[]};
}
test('database stage_type separates road, ITT, prologue and TTT without mutating the original or its keys',()=>{
  const f=fixture(),before=JSON.stringify(f),p=splitManagedS5TypedPreparations(f);
  assert.equal(JSON.stringify(f),before);assert.equal(p.road.actions.length,1);assert.equal(p.timeTrials.actions.length,3);
  assert.strictEqual(p.road.actions[0],f.manifest.actions[0]);
  assert.ok(p.timeTrials.actions.every(a=>a.rpc==='save_current_team_time_trial_preparation'));
  for(const a of p.timeTrials.actions.filter(a=>a.stage_type!=='team_time_trial')){
    assert.deepEqual(Object.keys(a.args).sort(),['p_plan','p_race_edition_id','p_stage_id']);
    assert.ok(a.args.p_plan.every(p=>p.effortMode==='normal'&&!Object.hasOwn(p,'relaySharePct')));
  }
});
test('TTT native five-argument plan has a unique leader, weighted exact 100% relays and no sprint train',()=>{
  const p=splitManagedS5TypedPreparations(fixture()).timeTrials.actions.at(-1);
  assert.equal(Object.keys(p.args).length,5);assert.equal(p.args.p_roles.filter(r=>r.role==='leader').length,1);
  assert.ok(p.args.p_roles.every(r=>['leader','domestique'].includes(r.role)));
  assert.equal(p.args.p_plan.reduce((n,p)=>n+Math.round(p.relaySharePct*100),0),10000);
  assert.ok(p.args.p_plan[0].relaySharePct>p.args.p_plan[3].relaySharePct);
  assert.equal(p.args.p_strategy.collectivePosture,'conservative');assert.equal(p.args.p_strategy.attackOrders.length,0);
  assert.ok(!Object.hasOwn(p.args.p_strategy,'sprintTrainOrder'));
});
test('missing actual stage types or foreign riders stop classification rather than guessing from profile',()=>{
  const f=fixture();f.stageTypes.pop();assert.throws(()=>splitManagedS5TypedPreparations(f),/real database stage_type/);
  const g=fixture();g.riders[0].bot_key='other';assert.throws(()=>splitManagedS5TypedPreparations(g),/must be owned/);
});
test('all-in is restricted to fresh objective leaders or specialists on the final TT',()=>{
  const f=fixture();f.manifest.actions=[f.manifest.actions[1]];f.calendar[0].stages=[f.calendar[0].stages[1]];
  f.objectives=[{bot_key:'antoine_morel_29',objective_type:'race_result',target_details:{raceEditionId:id(300)},status:'pending'}];
  let p=splitManagedS5TypedPreparations(f).timeTrials.actions[0];assert.equal(p.args.p_plan.filter(p=>p.effortMode==='all_in').length,1);
  f.riders[0].fatigue=30;p=splitManagedS5TypedPreparations(f).timeTrials.actions[0];assert.ok(p.args.p_plan.every(p=>p.effortMode==='normal'));
});
test('whitelist rejects malformed overloads, duplicate riders and invalid effort or relay totals',()=>{
  const plan=splitManagedS5TypedPreparations(fixture()),itt=structuredClone(plan.timeTrials.actions[0]),ttt=structuredClone(plan.timeTrials.actions.at(-1));
  itt.args.p_roles=[];assert.throws(()=>nativeActionCall(itt));delete itt.args.p_roles;
  itt.args.p_plan[0].effortMode='boost';assert.throws(()=>nativeActionCall(itt),/effort/);
  itt.args.p_plan[0].effortMode='normal';itt.args.p_plan[1].riderId=itt.args.p_plan[0].riderId;assert.throws(()=>nativeActionCall(itt),/Duplicate/);
  ttt.args.p_plan[0].relaySharePct+=1;assert.throws(()=>nativeActionCall(ttt),/exactly 100/);
});
test('compiled TT actions verify the saved stage and exact complete rider count',()=>{
  const action=splitManagedS5TypedPreparations(fixture()).timeTrials.actions[0],team={bot_key:action.bot_key,season_id:MANAGED_S5_SEASON,
    team_id:id(400),team_season_id:id(401),director_id:id(402),auth_user_id:id(403)};
  const sql=managedS5ActionSql(action,team);assert.ok(sql.includes("'{0,saved_stage_id}'"));
  assert.ok(sql.includes("'{0,updated_rider_count}'"));assert.ok(sql.includes('is distinct from 4'));
});
