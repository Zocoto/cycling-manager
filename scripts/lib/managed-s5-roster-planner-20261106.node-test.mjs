import assert from 'node:assert/strict';
import {test} from 'node:test';
import {planManagedS5Roster,rawProjectedBudget} from './managed-s5-roster-planner-20261106.mjs';

const stats=['mountain','hills','time_trial','cobbles','sprint','flat','acceleration','downhill','endurance','resistance','recovery','breakaway','prologue'];
const ratings=(base,extra={})=>({...Object.fromEntries(stats.map(key=>[key,base])),...extra});
function fixture(){
  const identity=Array.from({length:8},(_,i)=>({bot_key:'bot-'+i,team_id:'team-'+i,team_season_id:'ts-'+i,
    director_id:'ds-'+i,auth_user_id:'auth-'+i,game_year:5,current_day_number:1,season_id:'S5',cash_balance:350000,
    reputation_points:50,strategy:'climber',display_name:'Team '+i}));
  const freeAgents=Array.from({length:160},(_,i)=>({rider_id:'free-'+String(i).padStart(3,'0'),first_name:'Free',last_name:String(i),
    country_id:i%3===0?'country-FR':'country-US',country_code:i%3===0?'FR':'US',age:20+i%16,potential_steps:2,
    salary_per_season:7000+i%3*500,...ratings(52,{[stats[i%5]]:65+i%7})}));
  const catalog=[
    {id:'glass',slot_type:'glasses',price:250,acquisition_channel:'commercial',effect_payload:{ratingBonuses:{downhill:1}}},
    {id:'shoes',slot_type:'shoes',price:2800,acquisition_channel:'commercial',effect_payload:{ratingBonuses:{mountain:2}}},
    {id:'helmet',slot_type:'helmet',price:450,acquisition_channel:'commercial',effect_payload:{injuryRiskReductionPct:3}},
    {id:'free-tutorial',slot_type:'frame',price:0,acquisition_channel:'commercial',effect_payload:{ratingBonuses:{mountain:99}}},
  ];
  return {identity,freeAgents,riders:[],objectives:[],finances:{teams:identity.map(t=>({...t})),
    contracts:[],pending_finance:[],catalog,assignments:[],inventory:[{bot_key:'bot-0',equipment_item_id:'glass',quantity:1}]}};
}

function addExisting(input,teamIndex,count,base=65){
  const identity=input.identity[teamIndex];
  for(let i=0;i<count;i++){
    const id=`owned-${teamIndex}-${i}`;
    input.riders.push({id,name:id,team_id:identity.team_id,country_id:'country-US',age:27,potential_steps:4,...ratings(base)});
    input.finances.contracts.push({id:'contract-'+id,rider_id:id,team_id:identity.team_id,status:'active',end_year:5,start_year:4,salary_per_season:10000});
  }
}

test('fills all eight targets, allocates each free agent once and protects the full budget',()=>{
  const input=fixture();
  const plan=planManagedS5Roster(input);
  assert.equal(plan.teams.length,8);assert.equal(plan.summary.recruits,96);
  assert.equal(new Set(plan.teams.flatMap(t=>t.recruits.map(r=>r.id))).size,96);
  for(const team of plan.teams){
    assert.equal(team.planned_roster,12);assert.equal(team.initial_roster,0);
    assert.ok(team.roster.every(r=>r.new_recruit&&r.bot_key===team.bot_key));
    const reserves=team.finance.reserves;
    assert.ok(team.finance.projected_after_recruits_and_gear>=reserves.liquidity+reserves.camps+reserves.youth+reserves.infrastructure);
  }
  assert.deepEqual(plan.draft_actions,[]);
});

test('a clamped projected helper never hides a deficit or authorizes fresh spending',()=>{
  const input=fixture();
  input.finances.teams[0].cash_balance=10000;input.identity[0].cash_balance=10000;
  input.finances.pending_finance.push({bot_key:'bot-0',amount:-15000});
  assert.equal(rawProjectedBudget(input.finances.teams[0],input.finances.pending_finance),-5000);
  const team=planManagedS5Roster(input).teams[0];
  assert.equal(team.finance.funding_blocked,true);assert.equal(team.recruits.length,0);
  assert.equal(team.equipment.total_cost,0);assert.equal(team.equipment.purchases.length,0);
  assert.ok(!team.native_actions.some(a=>['sign_current_team_free_agent','purchase_current_team_equipment_cart'].includes(a.rpc)));
});

test('a planned sponsor restoration is an explicit financial precondition, never cash',()=>{
  const input=fixture();
  input.finances.pending_finance.push({bot_key:'bot-0',amount:-400000});
  const plan=planManagedS5Roster(input,{plannedSponsorRestorations:{'bot-0':{annual_budget:570000,contract_id:'historical-contract'}}});
  const team=plan.teams[0];
  assert.equal(team.finance.cash,350000);assert.equal(team.finance.baseline_raw_projected,-50000);
  assert.equal(team.finance.raw_projected,520000);assert.equal(team.finance.funding_blocked,false);
  assert.equal(team.financial_preconditions[0].annual_budget,570000);
  assert.equal(team.financial_preconditions[0].contract_id,'historical-contract');
});

test('sponsor national quotas receive actual nationals before common allocation',()=>{
  const input=fixture();
  input.objectives.push({bot_key:'bot-0',objective_id:'quota',objective_type:'nationality_quota',target_details:{countryCode:'FR',minimumPercentage:30}});
  const team=planManagedS5Roster(input).teams[0];
  assert.ok(team.recruits.filter(r=>r.country_id==='country-FR').length>=4);
  assert.ok(team.recruits.filter(r=>r.selection_reason==='national_sponsor').every(r=>r.country_id==='country-FR'));
});

test('missing national candidates produce a warning, never a false national signing',()=>{
  const input=fixture();
  input.objectives.push({bot_key:'bot-0',objective_id:'quota',objective_type:'nationality_quota',target_details:{countryCode:'NP',minimumPercentage:30}});
  const team=planManagedS5Roster(input).teams[0];
  assert.ok(team.warnings.some(w=>w.includes('NP')));
  assert.ok(!team.recruits.some(r=>r.selection_reason==='national_sponsor'));
});

test('modest useful locals can complete quotas without spreading weak recruits to other teams',()=>{
  const input=fixture();
  input.objectives.push({bot_key:'bot-0',objective_id:'quota',objective_type:'nationality_quota',target_details:{countryCode:'NP',minimumPercentage:30}});
  input.quotaFreeAgents=Array.from({length:4},(_,i)=>({rider_id:'native-'+i,first_name:'Local',last_name:String(i),
    country_id:'country-NP',country_code:'NP',age:23,potential_steps:4,salary_per_season:6500,...ratings(47,{mountain:53,breakaway:68})}));
  input.quotaFreeAgents.push({rider_id:'junk',first_name:'No',last_name:'Utility',country_id:'country-NP',country_code:'NP',
    age:20,potential_steps:8,salary_per_season:100,...ratings(1)});
  const plan=planManagedS5Roster(input);
  assert.equal(plan.teams[0].recruits.filter(r=>r.country_id==='country-NP').length,4);
  assert.ok(!plan.teams.slice(1).some(t=>t.recruits.some(r=>r.country_id==='country-NP')));
  assert.ok(!plan.teams.some(t=>t.recruits.some(r=>r.id==='junk')));
});

test('native actions require a fresh renewal quote and only renew the strongest incumbents',()=>{
  const input=fixture();addExisting(input,0,6);
  input.riders[0].mountain=75;input.riders[1].mountain=74;
  const first=planManagedS5Roster(input).teams[0];
  assert.equal(first.renewals.length,4);assert.equal(first.initial_roster,6);
  assert.ok(first.renewals.some(r=>r.rider_id===input.riders[0].id));
  assert.ok(!first.native_actions.some(a=>a.rpc==='renew_current_team_rider_until'));
  input.renewalQuotes=first.renewals.map(r=>({rider_id:r.rider_id,salary_per_season:11000}));
  const second=planManagedS5Roster(input).teams[0];
  const actions=second.native_actions.filter(a=>a.rpc==='renew_current_team_rider_until');
  assert.equal(actions.length,4);assert.ok(actions.every(a=>a.args.p_target_end_game_year===6&&a.max_cash_cost===0&&a.max_salary===11550));
  assert.ok(!second.renewals.some(r=>second.recruits.some(candidate=>r.rider_id===candidate.id)));
});

test('existing future commitments are respected and extra term is exactly one season',()=>{
  const input=fixture();addExisting(input,0,3,70);
  input.finances.contracts[0].end_year=6;
  input.finances.contracts.push({id:'future-owned',rider_id:input.riders[1].id,team_id:'team-0',status:'planned',start_year:6,end_year:6,salary_per_season:10000});
  const team=planManagedS5Roster(input).teams[0];
  assert.equal(team.renewals.find(r=>r.rider_id===input.riders[0].id).target_end_year,7);
  assert.ok(!team.renewals.some(r=>r.rider_id===input.riders[1].id));
});

test('owned stock is used first, zero-price gifts are never bought and equipment slots remain unique',()=>{
  const input=fixture();
  const plan=planManagedS5Roster(input);
  assert.equal(plan.teams[0].equipment.owned_units_reused,1);
  for(const team of plan.teams){
    assert.ok(!team.equipment.purchases.some(p=>p.equipmentItemId==='free-tutorial'));
    assert.equal(new Set(team.equipment.assignments.map(a=>`${a.riderId}:${a.slot}`)).size,team.equipment.assignments.length);
    assert.ok(team.equipment.assignments.every(a=>team.roster.some(r=>r.id===a.riderId)));
    assert.equal(team.equipment.total_cost,team.equipment.purchases.reduce((total,p)=>total+input.finances.catalog.find(c=>c.id===p.equipmentItemId).price*p.quantity,0));
    for(const purchase of team.equipment.purchases){
      const owned=input.finances.inventory.find(i=>i.bot_key===team.bot_key&&i.equipment_item_id===purchase.equipmentItemId)?.quantity??0;
      assert.ok(team.equipment.assignments.filter(a=>a.equipmentItemId===purchase.equipmentItemId).length<=purchase.quantity+owned);
    }
    assert.ok(team.native_actions.every(a=>a.bot_key===team.bot_key&&Number.isFinite(a.min_cash)&&Number.isFinite(a.min_projected)));
  }
});

test('a stronger older specialist is not displaced by youth and potential alone',()=>{
  const input=fixture();
  for(let team=0;team<8;team++)addExisting(input,team,team===0?7:8,40);
  input.freeAgents=[
    {rider_id:'older-specialist',first_name:'Older',last_name:'Specialist',country_id:'country-US',country_code:'US',
      age:38,potential_steps:1,salary_per_season:11000,...ratings(50,{time_trial:75})},
    {rider_id:'young-prospect',first_name:'Young',last_name:'Prospect',country_id:'country-US',country_code:'US',
      age:19,potential_steps:8,salary_per_season:11000,...ratings(60,{time_trial:70})},
  ];
  const options={targetRosters:Object.fromEntries(input.identity.map(t=>[t.bot_key,8]))};
  const team=planManagedS5Roster(input,options).teams[0];
  assert.equal(team.recruits.length,1);assert.equal(team.recruits[0].id,'older-specialist');
});

test('rejects another season or any plan that does not contain the exact eight teams',()=>{
  const input=fixture();input.identity[0].game_year=6;
  assert.throws(()=>planManagedS5Roster(input));
  const seven=fixture();seven.identity.pop();assert.throws(()=>planManagedS5Roster(seven));
});
