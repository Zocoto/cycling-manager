// Companion to the real-function Olympic harness. Local PGlite only: no network.
import { readFile } from 'node:fs/promises';

export async function verifyFederationPrequalification(db, { id, check, rows, scalar, rejects }) {
  const read = path => readFile(new URL(path, import.meta.url), 'utf8');
  const original = await read('../../supabase/migrations/20260925100000_require_ds_approval_for_automatic_international_callups.sql');
  // Replace the unrelated Olympic harness's qualification double with the real
  // J8 freeze, including its ranking schema and real season-points inputs.
  check(await scalar('select count(*)::int from international_nation_qualification_snapshots'),0,'fixture qualification table starts empty');
  await db.exec(`alter table international_nation_qualification_snapshots
    add primary key(season_id,competition_code,country_id),
    add continent_code text, add qualification_rank integer not null default 1,
    add current_season_points bigint not null default 0, add previous_season_points bigint not null default 0,
    add qualification_score numeric(18,2) not null default 0,
    add ranking_day_number smallint not null default 8, add captured_day_number smallint not null default 8,
    add captured_at timestamptz not null default now();
    create table rider_season_summaries(rider_id uuid,season_id uuid,points bigint);
    update seasons set status=case when game_year=4 then 'active' else 'planned' end;
    update seasons set current_day_number=6 where game_year=4;
    select set_config('test.user','${id(301)}',false);`);
  await db.exec(original.match(/create or replace function public\.freeze_due_international_nation_qualifications[\s\S]*?\$\$;/i)[0]);
  await db.exec(`insert into countries values('${id(20001)}','RW','Rwanda','africa',true);
    update countries set iso_alpha2='PL',name='ZZ outsider' where id='${id(1079)}';
    insert into teams values('${id(20002)}','active','RW team','RW team','${id(20001)}'),('${id(20003)}','active','PL team','PL team','${id(1079)}');
    insert into sporting_directors values('${id(20004)}','${id(20004)}','active'),('${id(20005)}','${id(20005)}','active');
    insert into team_manager_assignments(sporting_director_id,team_id,role,status) values('${id(20004)}','${id(20002)}','general_manager','active'),('${id(20005)}','${id(20003)}','general_manager','active');
    insert into national_federation_terms values('${id(20001)}',3,6,'elected','${id(20004)}'),('${id(1079)}',3,6,'elected','${id(20005)}'),('${id(102)}',3,6,'elected','${id(302)}');
    insert into riders values('${id(20006)}','${id(20001)}','active','Rwanda','Rider');
    insert into rider_season_ratings values('${id(20006)}','${id(4)}',80,80,80,80,80,80,80,80,80,80,80);
    insert into rider_season_summaries values('${id(401)}','${id(4)}',100000),('${id(20006)}','${id(4)}',90000);
    insert into national_federation_selection_slots values
      ('cc-pro-itt','CC Chrono','professional','continental_championship','Chrono',2,15,3),
      ('world-pro-itt','CM Chrono','professional','world_championship','Chrono',2,26,3),
      ('cc-junior-road','CC Juniors','junior','continental_championship_junior','Route',6,15,3);
    insert into season_days values('${id(20007)}','${id(4)}',15,current_date+9);
    insert into development_race_editions values('${id(20008)}','${id(4)}','cc-junior','scheduled','continental_road',15,'europe');`);
  const events=[['continental_championship','europe','road'],['continental_championship','europe','individual_time_trial'],
    ['continental_championship','africa','road'],['continental_championship','africa','individual_time_trial'],
    ['world_championship',null,'road'],['world_championship',null,'individual_time_trial']];
  for (const [index,[competition,continent,discipline]] of events.entries()) {
    await db.exec(`insert into races(id,country_id,name,slug,competition_type,championship_continent_code)
      values('${id(20100+index)}','${id(101)}','CC/World test','qualification-test-${index}','${competition}',${continent?`'${continent}'`:'null'});
      insert into race_editions(id,race_id,season_id,status) values('${id(20200+index)}','${id(20100+index)}','${id(4)}','registration_open');
      insert into stages(id,race_edition_id,stage_number,stage_type,status,departure_at) values('${id(20300+index)}','${id(20200+index)}',1,'${discipline}','planned',now()+interval '9 days');`);
  }
  const proSlots=['cc-pro-road','cc-pro-itt','world-pro-road','world-pro-itt'];
  const schedule = (country=id(101),season=id(4)) => `get_national_federation_preselection_schedule('${country}','${season}')`;
  const ready = (country=id(101),season=id(4)) => rows(`select slot_key,is_open,can_prepare,qualification_status,qualification_day_number from ${schedule(country,season)} where slot_key in ('${proSlots.join("','")}') order by slot_key`);
  const expected = (is_open,can_prepare,qualification_status) => [...proSlots].sort().map(slot_key=>({slot_key,is_open,can_prepare,qualification_status,qualification_day_number:8}));
  const save = (country='FR',slot='cc-pro-road',rider=id(401)) => `select save_national_federation_preselection('${country}','${slot}',array['${rider}'::uuid])`;
  const publish = (country='FR',slot='cc-pro-road') => `select publish_national_federation_preselection('${country}','${slot}')`;
  const unchangedFunctions = ['get_national_federation_selection_target(uuid,uuid,text)','freeze_due_international_nation_qualifications(timestamptz)',
    'publish_national_federation_preselection(text,text)','respond_to_national_federation_preselection(uuid,boolean)',
    'prepare_due_automatic_federation_professional_lineups(timestamptz)','sync_national_federation_championship_lineup(uuid)'];
  const hashes = () => rows(`select signature,md5(pg_get_functiondef(('public.'||signature)::regprocedure)) hash from unnest(array['${unchangedFunctions.join("','")}']) signature`);
  const beforeHashes=await hashes();
  const beforeOther=await rows(`select * from get_national_federation_selection_schedule('${id(101)}','${id(4)}') where slot_key not in ('${proSlots.join("','")}') order by slot_key`);
  const dataCounts=() => rows(`select (select count(*)::int from national_federation_selection_lists) lists,
    (select count(*)::int from national_federation_selection_members) members,
    (select count(*)::int from sporting_director_messages) messages,
    (select count(*)::int from race_rosters) rosters,
    (select count(*)::int from international_nation_qualification_snapshots) qualifications`);
  const beforeData=await dataCounts();
  check(await scalar('select freeze_due_international_nation_qualifications(now())'),0,'J6 must not prematurely freeze qualifications');
  check(await rows(`select race_edition_id,is_open from get_national_federation_selection_schedule('${id(101)}','${id(4)}') where slot_key='cc-pro-road'`),[{race_edition_id:null,is_open:false}],'reproduce missing calendar before patch');
  await rejects(save(),/date limite|calendrier/);
  await db.exec(await read('../../supabase/migrations/20261014120000_allow_federation_drafts_before_qualification.sql'));
  check(await hashes(),beforeHashes,'real qualification, publication, responses and startlist functions unchanged');
  check(await dataCounts(),beforeData,'migration never rewrites selections, messages, rosters or qualification');
  check(await rows(`select * from get_national_federation_selection_schedule('${id(101)}','${id(4)}') where slot_key not in ('${proSlots.join("','")}') order by slot_key`),beforeOther,'junior and Olympic timetable unchanged');
  for (const country of [id(101),id(20001),id(1079),id(102)]) {
    check(await ready(country),expected(false,true,'pending'),'any federation can prepare both CC/World disciplines before J8');
  }
  check(await scalar(`select race_edition_id from ${schedule(id(20001))} where slot_key='cc-pro-road'`),id(20202),'Africa resolves its own continental course');
  check(await scalar(`select count(*)::int from get_national_federation_selection_target('${id(101)}','${id(4)}','cc-pro-road')`),0,'unqualified draft is never an entry target');
  const beforeReads=await dataCounts();
  await ready(); await ready();
  check(await dataCounts(),beforeReads,'readiness RPC is read-only/idempotent');
  check(await scalar(`select has_function_privilege('anon','get_national_federation_preselection_schedule(uuid,uuid)','execute')`),false,'anonymous cannot call readiness RPC');
  check(await scalar(`select has_function_privilege('authenticated','get_national_federation_selection_calendar_target(uuid,uuid,text)','execute')`),false,'internal resolver not exposed to client');
  await db.exec('set role authenticated');
  check(await ready(),expected(false,true,'pending'),'authenticated can read readiness without direct table grants');
  await db.exec('reset role');
  for (const slot of proSlots) {
    check((await scalar(save('FR',slot))).riderCount,1,'J6 saves a real draft');
    await rejects(publish('FR',slot),/J8/);
  }
  check(await scalar(`select count(*)::int from national_federation_selection_members m join national_federation_selection_lists l on l.id=m.selection_list_id where l.country_id='${id(101)}' and l.slot_key in ('${proSlots.join("','")}') and m.response_status='draft'`),4,'failed premature publication keeps drafts unchanged');
  check((await dataCounts())[0].messages,beforeData[0].messages,'drafts send no premature DS notification');
  check((await dataCounts())[0].rosters,beforeData[0].rosters,'drafts create no race registrations');
  await rejects(`select save_national_federation_preselection('FR','cc-pro-road',array['${id(401)}'::uuid,'${id(401)}'::uuid])`,/deux fois/);
  await rejects(`select save_national_federation_preselection('FR','cc-pro-itt',array['${id(401)}'::uuid,'${id(402)}'::uuid,'${id(403)}'::uuid])`,/quota/);
  await rejects(save('FR','cc-pro-road',id(20006)),/inéligible/);
  await db.exec(`select set_config('test.user','${id(302)}',false)`);
  await rejects(save(),/ne fait pas partie/);
  await db.query(`select save_national_federation_preselection('BE','cc-pro-road','{}'::uuid[])`);
  await db.exec(`select set_config('test.user','${id(20005)}',false)`);
  await db.query(save('PL','cc-pro-road',id(10790)));
  await db.exec(`select set_config('test.user','${id(20004)}',false)`);
  await db.query(save('RW','cc-pro-road',id(20006)));
  await db.exec(`select set_config('test.user','${id(301)}',false); update seasons set current_day_number=8 where id='${id(4)}'`);
  check((await scalar('select freeze_due_international_nation_qualifications(now())'))>0,true,'real scheduled J8 freeze produces national rankings');
  check(await scalar('select freeze_due_international_nation_qualifications(now())'),0,'J8 freeze remains idempotent');
  check(await ready(),expected(true,true,'qualified'),'J8 opens all four qualified CC/World slots automatically');
  check(await ready(id(20001)),expected(true,true,'qualified'),'another continent opens automatically as well');
  check(await ready(id(1079)),expected(false,false,'not_qualified'),'outside ranking cutoff cannot prepare or publish');
  check(await scalar(`select count(*)::int from international_nation_qualification_snapshots where country_id='${id(102)}'`),0,'Belgium fixture has no eligible rated riders and no snapshot');
  check(await ready(id(102)),expected(false,false,'not_qualified'),'missing nation after freeze is not perpetually pending');
  check(await scalar(publish()),1,'qualified president can actually send saved draft to the DS');
  check(await scalar(publish()),0,'resubmitting sends no duplicate invitation');
  const member=await scalar(`select m.id from national_federation_selection_members m join national_federation_selection_lists l on l.id=m.selection_list_id where l.country_id='${id(101)}' and l.slot_key='cc-pro-road'`);
  await db.exec(`select set_config('test.user','${id(302)}',false)`);
  check(await scalar(`select respond_to_national_federation_preselection('${member}',true)`),'confirmed','owner can confirm qualified rider');
  await rejects(`select save_national_federation_preselection('BE','cc-pro-road','{}'::uuid[])`,/pas qualifiée/);
  await rejects(publish('BE'),/pas qualifiée/);
  await db.exec(`select set_config('test.user','${id(20005)}',false)`);
  await rejects(save('PL','cc-pro-road',id(10790)),/pas qualifiée/);
  await rejects(publish('PL'),/pas qualifiée/);
  await db.exec(`select set_config('test.user','${id(301)}',false)`);
  await rejects(`select save_national_federation_preselection('FR','cc-pro-road','{}'::uuid[])`,/confirmé/);
  await db.exec(`update stages set departure_at=now()+interval '24 hours' where id='${id(20300)}'`);
  check(await scalar(`select can_prepare from ${schedule()} where slot_key='cc-pro-road'`),false,'H24 exact deadline closes preparation');
  await rejects(save(),/date limite/); await rejects(publish(),/date limite/);
  await db.exec(`update stages set departure_at=now()+interval '9 days' where id='${id(20300)}'; update race_editions set status='cancelled' where id='${id(20200)}'`);
  check(await scalar(`select can_prepare from ${schedule()} where slot_key='cc-pro-road'`),false,'cancelled edition cannot be prepared');
  await db.exec(`update race_editions set status='completed' where id='${id(20200)}'`);
  check(await scalar(`select is_open from ${schedule()} where slot_key='cc-pro-road'`),false,'finished race cannot be published');
  // Next season, same president/country, without a one-off player or season patch.
  await db.exec(`update seasons set status='completed'; update seasons set status='active',current_day_number=1 where id='${id(5)}';
    insert into race_editions(id,race_id,season_id,status) values('${id(20400)}','${id(20100)}','${id(5)}','registration_open');
    insert into stages(id,race_edition_id,stage_number,stage_type,status,departure_at) values('${id(20401)}','${id(20400)}',1,'road','planned',now()+interval '37 days');`);
  check(await rows(`select is_open,can_prepare,qualification_status from ${schedule(id(101),id(5))} where slot_key='cc-pro-road'`),[{is_open:false,can_prepare:true,qualification_status:'pending'}],'future season J1 reopens drafts independently of old snapshot');
  check((await scalar(save())).riderCount,1,'next season president can save without manual repair');
  await rejects(publish(),/J8/);
  check(await scalar(`select can_prepare from ${schedule(id(101),id(4))} where slot_key='world-pro-road'`),false,'completed season cannot be edited');
}
