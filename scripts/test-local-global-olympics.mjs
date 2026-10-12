// Real selection SQL in an isolated PostgreSQL runtime, never on Supabase.
// Only unrelated hosting/race-camp/qualification hooks use local test doubles.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]?.endsWith('/dist/index.js')) throw new Error('Pass the local PGlite module path.');
const japanException = process.argv.includes('--japan-exception');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let assertions = 0, phase = 'schema';
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
const rows = async sql => (await db.query(sql)).rows;
const scalar = async sql => Object.values((await rows(sql))[0])[0];
const rejects = async (sql, pattern) => { await assert.rejects(db.query(sql), pattern); assertions++; };
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
    create table seasons(id uuid primary key,game_year int,status text,current_day_number int);
    create table countries(id uuid primary key,iso_alpha2 text,name text,continent_code text,is_active boolean);
    create table season_days(id uuid primary key,season_id uuid,day_number int,calendar_date date);
    create table teams(id uuid primary key,status text,amateur_name text,internal_name text,country_id uuid);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table team_manager_assignments(id uuid default gen_random_uuid(),sporting_director_id uuid,team_id uuid,role text,status text,created_at timestamptz default now());
    create table riders(id uuid primary key,country_id uuid,status text,first_name text,last_name text);
    create table rider_contracts(id uuid default gen_random_uuid(),rider_id uuid,team_id uuid,status text,created_at timestamptz default now());
    create table rider_season_ratings(rider_id uuid,season_id uuid,mountain numeric,hills numeric,flat numeric,cobbles numeric,sprint numeric,acceleration numeric,endurance numeric,resistance numeric,recovery numeric,time_trial numeric,prologue numeric);
    create table youth_academy_riders(id uuid,team_id uuid,country_id uuid,status text,birth_game_year int,first_name text,last_name text);
    create table rider_injuries(rider_id uuid,status text,started_at timestamptz,expected_recovery_at timestamptz);
    create table race_categories(id uuid primary key,code text,is_active boolean);
    create table races(id uuid primary key default gen_random_uuid(),country_id uuid,name text,short_name text,race_format text,status text,slug text unique,competition_type text,championship_continent_code text);
    create table race_editions(id uuid primary key default gen_random_uuid(),race_id uuid,season_id uuid,race_category_id uuid,edition_number int,display_name text,status text,registration_closes_at timestamptz,withdrawal_closes_at timestamptz,minimum_reputation int,registration_policy text,field_limit int,host_country_id uuid,unique(race_id,season_id));
    create table stages(id uuid primary key default gen_random_uuid(),race_edition_id uuid,season_day_id uuid,stage_number int,name text,stage_type text,distance_km numeric,status text,departure_at timestamptz,profile_type text,day_slot text,unique(race_edition_id,stage_number));
    create table stage_segments(id uuid default gen_random_uuid(),stage_id uuid,segment_number smallint,distance_km numeric,terrain_type text,surface_type text,average_gradient_pct numeric,unique(stage_id,segment_number));
    create table stage_results(stage_id uuid);
    create table race_results(race_edition_id uuid,race_roster_id uuid,final_rank int,status text);
    create table official_stage_simulations(stage_id uuid);
    create table official_stage_simulation_claims(stage_id uuid);
    create table development_race_editions(id uuid,season_id uuid,slug text,status text,competition_type text,start_day_number int,championship_continent_code text);
    create table national_federation_nations_cup_assignments(country_id uuid,season_id uuid,division smallint,group_code text,source_season_id uuid,source_division smallint,movement text,source_overall_rank int,primary key(country_id,season_id));
    create table national_federation_nations_cup_heats(season_id uuid,slot_key text,pool_key text,division smallint,group_code text,race_id uuid,race_edition_id uuid,primary key(season_id,slot_key,pool_key));
    create table national_federation_accounts(country_id uuid,season_id uuid,uci_rank int,nations_cup_division smallint);
    create table national_federation_hosting_awards(id uuid default gen_random_uuid(),selected_at timestamptz default now(),target_game_year int,event_type text,status text,country_id uuid);
    create table international_nation_qualification_snapshots(season_id uuid,competition_code text,country_id uuid,is_qualified boolean);
    create table national_federation_selection_slots(slot_key text primary key,label text,rider_category text,competition_code text,profile_label text,rider_limit int,day_number int,active_from_game_year int);
    create table national_federation_terms(country_id uuid,start_game_year int,end_game_year int,governance_mode text,president_director_id uuid);
    create table national_federation_selection_preferences(country_id uuid,season_id uuid,automatic_selection boolean);
    create table national_federation_selection_lists(id uuid primary key default gen_random_uuid(),country_id uuid,season_id uuid,slot_key text,status text,revision int,created_by_director_id uuid,published_at timestamptz,manually_submitted_at timestamptz,updated_at timestamptz default now(),created_at timestamptz default now(),unique(country_id,season_id,slot_key));
    create table national_federation_selection_members(id uuid primary key default gen_random_uuid(),selection_list_id uuid,professional_rider_id uuid,junior_rider_id uuid,owner_team_id uuid,owner_director_id uuid,response_status text,responded_at timestamptz,created_at timestamptz default now(),unique(selection_list_id,professional_rider_id));
    create table national_federation_journal_entries(country_id uuid,season_id uuid,day_number int,category text,title text,detail text,source_reference text unique);
    create table sporting_director_messages(id uuid default gen_random_uuid(),sporting_director_id uuid,season_id uuid,message_type text,sender_name text,subject text,preview text,body text,action_href text,action_label text,source_reference text,is_important boolean,archived_at timestamptz,unique(sporting_director_id,source_reference));
    create table race_registrations(id uuid primary key default gen_random_uuid(),race_edition_id uuid,team_season_id uuid,historical_team_name text,entry_method text,status text,registered_at timestamptz,decided_at timestamptz);
    create table race_rosters(id uuid primary key default gen_random_uuid(),race_registration_id uuid,rider_id uuid,race_role text,status text,selected_at timestamptz,unique(race_registration_id,rider_id));
    create table national_federation_selection_race_links(selection_list_id uuid primary key,race_edition_id uuid,race_registration_id uuid,synced_at timestamptz);
    create function get_current_federation_identity(p_country_code text) returns table(country_id uuid,team_id uuid,sporting_director_id uuid) language sql stable as $$
      select t.country_id,t.id,d.id from public.sporting_directors d join public.team_manager_assignments a on a.sporting_director_id=d.id and a.status='active' join public.teams t on t.id=a.team_id join public.countries c on c.id=t.country_id where d.auth_user_id=auth.uid() and c.iso_alpha2=p_country_code $$;
    create function freeze_due_international_nation_qualifications(timestamptz) returns int language sql as $$ select 0 $$;
    create function prioritize_federation_championship_rider(uuid,uuid) returns void language plpgsql as $$ begin if current_setting('test.locked',true)='yes' then raise exception 'Locked tour'; end if; end; $$;
    create function get_national_championship_country_rankings(uuid) returns table(country_id uuid,uci_points int) language sql as $$ select null::uuid,0 where false $$;
    create function get_nations_cup_group_code(integer,integer) returns text language sql immutable as $$ select case when $2=1 then null else 'A' end $$;
    create function get_nations_cup_projected_division(integer,integer,integer,integer,integer) returns smallint language sql immutable as $$ select $1::smallint $$;
    insert into seasons values('${id(4)}',4,'active',4),('${id(3)}',3,'completed',28),('${id(5)}',5,'planned',1);
    insert into season_days values('${id(24)}','${id(4)}',24,current_date+20),('${id(34)}','${id(3)}',24,current_date+20),('${id(54)}','${id(5)}',24,current_date+48);
    insert into countries values('${id(101)}','FR','France','europe',true),('${id(102)}','BE','Belgique','europe',true),('${id(103)}','CH','Suisse','europe',true),('${id(104)}','DE','Allemagne','europe',true),('${id(105)}','IT','Italie','europe',true),('${id(106)}','ES','Espagne','europe',true),('${id(107)}','GB','Royaume-Uni','europe',true),('${id(108)}','NL','Pays-Bas','europe',true);
    insert into national_federation_nations_cup_assignments values
      ('${id(101)}','${id(4)}',1,null,'${id(3)}',1,'held',1),('${id(102)}','${id(4)}',2,'A','${id(3)}',2,'held',2),('${id(103)}','${id(4)}',2,'B','${id(3)}',2,'held',3),('${id(104)}','${id(4)}',3,'A','${id(3)}',3,'held',4),('${id(105)}','${id(4)}',3,'B','${id(3)}',3,'held',5),('${id(106)}','${id(4)}',4,'A','${id(3)}',4,'held',6),('${id(107)}','${id(4)}',4,'B','${id(3)}',4,'held',7),('${id(108)}','${id(4)}',4,'C','${id(3)}',4,'held',8);
    insert into national_federation_hosting_awards(target_game_year,event_type,status,country_id) values(4,'quadrennial_games_pro','scheduled','${id(104)}');
    insert into race_categories values('${id(150)}','world',true);
    insert into teams values('${id(201)}','active','FR Team','FR Team','${id(101)}'),('${id(202)}','active','BE Team','BE Team','${id(102)}');
    insert into sporting_directors values('${id(301)}','${id(301)}','active'),('${id(302)}','${id(302)}','active');
    insert into team_manager_assignments(sporting_director_id,team_id,role,status) values('${id(301)}','${id(201)}','general_manager','active'),('${id(302)}','${id(202)}','general_manager','active');
    insert into national_federation_terms values('${id(101)}',3,6,'elected','${id(301)}');
    insert into riders values('${id(401)}','${id(101)}','active','Complete','One'),('${id(402)}','${id(101)}','active','Complete','Two'),('${id(403)}','${id(101)}','active','Hills','Only'),('${id(404)}','${id(101)}','active','Reserve','Four');
    insert into rider_contracts(rider_id,team_id,status) values('${id(401)}','${id(202)}','active'),('${id(402)}','${id(202)}','active'),('${id(403)}','${id(202)}','active'),('${id(404)}','${id(202)}','active');
    insert into rider_season_ratings values('${id(401)}','${id(4)}',80,80,75,80,75,75,80,80,75,70,70),('${id(402)}','${id(4)}',78,78,75,78,75,75,78,78,75,70,70),('${id(403)}','${id(4)}',40,95,70,40,60,85,55,55,60,60,60),('${id(404)}','${id(4)}',72,72,72,72,72,72,72,72,72,72,72);
    select set_config('test.user','${id(301)}',false);`);
  const oldHeatMigration = await read('../supabase/migrations/20260914121000_split_professional_nations_cup_heats.sql');
  await db.exec(oldHeatMigration.match(/create or replace function public\.get_professional_nations_cup_profile_segments[\s\S]*?\$\$;/i)[0]);
  const movementMigration = await read('../supabase/migrations/20260913143000_wire_nations_cup_movements.sql');
  await db.exec(movementMigration.match(/create or replace function public\.get_nations_cup_group_code_for_seed[\s\S]*?\$\$;/i)[0]);
  const beforeFunctions = await read('./fixtures/olympic-selection-functions-before-20261012.sql');
  const functions = new Map(Array.from(beforeFunctions.matchAll(/CREATE OR REPLACE FUNCTION public\.([^\(]+)[\s\S]*?\$function\$[\s\S]*?\$function\$;/g), match => [match[1], match[0]]));
  const dependencyOrder = ['get_national_federation_selection_target','get_national_federation_selection_schedule','get_national_federation_callup_response_closes_at','get_national_federation_nations_cup_standings','get_national_federation_nations_cup_movement_projection','get_current_director_federation_callups'];
  for (const [name, definition] of functions) if (!dependencyOrder.includes(name)) await db.exec(definition);
  for (const name of dependencyOrder) await db.exec(functions.get(name));
  phase = 'original programme';
  check(await scalar(`select ensure_professional_nations_cup('${id(4)}')`),40,'original five disciplines / eight heats');
  const hill = (await rows(`select h.race_edition_id,e.race_id,t.id stage_id from national_federation_nations_cup_heats h join race_editions e on e.id=h.race_edition_id join stages t on t.race_edition_id=e.id where h.season_id='${id(4)}' and h.slot_key='nc-hills' and h.pool_key='d1'`))[0];
  const slots = ['nc-mountain','nc-hills','nc-sprint','nc-cobbles','nc-time-trial'];
  for (let i=0;i<slots.length;i++) {
    const key=slots[i], list=id(500+i), member=id(600+i);
    await db.exec(`insert into national_federation_selection_slots values('${key}','Nations Cup · ${key==='nc-hills'?'Vallons':key}','professional','nations_cup','${key==='nc-hills'?'Vallons':'Sprint'}',1,24,3);
      insert into national_federation_selection_lists(id,country_id,season_id,slot_key,status,revision,published_at) values('${list}','${id(101)}','${id(4)}','${key}','finalized',1,now());
      insert into national_federation_selection_members(id,selection_list_id,professional_rider_id,owner_team_id,owner_director_id,response_status,responded_at) values('${member}','${list}','${key==='nc-hills'?id(401):id(402)}','${id(202)}','${id(302)}','confirmed',now());
      insert into sporting_director_messages(sporting_director_id,season_id,source_reference) values('${id(302)}','${id(4)}','federation-auto-callup:${member}');
      select sync_national_federation_championship_lineup('${list}');`);
  }
  await db.exec(`insert into national_federation_selection_slots values('nc-junior-road','Nations Cup Juniors','junior','nations_cup_junior','Route',6,24,3),('cc-pro-road','CC Route','professional','continental_championship','Route',8,15,3),('world-pro-road','CM Route','professional','world_championship','Route',8,26,3);
    insert into national_federation_selection_preferences values('${id(101)}','${id(4)}',false);`);
  phase = 'migration';
  const migration=await read('../supabase/migrations/20261012130000_single_hybrid_olympic_road_event.sql');
  const preflight = migration.match(/do \$preflight\$[\s\S]*?\$preflight\$;/)[0];
  for (const table of ['official_stage_simulations','official_stage_simulation_claims','stage_results']) {
    await db.exec(`begin; insert into ${table} values('${hill.stage_id}');`);
    await assert.rejects(db.exec(preflight),/already started, claimed or simulated/); assertions++;
    await db.exec('rollback');
  }
  await db.exec(migration);

  phase='global qualification setup';
  const current=await read('./fixtures/olympic-global-functions-before-20261012.sql');
  for(const match of current.matchAll(/CREATE OR REPLACE FUNCTION public\.[^\(]+[\s\S]*?\$function\$[\s\S]*?\$function\$;/g)) await db.exec(match[0]);
  // Broad, deterministic field: enough nations and riders to exercise every tier.
  for(let i=0;i<80;i++) {
    const country=id(1000+i);
    await db.exec(`insert into countries values('${country}','${i===65?'JP':`X${i}`}','${i===65?'Japon':`Nation ${i}`}','europe',true)`);
    for(let j=0;j<10;j++) {
      const rider=id(10000+i*10+j),note=70-i/4;
      await db.exec(`insert into riders values('${rider}','${country}','active','Test','${j}');
        insert into rider_season_ratings values('${rider}','${id(4)}',${note},${note},${note},${note},${note},${note},${note},${note},${note},${note},${note});
        insert into rider_contracts(rider_id,team_id,status) values('${rider}','${id(202)}','active')`);
    }
  }
  for(let j=0;j<8;j++){
    await db.exec(`insert into riders values('${id(410+j)}','${id(101)}','active','French','${j}');
      insert into rider_season_ratings values('${id(410+j)}','${id(4)}',75,75,75,75,75,75,75,75,75,75,75);
      insert into rider_contracts(rider_id,team_id,status) values('${id(410+j)}','${id(202)}','active')`);
  }
  await db.exec(`create or replace function get_national_championship_country_rankings(uuid) returns table(country_id uuid,uci_points int)
    language sql as $$ select id,(100000-row_number() over(order by id)*1000)::int from public.countries where is_active $$;`);
  const globalMigration=await read('../supabase/migrations/20261012160000_global_olympic_quotas_and_callups.sql');
  // A previously confirmed rider in another old division must keep his agreement,
  // roster ID and registration ID when every nation moves to the global race.
  const secondEdition=await scalar(`select race_edition_id from national_federation_nations_cup_heats where season_id='${id(4)}' and slot_key='nc-hills' and pool_key='d2-a'`);
  await db.exec(`insert into national_federation_selection_lists(id,country_id,season_id,slot_key,status,revision,published_at) values('${id(710)}','${id(1000)}','${id(4)}','nc-hills','finalized',1,now());
    insert into national_federation_selection_members(id,selection_list_id,professional_rider_id,owner_team_id,owner_director_id,response_status) values('${id(711)}','${id(710)}','${id(10000)}','${id(202)}','${id(302)}','confirmed');
    insert into race_registrations(id,race_edition_id,historical_team_name,status) values('${id(712)}','${secondEdition}','Nation 0','accepted');
    insert into race_rosters(id,race_registration_id,rider_id,race_role,status) values('${id(713)}','${id(712)}','${id(10000)}','leader','confirmed');
    insert into national_federation_selection_race_links values('${id(710)}','${secondEdition}','${id(712)}',now());`);
  const secondMember=await rows(`select * from national_federation_selection_members where id='${id(711)}'`);
  const secondRoster=await rows(`select * from race_rosters where id='${id(713)}'`);
  const beforeCalls=await rows(`select * from national_federation_selection_members where id='${id(601)}'`);
  if (japanException) {
    await db.exec(`insert into national_federation_selection_lists(id,country_id,season_id,slot_key,status,revision,published_at,manually_submitted_at) values('${id(720)}','${id(1065)}','${id(4)}','nc-hills','finalized',1,now(),now());
      insert into national_federation_selection_members(id,selection_list_id,professional_rider_id,owner_team_id,owner_director_id,response_status) values('${id(721)}','${id(720)}','${id(10650)}','${id(202)}','${id(302)}','confirmed');
      insert into race_registrations(id,race_edition_id,historical_team_name,status) values('${id(722)}','${secondEdition}','Japon','accepted');
      insert into race_rosters(id,race_registration_id,rider_id,race_role,status) values('${id(723)}','${id(722)}','${id(10650)}','leader','confirmed');
      insert into national_federation_selection_race_links values('${id(720)}','${secondEdition}','${id(722)}',now());`);
  }
  const japanMember=await rows(`select * from national_federation_selection_members where id='${id(721)}'`);
  const japanRoster=await rows(`select * from race_rosters where id='${id(723)}'`);
  phase='global migration';
  await db.exec(globalMigration);
  check(await scalar("select count(*)::int from race_editions where status<>'cancelled'"),1,'one global Olympic race');
  check(await rows(`select * from national_federation_selection_members where id='${id(601)}'`),beforeCalls,'existing agreement and member ID unchanged');
  check(await rows(`select * from national_federation_selection_members where id='${id(711)}'`),secondMember,'D2 nation agreement unchanged');
  check(await rows(`select * from race_rosters where id='${id(713)}'`),secondRoster,'D2 roster preserved exactly');
  check(await scalar(`select race_edition_id from race_registrations where id='${id(712)}'`),hill.race_edition_id,'D2 registration moved, not deleted');
  check(await scalar(`select field_limit from race_editions where id='${hill.race_edition_id}'`),220,'global hard cap');
  check(await scalar(`select race_edition_id from get_national_federation_selection_target('${id(1000)}','${id(4)}','nc-hills')`),hill.race_edition_id,'all invited countries resolve same race');
  check(await scalar(`select sum(rider_quota)::int from national_federation_olympic_qualifications where season_id='${id(4)}'`),220,'full tier allocation 10*8+20*4+30*2');
  check(await scalar('select count(*)::int from national_federation_olympic_qualifications where rider_quota>0'),60,'only sixty nations invited');
  check(await scalar('select count(*)::int from national_federation_olympic_qualifications where qualification_rank<=10 and rider_quota=8'),10,'top ten get eight places');
  check(await scalar('select count(*)::int from national_federation_olympic_qualifications where qualification_rank between 11 and 30 and rider_quota=4'),20,'next twenty get four places');
  check(await scalar('select count(*)::int from national_federation_olympic_qualifications where qualification_rank between 31 and 60 and rider_quota=2'),japanException?29:30,'two-place invitations honor the approved transition');
  check(await rows(`select qualification_rank,rider_quota,exception_reason from national_federation_olympic_qualifications where country_id='${id(1065)}'`),
    [{qualification_rank:67,rider_quota:japanException?2:0,exception_reason:japanException?'existing_confirmed_selection':null}], 'Japan retains actual rank; exception requires existing human agreement');
  if (japanException) {
    check(await rows(`select * from national_federation_selection_members where id='${id(721)}'`),japanMember,'Japanese confirmed agreement unchanged');
    check(await rows(`select * from race_rosters where id='${id(723)}'`),japanRoster,'Japanese roster ID and status unchanged');
    check(await scalar(`select race_edition_id from race_registrations where id='${id(722)}'`),hill.race_edition_id,'Japanese registration moved to global course');
    check(await rows('select rider_quota,exception_reason from national_federation_olympic_qualifications where qualification_rank=60'),
      [{rider_quota:0,exception_reason:'reallocated_for_confirmed_selection'}],'rank sixty exchanges exactly two places');
    check(await scalar(`select exception_reason from get_olympic_nation_standings('${id(4)}') where country_id='${id(1065)}'`),'existing_confirmed_selection','public summary reports exception');
  }
  const outsider=await scalar('select country_id from national_federation_olympic_qualifications where qualification_rank=61');
  check(await scalar(`select count(*)::int from get_national_federation_selection_target('${outsider}','${id(4)}','nc-hills')`),0,'uninvited nation cannot enter');
  const frozen=await rows('select * from national_federation_olympic_qualifications order by country_id');
  await db.query(`select ensure_professional_nations_cup('${id(4)}')`);
  check(await rows('select * from national_federation_olympic_qualifications order by country_id'),frozen,'qualifications frozen/idempotent');
  check(await scalar('select count(*)::int from race_editions where status<>\'cancelled\''),1,'maintenance cannot resurrect divided heats');
  phase='manual quota and DS approval';
  await rejects(`select save_national_federation_preselection('FR','nc-hills',array[${Array.from({length:9},(_,j)=>`'${id(400+j)}'::uuid`).join(',')}])`,/quota/);
  await db.exec(`delete from national_federation_selection_members where selection_list_id='${id(501)}'; update race_rosters set status='withdrawn'; update national_federation_selection_lists set status='draft',published_at=null where id='${id(501)}';`);
  await db.query(`select save_national_federation_preselection('FR','nc-hills',array['${id(401)}'::uuid,'${id(402)}'::uuid])`);
  check(await scalar("select publish_national_federation_preselection('FR','nc-hills')"),2,'manual calls use national quota not the old one-rider slot');
  const members=await rows(`select id,professional_rider_id from national_federation_selection_members where selection_list_id='${id(501)}' order by professional_rider_id`);
  check(await scalar(`select count(*)::int from race_rosters where status='confirmed'`),0,'pending invitation is not registration');
  await rejects(`select respond_to_national_federation_preselection('${members[0].id}',true)`,/votre équipe/);
  await db.exec(`select set_config('test.user','${id(302)}',false)`);
  await db.exec("select set_config('test.locked','yes',false)");
  await rejects(`select respond_to_national_federation_preselection('${members[0].id}',true)`,/participation ne peut/);
  check(await scalar(`select response_status from national_federation_selection_members where id='${members[0].id}'`),'pending','blocked acceptance rolls back and leaves pending');
  await db.exec("select set_config('test.locked','no',false)");
  check(await scalar(`select respond_to_national_federation_preselection('${members[0].id}',true)`),'confirmed','foreign-team DS explicitly agrees');
  check(await scalar(`select count(*)::int from race_rosters where status='confirmed'`),1,'only accepted rider registered');
  await rejects(`insert into race_rosters(race_registration_id,rider_id,race_role,status) select race_registration_id,'${id(402)}','leader','confirmed' from national_federation_selection_race_links where selection_list_id='${id(501)}'`,/sans accord/);
  const responseDeadline=new Date(await scalar(`select get_national_federation_callup_response_closes_at('nations_cup','professional',(select departure_at from stages where id='${hill.stage_id}'))`)).toISOString();
  check(await scalar(`select extract(epoch from ((select departure_at from stages where id='${hill.stage_id}')-'${responseDeadline}'::timestamptz))::int`),3600,'DS keeps H-1 answer deadline');
  check(await scalar(`select extract(epoch from (departure_at-closes_at))::int from get_national_federation_selection_schedule('${id(101)}','${id(4)}') where slot_key='nc-hills'`),86400,'president stops new invitations H-24');
  phase='automatic timeline';
  const departure=new Date(await scalar(`select departure_at from stages where id='${hill.stage_id}'`)).toISOString();
  check(await scalar(`select federation_selection_automatic_callup_is_due('${id(4)}','nc-hills','nations_cup','${departure}','${departure}'::timestamptz-interval '8 days')`),false,'not earlier than H-7d');
  check(await scalar(`select federation_selection_automatic_callup_is_due('${id(4)}','nc-hills','nations_cup','${departure}','${departure}'::timestamptz-interval '7 days')`),true,'automatic window opens H-7d');
  check(await scalar(`select federation_selection_automatic_callup_is_due('${id(4)}','nc-hills','nations_cup','${departure}','${departure}'::timestamptz-interval '24 hours')`),false,'no last-minute automatic callups');
  await db.exec(`update national_federation_selection_preferences set automatic_selection=true;
    update stages set departure_at=now()+interval '6 days' where id='${hill.stage_id}'`);
  // Keep other nations manual so this case exercises only the real French cycle.
  await db.exec(`insert into national_federation_selection_preferences select country_id,'${id(4)}',false from national_federation_olympic_qualifications where country_id<>'${id(101)}'`);
  check(await scalar('select prepare_due_automatic_federation_professional_lineups(now())'),6,'quota eight = one confirmed + one pending + six automatic calls');
  check(await scalar('select prepare_due_automatic_federation_professional_lineups(now())'),0,'automatic publication idempotent');
  await db.exec(`update stages set departure_at=now()+interval '23 hours' where id='${hill.stage_id}'`);
  await db.exec(`select set_config('test.user','${id(301)}',false)`);
  await rejects(`select save_national_federation_preselection('FR','nc-hills',array['${id(401)}'::uuid])`,/date limite/);
  await db.exec(`select set_config('test.user','${id(302)}',false)`);
  check(await scalar(`select refill_national_federation_professional_selection('${id(501)}',now())`),0,'no replacement invitation inside H-24');
  await db.exec(`update stages set departure_at=now()+interval '6 days' where id='${hill.stage_id}'`);
  const auto=await scalar(`select id from national_federation_selection_members where selection_list_id='${id(501)}' and professional_rider_id not in('${id(401)}','${id(402)}') and response_status='pending' limit 1`);
  check(await scalar(`select respond_to_national_federation_preselection('${auto}',false)`),'declined','refusal honored');
  check(await scalar(`select count(*)::int from national_federation_selection_members where selection_list_id='${id(501)}' and response_status in('pending','confirmed')`),8,'refused rider replaced within quota');
  const refusedRider=await scalar(`select professional_rider_id from national_federation_selection_members where id='${auto}'`);
  check(await scalar(`select count(*)::int from national_federation_selection_members where selection_list_id='${id(501)}' and professional_rider_id='${refusedRider}'`),1,'refused rider never recalled');
  phase='silence and normal Nations Cup';
  // Other race deliberately overlaps: lack of a DS answer must not remove it.
  await db.exec(`insert into races(id,country_id,name,slug,competition_type) values('${id(900)}','${id(101)}','Existing race','existing-race','standard');
    insert into race_editions(id,race_id,season_id,status) values('${id(901)}','${id(900)}','${id(4)}','registration_open');
    insert into race_registrations(id,race_edition_id,status) values('${id(902)}','${id(901)}','accepted');
    insert into race_rosters(race_registration_id,rider_id,status) values('${id(902)}','${id(402)}','confirmed');
    update stages set departure_at=now()+interval '30 minutes' where id='${hill.stage_id}'`);
  await rejects(`select respond_to_national_federation_preselection('${members[1].id}',true)`,/date limite/);
  await db.query('select prepare_due_automatic_federation_professional_lineups(now())');
  check(await scalar(`select status from race_rosters where race_registration_id='${id(902)}'`),'confirmed','silence does not withdraw existing team race');
  check(await scalar(`select count(*)::int from race_rosters r join race_registrations g on g.id=r.race_registration_id where g.race_edition_id='${hill.race_edition_id}' and r.rider_id='${id(402)}' and r.status='confirmed'`),0,'unanswered rider excluded from JO');
  await db.exec(`insert into race_results(race_edition_id,race_roster_id,final_rank,status) select '${hill.race_edition_id}',r.id,1,'classified' from race_rosters r join race_registrations g on g.id=r.race_registration_id where g.race_edition_id='${hill.race_edition_id}' and r.rider_id='${id(401)}'`);
  check(await scalar(`select best_finish from get_olympic_nation_standings('${id(4)}') where country_id='${id(101)}'`),1,'JO results read directly, best rider per nation');
  check(await scalar(`select sum(points)::int from get_national_federation_nations_cup_standings('${id(4)}')`),0,'Olympic victory never earns Nations Cup movement points');
  await db.exec(`update seasons set status='active' where id='${id(5)}';
    insert into national_federation_nations_cup_assignments select country_id,'${id(5)}',division,group_code,source_season_id,source_division,movement,source_overall_rank from national_federation_nations_cup_assignments where season_id='${id(4)}'`);
  check(await scalar(`select ensure_professional_nations_cup('${id(5)}')`),40,'normal Nations Cup still five disciplines/eight heats');
  check(await scalar(`select count(*)::int from get_national_federation_selection_schedule('${id(101)}','${id(5)}') where slot_key in('nc-mountain','nc-hills','nc-sprint','nc-cobbles','nc-time-trial')`),5,'normal NC selection slots unchanged');
  check(await scalar(`select get_federation_selection_rider_limit('${id(101)}','${id(5)}','nc-hills')`),1,'normal Nations Cup quota stays one');
  phase='next Olympic edition';
  await db.exec(`insert into seasons values('${id(8)}',8,'planned',4);
    insert into season_days values('${id(84)}','${id(8)}',24,current_date+112);
    insert into rider_season_ratings select rider_id,'${id(8)}',mountain,hills,flat,cobbles,sprint,acceleration,endurance,resistance,recovery,time_trial,prologue from rider_season_ratings where season_id='${id(4)}';
    insert into national_federation_selection_lists(id,country_id,season_id,slot_key,status,revision,manually_submitted_at) values('${id(820)}','${id(1065)}','${id(8)}','nc-hills','finalized',1,now());
    insert into national_federation_selection_members(id,selection_list_id,professional_rider_id,owner_team_id,owner_director_id,response_status) values('${id(821)}','${id(820)}','${id(10650)}','${id(202)}','${id(302)}','confirmed');`);
  check(await scalar(`select ensure_professional_nations_cup('${id(8)}')`),1,'future Olympics still one global race');
  check(await rows(`select qualification_rank,rider_quota,exception_reason from national_federation_olympic_qualifications where season_id='${id(8)}' and country_id='${id(1065)}'`),
    [{qualification_rank:67,rider_quota:0,exception_reason:null}], 'S4 exception never renews, even with another old confirmed call');
  check(await scalar(`select rider_quota from national_federation_olympic_qualifications where season_id='${id(8)}' and qualification_rank=60`),2,'future rank sixty keeps standard entitlement');
  console.log(JSON.stringify({isolated:true,productionActions:false,assertions,japanException,globalRace:true,max220:true,explicitDSApproval:true,silencePreservesRegistrations:true,normalNationsCupPreserved:true}));
} catch(error) { console.error(JSON.stringify({phase,message:error.message,where:error.where,internalQuery:error.internalQuery?.slice(0,1500)})); process.exitCode=1; }
finally { await db.close(); }
