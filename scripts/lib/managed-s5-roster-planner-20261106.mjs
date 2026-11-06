// Pure one-shot planning only. No credentials, network, SQL or gameplay writes.
import assert from 'node:assert/strict';

const PRIMARY=['mountain','hills','time_trial','cobbles','sprint'];
const STATS=[...PRIMARY,'flat','acceleration','downhill','endurance','resistance','recovery','breakaway','prologue'];
const CAMEL={timeTrial:'time_trial'};
const n=value=>Number(value??0);
const sum=values=>values.reduce((a,b)=>a+b,0);
const byId=(a,b)=>String(a.id).localeCompare(String(b.id));
const rating=(r,key)=>n(r[key]);
export const bestPrimary=r=>Math.max(...PRIMARY.map(key=>rating(r,key)));
export const primaryDomain=r=>PRIMARY.slice().sort((a,b)=>rating(r,b)-rating(r,a)||PRIMARY.indexOf(a)-PRIMARY.indexOf(b))[0];
export const performance=r=>.9*bestPrimary(r)+.1*sum(STATS.filter(key=>key!=='flat').map(key=>rating(r,key)))/12;

function domainScore(r,domain){
  const support=domain==='mountain'?(.4*rating(r,'endurance')+.3*rating(r,'resistance')+.3*rating(r,'recovery'))
    :domain==='hills'?(.5*rating(r,'acceleration')+.3*rating(r,'resistance')+.2*rating(r,'endurance'))
      :domain==='sprint'?(.7*rating(r,'acceleration')+.3*rating(r,'flat'))
        :domain==='cobbles'?(.4*rating(r,'resistance')+.3*rating(r,'endurance')+.3*rating(r,'flat'))
          :(.4*rating(r,'endurance')+.3*rating(r,'resistance')+.3*rating(r,'flat'));
  return .8*rating(r,domain)+.2*support;
}

function preferences(identity,objectives){
  const philosophy=objectives.map(o=>o.target_details?.sportingPhilosophy).find(Boolean);
  if(philosophy==='cobbled_classics'||identity.strategy==='classics')return ['cobbles','hills','sprint','mountain','time_trial'];
  if(philosophy==='time_trials'||identity.strategy==='rouleur')return ['time_trial','hills','cobbles','sprint','mountain'];
  if(philosophy==='grand_tour_general'||identity.strategy==='climber')return ['mountain','time_trial','hills','sprint','cobbles'];
  if(philosophy==='sprints'||identity.strategy==='sprinter')return ['sprint','hills','time_trial','mountain','cobbles'];
  return ['mountain','sprint','hills','cobbles','time_trial'];
}

export function rawProjectedBudget(team,pending){
  return n(team.cash_balance)+sum(pending.filter(p=>p.bot_key===team.bot_key).map(p=>n(p.amount)));
}

const normalizedRider=(r,identity,recruit=false)=>({
  ...r,id:r.id??r.rider_id,rider_id:r.id??r.rider_id,
  name:r.name??`${r.first_name} ${r.last_name}`,bot_key:identity.bot_key,team_id:identity.team_id,
  team_season_id:identity.team_season_id,new_recruit:recruit,
});

function defaultReserves(identity,raw,target){
  const wealthy=raw>=250000;
  const liquid=n(identity.cash_balance)>=250000;
  return {
    liquidity:liquid?60000:30000,
    camps:target>=12?24000:12000,
    infrastructure:['elodie_martin','thomas_vermeulen'].includes(identity.bot_key)&&raw>=250000?100000:0,
    youth:wealthy?(liquid?20000:10000):5000,
    equipment:wealthy?Math.min(16000,Math.floor(n(identity.cash_balance)*.06)):6000,
  };
}

function objectiveRequests(state,candidates){
  const named=state.objectives.filter(o=>o.objective_type==='rider_recruitment').map(o=>o.target_details?.riderId).filter(Boolean);
  const nationality=state.objectives.find(o=>o.objective_type==='nationality_quota')?.target_details;
  const countryCode=nationality?.countryCode??state.objectives.find(o=>o.objective_type==='national_championship')?.target_details?.countryCode;
  const countryId=candidates.find(r=>r.country_code===countryCode)?.country_id;
  const currentNative=state.roster.filter(r=>r.country_id===countryId).length;
  const nativeNeed=nationality?Math.max(0,Math.ceil(state.target*n(nationality.minimumPercentage)/100)-currentNative)
    :countryCode&&countryId&&currentNative===0?1:0;
  return {named,countryCode,countryId,nativeNeed};
}

function affordableCandidates(state,candidates,used){
  const remaining=Math.max(1,state.target-state.roster.length);
  const available=candidates.filter(r=>!used.has(r.id)&&n(r.salary_per_season)>0);
  const ranked=available.filter(r=>bestPrimary(r)>=60).sort((a,b)=>n(a.salary_per_season)-n(b.salary_per_season)||byId(a,b));
  return available.filter(r=>{
    const reserveForOthers=sum(ranked.filter(other=>other.id!==r.id).slice(0,Math.max(0,remaining-1)).map(other=>n(other.salary_per_season)));
    return n(r.salary_per_season)<=state.recruitBudget-state.recruitSalary-reserveForOthers;
  });
}

function candidateUtility(r,state,domain,reason){
  const currentDomainBest=Math.max(0,...state.roster.map(owned=>domainScore(owned,domain)));
  const improvement=Math.max(0,domainScore(r,domain)-currentDomainBest);
  const secondary=performance(r);
  const oldPenalty=Math.max(0,n(r.age)-32)*.25;
  const potentialBonus=n(r.age)<=26?Math.min(1,n(r.potential_steps)*.12):0;
  const costPenalty=n(r.salary_per_season)/4500;
  return domainScore(r,domain)+.15*secondary+.6*improvement-oldPenalty+potentialBonus-costPenalty+(reason==='named_sponsor'?20:0);
}

function selectCandidate(state,candidates,used,{domain,reason,countryId,riderId}){
  let available=affordableCandidates(state,candidates,used);
  if(reason==='national_sponsor')available=available.filter(r=>bestPrimary(r)>=50||rating(r,'breakaway')>=65);
  else if(reason!=='named_sponsor')available=available.filter(r=>bestPrimary(r)>=60);
  if(countryId)available=available.filter(r=>r.country_id===countryId);
  if(riderId)available=available.filter(r=>r.id===riderId);
  available.sort((a,b)=>candidateUtility(b,state,domain,reason)-candidateUtility(a,state,domain,reason)
    ||n(a.salary_per_season)-n(b.salary_per_season)||byId(a,b));
  const candidate=available[0];
  if(!candidate)return false;
  used.add(candidate.id);
  const recruit={...normalizedRider(candidate,state.identity,true),selection_reason:reason,target_domain:domain,salary_per_season:n(candidate.salary_per_season)};
  state.recruits.push(recruit);state.roster.push(recruit);state.recruitSalary+=recruit.salary_per_season;
  return true;
}

function nextDomain(state){
  const priority=state.domainPreferences;
  return priority.map((domain,index)=>({domain,score:
    Math.max(0,...state.roster.map(r=>domainScore(r,domain)))
      +state.roster.filter(r=>primaryDomain(r)===domain).length*3+index*.75}))
    .sort((a,b)=>a.score-b.score||priority.indexOf(a.domain)-priority.indexOf(b.domain))[0].domain;
}

function equipmentValue(item,rider){
  const effects=item?.effect_payload??{};
  const domain=primaryDomain(rider);
  let value=0;
  for(const [key,bonus] of Object.entries(effects.ratingBonuses??{})){
    const stat=CAMEL[key]??key;
    const weight=stat===domain?3:PRIMARY.includes(stat)?.8:['endurance','resistance','recovery','acceleration'].includes(stat)?.6:.25;
    const applied=Math.max(0,Math.min(100,rating(rider,stat)+n(bonus))-Math.min(100,rating(rider,stat)));
    value+=applied*weight;
  }
  value+=n(effects.injuryRiskReductionPct)*.07+n(effects.victoryReputationBonus)*3+n(effects.breakawayReputationBonus);
  return value;
}

function planEquipment(state,snapshot){
  const catalog=new Map(snapshot.catalog.map(item=>[item.id,item]));
  const roster=state.roster.slice().sort((a,b)=>performance(b)-performance(a)||byId(a,b));
  const rosterIds=new Set(roster.map(r=>r.id));
  const existing=snapshot.assignments.filter(a=>rosterIds.has(a.rider_id));
  const final=new Map(existing.map(a=>[`${a.rider_id}:${a.slot_type}`,{...a}]));
  const actions=new Map();
  const owned=snapshot.inventory.filter(i=>i.bot_key===state.identity.bot_key);
  const stock=new Map(owned.map(i=>[i.equipment_item_id,n(i.quantity)]));
  for(const a of existing)stock.set(a.equipment_item_id,(stock.get(a.equipment_item_id)??0)-1);
  assert.ok([...stock.values()].every(quantity=>quantity>=0),'Existing equipment exceeds inventory');

  // Keep existing equipment; distribute unused owned stock before any purchase.
  const unused=owned.flatMap(i=>Array.from({length:Math.max(0,stock.get(i.equipment_item_id)??0)},()=>catalog.get(i.equipment_item_id)))
    .filter(Boolean).sort((a,b)=>Math.max(...roster.map(r=>equipmentValue(b,r)),0)-Math.max(...roster.map(r=>equipmentValue(a,r)),0)||byId(a,b));
  for(const item of unused){
    const rider=roster.filter(r=>!final.has(`${r.id}:${item.slot_type}`))
      .sort((a,b)=>equipmentValue(item,b)-equipmentValue(item,a)||performance(b)-performance(a)||byId(a,b))[0];
    if(!rider)continue;
    const assignment={riderId:rider.id,slot:item.slot_type,equipmentItemId:item.id};
    actions.set(`${rider.id}:${item.slot_type}`,assignment);
    final.set(`${rider.id}:${item.slot_type}`,{rider_id:rider.id,slot_type:item.slot_type,equipment_item_id:item.id});
    stock.set(item.id,(stock.get(item.id)??0)-1);
  }

  let cost=0;
  const cart=new Map();
  // Purchases are modest and useful for the top three. Zero-price tutorial
  // articles and reputation-only clothing are never farmed from the shop.
  const commercial=snapshot.catalog.filter(item=>item.acquisition_channel==='commercial'&&n(item.price)>0);
  const leaders=roster.slice(0,3);
  for(let step=0;step<24;step++){
    const proposals=[];
    for(const rider of leaders)for(const item of commercial){
      if(n(item.price)+cost>state.reserves.equipment)continue;
      if(!Object.keys(item.effect_payload?.ratingBonuses??{}).length&&!item.effect_payload?.injuryRiskReductionPct)continue;
      const key=`${rider.id}:${item.slot_type}`;
      const current=final.get(key);
      if(current)continue;
      const gain=equipmentValue(item,rider);
      if(gain<=0)continue;
      proposals.push({rider,item,key,gain,efficiency:gain/n(item.price)});
    }
    proposals.sort((a,b)=>b.efficiency-a.efficiency||b.gain-a.gain||performance(b.rider)-performance(a.rider)||byId(a.item,b.item)||byId(a.rider,b.rider));
    const choice=proposals[0];
    if(!choice)break;
    const {rider,item,key}=choice;
    cost+=n(item.price);cart.set(item.id,(cart.get(item.id)??0)+1);
    actions.set(key,{riderId:rider.id,slot:item.slot_type,equipmentItemId:item.id});
    final.set(key,{rider_id:rider.id,slot_type:item.slot_type,equipment_item_id:item.id});
  }
  return {
    budget:state.reserves.equipment,total_cost:cost,
    purchases:[...cart].map(([equipmentItemId,quantity])=>({equipmentItemId,quantity})),
    assignments:[...actions.values()],existing_assignments_preserved:existing.length,
    owned_units_reused:actions.size-sum([...cart.values()]),
  };
}

export function planManagedS5Roster(input,options={}){
  const identity=input.identity;
  const snapshot=input.finances;
  assert.equal(identity.length,8,'Exactly the eight owner-authorized teams are required');
  assert.equal(new Set(identity.map(t=>t.team_id)).size,8);
  assert.ok(identity.every(t=>t.game_year===5&&t.current_day_number===1));
  const uniqueCandidates=new Map([...input.freeAgents,...(input.targetedFreeAgents??[]),...(input.quotaFreeAgents??[])].map(r=>[r.rider_id,r]));
  const candidates=[...uniqueCandidates.values()].map(r=>({...r,id:r.rider_id}));
  assert.equal(candidates.length,new Set(candidates.map(r=>r.id)).size);
  const used=new Set(input.riders.map(r=>r.id));
  const states=identity.map(t=>{
    const finance=snapshot.teams.find(f=>f.team_id===t.team_id);assert.ok(finance);
    const baselineRaw=rawProjectedBudget(finance,snapshot.pending_finance);
    const restoration=n(options.plannedSponsorRestorations?.[t.bot_key]?.annual_budget);
    assert.ok(restoration>=0,'Invalid planned sponsor restoration');
    const raw=baselineRaw+restoration;
    const target=options.targetRosters?.[t.bot_key]??(raw>=250000?12:10);
    assert.ok(Number.isInteger(target)&&target>=8&&target<=16,'Invalid target roster size');
    const reserves={...defaultReserves(t,raw,target),...(options.reserves?.[t.bot_key]??{})};
    assert.ok(Object.values(reserves).every(value=>Number.isFinite(value)&&value>=0));
    const objectives=input.objectives.filter(o=>o.bot_key===t.bot_key&&o.objective_id);
    const roster=input.riders.filter(r=>r.team_id===t.team_id).map(r=>normalizedRider(r,t));
    const reserveTotal=sum(Object.values(reserves));
    return {identity:t,finance,baselineRaw,restoration,raw,target,reserves,reserveTotal,objectives,roster,
      recruitBudget:Math.max(0,Math.min(n(t.cash_balance)*.65,raw-reserveTotal)),
      recruitSalary:0,recruits:[],domainPreferences:preferences(t,objectives),warnings:[]};
  });
  // Named sponsor requests and national quotas precede the common allocation;
  // this prevents another managed team taking a necessary national recruit.
  for(const state of states){
    const requests=objectiveRequests(state,candidates);
    for(const riderId of requests.named){
      if(state.roster.length>=state.target)break;
      if(!selectCandidate(state,candidates,used,{riderId,domain:state.domainPreferences[0],reason:'named_sponsor'}))state.warnings.push(`Named sponsor rider unavailable or outside budget: ${riderId}`);
    }
    const alreadyAdded=state.recruits.filter(r=>r.country_id===requests.countryId).length;
    if(requests.nativeNeed>0&&!requests.countryId){
      state.warnings.push(`No eligible free agent found for the national sponsor quota: ${requests.countryCode}`);
      continue;
    }
    for(let count=alreadyAdded;count<requests.nativeNeed&&state.roster.length<state.target;count++){
      if(!selectCandidate(state,candidates,used,{countryId:requests.countryId,domain:state.domainPreferences[0],reason:'national_sponsor'})){
        const eligibleLocal=candidates.some(r=>r.country_id===requests.countryId&&!used.has(r.id)
          &&(bestPrimary(r)>=50||rating(r,'breakaway')>=65));
        state.warnings.push(eligibleLocal?`National sponsor quota cannot be fully filled within budget: ${requests.countryCode}`
          :`No further eligible national free agent available for sponsor quota: ${requests.countryCode}`);
        break;
      }
    }
  }
  const allocation=states.slice().sort((a,b)=>a.roster.length-b.roster.length||n(a.identity.cash_balance)-n(b.identity.cash_balance)||a.identity.bot_key.localeCompare(b.identity.bot_key));
  for(let round=0;round<16;round++){
    let progressed=false;
    for(const state of allocation){
      if(state.roster.length>=state.target)continue;
      const domain=nextDomain(state);
      progressed=selectCandidate(state,candidates,used,{domain,reason:'sporting_gap'})||progressed;
    }
    if(!progressed)break;
  }
  const result=states.map(state=>{
    const original=state.roster.filter(r=>!r.new_recruit).sort((a,b)=>performance(b)-performance(a)||byId(a,b));
    const renewals=original.filter(r=>bestPrimary(r)>=65).slice(0,original.length>=6?4:3).flatMap(r=>{
      const active=snapshot.contracts.find(c=>c.rider_id===r.id&&c.team_id===state.identity.team_id&&c.status==='active');
      if(!active||n(active.end_year)>=7)return [];
      const targetEnd=n(active.end_year)+1;
      if(snapshot.contracts.some(c=>c.rider_id===r.id&&c.status==='planned'&&n(c.start_year)<=targetEnd&&n(c.end_year)>=targetEnd))return [];
      return [{rider_id:r.id,name:r.name,active_contract_id:active.id,previous_end_year:n(active.end_year),
        target_end_year:targetEnd,current_salary:n(active.salary_per_season),requires_fresh_salary_quote:true}];
    });
    const blocked=state.raw<state.reserveTotal;
    if(blocked)state.warnings.push('Existing projection cannot fund even protected reserves; restore legitimate sponsor/staff balance before recruiting.');
    if(state.roster.length<state.target)state.warnings.push(`Roster target not yet funded: ${state.roster.length}/${state.target}`);
    // No new paid gear is added to a team already unable to fund its obligations.
    const gear=planEquipment({...state,reserves:{...state.reserves,equipment:blocked?0:state.reserves.equipment}},snapshot);
    const remainder=state.raw-state.recruitSalary-gear.total_cost;
    if(!blocked)assert.ok(remainder>=state.reserveTotal-state.reserves.equipment,'Protected budget was consumed');
    const nativeActions=state.recruits.map(r=>({key:`recruit:${r.id}`,bot_key:state.identity.bot_key,
      rpc:'sign_current_team_free_agent',args:{p_rider_id:r.id},min_cash:15000,
      min_projected:Math.max(25000,state.reserves.liquidity),max_cash_cost:0,max_salary:r.salary_per_season*1.05}));
    for(const renewal of renewals){
      const quote=input.renewalQuotes?.find(q=>q.rider_id===renewal.rider_id);
      renewal.quoted_salary=quote?n(quote.salary_per_season):null;
      if(quote){
        nativeActions.push({key:`renew:${renewal.rider_id}:${renewal.target_end_year}`,bot_key:state.identity.bot_key,
          rpc:'renew_current_team_rider_until',args:{p_rider_id:renewal.rider_id,p_target_end_game_year:renewal.target_end_year},
          min_cash:15000,min_projected:Math.max(25000,state.reserves.liquidity),max_cash_cost:0,max_salary:n(quote.salary_per_season)*1.05});
      }
    }
    if(gear.purchases.length)nativeActions.push({key:`gear-purchase:${state.identity.team_id}:S5`,bot_key:state.identity.bot_key,
      rpc:'purchase_current_team_equipment_cart',args:{p_items:gear.purchases},
      min_cash:gear.total_cost+state.reserves.liquidity,min_projected:gear.total_cost+state.reserves.liquidity,
      max_cash_cost:gear.total_cost,max_salary:0});
    for(let offset=0;offset<gear.assignments.length;offset+=24){
      nativeActions.push({key:`gear-equip:${state.identity.team_id}:S5:${offset/24}`,bot_key:state.identity.bot_key,
        rpc:'save_current_team_equipment_assignments',args:{p_assignments:gear.assignments.slice(offset,offset+24)},
        min_cash:15000,min_projected:Math.max(25000,state.reserves.liquidity),max_cash_cost:0,max_salary:0});
    }
    const nationality=state.objectives.find(o=>o.objective_type==='nationality_quota')?.target_details;
    const nationalCountry=candidates.find(r=>r.country_code===nationality?.countryCode)?.country_id;
    const nationalCount=nationalCountry?state.roster.filter(r=>r.country_id===nationalCountry).length:0;
    return {
      bot_key:state.identity.bot_key,team_id:state.identity.team_id,team_season_id:state.identity.team_season_id,
      director_id:state.identity.director_id,auth_user_id:state.identity.auth_user_id,team_name:state.identity.display_name,
      domain_priority:state.domainPreferences,initial_roster:original.length,target_roster:state.target,planned_roster:state.roster.length,
      finance:{cash:n(state.identity.cash_balance),baseline_raw_projected:state.baselineRaw,
        planned_sponsor_restoration_income:state.restoration,raw_projected:state.raw,reserves:state.reserves,
        recruit_salary_budget:state.recruitBudget,new_annual_salaries:state.recruitSalary,
        immediate_gear_cost:gear.total_cost,projected_after_recruits_and_gear:remainder,
        cash_after_gear:n(state.identity.cash_balance)-gear.total_cost,funding_blocked:blocked},
      recruits:state.recruits,renewals,equipment:gear,roster:state.roster,warnings:state.warnings,native_actions:nativeActions,
      financial_preconditions:state.restoration>0?[{kind:'sponsor_restoration',
        annual_budget:state.restoration,...options.plannedSponsorRestorations[state.identity.bot_key]}]:[],
      sponsor_nationality:nationality?{country_code:nationality.countryCode,minimum_percentage:n(nationality.minimumPercentage),
        required_count:Math.ceil(state.target*n(nationality.minimumPercentage)/100),planned_count:nationalCount,
        eligible_candidates_in_snapshot:candidates.filter(r=>r.country_id===nationalCountry&&(bestPrimary(r)>=50||rating(r,'breakaway')>=65)).length}:null,
      equipment_partner:{can_sign:n(state.identity.reputation_points)>=200,minimum_reputation:200,
        status:n(state.identity.reputation_points)>=200?'requires_supplier_review':'reputation_locked'},
    };
  });
  const allRecruits=result.flatMap(t=>t.recruits);
  assert.equal(allRecruits.length,new Set(allRecruits.map(r=>r.id)).size,'A free agent was allocated twice');
  return {season_id:identity[0].season_id,game_year:5,current_day:1,one_shot:true,draft_actions:[],
    teams:result,native_actions:result.flatMap(team=>team.native_actions),summary:{teams:8,existing_riders:input.riders.length,recruits:allRecruits.length,
      annual_salary_added:sum(result.map(t=>t.finance.new_annual_salaries)),
      gear_cost:sum(result.map(t=>t.equipment.total_cost)),renewals:sum(result.map(t=>t.renewals.length)),
      funding_blocked:result.filter(t=>t.finance.funding_blocked).map(t=>t.bot_key)}};
}
