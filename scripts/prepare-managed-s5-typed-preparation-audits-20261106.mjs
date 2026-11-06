// Audit generation only. No connection, worker, RPC invocation or production write.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const folder='C:/Dev/artifacts/managed-teams-s5-20261106/';
const hashes={
  'season-training-native.json':'b8f8c3a86144366200e0bffafc45a88690fe08a5c4f5a39862c1c5f503f484d5',
  'season-road-preparations-native.json':'c5c08fe0381a0dd8142e465a12c4c2b03d0ad6ae6393450941b97c41d7e2f1cc',
  'season-time-trial-preparations-native.json':'25bee07dcdf08ad478a78caf6f84359678b15f6b6b5afd38456288ea45fae52f',
};
const digest=value=>createHash('sha256').update(value).digest('hex');
const text=value=>"'"+String(value).replaceAll("'","''")+"'";
const uuid=value=>{assert.match(value,/^[a-f\d-]{36}$/);return text(value)+'::uuid';};
const json=value=>text(JSON.stringify(value))+'::jsonb';
const nullableUuid=value=>value?uuid(value):'null::uuid';
const read=name=>JSON.parse(readFileSync(folder+name,'utf8'));
for(const [name,hash]of Object.entries(hashes))assert.equal(digest(readFileSync(folder+name)),hash,`Frozen preparation manifest changed: ${name}`);
const identity=read('identity-after-roster.json'),training=read('season-training-native.json'),road=read('season-road-preparations-native.json'),timeTrials=read('season-time-trial-preparations-native.json');
const stages={...road,actions:[...road.actions,...timeTrials.actions.filter(a=>a.stage_type==='team_time_trial')]};
assert.equal(identity.length,8);assert.equal(training.actions.length,16);assert.equal(stages.actions.length,321);
assert.equal(timeTrials.actions.length,13);assert.equal(road.actions.length,320);
assert.equal(training.finalized,true);assert.equal(stages.finalized,true);assert.equal(training.season_id,stages.season_id);
const season=uuid(training.season_id),byKey=new Map(identity.map(t=>[t.bot_key,t]));
const team=a=>{const row=byKey.get(a.bot_key);assert.ok(row);return row;};
const target=`target(bot_key,team_id,team_season_id) as(values ${identity.map(t=>`(${text(t.bot_key)},${uuid(t.team_id)},${uuid(t.team_season_id)})`).join(',\n')})`;
const written=[];
function write(name,ctes,body){
  const filename=name.replace('final-preparation-','final-typed-preparation-')+'.sql',sql=`begin read only;set local statement_timeout='3s';set local lock_timeout='300ms';
set local application_name=${text(name)};\nwith ${target},\n${ctes}\n${body}\ncommit;\n`;
  writeFileSync(folder+filename,sql);written.push({filename,sha256:digest(sql),bytes:Buffer.byteLength(sql)});
}
const plans=training.actions.filter(a=>a.rpc==='save_current_rider_training_plans_v2').flatMap(a=>a.args.p_plans.map(p=>({...p,bot_key:a.bot_key,team_id:team(a).team_id})));
assert.equal(plans.length,90);assert.equal(new Set(plans.map(p=>p.rider_id)).size,90);assert.ok(plans.every(p=>p.intensity===50));
const settings=training.actions.filter(a=>a.rpc==='save_current_team_training_settings');assert.equal(settings.length,8);
assert.ok(settings.every(a=>a.args.p_minimum_form===80));
write('final-preparation-training',`
expected_plans(bot_key,team_id,rider_id,intensity,domain,trainer_id) as(values ${plans.map(p=>`(${text(p.bot_key)},${uuid(p.team_id)},${uuid(p.rider_id)},50,${text(p.domain)},${nullableUuid(p.trainer_contract_id)})`).join(',\n')}),
owned as materialized(select distinct rc.rider_id,rc.team_id from target t join public.rider_contracts rc on rc.team_id=t.team_id and rc.status='active'),
checked as materialized(
 select e.*,p.intensity actual_intensity,p.domain actual_domain,p.trainer_contract_id actual_trainer,p.effective_from_day_number,
   coach.level trainer_level,
   (e.trainer_id is null or (contract.status='active' and contract.team_id=e.team_id and coach.role='trainer')) valid_coach,
   exists(select 1 from owned o where o.rider_id=e.rider_id and o.team_id=e.team_id) owned
 from expected_plans e left join lateral(select p.* from public.rider_training_plan_versions p
   where p.rider_id=e.rider_id and p.team_id=e.team_id and p.season_id=${season} and p.effective_from_day_number<=2
   order by p.effective_from_day_number desc,p.created_at desc limit 1)p on true
 left join public.staff_contracts contract on contract.id=p.trainer_contract_id
 left join public.staff_members coach on coach.id=contract.staff_member_id
),coach_usage as materialized(
 select actual_trainer,count(*)::integer assigned,least(8,greatest(4,max(trainer_level)+3)) capacity,
   bool_and(coalesce(valid_coach,false)) valid
 from checked where actual_trainer is not null group by actual_trainer
),settings as materialized(
 select t.bot_key,s.minimum_form,s.effective_from_day_number from target t left join lateral(
   select minimum_form,effective_from_day_number from public.team_training_setting_versions s
   where s.team_id=t.team_id and s.season_id=${season} and s.effective_from_day_number<=2
   order by effective_from_day_number desc,s.created_at desc limit 1)s on true
),mismatches as materialized(
 select * from checked where not owned or effective_from_day_number is distinct from 2
   or actual_intensity is distinct from intensity or actual_domain is distinct from domain
   or actual_trainer is distinct from trainer_id or valid_coach is distinct from true
)
`,
`select statement_timestamp() checked_at,(select count(*) from expected_plans) expected_rider_plans,
 (select count(*) from owned) actual_active_owned_riders,
 (select count(*) from checked where owned and effective_from_day_number=2 and actual_intensity=intensity
   and actual_domain=domain and actual_trainer is not distinct from trainer_id and valid_coach) exact_j2_plans,
 (select count(*) from mismatches) plan_mismatch_count,
 (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from(select * from mismatches limit 21)x) plan_mismatches,
 (select count(*) from settings where minimum_form=80 and effective_from_day_number=2) exact_j2_form_thresholds,
 (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from settings x) settings,
 (select count(*) from coach_usage where not valid or assigned>capacity) invalid_coach_capacity_count,
 (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from coach_usage x) coach_usage;`);

const stageValues=stages.actions.map(a=>{
  assert.ok(['save_current_team_race_preparation_with_sprint','save_current_team_time_trial_preparation'].includes(a.rpc));
  const roles=[...a.args.p_roles].sort((a,b)=>a.riderId.localeCompare(b.riderId));
  return `(${text(a.bot_key)},${uuid(team(a).team_id)},${uuid(team(a).team_season_id)},${uuid(a.args.p_race_edition_id)},${uuid(a.args.p_stage_id)},${json(roles)},${json({...a.args.p_strategy,sprintTrainOrder:a.args.p_strategy.sprintTrainOrder??[]})})`;
}).join(',\n');
write('final-preparation-stages',`
expected(bot_key,team_id,team_season_id,race_id,stage_id,roles,strategy) as(values ${stageValues}),
checked as materialized(
 select e.*,reg.id registration_id,reg.status registration_status,s.team_id strategy_team,
  coalesce((select jsonb_agg(jsonb_build_object('riderId',r.rider_id,'role',r.race_role) order by r.rider_id)
    from public.race_roster_stage_roles r where r.race_registration_id=reg.id and r.stage_id=e.stage_id),'[]'::jsonb) actual_roles,
  coalesce((select jsonb_agg(r.rider_id order by r.rider_id) from public.race_rosters r
    where r.race_registration_id=reg.id and r.status in('selected','confirmed')),'[]'::jsonb) actual_roster,
  jsonb_build_object('objective',s.objective,'collectivePosture',s.collective_posture,'breakawayPolicy',s.breakaway_policy,
    'chasePolicy',s.chase_policy,'lieutenantRiderId',s.lieutenant_rider_id,'dangerPacerRiderId',s.danger_pacer_rider_id,
    'protectorRiderId',s.protector_rider_id,'breakawayRiderId',s.breakaway_rider_id,'attackOrders',s.attack_orders,
    'sprintTrainOrder',to_jsonb(s.sprint_train_order)) actual_strategy,
  stage.race_edition_id actual_stage_race
 from expected e left join public.race_registrations reg on reg.team_season_id=e.team_season_id and reg.race_edition_id=e.race_id
 left join public.race_stage_strategies s on s.race_registration_id=reg.id and s.stage_id=e.stage_id
 left join public.stages stage on stage.id=e.stage_id
),mismatches as materialized(
 select c.* from checked c where registration_status is distinct from 'accepted' or strategy_team is distinct from team_id
   or actual_stage_race is distinct from race_id or actual_roles<>roles or actual_strategy<>strategy
   or actual_roster<>(select jsonb_agg(x->'riderId' order by x->>'riderId') from jsonb_array_elements(roles)x)
)
`,
`select statement_timestamp() checked_at,(select count(*) from expected) expected_stages,
 (select count(*) from checked)-(select count(*) from mismatches) exact_stored_stage_preparations,
 (select count(*) from mismatches) preparation_mismatch_count,
 (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from(select * from mismatches limit 11)x) preparation_mismatches,
 (select jsonb_agg(jsonb_build_object('bot_key',t.bot_key,'expected',(select count(*) from expected e where e.team_id=t.team_id),
   'exact',(select count(*) from checked c where c.team_id=t.team_id)-(select count(*) from mismatches m where m.team_id=t.team_id))) from target t) teams;`);

write('final-preparation-time-trials',`
expected(bot_key,team_id,team_season_id,race_id,stage_id,stage_type,plan) as(values ${timeTrials.actions.map(a=>{
  const plans=a.args.p_plan.map(p=>({riderId:p.riderId,effortMode:p.effortMode,relaySharePct:p.relaySharePct??null})).sort((a,b)=>a.riderId.localeCompare(b.riderId));
  return `(${text(a.bot_key)},${uuid(team(a).team_id)},${uuid(team(a).team_season_id)},${uuid(a.args.p_race_edition_id)},${uuid(a.args.p_stage_id)},${text(a.stage_type)},${json(plans)})`;
}).join(',\n')}),
checked as materialized(
 select e.*,reg.id registration_id,reg.status registration_status,st.stage_type actual_stage_type,
   coalesce((select jsonb_agg(jsonb_build_object('riderId',p.rider_id,'effortMode',p.effort_mode,'relaySharePct',p.relay_share_pct) order by p.rider_id)
     from public.race_time_trial_rider_plans p where p.race_registration_id=reg.id and p.stage_id=e.stage_id),'[]'::jsonb) actual_plan,
   (select bool_and(p.team_id=e.team_id) from public.race_time_trial_rider_plans p where p.race_registration_id=reg.id and p.stage_id=e.stage_id) correct_owner,
   (select sum(p.relay_share_pct) from public.race_time_trial_rider_plans p where p.race_registration_id=reg.id and p.stage_id=e.stage_id) relay_total,
   (select count(*) from public.race_stage_strategies s where s.race_registration_id=reg.id and s.stage_id=e.stage_id) collective_strategy_count,
   (select count(*) from public.race_roster_stage_roles s where s.race_registration_id=reg.id and s.stage_id=e.stage_id) collective_role_count,
   coalesce((select jsonb_agg(r.rider_id order by r.rider_id) from public.race_rosters r where r.race_registration_id=reg.id and r.status in('selected','confirmed')),'[]'::jsonb) actual_roster
 from expected e left join public.race_registrations reg on reg.team_season_id=e.team_season_id and reg.race_edition_id=e.race_id
 left join public.stages st on st.id=e.stage_id and st.race_edition_id=e.race_id
),mismatches as materialized(
 select * from checked c where registration_status is distinct from 'accepted' or actual_stage_type is distinct from stage_type
   or actual_plan<>plan or correct_owner is distinct from true
   or (stage_type='team_time_trial' and relay_total is distinct from 100)
   or (stage_type<>'team_time_trial' and (relay_total is not null or collective_strategy_count<>0 or collective_role_count<>0))
   or actual_roster<>(select jsonb_agg(x->'riderId' order by x->>'riderId') from jsonb_array_elements(plan)x)
)
`,
`select statement_timestamp() checked_at,(select count(*) from expected) expected_time_trials,
 (select count(*) from checked)-(select count(*) from mismatches) exact_stored_time_trials,
 (select count(*) from expected where stage_type='individual_time_trial') individual_time_trials,
 (select count(*) from expected where stage_type='team_time_trial') team_time_trials,
 (select count(*) from expected where stage_type='prologue') prologues,
 (select count(*) from mismatches) time_trial_mismatch_count,
 (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from(select * from mismatches limit 11)x) time_trial_mismatches;`);

const allActions=[...training.actions,...road.actions,...timeTrials.actions];
write('final-preparation-receipts',`
expected(bot_key,action_key,rpc,args) as(values ${allActions.map(a=>`(${text(a.bot_key)},${text(a.key)},${text(a.rpc)},${json(a.args)})`).join(',\n')}),
checked as materialized(
 select e.*,c.id receipt_id,c.status,c.actions->0 payload,
  (c.status='completed' and c.actions->0->>'rpc'=e.rpc and c.actions->0->'args'=e.args
    and (c.actions->0->>'cashCost')::numeric=0) exact_receipt
 from expected e join target t on t.bot_key=e.bot_key
 left join public.alpha_bot_managers b on b.bot_key=t.bot_key and b.team_id=t.team_id
 left join public.alpha_bot_cycles c on c.manager_id=b.id and c.cycle_key='owner-s5-20261106:'||e.action_key
)
`,
`select statement_timestamp() checked_at,(select count(*) from expected) expected_zero_cost_actions,
 (select count(*) from checked where exact_receipt) exact_completed_zero_cost_receipts,
 (select count(*) from checked where exact_receipt is distinct from true) receipt_mismatch_count,
 (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from(select bot_key,action_key,rpc,receipt_id,status,payload
   from checked where exact_receipt is distinct from true limit 11)x) receipt_mismatches;`);
console.log(JSON.stringify({written,expected:{riders:90,thresholds:8,roadStages:320,collectivePreparations:321,timeTrials:13,zeroCostReceipts:349},readOnly:true,productionTouched:false}));
