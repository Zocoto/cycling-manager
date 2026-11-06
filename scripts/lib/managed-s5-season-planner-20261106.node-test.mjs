import test from 'node:test';
import assert from 'node:assert/strict';
import {MANAGED_S5_KEYS,planManagedS5Season,managedS5ProfileFit} from './managed-s5-season-planner-20261106.mjs';
const now=Date.parse('2026-11-06T10:00:00Z');
const opts={now};
const stats=['mountain','hills','flat','time_trial','cobbles','sprint','acceleration','downhill','endurance','resistance','recovery','breakaway','prologue'];
function race(id,day,extra={}){return {id,display_name:id,competition_type:'standard',category:'national',registration_policy:'open',
  status:'planned',minimum_reputation:0,first_day:day,last_day:day,days:[day],profiles:['hilly'],stage_count:1,
  registration_closes_at:'2026-12-01T00:00:00Z',withdrawal_closes_at:'2026-12-01T00:00:00Z',
  wildcard_closes_at:'2026-12-01T00:00:00Z',field_limit:30,entries:0,minimum_roster_size:4,maximum_roster_size:5,
  country_id:'fr',continent_code:'europe',race_format:'one_day',
  stages:[{id:`stage-${id}`,day,departureAt:new Date(Date.UTC(2026,10,5+day,13)).toISOString(),profile:'hilly'}],...extra};}
function fixture(){
  const context=MANAGED_S5_KEYS.map((bot_key,i)=>({bot_key,team_id:`team-${i}`,team_season_id:`ts-${i}`,director_id:`ds-${i}`,auth_user_id:`auth-${i}`,
    season_id:'s5',game_year:5,current_day_number:1,reputation_points:250,registration_country_id:'fr',continent_code:'europe',division_code:'world'}));
  const riders=context.flatMap(t=>Array.from({length:10},(_,i)=>({id:`${t.team_id}-r${i}`,team_id:t.team_id,bot_key:t.bot_key,
    name:`Rider ${i}`,status:'active',camp_days:[],season_race_days:0,...Object.fromEntries(stats.map(s=>[s,s==='hills'?60+i:55]))})));
  return {context,riders,busy:[],registrations:[],calendar:[race('w1',2),race('w2',9),race('w3',16),race('w4',23)],objectives:[]};
}
function classicsFixture(){
  const f=fixture();f.riders=f.riders.filter(r=>/-r[0-3]$/.test(r.id));
  f.calendar=[2,3,4,5,8,9,10,11,14,15,16,17].map(d=>race(`classic-${d}`,d,{minimum_roster_size:4,maximum_roster_size:4}));
  return f;
}
const teamActions=(p,f,i=0)=>p.actions.filter(a=>a.team_id===f.context[i].team_id);
const ownRiders=(f,i=0)=>f.riders.filter(r=>r.team_id===f.context[i].team_id);
const target=(f,raceId,leader,extra={})=>({bot_key:f.context[0].bot_key,objective_id:`obj-${raceId}`,objective_type:'race_result',
  priority:'mandatory',status:'active',satisfaction_points:50,target_details:{raceEditionId:raceId,leaderRiderId:leader},...extra});

test('deterministic offline planning covers all weeks and never mutates its snapshot',()=>{
  const f=fixture(),before=JSON.stringify(f),p=planManagedS5Season(f,opts);
  assert.equal(p.actions.length,32);assert.equal(JSON.stringify(f),before);assert.deepEqual(p,planManagedS5Season(f,opts));
  assert.ok(p.teams.every(t=>t.weeks.join(',')==='1,2,3,4'));
  assert.ok(p.riders.every(r=>r.after.committed_stages>0));
});
test('only the authorized eight accounts and S5 J1 are accepted',()=>{
  const f=fixture();f.context[0].game_year=6;assert.throws(()=>planManagedS5Season(f,opts),/S5 J1/);
  f.context[0].game_year=5;f.context[0].current_day_number=2;assert.throws(()=>planManagedS5Season(f,opts),/S5 J1/);
  f.context[0].current_day_number=1;f.context[0].bot_key='human';assert.throws(()=>planManagedS5Season(f,opts),/eight authorized/);
});
test('duplicate and foreign riders cannot enter an action',()=>{
  const f=fixture();f.riders.push({...f.riders[0]});assert.throws(()=>planManagedS5Season(f,opts),/duplicate/);
  f.riders.pop();f.riders[0].team_id='human';assert.throws(()=>planManagedS5Season(f,opts),/Foreign/);
});
test('reputation, local country, deadline, J1 and nonstandard races are filtered',()=>{
  const f=fixture();f.calendar=[race('high',3,{minimum_reputation:999}),race('foreign',4,{category:'local',country_id:'de'}),
    race('closed',5,{registration_closes_at:'2026-11-01'}),race('j1',1),race('federation',6,{competition_type:'world_championship'})];
  assert.equal(planManagedS5Season(f,opts).actions.length,0);
});
test('regional access respects amateur status and continent',()=>{
  const f=fixture();f.calendar=[race('regional',3,{category:'regional'})];
  f.objectives=[{bot_key:f.context[0].bot_key,role:'principal',sponsor_contract_status:'active'}];
  f.context[1].continent_code='africa';
  const p=planManagedS5Season(f,opts);assert.equal(teamActions(p,f,0).length,0);assert.equal(teamActions(p,f,1).length,0);assert.equal(p.actions.length,6);
});
test('shared field capacity cannot be overbooked and sponsor priority wins the last places',()=>{
  const f=fixture();f.calendar=[race('only',3,{field_limit:1})];
  f.objectives=[{...target(f,'only',ownRiders(f,7)[0].id),bot_key:f.context[7].bot_key}];
  const p=planManagedS5Season(f,opts);assert.equal(p.actions.length,1);assert.equal(p.actions[0].bot_key,f.context[7].bot_key);
});
test('elite direct access is retained while unsolicited wildcards do not dominate the programme',()=>{
  const f=fixture();f.calendar=[race('elite',5,{category:'elite'})];f.context[0].division_code='elite';
  let p=planManagedS5Season(f,opts);assert.equal(p.actions.length,1);assert.equal(p.actions[0].expected_status,'accepted');
  f.objectives=[{...target(f,'elite',ownRiders(f,1)[0].id),bot_key:f.context[1].bot_key}];
  p=planManagedS5Season(f,opts);assert.equal(teamActions(p,f,1)[0].expected_status,'pending');
});
test('federation and pending commitments, existing camps and injuries block the rider',()=>{
  const f=fixture();f.calendar=[race('race',4)];const r=ownRiders(f);
  f.busy=[{rider_id:r[0].id,registration_id:'fed',registration_status:'accepted',status:'selected',days:[4],stage_count:1},
    {rider_id:r[1].id,registration_id:'pending',registration_status:'pending',status:'confirmed',days:[4],stage_count:1}];
  r[2].camp_days=[4];r[3].injured_until='2026-11-25T00:00:00Z';
  const selected=teamActions(planManagedS5Season(f,opts),f)[0].rider_ids;
  assert.ok(r.slice(0,4).every(x=>!selected.includes(x.id)));
});
test('a rider recovering before a future departure is available again',()=>{
  const f=fixture();f.calendar=[race('late',16)];for(const r of ownRiders(f))r.injured_until='2026-11-10T00:00:00Z';
  assert.equal(teamActions(planManagedS5Season(f,opts),f).length,1);
});
test('two stages on one day count twice toward the workload ceiling',()=>{
  const f=fixture();f.calendar=[race('double',4,{stage_count:2})];
  assert.equal(planManagedS5Season(f,{...opts,maxStages:1}).actions.length,0);
});
test('a long tour may be ridden alone but cannot extend an adjacent overload run',()=>{
  const f=fixture(),days=Array.from({length:8},(_,i)=>i+3);
  f.calendar=[race('tour',3,{days,last_day:10,stage_count:8,race_format:'stage_race'})];
  assert.equal(teamActions(planManagedS5Season(f,opts),f).length,1);
  f.busy=ownRiders(f).map(r=>({rider_id:r.id,registration_id:'fixed',registration_status:'accepted',status:'selected',days:[2],stage_count:1}));
  assert.equal(teamActions(planManagedS5Season(f,opts),f).length,0);
});
test('fixed loads cannot be silently extended beyond the stage limit',()=>{
  const f=fixture();f.calendar=[race('one',12)];
  f.busy=ownRiders(f).map(r=>({rider_id:r.id,registration_id:'fixed',registration_status:'accepted',status:'selected',days:[2,3],stage_count:26}));
  assert.equal(teamActions(planManagedS5Season(f,opts),f).length,0);
});
test('a completed long block does not prohibit an unrelated later race after rest',()=>{
  const f=fixture();f.calendar=[race('later',20)];
  f.busy=ownRiders(f).map(r=>({rider_id:r.id,registration_id:'long',registration_status:'accepted',status:'selected',days:[2,3,4,5,6,7,8,9],stage_count:8}));
  assert.equal(teamActions(planManagedS5Season(f,opts),f).length,1);
});
test('sponsor leaders receive their target and the requested pre-objective rest window',()=>{
  const f=fixture(),leader=ownRiders(f)[0];f.calendar=[race('filler',8),race('objective',10)];
  f.objectives=[target(f,'objective',leader.id)];
  const p=planManagedS5Season(f,opts),objective=teamActions(p,f).find(a=>a.race_edition_id==='objective');
  assert.equal(objective.leader_rider_id,leader.id);
  assert.ok(!teamActions(p,f).find(a=>a.race_edition_id==='filler').rider_ids.includes(leader.id));
  assert.deepEqual(p.preparation_targets[0].rest_days,[9,8]);
});
test('fixed accepted rosters are preserved while an underfilled roster can be completed in place',()=>{
  const f=fixture(),roster=ownRiders(f).slice(0,5).map(r=>r.id);
  f.calendar=[race('fixed',4),race('small',9)];
  f.registrations=[{id:'reg-fixed',bot_key:f.context[0].bot_key,race_edition_id:'fixed',status:'accepted',riders:5,rider_ids:roster},
    {id:'reg-small',bot_key:f.context[0].bot_key,race_edition_id:'small',status:'accepted',riders:2,rider_ids:roster.slice(0,2)}];
  f.busy=roster.map(rider_id=>({rider_id,registration_id:'reg-fixed',registration_status:'accepted',status:'selected',days:[4],stage_count:1}));
  f.busy.push(...roster.slice(0,2).map(rider_id=>({rider_id,registration_id:'reg-small',registration_status:'accepted',status:'selected',days:[9],stage_count:1})));
  const p=planManagedS5Season(f,opts),actions=teamActions(p,f);
  assert.equal(actions.length,1);assert.equal(actions[0].operation,'update');
  assert.equal(actions[0].source_registration_id,'reg-small');assert.ok(roster.slice(0,2).every(id=>actions[0].rider_ids.includes(id)));
});
test('reoptimization reports a withdrawable impossible registration instead of overwriting outsiders',()=>{
  const f=fixture();f.calendar=[race('impossible',4)];for(const r of ownRiders(f))r.camp_days=[4];
  f.registrations=[{id:'own',bot_key:f.context[0].bot_key,race_edition_id:'impossible',status:'accepted',riders:4,rider_ids:ownRiders(f).slice(0,4).map(r=>r.id)}];
  const p=planManagedS5Season(f,{...opts,reoptimizeExisting:true});assert.equal(p.withdrawals.length,1);assert.equal(p.withdrawals[0].source_registration_id,'own');
});
test('recovery reservations honor an explicit budget and cannot collide with races',()=>{
  const f=fixture();f.calendar=[race('tour',3,{days:[3,4,5,6],last_day:6,stage_count:4,race_format:'stage_race'})];
  const p=planManagedS5Season(f,{...opts,recoveryBudgets:{[f.context[0].team_id]:2000}});
  assert.equal(p.camp_actions.length,1);assert.equal(p.camp_actions[0].start_day,7);assert.equal(p.camp_actions[0].expected_cost,2000);
  assert.equal(p.teams[0].recovery_cost,2000);
});
test('performance reservations come before recovery, honor facility capacity and require a date-aware booking',()=>{
  const f=fixture(),r=ownRiders(f);f.calendar=[race('a',10,{minimum_roster_size:1,maximum_roster_size:1}),race('b',10,{minimum_roster_size:1,maximum_roster_size:1})];
  f.objectives=[target(f,'a',r[0].id),target(f,'b',r[1].id)];
  const facilities=[{team_id:f.context[0].team_id,infrastructure_code:'hills_circuit',level:1,available_day:1}];
  const p=planManagedS5Season(f,{...opts,facilities,recoveryBudgets:{[f.context[0].team_id]:10000}});
  assert.equal(p.performance_suggestions.length,1);assert.equal(p.performance_suggestions[0].start_day,8);
  assert.equal(p.performance_suggestions[0].end_day,9);assert.equal(p.performance_suggestions[0].requires_date_aware_booking,true);
  assert.ok(p.camp_actions.every(c=>c.start_day!==8&&c.start_day!==9));
});
test('a future building is never treated as available before completion',()=>{
  const f=fixture();f.calendar=[race('target',10)];f.objectives=[target(f,'target',ownRiders(f)[0].id)];
  const facilities=[{team_id:f.context[0].team_id,infrastructure_code:'hills_circuit',level:1,available_day:9}];
  assert.equal(planManagedS5Season(f,{...opts,facilities}).performance_suggestions.length,0);
});
test('flat race fitness values a finisher above flat-only ability',()=>{
  const base=Object.fromEntries(stats.map(s=>[s,50]));
  assert.ok(managedS5ProfileFit({...base,sprint:80,flat:60},race('flat',4,{profiles:['flat']}))>
    managedS5ProfileFit({...base,sprint:50,flat:95},race('flat',4,{profiles:['flat']})));
});
test('native reconnaissance bundles registered riders for one flat fee and reserves its dates before recovery',()=>{
  const f=fixture(),leader=ownRiders(f)[0];f.calendar=[race('target',10)];f.objectives=[target(f,'target',leader.id)];
  const p=planManagedS5Season(f,{...opts,reconnaissanceBudgets:{[f.context[0].team_id]:4000},recoveryBudgets:{[f.context[0].team_id]:10000}});
  assert.equal(p.reconnaissance_actions.length,1);const a=p.reconnaissance_actions[0];
  assert.equal(a.expected_cost,4000);assert.equal(a.rider_ids.length,3);assert.ok(a.rider_ids.includes(leader.id));
  assert.equal(a.rpc,'book_current_team_stage_reconnaissance');assert.equal(a.args.p_preparer_contract_id,null);
  assert.equal(a.start_day,8);assert.equal(a.end_day,9);assert.equal(a.expected_bonus,2);
  assert.ok(p.camp_actions.every(c=>c.start_day!==8&&c.start_day!==9));
});
test('a tour reconnaissance ends before the entire tour and targets the leader’s relevant stage',()=>{
  const f=fixture(),leader=ownRiders(f)[0];leader.mountain=90;
  f.calendar=[race('tour',10,{race_format:'stage_race',days:[10,11,12],last_day:12,stage_count:3,profiles:['flat','mountain','time_trial'],
    stages:[{id:'flat-stage',day:10,stageNumber:1,profile:'flat'},{id:'mountain-stage',day:11,stageNumber:2,profile:'mountain'},
      {id:'tt-stage',day:12,stageNumber:3,profile:'time_trial'}]})];f.objectives=[target(f,'tour',leader.id)];
  const p=planManagedS5Season(f,{...opts,reconnaissanceBudgets:{[f.context[0].team_id]:3000}}),a=p.reconnaissance_actions[0];
  assert.equal(a.target_stage_id,'mountain-stage');assert.equal(a.start_day,8);assert.equal(a.end_day,9);assert.equal(a.expected_cost,3000);
});
test('reconnaissance refuses an inadequate budget and does not duplicate an existing rider-stage benefit',()=>{
  const f=fixture(),leader=ownRiders(f)[0];f.calendar=[race('target',10)];f.objectives=[target(f,'target',leader.id)];
  assert.equal(planManagedS5Season(f,{...opts,reconnaissanceBudgets:{[f.context[0].team_id]:3999}}).reconnaissance_actions.length,0);
  f.reconnaissances=[{team_season_id:f.context[0].team_season_id,target_stage_id:'stage-target',status:'completed',rider_ids:[leader.id]}];
  assert.equal(planManagedS5Season(f,{...opts,reconnaissanceBudgets:{[f.context[0].team_id]:4000}}).reconnaissance_actions.length,0);
});
test('a preparer’s one-day duration, discount and wider group are retained',()=>{
  const f=fixture(),leader=ownRiders(f)[0];f.calendar=[race('target',10)];f.objectives=[target(f,'target',leader.id)];
  const preparers=[{team_id:f.context[0].team_id,contract_id:'preparer',level:5,duration_days:1,rider_capacity:5,cost_reduction_percentage:20,resulting_bonus:2.8}];
  const a=planManagedS5Season(f,{...opts,preparers,reconnaissanceBudgets:{[f.context[0].team_id]:3200}}).reconnaissance_actions[0];
  assert.equal(a.start_day,9);assert.equal(a.end_day,9);assert.equal(a.rider_ids.length,5);
  assert.equal(a.expected_cost,3200);assert.equal(a.expected_bonus,2.8);assert.equal(a.args.p_preparer_contract_id,'preparer');
});
test('an unsponsored team receives a planned season peak for its best available finisher',()=>{
  const f=fixture();f.calendar=[race('target',10)];
  const p=planManagedS5Season(f,{...opts,reconnaissanceBudgets:{[f.context[0].team_id]:4000}});
  assert.equal(p.reconnaissance_actions.length,1);assert.equal(p.reconnaissance_actions[0].reason,'season_peak');
});
test('every rider with a twelve-classic programme can receive one recovery day after four JDC',()=>{
  const f=classicsFixture(),options={...opts,planSeasonPeaks:false};
  const without=planManagedS5Season(f,options),p=planManagedS5Season(f,{...options,recoveryBudgets:{[f.context[0].team_id]:24000}});
  assert.deepEqual(p.actions,without.actions,'recovery budgets do not rewrite the race programme');
  assert.equal(p.camp_actions.length,4);assert.equal(p.teams[0].recovery_cost,8000);
  assert.ok(p.camp_actions.every(a=>a.start_day===6&&a.end_day===6&&a.reason==='after_racing_load'));
  assert.equal(new Set(p.camp_actions.flatMap(a=>a.rider_ids)).size,4);
  assert.ok(p.riders.filter(r=>r.team_id===f.context[0].team_id).every(r=>r.after.committed_stages===12));
});
test('four JDC across two double-stage days unlock recovery even without a tour',()=>{
  const f=classicsFixture();f.calendar=[race('double-a',2,{stage_count:2,minimum_roster_size:4,maximum_roster_size:4,
    stages:[{id:'a-am',day:2,profile:'hilly'},{id:'a-pm',day:2,profile:'flat'}]}),
  race('double-b',3,{stage_count:2,minimum_roster_size:4,maximum_roster_size:4,
    stages:[{id:'b-am',day:3,profile:'hilly'},{id:'b-pm',day:3,profile:'flat'}]})];
  const p=planManagedS5Season(f,{...opts,planSeasonPeaks:false,recoveryBudgets:{[f.context[0].team_id]:8000}});
  assert.equal(p.camp_actions.length,4);assert.ok(p.camp_actions.every(a=>a.start_day===4));
});
test('an already booked recovery resets accumulated racing load before scheduling another day',()=>{
  const f=classicsFixture();f.calendar=[race('two-a',2,{stage_count:2,minimum_roster_size:4,maximum_roster_size:4}),
    race('two-b',3,{stage_count:2,minimum_roster_size:4,maximum_roster_size:4}),
    ...[6,7,8].map(d=>race(`after-${d}`,d,{minimum_roster_size:4,maximum_roster_size:4}))];
  for(const r of ownRiders(f)){r.camp_days=[4];r.camps=[{camp_type:'classic',status:'planned',start_day_number:4,end_day_number:4}];}
  const options={...opts,planSeasonPeaks:false,recoveryBudgets:{[f.context[0].team_id]:8000}};
  assert.equal(planManagedS5Season(f,options).camp_actions.length,0,'three JDC after the existing camp are insufficient');
  f.calendar.push(race('fourth-after',9,{minimum_roster_size:4,maximum_roster_size:4}));
  const p=planManagedS5Season(f,options);assert.equal(p.camp_actions.length,4);assert.ok(p.camp_actions.every(a=>a.start_day===10));
});
test('the recovery budget remains strict and the sponsor leader receives the first funded place',()=>{
  const f=classicsFixture();f.calendar.push(race('objective',20,{minimum_roster_size:4,maximum_roster_size:4}));
  const leader=ownRiders(f)[0];f.objectives=[target(f,'objective',leader.id)];
  const p=planManagedS5Season(f,{...opts,planSeasonPeaks:false,recoveryBudgets:{[f.context[0].team_id]:2000}});
  assert.equal(p.camp_actions.length,1);assert.deepEqual(p.camp_actions[0].rider_ids,[leader.id]);
  assert.equal(p.camp_actions[0].reason,'before_objective');assert.equal(p.teams[0].recovery_cost,2000);
});
