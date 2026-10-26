// Local PGlite only. No Supabase calls or production data.
import { readFile } from 'node:fs/promises';

export async function verifyS5ChampionshipQuotas(db, { id, check, rows, scalar, rejects }) {
  const s4 = id(4), s5 = id(5);
  const before = await rows(`select
    (select jsonb_agg(to_jsonb(q) order by q.country_id,q.competition_code) from international_nation_qualification_snapshots q where season_id='${s4}') qualifications,
    (select jsonb_agg(to_jsonb(e) order by e.id) from race_editions e where season_id='${s4}') editions,
    (select jsonb_agg(to_jsonb(l) order by l.id) from national_federation_selection_lists l where season_id='${s4}') lists,
    (select jsonb_agg(to_jsonb(m) order by m.id) from national_federation_selection_members m join national_federation_selection_lists l on l.id=m.selection_list_id where l.season_id='${s4}') members,
    (select jsonb_agg(to_jsonb(q) order by q.season_id,q.country_id) from national_federation_olympic_qualifications q) olympics,
    (select jsonb_agg(to_jsonb(r) order by r.id) from race_rosters r) rosters`);
  const oldLimits = () => rows(`select s.game_year,slot.slot_key,get_federation_selection_rider_limit('${id(101)}',s.id,slot.slot_key) quota
    from seasons s cross join national_federation_selection_slots slot
    where s.game_year in (4,8) or slot.competition_code not in ('continental_championship','world_championship') order by s.game_year,slot.slot_key`);
  const preservedLimits = await oldLimits();
  const sql = await readFile(new URL('../../supabase/migrations/20261026160000_s5_international_championship_quotas.sql',import.meta.url),'utf8');
  await db.exec(sql);
  check(await oldLimits(),preservedLimits,'S4, Olympic, Nations Cup and junior quotas unchanged');
  check(await rows(`select
    (select jsonb_agg(to_jsonb(q) order by q.country_id,q.competition_code) from international_nation_qualification_snapshots q where season_id='${s4}') qualifications,
    (select jsonb_agg(to_jsonb(e) order by e.id) from race_editions e where season_id='${s4}') editions,
    (select jsonb_agg(to_jsonb(l) order by l.id) from national_federation_selection_lists l where season_id='${s4}') lists,
    (select jsonb_agg(to_jsonb(m) order by m.id) from national_federation_selection_members m join national_federation_selection_lists l on l.id=m.selection_list_id where l.season_id='${s4}') members,
    (select jsonb_agg(to_jsonb(q) order by q.season_id,q.country_id) from national_federation_olympic_qualifications q) olympics,
    (select jsonb_agg(to_jsonb(r) order by r.id) from race_rosters r) rosters`),before,'migration never rewrites S4 qualifications, editions, lists, approvals or any roster');

  const quota = (competition,profile,rank) => scalar(`select get_international_championship_rider_quota('${competition}','${profile}',${rank})`);
  for (const [rank,cm,cc] of [[0,0,0],[1,8,8],[5,8,8],[6,8,6],[10,8,6],[11,4,5],[20,4,5],[21,4,4],[30,4,4],[31,2,3],[40,2,3],[41,2,2],[60,2,2],[61,0,2],[173,0,2]]) {
    check(await quota('world_championship','Route',rank),cm,`CM road boundary ${rank}`);
    check(await quota('continental_championship','Route',rank),cc,`CC road boundary ${rank}`);
    check(await quota('world_championship','Chrono',rank),rank<1||rank>60?0:rank<=20?2:1,`CM ITT boundary ${rank}`);
    check(await quota('continental_championship','Chrono',rank),rank<1?0:rank<=20?2:1,`CC ITT boundary ${rank}`);
  }
  check(await scalar("select sum(get_international_championship_rider_quota('world_championship','Route',n))::int from generate_series(1,173)n"),220,'60 CM nations max 220 road starters');
  check(await scalar("select sum(get_international_championship_rider_quota('world_championship','Chrono',n))::int from generate_series(1,173)n"),80,'CM ITT max 80 starters');
  for (const [countries,total] of [[51,212],[47,204],[40,190],[29,156],[7,52]]) {
    check(await scalar(`select sum(get_international_championship_rider_quota('continental_championship','Route',n))::int from generate_series(1,${countries})n`),total,'approved continental field size');
  }
  check(await quota('nations_cup','Route',1),0,'pure championship quota never applies to Nations Cup');
  check(await scalar("select has_function_privilege('anon','get_national_federation_preselection_schedule_v2(uuid,uuid)','execute')"),false,'anonymous cannot read selection schedules');

  await db.exec(`update seasons set status='completed' where status='active';update seasons set status='active',current_day_number=1 where id='${s5}';
    insert into rider_season_ratings select rating.rider_id,'${s5}',rating.mountain,rating.hills,rating.flat,rating.cobbles,rating.sprint,rating.acceleration,rating.endurance,rating.resistance,rating.recovery,rating.time_trial,rating.prologue
      from rider_season_ratings rating where rating.season_id='${s4}' and not exists(select 1 from rider_season_ratings existing where existing.rider_id=rating.rider_id and existing.season_id='${s5}');`);
  for (let i=0;i<6;i++) {
    const existing = await scalar(`select count(*)::int from race_editions where race_id='${id(20100+i)}' and season_id='${s5}'`);
    if (!existing) await db.exec(`insert into race_editions(id,race_id,season_id,status,field_limit) values('${id(40000+i)}','${id(20100+i)}','${s5}','registration_open',160);
      insert into stages(id,race_edition_id,stage_number,stage_type,status,departure_at) values('${id(40100+i)}','${id(40000+i)}',1,'${i%2===1?'individual_time_trial':'road'}','planned',now()+interval '9 days');`);
  }
  const ready = country => rows(`select slot_key,is_open,can_prepare,rider_limit,qualification_rank from get_national_federation_preselection_schedule_v2('${country}','${s5}') where slot_key in ('cc-pro-road','cc-pro-itt','world-pro-road','world-pro-itt') order by slot_key`);
  const save = (riders,slot='cc-pro-road') => `select save_national_federation_preselection('PL','${slot}',array[${riders.map(r=>`'${r}'::uuid`).join(',')}])`;
  const publish = (slot='cc-pro-road') => `select publish_national_federation_preselection('PL','${slot}')`;
  check(await scalar('select freeze_due_international_nation_qualifications(now())'),0,'S5 J1 never freezes early');
  check((await ready(id(1079))).map(row=>[row.is_open,row.can_prepare,row.rider_limit,row.qualification_rank]),
    [[false,true,2,null],[false,true,8,null],[false,true,2,null],[false,true,8,null]],'J1 drafts are open with provisional maximum, publication stays locked');
  await db.exec(`select set_config('test.user','${id(20005)}',false)`);
  check((await scalar(save([id(10790),id(10791),id(10792)]))).riderCount,3,'president can prepare a larger draft before J8');
  await rejects(publish(),/J8/);
  await db.exec(`update seasons set current_day_number=8 where id='${s5}'`);
  check((await scalar('select freeze_due_international_nation_qualifications(now())'))>0,true,'scheduled J8 freeze creates new quotas without manual action');
  check(await scalar(`select count(*)::int from international_nation_qualification_snapshots where season_id='${s5}' and competition_code='world_championship' and is_qualified`),60,'S5 admits exactly top 60 at Worlds');
  check(await scalar(`select count(*)::int from international_nation_qualification_snapshots where season_id='${s5}' and competition_code='continental_championship' and not is_qualified`),0,'CC admits every nation with eligible rated riders');
  const frozen = await rows(`select * from international_nation_qualification_snapshots where season_id='${s5}' order by competition_code,country_id`);
  check(await scalar('select freeze_due_international_nation_qualifications(now())'),0,'qualification freeze remains idempotent');
  check(await rows(`select * from international_nation_qualification_snapshots where season_id='${s5}' order by competition_code,country_id`),frozen,'no ranking or quota changes during season');
  const outsiderReady = await ready(id(1079));
  check(outsiderReady.find(r=>r.slot_key==='cc-pro-road').rider_limit,2,'low-ranked CC nation gets two road places');
  check(outsiderReady.find(r=>r.slot_key==='cc-pro-road').is_open,true,'CC outsider is now admitted');
  check(outsiderReady.find(r=>r.slot_key==='world-pro-road').is_open,false,'outside top60 cannot enter Worlds');
  await rejects(publish(),/quota/);
  await rejects(save([id(10790),id(10791),id(10792)]),/quota/);
  check((await scalar(save([id(10790),id(10791)]))).riderCount,2,'oversized provisional draft can be trimmed to frozen quota');
  check(await scalar(publish()),2,'two calls sent after trimming, no implicit DS agreement');
  const list = await scalar(`select id from national_federation_selection_lists where season_id='${s5}' and country_id='${id(1079)}' and slot_key='cc-pro-road'`);
  const members = await rows(`select id from national_federation_selection_members where selection_list_id='${list}' order by id`);
  check(await scalar(`select count(*)::int from race_rosters r join race_registrations g on g.id=r.race_registration_id where g.race_edition_id=(select race_edition_id from get_national_federation_preselection_schedule_v2('${id(1079)}','${s5}') where slot_key='cc-pro-road') and r.status='confirmed'`),0,'pending invitations never leak into startlist');
  await db.exec(`select set_config('test.user','${id(302)}',false)`);
  for (const member of members) check(await scalar(`select respond_to_national_federation_preselection('${member.id}',true)`),'confirmed','foreign-team DS can explicitly accept within national quota');
  check(await scalar(`select count(*)::int from race_rosters r join national_federation_selection_race_links link on link.race_registration_id=r.race_registration_id where link.selection_list_id='${list}' and r.status='confirmed'`),2,'startlist contains exactly the two approved riders');
  await db.exec(`insert into national_federation_selection_members(id,selection_list_id,professional_rider_id,owner_team_id,owner_director_id,response_status) values('${id(40500)}','${list}','${id(10792)}','${id(202)}','${id(302)}','pending')`);
  await rejects(`select respond_to_national_federation_preselection('${id(40500)}',true)`,/quota/);
  check(await scalar(`select response_status from national_federation_selection_members where id='${id(40500)}'`),'pending','over-quota acceptance rolls back');
  check(await scalar(`select respond_to_national_federation_preselection('${id(40500)}',false)`),'declined','refusal remains possible at full quota');
  await db.query(`select sync_national_federation_championship_lineup('${list}')`);
  check(await scalar(`select count(*)::int from race_rosters r join national_federation_selection_race_links link on link.race_registration_id=r.race_registration_id where link.selection_list_id='${list}' and r.status='confirmed'`),2,'repeat synchronization cannot duplicate or drop accepted riders');
  await db.exec(`select set_config('test.user','${id(20005)}',false)`);
  await rejects(save([id(10790)],'world-pro-road'),/pas qualifiée|quota/);
  await rejects(save([id(10790)]),/confirmé/);

  // Genuine automatic producer/refill, not a duplicated quota implementation.
  const autoCountry = await scalar(`select country_id from international_nation_qualification_snapshots where season_id='${s5}' and competition_code='world_championship' and qualification_rank=41`);
  await db.exec(`insert into national_federation_selection_lists(id,country_id,season_id,slot_key,status,revision,published_at) values('${id(40600)}','${autoCountry}','${s5}','world-pro-road','pending_confirmation',1,now())`);
  await db.query(`select refill_national_federation_professional_selection('${id(40600)}',now())`);
  check(await scalar(`select count(*)::int from national_federation_selection_members where selection_list_id='${id(40600)}' and response_status in ('pending','confirmed')`),2,'automatic refill obeys two-rider World quota');
  check(await scalar(`select count(*)::int from national_federation_selection_members where selection_list_id='${id(40600)}' and response_status='confirmed'`),0,'automatic refill still requires human consent');
  check(await scalar(`select get_federation_selection_rider_limit('${id(101)}','${s5}','nc-hills')`),1,'S5 Nations Cup remains one rider per profile');
  check(await scalar(`select get_federation_selection_rider_limit('${id(101)}','${s5}','cc-junior-road')`),6,'S5 junior CC remains six riders');

  // Future generators keep the capacity aligned; historical edition updates do not change it.
  const worldRoad = id(40004);
  await db.exec(`update race_editions set field_limit=240 where id='${worldRoad}'`);
  check(await scalar(`select field_limit from race_editions where id='${worldRoad}'`),220,'future CM road generator gets 220 slots');
  await db.exec(`update races set slug='test-world-contre-la-montre' where id='${id(20105)}';update race_editions set field_limit=60 where id='${id(40005)}'`);
  check(await scalar(`select field_limit from race_editions where id='${id(40005)}'`),80,'future CM ITT generator gets 80 slots');
  const continentCount = await scalar("select count(*)::int from countries where is_active and continent_code='europe'");
  const continentalCapacity = await scalar(`select sum(get_international_championship_rider_quota('continental_championship','Route',position))::int from generate_series(1,${continentCount})position`);
  await db.exec(`update race_editions set field_limit=160 where id='${id(20400)}'`);
  check(await scalar(`select field_limit from race_editions where id='${id(20400)}'`),continentalCapacity,'CC field capacity includes every active country of its continent');
  await db.exec(`update race_editions set field_limit=123 where season_id='${s4}' and race_id='${id(20104)}'`);
  check(await scalar(`select field_limit from race_editions where season_id='${s4}' and race_id='${id(20104)}'`),123,'trigger never adjusts S4 capacity');

  const started=performance.now();
  await db.query('select prepare_due_automatic_federation_professional_lineups(now())');
  check(await scalar(`select count(*)::int from (
    select l.id from national_federation_selection_lists l join national_federation_selection_members m on m.selection_list_id=l.id
    where l.season_id='${s5}' and l.slot_key in ('cc-pro-road','cc-pro-itt','world-pro-road','world-pro-itt')
      and m.response_status in ('pending','confirmed') group by l.id,l.country_id,l.season_id,l.slot_key
    having count(*)>get_federation_selection_rider_limit(l.country_id,l.season_id,l.slot_key)
  ) over_quota`),0,'complete S5 automatic batch obeys all quotas');
  check(await scalar(`select count(*)::int from national_federation_selection_lists l
    join international_nation_qualification_snapshots q on q.country_id=l.country_id and q.season_id=l.season_id and q.competition_code='world_championship'
    where l.season_id='${s5}' and l.slot_key in ('world-pro-road','world-pro-itt') and q.qualification_rank>60 and l.published_at is not null`),0,'full batch does not publish World calls outside the top60');
  console.log(JSON.stringify({isolatedS5AutomaticBatchMs:Math.round(performance.now()-started)}));
}
