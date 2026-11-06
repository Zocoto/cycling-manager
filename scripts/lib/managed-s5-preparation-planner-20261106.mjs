// Pure one-shot preparation planning. No SQL, credentials, network or workers.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MANAGED_S5_KEYS,managedS5ProfileFit} from './managed-s5-season-planner-20261106.mjs';

const axes=['mountain','hills','flat','time_trial','cobbles','sprint','acceleration','downhill','endurance','resistance','recovery','breakaway','prologue'];
const main=['mountain','hills','time_trial','cobbles','sprint'];
const domains={climber:['mountain','endurance'],puncheur:['hills','acceleration'],stage_racer:['recovery','endurance','time_trial'],
  northern_classics:['cobbles','resistance','flat'],rouleur:['time_trial','flat','prologue'],breakaway:['breakaway','endurance','resistance'],sprinter:['sprint','acceleration','flat']};
const secondary={climber:['hills','recovery','downhill','acceleration'],puncheur:['mountain','sprint','resistance','breakaway'],
  stage_racer:['mountain','hills','resistance','prologue'],northern_classics:['endurance','acceleration','sprint','breakaway'],
  rouleur:['endurance','resistance','recovery'],breakaway:['hills','flat','recovery','downhill'],sprinter:['resistance','prologue','cobbles']};
const specialties={mountain:['mountain'],hills:['hills'],flat:['flat'],sprint:['sprint','acceleration'],time_trial:['time_trial','prologue'],
  cobbles:['cobbles'],endurance:['endurance','resistance','recovery','breakaway','downhill']};
const n=(value,fallback=0)=>value==null?fallback:Number.isFinite(Number(value))?Number(value):fallback;
const byId=(a,b)=>a.id.localeCompare(b.id);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,12);
const uuid=value=>assert.match(value??'',/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i);
const normalized=r=>({...r,id:r.id??r.rider_id,...Object.fromEntries(axes.map(key=>[key,n(r[key]??r.ratings?.[key]??r.ratings?.[key==='time_trial'?'timeTrial':key],40)]))});

export function managedS5TrainingDomain(rider,preferredDomain=null){
  if(preferredDomain&&domains[preferredDomain])return preferredDomain;
  if(domains[rider.requested_training_domain])return rider.requested_training_domain;
  const best=[...main].sort((a,b)=>rider[b]-rider[a]||main.indexOf(a)-main.indexOf(b))[0];
  if(rider.breakaway>=rider[best]+10&&rider[best]<65)return 'breakaway';
  if(best==='mountain'&&rider.time_trial>=rider.mountain-4&&rider.recovery>=55)return 'stage_racer';
  return {mountain:'climber',hills:'puncheur',time_trial:'rouleur',cobbles:'northern_classics',sprint:'sprinter'}[best];
}
function normalizedTrainers(staff){
  return staff.flatMap(row=>row.kind==='team_staff'?(row.payload.contracts??[]).map(c=>({...c,...c.member,contract_id:c.id,
    status:c.status,team_id:c.team_id??row.payload.teamId,talents:c.talents??[]})):[row])
    .filter(c=>c.role==='trainer'&&c.status==='active')
    .map(c=>({...c,id:c.contract_id??c.id,level:Math.min(5,Math.max(1,n(c.level,1))),
      specialty:c.specialty??c.trainer_specialty,talents:(c.talents??[]).map(t=>typeof t==='string'?t:t.talent_code)})).sort(byId);
}
const ageFactor=age=>age<=21?1:age<=24?.95:age<=27?.85:age<=29?.72:age<=31?.55:age<=36?.5-(age-32)*.04:Math.max(.3,.34-(age-36)*.01);
const ratingFactor=rating=>rating<50?1.8:rating<60?1.35:rating<70?1:rating<75?.65:rating<80?.5:rating<85?.35:rating<90?.25:rating<95?.15:.1;
function coachValue(rider,trainer,domain,priority){
  const sameCountry=Boolean(rider.country_id&&rider.country_id===trainer.country_id);
  const level=trainer.level,cap=Math.min(100,65+Math.max(1,Math.min(8,n(rider.potential_steps,8)))*5);
  let value=0;
  for(const key of axes){
    if(rider[key]>=cap)continue;
    const weight=domains[domain].includes(key)?1:secondary[domain].includes(key)?.55:.1;
    const base=1+(specialties[trainer.specialty]?.includes(key)?level*.04:0)+(sameCountry?.10:0);
    const talent=trainer.talents.some(code=>specialties[code.replace(/^trainer_/,'')]?.includes(key))?1+level*.04*(sameCountry?1.1:1):1;
    value+=weight*ratingFactor(rider[key])*(base*talent-1);
  }
  return value*ageFactor(n(rider.age,25))*(.6+.05*n(rider.potential_steps,8))*(priority?1.15:1);
}
// Maximum-weight bipartite assignment using expanded trainer capacity slots.
// Dummy slots represent legitimate uncoached plans. No greedy capacity traps.
function optimalColumns(weights){
  const count=weights.length;if(!count)return [];
  const columns=weights[0].length,u=Array(count+1).fill(0),v=Array(columns+1).fill(0),p=Array(columns+1).fill(0),way=Array(columns+1).fill(0);
  for(let row=1;row<=count;row++){
    p[0]=row;let column=0;const min=Array(columns+1).fill(Infinity),used=Array(columns+1).fill(false);
    do{
      used[column]=true;const current=p[column];let delta=Infinity,next=0;
      for(let candidate=1;candidate<=columns;candidate++)if(!used[candidate]){
        const cost=-weights[current-1][candidate-1]-u[current]-v[candidate];
        if(cost<min[candidate]){min[candidate]=cost;way[candidate]=column;}
        if(min[candidate]<delta){delta=min[candidate];next=candidate;}
      }
      for(let candidate=0;candidate<=columns;candidate++)if(used[candidate]){u[p[candidate]]+=delta;v[candidate]-=delta;}else min[candidate]-=delta;
      column=next;
    }while(p[column]!==0);
    do{const previous=way[column];p[column]=p[previous];column=previous;}while(column!==0);
  }
  const result=Array(count).fill(-1);for(let column=1;column<=columns;column++)if(p[column])result[p[column]-1]=column-1;
  return result;
}
export function assignManagedS5Trainers(riders,trainers,domainByRider,priorityIds=new Set()){
  const ordered=[...riders].sort(byId),slots=trainers.flatMap(t=>Array.from({length:Math.min(8,Math.max(4,t.level+3))},()=>t));
  slots.push(...ordered.map(()=>null));
  const weights=ordered.map(r=>slots.map(t=>t?Math.round(coachValue(r,t,domainByRider.get(r.id),priorityIds.has(r.id))*1000000):0));
  const assignment=optimalColumns(weights);
  return new Map(ordered.map((r,i)=>[r.id,slots[assignment[i]]&&weights[i][assignment[i]]>0?slots[assignment[i]].id:null]));
}
const baseStrategy=()=>({objective:'balanced',collectivePosture:'balanced',breakawayPolicy:'avoid',chasePolicy:'dangerous_breakaway',
  lieutenantRiderId:null,dangerPacerRiderId:null,protectorRiderId:null,breakawayRiderId:null,attackOrders:[],sprintTrainOrder:[]});
const gcScore=r=>.45*r.mountain+.20*r.time_trial+.15*r.hills+.10*r.endurance+.10*r.recovery;
const sprintScore=r=>.70*r.sprint+.20*r.acceleration+.10*r.flat;
const leadoutScore=r=>.35*r.sprint+.30*r.acceleration+.20*r.flat+.15*r.resistance;
const supportScore=r=>.45*r.endurance+.35*r.resistance+.20*r.flat;
function bestRider(riders,score,preferred){
  const ordered=[...riders].sort((a,b)=>score(b)-score(a)||byId(a,b));
  const preference=ordered.find(r=>r.id===preferred);
  return preference&&score(preference)>=score(ordered[0])-6?preference:ordered[0];
}
export function managedS5StagePreparation({team,race,stage,riders,preferredLeaderId=null,hasSponsorObjective=false}){
  assert.ok(riders.length>0);assert.equal(new Set(riders.map(r=>r.id)).size,riders.length);
  assert.ok(riders.every(r=>r.team_id===team.team_id),'Preparation rider outside the managed team');
  const strategy=baseStrategy(),roles=new Map(riders.map(r=>[r.id,'domestique']));
  const flat=['flat','sprint'].includes(stage.profile??stage.profile_type);
  const isTour=race.race_format==='stage_race';
  const tourScore=(race.profiles??[]).includes('mountain')?gcScore:r=>managedS5ProfileFit(r,race);
  const leader=isTour?bestRider(riders,tourScore,preferredLeaderId):flat?null:
    bestRider(riders,r=>managedS5ProfileFit(r,{profiles:[stage.profile??stage.profile_type],race_format:'one_day'}),preferredLeaderId);
  if(leader)roles.set(leader.id,'leader');
  strategy.objective=isTour?'general_classification':'stage_win';
  strategy.collectivePosture=isTour&&flat?'conservative':'balanced';
  if(flat){
    const bestSprinter=bestRider(riders,sprintScore,null);
    const sprinter=leader&&sprintScore(leader)>=sprintScore(bestSprinter)-2?leader:bestSprinter;
    if(sprinter){
      roles.set(sprinter.id,sprinter.id===leader?.id?'leader_sprinter':'sprinter');if(!isTour)strategy.objective='sprint';
      const train=riders.filter(r=>r.id!==leader?.id&&r.id!==sprinter.id).sort((a,b)=>leadoutScore(b)-leadoutScore(a)||byId(a,b)).slice(0,2);
      for(const r of train)roles.set(r.id,'leadout');
      strategy.sprintTrainOrder=[...train].sort((a,b)=>leadoutScore(a)-leadoutScore(b)||byId(a,b)).map(r=>r.id);
    }
  }
  const helpers=riders.filter(r=>roles.get(r.id)==='domestique').sort((a,b)=>supportScore(b)-supportScore(a)||byId(a,b));
  if(leader&&helpers.length)strategy.protectorRiderId=helpers[0].id;
  if(leader&&helpers.length>1)strategy.lieutenantRiderId=helpers[1].id;
  if(!isTour&&!flat&&!hasSponsorObjective)strategy.breakawayPolicy='opportunistic';
  return {roles:[...roles].sort(([a],[b])=>a.localeCompare(b)).map(([riderId,role])=>({riderId,role})),strategy};
}

export function planManagedS5Preparations({context,riders:sourceRiders,rosters=[],staff=[],calendar=[],busy=[],registrations,plan={},objectives=[]},{now=Date.now(),allowEmptyTeams=false}={}){
  assert.equal(context.length,8);assert.deepEqual(context.map(t=>t.bot_key).sort(),[...MANAGED_S5_KEYS].sort());
  assert.equal(new Set(context.map(t=>t.team_id)).size,8);
  assert.ok(context.every(t=>t.game_year===5&&t.current_day_number===1&&t.season_id===context[0].season_id),'Expected S5 J1');
  const riders=(sourceRiders??rosters.flatMap(r=>Array.isArray(r.roster)?r.roster:r.race_edition_id?[]:[r])).map(normalized).sort(byId);
  assert.equal(new Set(riders.map(r=>r.id)).size,riders.length);
  for(const r of riders){uuid(r.id);assert.ok(context.some(t=>t.team_id===r.team_id),'Foreign rider in managed roster');}
  const allTrainers=normalizedTrainers(staff),nativeActions=[],training=[],stagePlans=[],warnings=[];
  const action=(team,kind,rpc,args,details={})=>({key:`managed-s5:${team.bot_key}:${kind}:${hash(args)}`,bot_key:team.bot_key,rpc,args,
    min_projected:25000,min_cash:15000,max_cash_cost:0,...details});
  for(const team of context){
    const roster=riders.filter(r=>r.team_id===team.team_id&&(!r.status||r.status==='active'));
    assert.ok(allowEmptyTeams||roster.length>0,'A managed team has no active riders; refresh after recruitment');
    assert.ok(roster.length<=35,'Training must cover one atomic team batch of at most 35 riders');
    const teamObjectives=objectives.filter(o=>o.bot_key===team.bot_key&&!['completed','failed','cancelled'].includes(o.status));
    const priorities=new Set([...teamObjectives.map(o=>o.target_details?.leaderRiderId),...(plan.preparation_targets??[]).filter(t=>t.team_id===team.team_id).map(t=>t.rider_id)].filter(Boolean));
    const preferredDomain=id=>{
      const lead=teamObjectives.find(o=>o.target_details?.leaderRiderId===id)?.target_details?.leaderDomain;
      return {mountain:'climber',hills:'puncheur',sprints:'sprinter',cobbles:'northern_classics',time_trials:'rouleur',stage_races:'stage_racer'}[lead]??null;
    };
    const domainByRider=new Map(roster.map(r=>[r.id,managedS5TrainingDomain(r,preferredDomain(r.id))]));
    const trainers=allTrainers.filter(t=>t.team_id===team.team_id);
    for(const t of trainers)uuid(t.id);
    const assigned=assignManagedS5Trainers(roster,trainers,domainByRider,priorities);
    const heavy=(plan.riders??[]).some(r=>r.team_id===team.team_id&&n(r.after?.committed_stages)>=16)||teamObjectives.some(o=>o.objective_type==='race_result');
    const minimumForm=heavy?80:75;
    nativeActions.push(action(team,'training-form','save_current_team_training_settings',{p_minimum_form:minimumForm}));
    const plans=roster.map(r=>({rider_id:r.id,intensity:50,domain:domainByRider.get(r.id),trainer_contract_id:assigned.get(r.id)}));
    if(plans.length)nativeActions.push(action(team,'training','save_current_rider_training_plans_v2',{p_plans:plans}));
    const usage=trainers.map(t=>({contract_id:t.id,capacity:Math.min(8,Math.max(4,t.level+3)),assigned:plans.filter(p=>p.trainer_contract_id===t.id).length}));
    assert.ok(usage.every(t=>t.assigned<=t.capacity));
    training.push({bot_key:team.bot_key,rider_count:roster.length,minimum_form:minimumForm,intensity:50,trainer_usage:usage,
      uncoached:plans.filter(p=>p.trainer_contract_id===null).length,plans});
  }
  let entries=registrations??rosters.filter(r=>r.race_edition_id);
  if(!entries.length){
    const grouped=new Map();
    for(const row of busy){
      if(row.registration_status!=='accepted'||!['selected','confirmed'].includes(row.status))continue;
      const key=row.registration_id;
      if(!grouped.has(key))grouped.set(key,{id:key,race_edition_id:row.race_edition_id,team_season_id:row.team_season_id,status:'accepted',rider_ids:[]});
      grouped.get(key).rider_ids.push(row.rider_id);
    }
    entries=[...grouped.values()];
  }
  const races=new Map(calendar.map(r=>[r.id,r])),seen=new Set();
  for(const entry of [...entries].sort((a,b)=>(a.id??a.race_edition_id).localeCompare(b.id??b.race_edition_id))){
    if(entry.status!=='accepted')continue;
    const race=races.get(entry.race_edition_id);
    if(!race||race.competition_type!=='standard')continue;
    const team=context.find(t=>t.team_season_id===entry.team_season_id||t.team_id===entry.team_id||t.bot_key===entry.bot_key);
    if(!team)continue;
    assert.ok((!entry.team_id||entry.team_id===team.team_id)&&(!entry.team_season_id||entry.team_season_id===team.team_season_id)
      &&(!entry.bot_key||entry.bot_key===team.bot_key),'Registration identity mismatch');
    const ids=entry.rider_ids??busy.filter(b=>b.registration_id===entry.id&&b.registration_status==='accepted'&&['selected','confirmed'].includes(b.status)).map(b=>b.rider_id);
    assert.equal(new Set(ids).size,ids.length,'Duplicate accepted rider');
    if(!ids.length){warnings.push({bot_key:team.bot_key,race_edition_id:race.id,code:'accepted_empty_roster'});continue;}
    const roster=ids.map(id=>riders.find(r=>r.id===id&&r.team_id===team.team_id&&(!r.status||r.status==='active')));
    assert.ok(roster.every(Boolean),'Accepted registration contains a departed or foreign rider');
    const targets=objectives.filter(o=>o.bot_key===team.bot_key&&o.objective_type==='race_result'&&o.target_details?.raceEditionId===race.id&&!['completed','failed','cancelled'].includes(o.status));
    const preferred=(plan.preparation_targets??[]).find(t=>t.team_id===team.team_id&&t.race_edition_id===race.id)?.rider_id
      ??(plan.actions??[]).find(a=>a.team_id===team.team_id&&a.race_edition_id===race.id)?.leader_rider_id??targets[0]?.target_details?.leaderRiderId??null;
    for(const stage of [...(race.stages??[])].sort((a,b)=>n(a.stageNumber)-n(b.stageNumber)||a.id.localeCompare(b.id))){
      if(stage.status!=='planned'||!(Date.parse(stage.departureAt)>now))continue;
      const unique=`${team.team_id}:${stage.id}`;assert.ok(!seen.has(unique),'Duplicate team-stage preparation');seen.add(unique);uuid(stage.id);uuid(race.id);
      const preparation=managedS5StagePreparation({team,race,stage,riders:roster,preferredLeaderId:preferred,hasSponsorObjective:targets.length>0});
      const args={p_race_edition_id:race.id,p_stage_id:stage.id,p_roles:preparation.roles,p_strategy:preparation.strategy};
      const native=action(team,'stage','save_current_team_race_preparation_with_sprint',args,{race_edition_id:race.id,stage_id:stage.id,stage_number:stage.stageNumber});
      nativeActions.push(native);stagePlans.push({bot_key:team.bot_key,race_edition_id:race.id,stage_id:stage.id,roles:preparation.roles,strategy:preparation.strategy});
    }
  }
  return {season_id:context[0].season_id,game_year:5,current_day:1,generated_at:new Date(now).toISOString(),
    policy:{intensity:50,minimum_form:'80 for sponsor race targets / loaded programmes, otherwise 75',automatic_attacks:false,
      trainer_assignment:'maximum weight matching under native 4–8 capacity; NULL when uncoached',only_accepted_standard_races:true},
    actions:nativeActions,training,stage_plans:stagePlans,warnings};
}
