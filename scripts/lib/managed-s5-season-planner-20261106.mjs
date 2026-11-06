// Offline, deterministic S5/J1 planner. This module never connects to a database.
export const MANAGED_S5_KEYS=Object.freeze(['antoine_morel_29','elodie_martin','giulia_rinaldi','mikkel_sorensen','pixel_sprint','rafael_costa','shadow_peloton','thomas_vermeulen']);
const categories=new Set(['elite','world','continental','national','regional','local']);
const n=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
const sortedIds=ids=>[...ids].sort();
const sameIds=(a,b)=>JSON.stringify(sortedIds(a))===JSON.stringify(sortedIds(b));
const overlap=(days,set)=>days.some(d=>set.has(d));
const week=day=>Math.min(4,Math.floor((day-1)/7)+1);
const stageCount=race=>n(race.stage_count,0)||race.stages?.length||race.days?.length||0;
const longestRun=days=>{const all=new Set(days);let best=0;for(const d of all)if(!all.has(d-1)){let end=d;while(all.has(end+1))end++;best=Math.max(best,end-d+1);}return best;};
const createsLongRun=(occupied,days,max)=>{
  const all=new Set([...occupied,...days]),limit=Math.max(max,longestRun(days));
  return days.some(day=>{let first=day,last=day;while(all.has(first-1))first--;while(all.has(last+1))last++;return last-first+1>limit;});
};
function addStageDays(counts,event){
  const count=stageCount(event),days=[...new Set(event.days??[])].sort((a,b)=>a-b);
  let events;
  if(event.stages?.length===count&&event.stages.every(s=>Number.isInteger(s.day)))events=event.stages.map(s=>s.day);
  else if(event.slots?.length===count&&event.slots.every(s=>/^\d+:/.test(s)))events=event.slots.map(s=>Number(s.split(':')[0]));
  else events=days.flatMap((d,i)=>Array.from({length:Math.floor(count/days.length)+(i<count%days.length?1:0)},()=>d));
  for(const d of events)counts.set(d,(counts.get(d)??0)+1);
}
function recoveryAfterRaceLoad(rider,counts,occupied){
  const recoveryDays=new Set((rider.camps??[]).filter(c=>['classic','premium'].includes(c.camp_type)&&c.status!=='cancelled')
    .flatMap(c=>Array.from({length:c.end_day_number-c.start_day_number+1},(_,i)=>c.start_day_number+i)));
  const result=[];let sinceRecovery=0;
  for(let d=1;d<=26;d++){
    if(recoveryDays.has(d)){sinceRecovery=0;continue;}
    sinceRecovery+=counts.get(d)??0;
    if(sinceRecovery>=4&&!occupied.has(d+1))result.push(d+1);
  }
  return result;
}
const primary=r=>Math.max(...['mountain','hills','time_trial','cobbles','sprint'].map(k=>n(r[k],40)));
export function managedS5ProfileFit(rider,race){
  const r=k=>n(rider[k],40);
  const fits={mountain:.65*r('mountain')+.20*r('endurance')+.10*r('resistance')+.05*r('recovery'),
    hilly:.60*r('hills')+.20*r('acceleration')+.10*r('resistance')+.10*r('endurance'),
    flat:.65*r('sprint')+.20*r('flat')+.15*r('acceleration'),
    sprint:.70*r('sprint')+.20*r('acceleration')+.10*r('flat'),
    cobbles:.60*r('cobbles')+.15*r('endurance')+.15*r('resistance')+.10*r('acceleration'),
    time_trial:.75*r('time_trial')+.15*r('flat')+.10*r('endurance'),
    mixed:.65*primary(rider)+.20*r('endurance')+.15*r('resistance')};
  const profiles=race.profiles??race.stages?.map(s=>s.profile)??[];
  const average=profiles.reduce((sum,p)=>sum+(fits[p]??fits.mixed),0)/Math.max(1,profiles.length);
  if(race.race_format==='stage_race'&&profiles.includes('mountain'))return .65*average+.35*(.55*r('mountain')+.20*r('time_trial')+.15*r('hills')+.10*r('recovery'));
  return average;
}
function sponsorTargets(team,race,objectives){
  return objectives.filter(o=>o.bot_key===team.bot_key&&!['cancelled','failed','completed'].includes(o.status)
    &&o.objective_type==='race_result'&&o.target_details?.raceEditionId===race.id);
}
function eligibility(team,race,objectives,now){
  if(race.competition_type!=='standard'||!categories.has(race.category)||!['planned','registration_open'].includes(race.status)
    ||race.registration_policy!=='open'||race.minimum_reputation==null||n(team.reputation_points)<n(race.minimum_reputation)
    ||!race.days?.length||race.first_day<2||!(Date.parse(race.registration_closes_at)>now))return false;
  if(race.category==='local'&&race.country_id!==team.registration_country_id)return false;
  if(race.category==='regional'){
    const sponsorship=objectives.filter(o=>o.bot_key===team.bot_key);
    if(team.sponsored===true||sponsorship.some(o=>o.role==='principal'&&o.sponsor_contract_status==='active'))return false;
    const continent=team.continent_code??sponsorship.find(o=>o.continent_code)?.continent_code;
    if(!continent||continent!==race.continent_code)return false;
  }
  return race.category!=='elite'||Date.parse(race.wildcard_closes_at??race.registration_closes_at)>now;
}

export function planManagedS5Season({context,riders,busy,calendar,registrations,objectives=[],reconnaissances=[]},{
  now=Date.now(),maxStages=26,hardMaxStages=30,maxConsecutiveDays=6,
  reoptimizeExisting=false,preObjectiveRestDays=2,recoveryBudgets={},facilities=[],
  reconnaissanceBudgets={},preparers=[],planSeasonPeaks=true,
}={}){
  if(context.length!==8||new Set(context.map(t=>t.bot_key)).size!==8||context.some(t=>!MANAGED_S5_KEYS.includes(t.bot_key))
    ||new Set(context.map(t=>t.team_id)).size!==8)throw Error('Exactly the eight authorized managed teams are required');
  const season=context[0].season_id;
  if(context.some(t=>t.season_id!==season||t.game_year!==5||t.current_day_number!==1))throw Error('This one-shot plan is restricted to S5 J1');
  if(maxStages>hardMaxStages||hardMaxStages>30||maxStages<1)throw Error('Invalid race-load ceiling');
  const knownTeams=new Set(context.map(t=>t.team_id));
  if(riders.some(r=>!knownTeams.has(r.team_id))||new Set(riders.map(r=>r.id)).size!==riders.length)throw Error('Foreign or duplicate rider in snapshot');
  const raceById=new Map(calendar.map(r=>[r.id,r]));
  const byTeam=new Map(context.map(t=>[t.team_id,riders.filter(r=>r.team_id===t.team_id&&r.status==='active')]));
  const regByKey=new Map(registrations.map(r=>[`${r.bot_key}:${r.race_edition_id}`,r]));
  const modifiable=new Set();
  for(const reg of registrations){
    const team=context.find(t=>t.bot_key===reg.bot_key),race=raceById.get(reg.race_edition_id);
    if(!team||!race||!eligibility(team,race,objectives,now)||!(Date.parse(race.withdrawal_closes_at)>now))continue;
    if(['accepted','pending'].includes(reg.status)&&(reoptimizeExisting||n(reg.riders)<n(race.minimum_roster_size)))modifiable.add(reg.id);
  }
  const occupied=new Map(riders.map(r=>[r.id,new Set(r.camp_days??[])]));
  const raceDays=new Map(riders.map(r=>[r.id,new Set()]));
  const stagesByDay=new Map(riders.map(r=>[r.id,new Map()]));
  const load=new Map(riders.map(r=>[r.id,n(r.season_race_days)]));
  const acceptedLoad=new Map(riders.map(r=>[r.id,n(r.season_race_days)]));
  const coverage=new Map(context.map(t=>[t.team_id,new Set()]));
  const protectedRest=new Map(riders.map(r=>[r.id,new Set()]));
  for(const entry of busy){
    if(!occupied.has(entry.rider_id)||modifiable.has(entry.registration_id)||!['accepted','pending'].includes(entry.registration_status)
      ||!['selected','confirmed'].includes(entry.status))continue;
    for(const d of entry.days){occupied.get(entry.rider_id).add(d);raceDays.get(entry.rider_id).add(d);}
    addStageDays(stagesByDay.get(entry.rider_id),entry);
    load.set(entry.rider_id,load.get(entry.rider_id)+stageCount(entry));
    if(entry.registration_status==='accepted')acceptedLoad.set(entry.rider_id,acceptedLoad.get(entry.rider_id)+stageCount(entry));
    const owner=riders.find(r=>r.id===entry.rider_id);
    for(const d of entry.days)coverage.get(owner.team_id).add(week(d));
  }
  const before=riders.map(r=>({id:r.id,committed_stages:load.get(r.id),accepted_stages:acceptedLoad.get(r.id)}));
  const places=new Map(calendar.map(r=>[r.id,Math.max(0,r.field_limit==null?100000:n(r.field_limit)-n(r.entries))]));
  const candidates=[];
  for(const team of context)for(const race of calendar){
    if(!eligibility(team,race,objectives,now))continue;
    const existing=regByKey.get(`${team.bot_key}:${race.id}`);
    if(existing&&['accepted','pending'].includes(existing.status)&&!modifiable.has(existing.id))continue;
    if(existing&&!['accepted','pending'].includes(existing.status)&&!(existing.status==='withdrawn'&&n(existing.riders)===0&&Date.parse(race.withdrawal_closes_at)>now))continue;
    candidates.push({team,race,existing,targets:sponsorTargets(team,race,objectives)});
  }
  if(planSeasonPeaks)for(const team of context){
    if(candidates.some(c=>c.team.team_id===team.team_id&&c.targets.length))continue;
    const peak=candidates.filter(c=>c.team.team_id===team.team_id&&c.race.first_day>=5&&c.race.first_day<=24&&stageCount(c.race)<=5
      &&(c.race.category!=='elite'||team.division_code==='elite'))
      .map(c=>({...c,peakScore:Math.max(0,...byTeam.get(team.team_id).map(r=>managedS5ProfileFit(r,c.race)))
        +({elite:20,world:15,continental:10,national:5,regional:2,local:1}[c.race.category])-c.race.first_day*.05}))
      .sort((a,b)=>b.peakScore-a.peakScore||a.race.id.localeCompare(b.race.id))[0];
    if(peak)candidates.find(c=>c.team.team_id===team.team_id&&c.race.id===peak.race.id).seasonPeak=true;
  }
  const used=new Set(),chosen=[],preparationTargets=[];
  for(const reg of registrations){
    if(modifiable.has(reg.id)||!['accepted','pending'].includes(reg.status))continue;
    const team=context.find(t=>t.bot_key===reg.bot_key),race=raceById.get(reg.race_edition_id);
    if(!team||!race)continue;
    const targets=sponsorTargets(team,race,objectives);
    if(!targets.length)continue;
    const roster=byTeam.get(team.team_id).filter(r=>(reg.rider_ids??[]).includes(r.id));
    const preferred=new Set(targets.map(t=>t.target_details?.leaderRiderId));
    const leader=roster.sort((a,b)=>(preferred.has(b.id)?20:0)+managedS5ProfileFit(b,race)-(preferred.has(a.id)?20:0)-managedS5ProfileFit(a,race)||a.id.localeCompare(b.id))[0];
    if(!leader)continue;
    const rest=Array.from({length:preObjectiveRestDays},(_,i)=>race.first_day-i-1).filter(d=>d>1&&!raceDays.get(leader.id).has(d));
    for(const d of rest)protectedRest.get(leader.id).add(d);
    preparationTargets.push({bot_key:team.bot_key,team_id:team.team_id,rider_id:leader.id,race_edition_id:race.id,
      race_name:race.display_name,target_day:race.first_day,rest_days:rest,profiles:race.profiles??[],sponsor_objective_ids:targets.map(t=>t.objective_id)});
  }
  for(let iteration=0;iteration<candidates.length;iteration++){
    let best;
    for(const candidate of candidates){
      const {team,race,existing,targets}=candidate,key=`${team.bot_key}:${race.id}`;
      if(used.has(key)||(!['accepted','pending'].includes(existing?.status)&&places.get(race.id)<=0))continue;
      const stages=stageCount(race),isObjective=targets.length>0;
      const pendingWildcard=race.category==='elite'&&team.division_code!=='elite'&&existing?.status!=='accepted';
      if(pendingWildcard&&!isObjective)continue;
      const departures=(race.stages??[]).map(s=>Date.parse(s.departureAt)).filter(Number.isFinite);
      const startsAt=departures.length?Math.min(...departures):now;
      const available=byTeam.get(team.team_id).filter(r=>{
        if(r.injured_until&&Date.parse(r.injured_until)>startsAt)return false;
        if(overlap(race.days,occupied.get(r.id))||overlap(race.days,protectedRest.get(r.id)))return false;
        if(load.get(r.id)+stages>(isObjective?hardMaxStages:maxStages))return false;
        return !createsLongRun(raceDays.get(r.id),race.days,maxConsecutiveDays);
      });
      if(available.length<n(race.minimum_roster_size))continue;
      const preferred=new Set(targets.map(t=>t.target_details?.leaderRiderId).filter(Boolean));
      const ranked=[...available].sort((a,b)=>
        (preferred.has(b.id)?20:0)+managedS5ProfileFit(b,race)-(preferred.has(a.id)?20:0)-managedS5ProfileFit(a,race)
        ||load.get(a.id)-load.get(b.id)||a.id.localeCompare(b.id));
      const leader=ranked[0];
      const existingIds=!reoptimizeExisting&&existing?existing.rider_ids??[]:[];
      if(existingIds.some(id=>!available.some(r=>r.id===id)))continue;
      const required=new Set([...existingIds,leader.id]);
      const desired=Math.min(n(race.maximum_roster_size),Math.max(n(race.minimum_roster_size),required.size,Math.ceil(byTeam.get(team.team_id).length/2)));
      const support=ranked.filter(r=>!required.has(r.id)).sort((a,b)=>
        (load.get(a.id)===0?0:1)-(load.get(b.id)===0?0:1)||load.get(a.id)-load.get(b.id)
        ||managedS5ProfileFit(b,race)-managedS5ProfileFit(a,race)||a.id.localeCompare(b.id));
      const selected=[...required].map(id=>available.find(r=>r.id===id));
      selected.push(...support.slice(0,Math.max(0,desired-selected.length)));
      if(selected.length>n(race.maximum_roster_size))continue;
      const rest=isObjective||candidate.seasonPeak?Array.from({length:preObjectiveRestDays},(_,i)=>race.first_day-i-1).filter(d=>d>1):[];
      if(overlap(rest,raceDays.get(leader.id)))continue;
      const newWeeks=[...new Set(race.days.map(week))].filter(w=>!coverage.get(team.team_id).has(w)).length;
      const unused=selected.filter(r=>load.get(r.id)===0).length;
      const averageLoad=selected.reduce((sum,r)=>sum+load.get(r.id),0)/selected.length;
      const objectiveWeight=targets.reduce((sum,o)=>sum+({mandatory:1600,important:1300,standard:1000,optional:700}[o.priority]??1000)+n(o.satisfaction_points),0);
      const categoryWeight={elite:30,world:22,continental:16,national:10,regional:5,local:4}[race.category];
      const score=objectiveWeight+(candidate.seasonPeak?500:0)+newWeeks*100+unused*12+managedS5ProfileFit(leader,race)/4+categoryWeight-(pendingWildcard?80:0)
        +(existing?18:0)-averageLoad*1.2-stages*.15;
      if(!best||score>best.score||(score===best.score&&`${race.first_day}:${key}`<`${best.race.first_day}:${best.key}`))best={...candidate,key,selected,leader,score,rest};
    }
    if(!best)break;
    const {team,race,existing,selected,leader,rest,key}=best;
    used.add(key);chosen.push(best);
    if(!['accepted','pending'].includes(existing?.status))places.set(race.id,places.get(race.id)-1);
    for(const r of selected){
      load.set(r.id,load.get(r.id)+stageCount(race));
      addStageDays(stagesByDay.get(r.id),race);
      if(race.category!=='elite'||team.division_code==='elite'||existing?.status==='accepted')acceptedLoad.set(r.id,acceptedLoad.get(r.id)+stageCount(race));
      for(const d of race.days){occupied.get(r.id).add(d);raceDays.get(r.id).add(d);coverage.get(team.team_id).add(week(d));}
    }
    for(const d of rest)protectedRest.get(leader.id).add(d);
    if(best.targets.length||best.seasonPeak)preparationTargets.push({bot_key:team.bot_key,team_id:team.team_id,rider_id:leader.id,race_edition_id:race.id,
      race_name:race.display_name,target_day:race.first_day,rest_days:rest,profiles:race.profiles??[],
      reason:best.targets.length?'sponsor_objective':'season_peak',sponsor_objective_ids:best.targets.map(t=>t.objective_id)});
  }
  const actions=[];
  for(const choice of chosen){
    const {team,race,existing,selected,leader,targets}=choice;
    const riderIds=selected.map(r=>r.id),original=existing?.rider_ids??[];
    if(existing&&sameIds(riderIds,original)&&['accepted','pending'].includes(existing.status))continue;
    actions.push({operation:existing&&['accepted','pending'].includes(existing.status)?'update':'register',
      bot_key:team.bot_key,team_id:team.team_id,team_season_id:team.team_season_id,director_id:team.director_id,auth_user_id:team.auth_user_id,
      race_edition_id:race.id,race_name:race.display_name,category:race.category,days:[...race.days],stage_count:stageCount(race),
      source_registration_id:existing?.id??null,original_rider_ids:[...original],rider_ids:riderIds,leader_rider_id:leader.id,
      expected_status:race.category==='elite'&&team.division_code!=='elite'&&existing?.status!=='accepted'?'pending':'accepted',
      sponsor_objective_ids:targets.map(t=>t.objective_id),reentry:existing?.status==='withdrawn'});
  }
  const withdrawals=[];
  if(reoptimizeExisting)for(const reg of registrations){
    if(!modifiable.has(reg.id)||used.has(`${reg.bot_key}:${reg.race_edition_id}`))continue;
    const team=context.find(t=>t.bot_key===reg.bot_key),race=raceById.get(reg.race_edition_id);
    withdrawals.push({operation:'withdraw',bot_key:team.bot_key,team_id:team.team_id,team_season_id:team.team_season_id,
      race_edition_id:race.id,race_name:race.display_name,source_registration_id:reg.id,original_rider_ids:[...(reg.rider_ids??[])],rider_ids:[]});
  }
  const reconnaissanceActions=[],reconBudgets=new Map(context.map(t=>[t.team_id,Math.max(0,n(reconnaissanceBudgets[t.team_id]))]));
  const reconnaissancePrices={local:{one_day:2500,stage_race:2000},regional:{one_day:2500,stage_race:2000},national:{one_day:4000,stage_race:3000},
    continental:{one_day:7000,stage_race:5000},world:{one_day:12000,stage_race:9000},elite:{one_day:20000,stage_race:15000}};
  for(const target of preparationTargets){
    const team=context.find(t=>t.team_id===target.team_id),race=raceById.get(target.race_edition_id),leader=riders.find(r=>r.id===target.rider_id);
    const member=preparers.filter(p=>p.team_id===team.team_id).sort((a,b)=>n(a.duration_days??a.durationDays,2)-n(b.duration_days??b.durationDays,2)||n(b.level)-n(a.level))[0];
    const duration=n(member?.duration_days??member?.durationDays,2),start=race.first_day-duration,end=race.first_day-1;
    if(start<2||overlap(Array.from({length:duration},(_,i)=>start+i),occupied.get(leader.id)))continue;
    const primaryKey=['mountain','hills','time_trial','cobbles','sprint'].sort((a,b)=>n(leader[b])-n(leader[a]))[0];
    const profileFor={mountain:'mountain',hills:'hilly',time_trial:'time_trial',cobbles:'cobbles',sprint:'flat'}[primaryKey];
    const stage=[...(race.stages??[])].sort((a,b)=>Number(b.profile===profileFor)-Number(a.profile===profileFor)||n(b.stageNumber)-n(a.stageNumber)||a.id.localeCompare(b.id))[0];
    if(!stage?.id)continue;
    const base=reconnaissancePrices[race.category]?.[race.race_format];
    if(base==null)continue;
    const reduction=Math.min(20,Math.max(0,n(member?.cost_reduction_percentage??member?.costReductionPercentage)));
    const cost=Math.round(base*(1-reduction/100)*100)/100;
    if(reconBudgets.get(team.team_id)<cost)continue;
    const chosenEntry=chosen.find(c=>c.team.team_id===team.team_id&&c.race.id===race.id);
    const rosterIds=chosenEntry?.selected.map(r=>r.id)??regByKey.get(`${team.bot_key}:${race.id}`)?.rider_ids??[];
    const days=Array.from({length:duration},(_,i)=>start+i);
    const already=riderId=>reconnaissances.some(m=>m.team_season_id===team.team_season_id&&m.target_stage_id===stage.id
      &&m.status!=='cancelled'&&(m.rider_ids??[]).includes(riderId));
    if(already(leader.id))continue;
    const capacity=n(member?.rider_capacity??member?.riderCapacity,3);
    const roster=rosterIds.map(id=>riders.find(r=>r.id===id)).filter(r=>r&&!already(r.id)&&!overlap(days,occupied.get(r.id)))
      .sort((a,b)=>Number(b.id===leader.id)-Number(a.id===leader.id)||managedS5ProfileFit(b,race)-managedS5ProfileFit(a,race)||a.id.localeCompare(b.id)).slice(0,capacity);
    if(!roster.some(r=>r.id===leader.id))continue;
    for(const r of roster)for(const day of days)occupied.get(r.id).add(day);
    reconBudgets.set(team.team_id,reconBudgets.get(team.team_id)-cost);
    reconnaissanceActions.push({...target,kind:'reconnaissance',team_season_id:team.team_season_id,target_stage_id:stage.id,
      rider_ids:roster.map(r=>r.id),start_day:start,end_day:end,expected_cost:cost,expected_bonus:n(member?.resulting_bonus??member?.resultingBonus,2),
      key:`managed-s5:${team.bot_key}:recon:${stage.id}:${start}`,rpc:'book_current_team_stage_reconnaissance',
      args:{p_stage_id:stage.id,p_rider_ids:roster.map(r=>r.id),p_start_day_number:start,p_preparer_contract_id:member?.contract_id??member?.contractId??null},
      max_cash_cost:cost});
  }
  const performanceSuggestions=[],facilityUses=[];
  const campToType={indoor_preparation:'indoor_track',wind_tunnel_preparation:'wind_tunnel',cobbles_preparation:'cobbles_center',hills_preparation:'hills_circuit',mountain_preparation:'mountain_base'};
  for(const r of riders)for(const camp of r.camps??[])if(campToType[camp.camp_type])facilityUses.push({team_id:r.team_id,
    type:campToType[camp.camp_type],start:camp.start_day_number,end:camp.end_day_number});
  for(const target of preparationTargets){
    const rider=riders.find(r=>r.id===target.rider_id),start=target.target_day-2,end=start+1;
    if(start<2||overlap([start,end],occupied.get(rider.id)))continue;
    const type=(target.profiles.includes('mountain')?'mountain_base':target.profiles.includes('hilly')?'hills_circuit':
      target.profiles.includes('cobbles')?'cobbles_center':target.profiles.length&&target.profiles.every(p=>p==='time_trial')?'wind_tunnel':'indoor_track');
    const facility=facilities.find(f=>f.team_id===target.team_id&&f.infrastructure_code===type&&n(f.level)>0&&n(f.available_day,1)<=start);
    if(!facility)continue;
    const capacity=n(facility.capacity,[0,1,1,2,2,3][n(facility.level)]);
    if([start,end].some(d=>facilityUses.filter(f=>f.team_id===target.team_id&&f.type===type&&f.start<=d&&f.end>=d).length>=capacity))continue;
    for(const d of [start,end])occupied.get(rider.id).add(d);
    facilityUses.push({team_id:target.team_id,type,start,end});
    performanceSuggestions.push({...target,kind:'performance',preparation_type:type,start_day:start,end_day:end,
      bonus_start_day:target.target_day,building_level:n(facility.level),requires_date_aware_booking:true});
  }
  const campActions=[],campBudgets=new Map(context.map(t=>[t.team_id,Math.max(0,n(recoveryBudgets[t.team_id]))]));
  const selectedRaces=new Map(riders.map(r=>[r.id,chosen.filter(c=>c.selected.some(s=>s.id===r.id))]));
  const orderedRiders=[...riders].sort((a,b)=>
    preparationTargets.filter(t=>t.rider_id===b.id).length-preparationTargets.filter(t=>t.rider_id===a.id).length
    ||load.get(b.id)-load.get(a.id)||primary(b)-primary(a)||a.id.localeCompare(b.id));
  for(const rider of orderedRiders){
    if(campBudgets.get(rider.team_id)<2000||load.get(rider.id)<4)continue;
    const targets=preparationTargets.filter(t=>t.rider_id===rider.id);
    const afterRaceLoad=recoveryAfterRaceLoad(rider,stagesByDay.get(rider.id),occupied.get(rider.id));
    const candidateDays=[...targets.flatMap(t=>[t.target_day-1,t.target_day-3]),...selectedRaces.get(rider.id).filter(c=>stageCount(c.race)>=3).map(c=>c.race.last_day+1),
      ...busy.filter(b=>b.rider_id===rider.id&&stageCount(b)>=3).map(b=>Math.max(...b.days)+1),...afterRaceLoad];
    const day=candidateDays.find(d=>d>=2&&d<=27&&!occupied.get(rider.id).has(d));
    if(!day)continue;
    occupied.get(rider.id).add(day);campBudgets.set(rider.team_id,campBudgets.get(rider.team_id)-2000);
    const team=context.find(t=>t.team_id===rider.team_id);
    campActions.push({kind:'recovery',bot_key:team.bot_key,team_id:team.team_id,team_season_id:team.team_season_id,
      rider_ids:[rider.id],camp_type:'classic',start_day:day,end_day:day,expected_cost:2000,
      reason:targets.some(t=>[t.target_day-1,t.target_day-3].includes(day))?'before_objective':'after_racing_load'});
  }
  const warnings=[];
  for(const team of context){
    const missing=[1,2,3,4].filter(w=>!coverage.get(team.team_id).has(w));
    if(missing.length)warnings.push({bot_key:team.bot_key,code:'uncovered_weeks',weeks:missing});
    if(byTeam.get(team.team_id).some(r=>load.get(r.id)===0))warnings.push({bot_key:team.bot_key,code:'unraced_riders',rider_ids:byTeam.get(team.team_id).filter(r=>load.get(r.id)===0).map(r=>r.id)});
  }
  for(const r of riders)if(load.get(r.id)>hardMaxStages)warnings.push({rider_id:r.id,code:'existing_overload',stages:load.get(r.id)});
  return {season_id:season,game_year:5,current_day:1,generated_at:new Date(now).toISOString(),
    policy:{maxStages,hardMaxStages,maxConsecutiveDays,preObjectiveRestDays,reoptimizeExisting,
      existing_engagements:'federation, started and closed races remain fixed',conflicts:'whole-day including camps and pending races'},
    requires_atomic_reoptimization:reoptimizeExisting&&actions.some(a=>a.operation==='update'),
    withdrawals,actions,camp_actions:campActions,reconnaissance_actions:reconnaissanceActions,performance_suggestions:performanceSuggestions,preparation_targets:preparationTargets,
    riders:riders.map(r=>({id:r.id,name:r.name,bot_key:r.bot_key,team_id:r.team_id,before:before.find(x=>x.id===r.id),
      after:{committed_stages:load.get(r.id),accepted_stages:acceptedLoad.get(r.id)},race_days:[...raceDays.get(r.id)].sort((a,b)=>a-b)})),
    teams:context.map(t=>({bot_key:t.bot_key,team_id:t.team_id,weeks:[...coverage.get(t.team_id)].sort(),
      recovery_cost:n(recoveryBudgets[t.team_id])-campBudgets.get(t.team_id),
      reconnaissance_cost:n(reconnaissanceBudgets[t.team_id])-reconBudgets.get(t.team_id)})),warnings};
}
