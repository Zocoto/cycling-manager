// Write bounded read-only audit queries for the frozen, real S5 programme.
// No database connection, helper execution, fixtures, worker or mutation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const folder='C:/Dev/artifacts/managed-teams-s5-20261106/';
const read=name=>JSON.parse(readFileSync(folder+name+'.json','utf8'));
const expectedHashes={
  'season-registrations-native':'647a19abedcc55a18ce8463423c88c7ac57d357eb3c3147b65f17cc3804467d9',
  'season-reconnaissances-native':'e8dabbee0b99683d3af422e60034e460aab8b9d321b20b5fa077fe9f9641dde8',
  'season-recovery-native':'94506c5793002bc8b70f2cc9226a209cba370be5ad6f5097ba1f21134e2d3701',
};
for(const [name,hash]of Object.entries(expectedHashes))assert.equal(createHash('sha256').update(readFileSync(folder+name+'.json')).digest('hex'),hash);
const identity=read('identity-after-roster'),programme=read('season-program');
const registrations=read('season-registrations-native').actions,recons=read('season-reconnaissances-native').actions,camps=read('season-recovery-native').actions;
assert.equal(identity.length,8);assert.equal(programme.riders.length,90);
const uuid=value=>{assert.match(value,/^[a-f\d-]{36}$/);return `'${value}'::uuid`;};
const text=value=>"'"+String(value).replaceAll("'","''")+"'";
const number=value=>{assert.ok(Number.isFinite(Number(value)));return String(Number(value));};
const uuidArray=ids=>`array[${[...ids].sort().map(uuid).join(',')}]::uuid[]`;
const team=key=>{const t=identity.find(t=>t.bot_key===key);assert.ok(t);return t;};
const season=identity[0].season_id;
const target=`target(bot_key,team_id,team_season_id) as(values ${identity.map(t=>`(${text(t.bot_key)},${uuid(t.team_id)},${uuid(t.team_season_id)})`).join(',\n')})`;
const riders=`managed_riders(rider_id,team_id,expected_jdc) as(values ${programme.riders.map(r=>`(${uuid(r.id)},${uuid(r.team_id)},${number(r.after.committed_stages)})`).join(',\n')})`;
const roster=`expected_rosters(team_season_id,race_edition_id,rider_ids) as(values ${registrations.map(a=>`(${uuid(team(a.bot_key).team_season_id)},${uuid(a.args.p_race_edition_id)},${uuidArray(a.args.p_rider_ids)})`).join(',\n')})`;
const commitments=`commitments as materialized (
  select mr.rider_id,mr.team_id,reg.id registration_id,reg.team_season_id,reg.race_edition_id,reg.status registration_status,
    st.id stage_id,st.status stage_status,sd.day_number,
    exists(select 1 from expected_rosters e where e.team_season_id=reg.team_season_id and e.race_edition_id=reg.race_edition_id) is_new_programme
  from managed_riders mr join public.race_rosters rr on rr.rider_id=mr.rider_id and rr.status in('selected','confirmed')
  join public.race_registrations reg on reg.id=rr.race_registration_id and reg.status in('accepted','pending')
  join public.race_editions e on e.id=reg.race_edition_id and e.season_id=${uuid(season)}
  join public.stages st on st.race_edition_id=e.id and st.status<>'cancelled'
  join public.season_days sd on sd.id=st.season_day_id
)`;
function write(name,ctes,body){
  writeFileSync(folder+name+'.sql',`begin read only;set local statement_timeout='3s';set local lock_timeout='300ms';
set local application_name='${name}';\nwith ${target},\n${riders},\n${ctes}\n${body}\ncommit;\n`);
}
write('final-programme-riders',`${roster},\n${commitments},
loads as materialized(select rider_id,
  count(*) filter(where registration_status='accepted' and stage_status<>'completed')::integer future_jdc,
  array_agg(distinct least(4,1+(day_number-1)/7) order by least(4,1+(day_number-1)/7)) filter(where registration_status='accepted') weeks,
  count(distinct race_edition_id) filter(where registration_status='accepted')::integer race_count
  from commitments group by rider_id)
,latest_training as materialized(
  select mr.rider_id,p.intensity,p.domain,p.trainer_contract_id,p.effective_from_day_number
  from managed_riders mr left join lateral(select intensity,domain,trainer_contract_id,effective_from_day_number
    from public.rider_training_plan_versions p where p.rider_id=mr.rider_id and p.team_id=mr.team_id and p.season_id=${uuid(season)}
    order by effective_from_day_number desc limit 1)p on true
),trainer_counts as materialized(
  select trainer_contract_id,count(*)::integer assigned from latest_training where trainer_contract_id is not null group by trainer_contract_id
)
`,
`select t.bot_key,mr.rider_id,r.first_name||' '||r.last_name rider_name,mr.expected_jdc,
  exists(select 1 from public.rider_contracts rc where rc.rider_id=mr.rider_id and rc.team_id=mr.team_id and rc.status='active') active_owned_contract,
  coalesce(rt.season_race_days,0)+coalesce(loads.future_jdc,0) actual_projected_jdc,
  coalesce(loads.race_count,0) accepted_races,coalesce(loads.weeks,'{}'::integer[]) weeks,
  condition.form,condition.fatigue,condition.morale,
  plan.intensity,plan.domain,plan.trainer_contract_id,plan.effective_from_day_number,
  settings.minimum_form,
  coach.level trainer_level,
  coalesce(trainer_counts.assigned,0) trainer_assigned_count,
  case when coach.level is null then null else least(8,greatest(4,coach.level+3)) end trainer_capacity
from managed_riders mr join target t on t.team_id=mr.team_id join public.riders r on r.id=mr.rider_id
left join public.rider_season_ratings rt on rt.rider_id=mr.rider_id and rt.season_id=${uuid(season)}
left join loads on loads.rider_id=mr.rider_id
left join lateral(select c.form,c.fatigue,(to_jsonb(c)->>'morale')::numeric morale
  from public.rider_condition_states c join public.season_days d on d.id=c.season_day_id
  where c.rider_id=mr.rider_id and d.season_id=${uuid(season)} order by d.day_number desc limit 1)condition on true
left join latest_training plan on plan.rider_id=mr.rider_id
left join trainer_counts on trainer_counts.trainer_contract_id=plan.trainer_contract_id
left join lateral(select minimum_form from public.team_training_setting_versions s where s.team_id=mr.team_id and s.season_id=${uuid(season)}
  order by effective_from_day_number desc limit 1)settings on true
left join public.staff_contracts sc on sc.id=plan.trainer_contract_id and sc.team_id=mr.team_id and sc.status='active'
left join public.staff_members coach on coach.id=sc.staff_member_id and coach.role='trainer'
order by t.bot_key,mr.rider_id limit 91;`);

write('final-programme-rosters',`${roster},\n${commitments},
checked as materialized(
  select e.*,reg.id registration_id,reg.status,
    coalesce((select array_agg(rr.rider_id order by rr.rider_id) from public.race_rosters rr
      where rr.race_registration_id=reg.id and rr.status in('selected','confirmed')),'{}'::uuid[]) actual_rider_ids
  from expected_rosters e left join public.race_registrations reg on reg.team_season_id=e.team_season_id and reg.race_edition_id=e.race_edition_id
),conflicts as materialized(
  select rider_id,day_number,array_agg(distinct race_edition_id order by race_edition_id) races
  from commitments group by rider_id,day_number having count(distinct race_edition_id)>1 and bool_or(is_new_programme)
)
`,
`select statement_timestamp() checked_at,(select count(*) from checked) expected_rosters,
  (select count(*) from checked where status='accepted' and actual_rider_ids=rider_ids) exact_accepted_rosters,
  (select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) from(select * from checked where status is distinct from 'accepted' or actual_rider_ids<>rider_ids limit 21)m) mismatches,
  (select count(*) from conflicts) new_whole_day_conflict_count,
  (select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from(select * from conflicts limit 21)c) conflicts,
  (select jsonb_agg(jsonb_build_object('bot_key',t.bot_key,'exact_rosters',(
    select count(*) from checked c where c.team_season_id=t.team_season_id and c.status='accepted' and c.rider_ids=c.actual_rider_ids))) from target t) teams;`);

const expectedCamps=`expected_camps(team_season_id,rider_id,camp_type,start_day,end_day,price) as(values ${camps.flatMap(a=>a.args.p_rider_ids.map(riderId=>
  `(${uuid(team(a.bot_key).team_season_id)},${uuid(riderId)},${text(a.args.p_camp_type)},${number(a.args.p_start_day_number)},${number(a.args.p_end_day_number)},${number(a.max_cash_cost/a.args.p_rider_ids.length)})`)).join(',\n')})`;
const expectedRecons=`expected_recons(team_season_id,target_stage_id,rider_ids,preparer_id,start_day,end_day,price,bonus) as(values ${recons.map(a=>
  `(${uuid(team(a.bot_key).team_season_id)},${uuid(a.args.p_stage_id)},${uuidArray(a.args.p_rider_ids)},${a.args.p_preparer_contract_id?uuid(a.args.p_preparer_contract_id):'null::uuid'},${number(a.start_day)},${number(a.end_day)},${number(a.expected_cost)},${number(a.expected_bonus)})`).join(',\n')})`;
write('final-programme-camps',`${roster},\n${commitments},\n${expectedCamps},\n${expectedRecons},
camp_checks as materialized(
  select e.*,(select count(*) from public.rider_form_camps c where c.team_season_id=e.team_season_id and c.rider_id=e.rider_id
    and c.season_id=${uuid(season)} and c.camp_type=e.camp_type and c.start_day_number=e.start_day and c.end_day_number=e.end_day
    and c.status<>'cancelled' and c.total_price=e.price) matching_count from expected_camps e
),recon_checks as materialized(
  select e.*,m.id reconnaissance_id,m.status,m.start_day_number actual_start,m.end_day_number actual_end,m.total_price actual_price,m.bonus_points actual_bonus,
    coalesce((select array_agg(p.rider_id order by p.rider_id) from public.stage_reconnaissance_riders p where p.reconnaissance_id=m.id),'{}'::uuid[]) actual_riders,
    m.preparer_contract_id actual_preparer,
    public.get_race_preparer_rider_capacity(m.preparer_contract_id) current_capacity,
    (select min(d.day_number) from public.stages st join public.season_days d on d.id=st.season_day_id
      where st.race_edition_id=target_stage.race_edition_id and st.status<>'cancelled') edition_start
  from expected_recons e left join public.stage_reconnaissances m on m.team_season_id=e.team_season_id and m.target_stage_id=e.target_stage_id and m.status<>'cancelled'
  left join public.stages target_stage on target_stage.id=e.target_stage_id
),new_camps as materialized(
  select c.id,c.rider_id,c.start_day_number,c.end_day_number,c.camp_type
  from managed_riders mr join public.rider_form_camps c on c.rider_id=mr.rider_id where c.status<>'cancelled' and c.season_id=${uuid(season)} and (
    exists(select 1 from expected_camps e where e.rider_id=c.rider_id and e.team_season_id=c.team_season_id
      and e.camp_type=c.camp_type and e.start_day=c.start_day_number and e.end_day=c.end_day_number)
    or exists(select 1 from public.stage_reconnaissance_riders p join recon_checks r on r.reconnaissance_id=p.reconnaissance_id where p.form_camp_id=c.id)
  )
),camp_conflicts as materialized(
  select distinct c.id camp_id,c.rider_id,c.camp_type,c.start_day_number,c.end_day_number,b.race_edition_id,b.day_number
  from new_camps c join commitments b on b.rider_id=c.rider_id and b.day_number between c.start_day_number and c.end_day_number
),overlapping_camps as materialized(
  select distinct a.id camp_id,b.id other_camp_id,a.rider_id,a.start_day_number,a.end_day_number
  from new_camps a join public.rider_form_camps b on b.rider_id=a.rider_id and b.id<>a.id and b.status<>'cancelled'
    and b.season_id=${uuid(season)} and b.start_day_number<=a.end_day_number and b.end_day_number>=a.start_day_number
),recon_camp_mismatches as materialized(
  select r.reconnaissance_id,p.rider_id,p.form_camp_id from recon_checks r
  join public.stage_reconnaissance_riders p on p.reconnaissance_id=r.reconnaissance_id
  left join public.rider_form_camps c on c.id=p.form_camp_id
  where c.id is null or c.rider_id<>p.rider_id or c.team_season_id<>r.team_season_id
    or c.status='cancelled' or c.start_day_number<>r.start_day or c.end_day_number<>r.end_day
)
`,
`select statement_timestamp() checked_at,(select count(*) from camp_checks) expected_recovery_camps,
  (select count(*) from camp_checks where matching_count=1) exact_recovery_camps,
  (select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from(select * from camp_checks where matching_count<>1 limit 21)c) recovery_mismatches,
  (select count(*) from expected_recons) expected_reconnaissances,
  (select count(*) from recon_checks where reconnaissance_id is not null and actual_start=start_day and actual_end=end_day and actual_price=price and actual_bonus=bonus
    and actual_riders=rider_ids and actual_preparer is not distinct from preparer_id and cardinality(actual_riders)<=current_capacity and actual_end<edition_start) exact_reconnaissances,
  (select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from(select * from recon_checks where reconnaissance_id is null or actual_start<>start_day or actual_end<>end_day
    or actual_price<>price or actual_bonus<>bonus or actual_riders<>rider_ids or actual_preparer is distinct from preparer_id
    or cardinality(actual_riders)>current_capacity or actual_end>=edition_start limit 21)r) reconnaissance_mismatches,
  (select count(*) from camp_conflicts) camp_course_conflict_count,
  (select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from(select * from camp_conflicts limit 21)c) camp_course_conflicts,
  (select count(*) from overlapping_camps) overlapping_camp_count,
  (select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from(select * from overlapping_camps limit 21)c) overlapping_camps,
  (select count(*) from recon_camp_mismatches) reconnaissance_camp_mismatch_count,
  (select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from(select * from recon_camp_mismatches limit 21)c) reconnaissance_camp_mismatches;`);
console.log(JSON.stringify({written:['final-programme-riders.sql','final-programme-rosters.sql','final-programme-camps.sql'],
  riders:programme.riders.length,registrations:registrations.length,reconnaissances:recons.length,recoveryCamps:camps.length,readOnly:true,productionTouched:false}));
