// Route real stage types through their normal UI RPCs; no native guard bypass.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {nativeActionCall} from './managed-s5-action-sql-20261106.mjs';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,12);
const n=(value,fallback=0)=>value==null?fallback:Number.isFinite(Number(value))?Number(value):fallback;
const typeNames=['road','individual_time_trial','team_time_trial','prologue'];
const ttScore=r=>.65*n(r.time_trial,40)+.20*n(r.flat,40)+.15*n(r.endurance,40);
function relayShares(roster){
  const weights=roster.map(r=>Math.max(1,ttScore(r)-35)**2*Math.max(.5,n(r.form,90)/100)*Math.max(.5,1-n(r.fatigue)/200));
  const total=weights.reduce((a,b)=>a+b,0),exact=weights.map(w=>10000*w/total),units=exact.map(Math.floor);
  const remaining=10000-units.reduce((a,b)=>a+b,0);
  const order=roster.map((r,i)=>({i,fraction:exact[i]-units[i],id:r.id})).sort((a,b)=>b.fraction-a.fraction||a.id.localeCompare(b.id));
  for(let i=0;i<remaining;i++)units[order[i].i]++;
  return units.map(value=>value/100);
}
export function splitManagedS5TypedPreparations({manifest,stageTypes,riders,calendar,objectives=[]}){
  const types=new Map(stageTypes.map(s=>[s.id,s.stage_type]));assert.equal(types.size,stageTypes.length,'Duplicate stage type');
  const races=new Map(calendar.map(r=>[r.id,r])),road=[],timeTrials=[],counts={road:0,individual_time_trial:0,team_time_trial:0,prologue:0};
  for(const a of manifest.actions){
    const stageType=types.get(a.args.p_stage_id);assert.ok(typeNames.includes(stageType),'Every preparation needs a real database stage_type');counts[stageType]++;
    if(stageType==='road'){nativeActionCall(a);road.push(a);continue;}
    const race=races.get(a.args.p_race_edition_id);assert.ok(race,'Missing time-trial race');
    const roster=a.args.p_roles.map(p=>riders.find(r=>r.id===p.riderId&&r.bot_key===a.bot_key));
    assert.ok(roster.length>0&&roster.every(Boolean),'Time-trial roster must be owned');
    const best=[...roster].sort((a,b)=>ttScore(b)-ttScore(a)||a.id.localeCompare(b.id))[0];
    const leader=a.args.p_roles.find(p=>['leader','leader_sprinter'].includes(p.role))?.riderId;
    const target=objectives.some(o=>o.bot_key===a.bot_key&&o.objective_type==='race_result'&&o.target_details?.raceEditionId===race.id
      &&!['completed','failed','cancelled'].includes(o.status));
    const stage=race.stages.find(s=>s.id===a.args.p_stage_id);assert.ok(stage);
    const finalStage=!race.stages.some(s=>n(s.stageNumber)>n(stage.stageNumber));
    const shares=stageType==='team_time_trial'?relayShares(roster):null;
    const plans=roster.map((r,i)=>({riderId:r.id,effortMode:stageType!=='team_time_trial'&&target&&finalStage
      &&(r.id===leader||r.id===best.id)&&n(r.form)>=90&&n(r.fatigue)<=15?'all_in':'normal',
    ...(shares?{relaySharePct:shares[i]}:{})}));
    const args={p_race_edition_id:a.args.p_race_edition_id,p_stage_id:a.args.p_stage_id,p_plan:plans};
    if(stageType==='team_time_trial'){
      const leaderId=leader??best.id;
      args.p_roles=roster.map(r=>({riderId:r.id,role:r.id===leaderId?'leader':'domestique'}));
      args.p_strategy={objective:target?'general_classification':'balanced',collectivePosture:'conservative',breakawayPolicy:'avoid',
        chasePolicy:'dangerous_breakaway',lieutenantRiderId:null,dangerPacerRiderId:null,protectorRiderId:null,breakawayRiderId:null,attackOrders:[]};
    }
    const next={...a,key:`managed-s5:${a.bot_key}:time-trial:${hash(args)}`,rpc:'save_current_team_time_trial_preparation',args,stage_type:stageType};
    nativeActionCall(next);timeTrials.push(next);
  }
  assert.equal(road.length+timeTrials.length,manifest.actions.length);
  const header={season_id:manifest.season_id,game_year:5,current_day:1,generated_at:new Date().toISOString(),finalized:true,
    policy:'Road uses collective tactics; ITT/prologue use individual effort; TTT uses effort, relays and conservative collective roles.'};
  return {road:{...header,phase:'road_preparations',actions:road},timeTrials:{...header,phase:'time_trial_preparations',actions:timeTrials},counts};
}
