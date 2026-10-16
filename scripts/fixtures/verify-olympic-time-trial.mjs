import { readFile } from 'node:fs/promises';

export async function verifyOlympicTimeTrial(db, { id, check, rows, scalar, rejects }) {
  await db.exec(`update seasons set status='planned';update seasons set status='active' where game_year=4;
    update national_federation_selection_slots set profile_label='Chrono' where slot_key='nc-time-trial';`);
  const roadSnapshot=()=>rows(`select q.season_id,q.country_id,q.qualification_rank,q.rider_quota,q.exception_reason,q.frozen_at,
    o.race_edition_id,o.qualification_frozen_at from national_federation_olympic_qualifications q
    join national_federation_olympic_events o on o.season_id=q.season_id order by q.season_id,q.country_id`);
  const confirmedRoad=()=>rows(`select m.* from national_federation_selection_members m
    join national_federation_selection_lists l on l.id=m.selection_list_id where l.slot_key='nc-hills' and m.response_status='confirmed' order by m.id`);
  const before=await roadSnapshot(), accepted=await confirmedRoad();
  await db.exec(await readFile(new URL('../../supabase/migrations/20261016180000_olympic_individual_time_trial.sql',import.meta.url),'utf8'));
  check(await roadSnapshot(),before,'existing rankings, road quotas, exception and freeze unchanged');
  check(await confirmedRoad(),accepted,'every confirmed road callup survives');
  const event=(await rows(`select o.*,s.stage_type,s.distance_km,s.day_slot,s.departure_at,e.field_limit,
    e.registration_policy,e.host_country_id,r.slug from national_federation_olympic_events o
    join race_editions e on e.id=o.time_trial_race_edition_id join races r on r.id=e.race_id
    join stages s on s.race_edition_id=e.id where o.season_id='${id(4)}'`))[0];
  check([event.stage_type,event.distance_km,event.day_slot,event.field_limit,event.registration_policy,event.slug],
    ['individual_time_trial','36','early',120,'closed','jeux-quadriennaux-clm'],'real global ITT, not road or division heats');
  check(await scalar(`select extract(hour from departure_at at time zone 'Europe/Paris')::int from stages where race_edition_id='${event.time_trial_race_edition_id}'`),14,'ITT is at 14h Paris');
  check(await scalar(`select sum(distance_km) from get_federation_professional_event_profile_segments('nc-time-trial',4)`),'36','selection preview matches 36km course');
  check(await scalar(`select count(*)::int from get_federation_professional_event_profile_segments('nc-hills',4)`),21,'road profile unchanged');
  check(await scalar(`select count(*)::int from national_federation_olympic_qualifications where season_id='${id(4)}' and time_trial_rider_quota<>least(eligible_riders,case when qualification_rank<=20 then 2 when qualification_rank<=100 then 1 else 0 end)`),0,'all quotas follow frozen ranking');
  check(await scalar(`select count(*)::int from national_federation_olympic_qualifications where season_id='${id(4)}' and time_trial_rider_quota>0`),81,'81 eligible fixture countries invited, beyond 60 road nations');
  check(await scalar(`select ensure_professional_nations_cup('${id(4)}')`),2,'programme creation idempotent');
  check(await scalar(`select count(*)::int from race_editions where id='${event.time_trial_race_edition_id}'`),1,'one TT edition only');
  check(await scalar(`select count(*)::int from get_national_federation_selection_target('${id(101)}','${id(4)}','nc-time-trial')`),1,'qualified nation targets global TT');
  check(await scalar(`select race_edition_id from get_national_federation_selection_target('${id(101)}','${id(4)}','nc-time-trial')`),event.time_trial_race_edition_id,'no cancelled old heat selected');
  check(await scalar(`select extract(epoch from departure_at-closes_at)::int from get_national_federation_selection_schedule('${id(101)}','${id(4)}') where slot_key='nc-time-trial'`),86400,'TT invitation deadline H24');
  const departure=new Date(event.departure_at).toISOString();
  for(const [days,expected] of [[8,false],[7,true],[1,false]]) {
    check(await scalar(`select federation_selection_automatic_callup_is_due('${id(4)}','nc-time-trial','nations_cup','${departure}','${departure}'::timestamptz-interval '${days} days')`),expected,`automatic TT window ${days}d`);
  }
  // Genuine end-to-end president -> pending invitation -> DS consent -> roster.
  await db.exec(`select set_config('test.user','${id(301)}',false);update stages set departure_at=now()+interval '6 days' where race_edition_id='${event.time_trial_race_edition_id}';`);
  const roadRiders=await rows(`select professional_rider_id from national_federation_selection_members m
    join national_federation_selection_lists l on l.id=m.selection_list_id where l.country_id='${id(101)}' and l.season_id='${id(4)}' and l.slot_key='nc-hills'`);
  const candidate=await scalar(`select r.id from riders r where r.country_id='${id(101)}' and r.id not in('${roadRiders.map(r=>r.professional_rider_id).join("','")}') order by r.id limit 1`);
  check((await scalar(`select save_national_federation_preselection('FR','nc-time-trial',array['${candidate}'::uuid])`)).riderCount,1,'president can save TT specialist');
  check(await scalar(`select publish_national_federation_preselection('FR','nc-time-trial')`),1,'president publishes distinct TT call');
  const member=await scalar(`select m.id from national_federation_selection_members m join national_federation_selection_lists l on l.id=m.selection_list_id where l.country_id='${id(101)}' and l.season_id='${id(4)}' and l.slot_key='nc-time-trial' and m.professional_rider_id='${candidate}'`);
  check(await scalar(`select count(*)::int from race_rosters r join race_registrations g on g.id=r.race_registration_id where g.race_edition_id='${event.time_trial_race_edition_id}' and r.status in('selected','confirmed')`),0,'pending call is never registered');
  await db.exec(`select set_config('test.user','${id(302)}',false);`);
  check(await scalar(`select respond_to_national_federation_preselection('${member}',true)`),'confirmed','DS explicitly accepts TT');
  check(await scalar(`select registered_riders from get_olympic_time_trial_nation_standings('${id(4)}') where country_id='${id(101)}'`),1,'TT standings show accepted rider');
  const registration=await scalar(`select g.id from race_registrations g where g.race_edition_id='${event.time_trial_race_edition_id}' limit 1`);
  await rejects(`insert into race_rosters(race_registration_id,rider_id,race_role,status) values('${registration}','${id(401)}','leader','confirmed')`,/sans accord/);
  await rejects(`insert into race_rosters(race_registration_id,rider_id,race_role,status) values('${registration}','${candidate}','leader','confirmed')`,/déjà inscrit/);
  await db.exec(`insert into race_results(race_edition_id,race_roster_id,final_rank,status)
    select '${event.time_trial_race_edition_id}',r.id,1,'classified' from race_rosters r
    join race_registrations g on g.id=r.race_registration_id where g.race_edition_id='${event.time_trial_race_edition_id}' and r.rider_id='${candidate}';`);
  check(await scalar(`select best_finish from get_olympic_time_trial_nation_standings('${id(4)}') where country_id='${id(101)}'`),1,'ITT result appears in its own standings');
  check(await scalar(`select sum(points)::int from get_national_federation_nations_cup_standings('${id(4)}')`),0,'neither Olympic discipline changes Nations Cup points');
  check(await scalar(`select ensure_professional_nations_cup('${id(8)}')`),2,'S8 automatically gets both disciplines');
  // Boundary countries: local-only rows, no games or player state in production.
  for (const rank of [99,100,101]) {
    await db.exec(`insert into countries values('${id(30000+rank)}','X${rank}','Boundary ${rank}','world',true);
      insert into national_federation_olympic_qualifications(season_id,country_id,source_season_id,qualification_rank,uci_rank,uci_points,rider_strength,qualification_score,eligible_riders,rider_quota)
      values('${id(8)}','${id(30000+rank)}','${id(4)}',${rank},${rank},0,0,0,1,0)`);
  }
  await db.exec(`select ensure_professional_nations_cup('${id(8)}')`);
  check(await rows(`select qualification_rank,time_trial_rider_quota from national_federation_olympic_qualifications where season_id='${id(8)}' and qualification_rank>=99 order by qualification_rank`),
    [{qualification_rank:99,time_trial_rider_quota:1},{qualification_rank:100,time_trial_rider_quota:1},{qualification_rank:101,time_trial_rider_quota:0}],'rank100 invited, rank101 excluded');
  check(await scalar(`select get_federation_selection_rider_limit('${id(101)}','${id(5)}','nc-time-trial')`),1,'non-Olympic time trial keeps one rider');
  check(await scalar(`select has_function_privilege('authenticated','ensure_global_olympic_event(uuid)','execute')`),false,'creation remains service-only');
  check(await scalar(`select has_function_privilege('authenticated','get_olympic_time_trial_nation_standings(uuid)','execute')`),false,'standings service-only');
}
