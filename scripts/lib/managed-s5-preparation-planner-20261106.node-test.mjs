import test from 'node:test';
import assert from 'node:assert/strict';
import {MANAGED_S5_KEYS} from './managed-s5-season-planner-20261106.mjs';
import {planManagedS5Preparations,managedS5TrainingDomain,assignManagedS5Trainers,managedS5StagePreparation} from './managed-s5-preparation-planner-20261106.mjs';
import {nativeActionCall} from './managed-s5-action-sql-20261106.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now=Date.parse('2026-11-06T10:00:00Z'),stats=['mountain','hills','flat','time_trial','cobbles','sprint','acceleration','downhill','endurance','resistance','recovery','breakaway','prologue'];
const rider=(number,team,overrides={})=>({id:id(number),team_id:team.team_id,status:'active',country_id:'fr',age:25,potential_steps:8,
  ...Object.fromEntries(stats.map(s=>[s,55])),...overrides});
function fixture(){
  const context=MANAGED_S5_KEYS.map((bot_key,i)=>({bot_key,team_id:id(100+i),team_season_id:id(200+i),season_id:id(5),game_year:5,current_day_number:1}));
  const riders=context.flatMap((team,t)=>Array.from({length:10},(_,i)=>rider(1000+t*100+i,team,
    i===0?{mountain:85,time_trial:75,endurance:75,recovery:70}:i===1?{sprint:88,acceleration:85}:i===2?{time_trial:83,flat:80}:i===3?{hills:82,acceleration:80}:{})));
  const calendar=[{id:id(500),competition_type:'standard',race_format:'stage_race',profiles:['flat','mountain'],
    stages:[{id:id(600),stageNumber:1,profile:'flat',status:'planned',departureAt:'2026-11-10T13:00:00Z'},
      {id:id(601),stageNumber:2,profile:'mountain',status:'planned',departureAt:'2026-11-11T13:00:00Z'}]}];
  const registrations=context.map(t=>({id:id(700+context.indexOf(t)),bot_key:t.bot_key,team_id:t.team_id,team_season_id:t.team_season_id,
    race_edition_id:id(500),status:'accepted',rider_ids:riders.filter(r=>r.team_id===t.team_id).slice(0,6).map(r=>r.id)}));
  const staff=context.map((t,i)=>({id:id(5000+i),team_id:t.team_id,status:'active',role:'trainer',level:1,trainer_specialty:'mountain',country_id:'fr',talents:['trainer_hills']}));
  return {context,riders,calendar,registrations,staff,plan:{riders:riders.map(r=>({id:r.id,team_id:r.team_id,after:{committed_stages:20}}))},objectives:[]};
}
test('all active riders receive one atomic intensity-50 plan and a protective team threshold',()=>{
  const f=fixture(),source=JSON.stringify(f),p=planManagedS5Preparations(f,{now});
  assert.equal(p.training.length,8);assert.equal(p.training.reduce((n,t)=>n+t.rider_count,0),80);
  assert.ok(p.training.every(t=>t.minimum_form===80&&t.intensity===50));
  assert.ok(p.actions.every(a=>a.max_cash_cost===0&&a.min_projected===25000&&a.min_cash===15000));
  assert.ok(p.training.flatMap(t=>t.plans).every(r=>r.intensity===50));
  assert.equal(JSON.stringify(f),source);assert.deepEqual(p,planManagedS5Preparations(f,{now}));
});
test('light programmes use 75 rather than demanding intensive training',()=>{
  const f=fixture();f.plan.riders.forEach(r=>{r.after.committed_stages=4;});
  assert.ok(planManagedS5Preparations(f,{now}).training.every(t=>t.minimum_form===75));
});
test('primary specialty ignores a large flat rating and replaces an outdated saved domain',()=>{
  const r=rider(900,{team_id:id(100)},{flat:99,hills:78,training_domain:'rouleur'});
  assert.equal(managedS5TrainingDomain(r),'puncheur');assert.equal(managedS5TrainingDomain(r,'sprinter'),'sprinter');
  assert.equal(managedS5TrainingDomain({...r,breakaway:90,hills:59}),'breakaway');
});
test('trainer capacities are never exceeded and uncoached riders remain legitimate',()=>{
  const p=planManagedS5Preparations(fixture(),{now});
  assert.ok(p.training.every(t=>t.trainer_usage[0].capacity===4&&t.trainer_usage[0].assigned===4&&t.uncoached===6));
});
test('only owned active trainers may be assigned',()=>{
  const f=fixture();f.staff[0].status='completed';f.staff.push({...f.staff[1],id:id(9900),team_id:id(9999)});
  const p=planManagedS5Preparations(f,{now});assert.equal(p.training[0].uncoached,10);
  assert.ok(p.training[0].plans.every(r=>r.trainer_contract_id===null));
});
test('trainer nationality breaks an otherwise equivalent coaching choice',()=>{
  const team={team_id:id(100)},r=rider(1001,team,{hills:75});
  const trainers=[{id:id(5001),level:2,specialty:'hills',country_id:'es',talents:[]},{id:id(5002),level:2,specialty:'hills',country_id:'fr',talents:[]}];
  const assigned=assignManagedS5Trainers([r],trainers,new Map([[r.id,'puncheur']]));assert.equal(assigned.get(r.id),id(5002));
});
test('capacity allocation preserves a flexible coach for sprinters instead of greedy climber assignment',()=>{
  const team={team_id:id(100)},riders=[...Array.from({length:4},(_,i)=>rider(1000+i,team,{mountain:80})),
    rider(1100,team,{sprint:70,acceleration:70}),rider(1101,team,{sprint:70,acceleration:70})];
  const trainers=[{id:id(5001),level:1,specialty:'mountain',country_id:'es',talents:['trainer_sprint']},
    {id:id(5002),level:1,specialty:'mountain',country_id:'es',talents:[]}];
  const domains=new Map(riders.map((r,i)=>[r.id,i>=4?'sprinter':'climber']));
  const assigned=assignManagedS5Trainers(riders,trainers,domains);
  assert.equal(assigned.get(id(1100)),id(5001));assert.equal(assigned.get(id(1101)),id(5001));
  assert.ok([...assigned.values()].filter(id=>id===trainers[0].id).length<=4);
});
test('actual nested staff snapshots are accepted without confusing member ID and contract ID',()=>{
  const f=fixture(),t=f.staff[0];f.staff=[{bot_key:f.context[0].bot_key,kind:'team_staff',payload:{teamId:t.team_id,contracts:[{id:t.id,team_id:t.team_id,status:'active',talents:[{talent_code:'trainer_hills'}],
    member:{id:id(999),role:'trainer',level:1,trainer_specialty:'mountain',country_id:'fr'}}]}}];
  const p=planManagedS5Preparations(f,{now});assert.ok(p.training[0].plans.some(r=>r.trainer_contract_id===t.id));
  assert.ok(p.training[0].plans.every(r=>r.trainer_contract_id!==id(999)));
});
test('every accepted future standard stage is prepared with the exact complete roster',()=>{
  const f=fixture(),p=planManagedS5Preparations(f,{now});assert.equal(p.stage_plans.length,16);
  for(const s of p.stage_plans){const reg=f.registrations.find(r=>r.bot_key===s.bot_key);
    assert.deepEqual(s.roles.map(r=>r.riderId).sort(),[...reg.rider_ids].sort());
    assert.ok(s.roles.filter(r=>['sprinter','leader_sprinter'].includes(r.role)).length<=1);
    assert.ok(s.roles.filter(r=>r.role==='leader').length<=1);
    assert.equal(s.strategy.attackOrders.length,0);
  }
});
test('GC leadership stays stable across flat and mountain stages and sprint helpers form a valid ordered train',()=>{
  const f=fixture(),p=planManagedS5Preparations(f,{now}),stages=p.stage_plans.filter(s=>s.bot_key===f.context[0].bot_key);
  const leader=s=>s.roles.find(r=>['leader','leader_sprinter'].includes(r.role))?.riderId;
  assert.equal(leader(stages[0]),leader(stages[1]));
  const flat=stages[0];assert.equal(flat.roles.filter(r=>r.role==='sprinter').length,1);assert.equal(flat.strategy.sprintTrainOrder.length,2);
  assert.ok(flat.strategy.sprintTrainOrder.every(id=>flat.roles.find(r=>r.riderId===id)?.role==='leadout'));
  const missions=[flat.strategy.protectorRiderId,flat.strategy.lieutenantRiderId].filter(Boolean);
  assert.equal(new Set(missions).size,missions.length);assert.ok(missions.every(id=>flat.roles.find(r=>r.riderId===id)?.role==='domestique'));
});
test('a sprinter leading a flat tour can retain both protection and sprint priority without duplicates',()=>{
  const f=fixture();f.calendar[0].profiles=['flat','flat'];f.calendar[0].stages.forEach(s=>{s.profile='flat';});
  const p=planManagedS5Preparations(f,{now}),first=p.stage_plans[0];
  assert.equal(first.roles.filter(r=>r.role==='leader_sprinter').length,1);
  assert.equal(first.roles.filter(r=>r.role==='sprinter').length,0);
});
test('pending, started, past, completed and international events never receive preparations',()=>{
  const f=fixture();f.registrations[0].status='pending';f.calendar[0].stages[0].status='in_progress';
  f.calendar[0].stages.push({id:id(602),stageNumber:3,profile:'flat',status:'planned',departureAt:'2025-01-01T13:00:00Z'});
  assert.equal(planManagedS5Preparations(f,{now}).stage_plans.length,7);
  f.calendar[0].competition_type='national_championship';assert.equal(planManagedS5Preparations(f,{now}).stage_plans.length,0);
});
test('a speculative season plan never substitutes for actual accepted registrations',()=>{
  const f=fixture();f.registrations=[];f.plan.actions=[{bot_key:f.context[0].bot_key,race_edition_id:id(500),expected_status:'accepted'}];
  assert.equal(planManagedS5Preparations(f,{now}).stage_plans.length,0);
});
test('accepted registrations can be reconstructed from verified busy rows',()=>{
  const f=fixture();f.busy=f.registrations.flatMap(reg=>reg.rider_ids.map(rider_id=>({rider_id,registration_id:reg.id,team_season_id:reg.team_season_id,
    race_edition_id:reg.race_edition_id,registration_status:'accepted',status:'selected'})));delete f.registrations;
  assert.equal(planManagedS5Preparations(f,{now}).stage_plans.length,16);
});
test('a foreign/departed rider or duplicate team-stage entry stops the plan',()=>{
  const f=fixture();f.registrations[0].rider_ids[0]=f.registrations[1].rider_ids[0];
  assert.throws(()=>planManagedS5Preparations(f,{now}),/foreign rider/);
  const valid=fixture();valid.registrations.push({...valid.registrations[0]});assert.throws(()=>planManagedS5Preparations(valid,{now}),/Duplicate team-stage/);
  const departed=fixture();departed.riders[0].status='retired';assert.throws(()=>planManagedS5Preparations(departed,{now}),/departed or foreign/);
});
test('empty teams require a refreshed post-recruitment snapshot rather than silently dropping training',()=>{
  const f=fixture();f.riders=f.riders.filter(r=>r.team_id!==f.context[0].team_id);assert.throws(()=>planManagedS5Preparations(f,{now}),/refresh after recruitment/);
});
test('all emitted native actions have stable distinct keys and match the driver whitelist argument shapes',()=>{
  const p=planManagedS5Preparations(fixture(),{now});assert.equal(new Set(p.actions.map(a=>a.key)).size,p.actions.length);
  assert.ok(p.actions.every(a=>/^[a-z0-9:_-]{3,150}$/.test(a.key)));
  for(const a of p.actions)assert.doesNotThrow(()=>nativeActionCall(a));
});
test('tactics do not issue forced attacks and keep special missions off leaders and sprinters',()=>{
  const f=fixture(),team=f.context[0],riders=f.riders.filter(r=>r.team_id===team.team_id);
  for(const profile of ['flat','hilly','mountain','cobbles','time_trial']){
    const p=managedS5StagePreparation({team,race:{race_format:'one_day',profiles:[profile]},stage:{profile},riders,hasSponsorObjective:true});
    assert.deepEqual(p.strategy.attackOrders,[]);assert.equal(p.strategy.breakawayPolicy,'avoid');
    const roles=new Map(p.roles.map(r=>[r.riderId,r.role]));
    for(const id of [p.strategy.protectorRiderId,p.strategy.lieutenantRiderId].filter(Boolean))assert.equal(roles.get(id),'domestique');
  }
});
