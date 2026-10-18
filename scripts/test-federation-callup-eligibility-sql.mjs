import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Isolated rehearsal of the actual live baseline plus the reviewed migration.
// Baseline definitions are exported by a bounded READ ONLY diagnostic.
const {PGlite}=await import(pathToFileURL(process.env.FEDERATION_CALLUP_SQL_TEST_MODULE).href);
const baseline=JSON.parse(readFileSync(process.env.FEDERATION_CALLUP_SQL_TEST_BASELINE,'utf8')).rows;
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const departure='2030-10-23T16:00:00Z';
let checks=0;
try {
 await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
 create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
 create table teams(id uuid primary key,status text,amateur_name text,internal_name text);
 create table seasons(id uuid primary key,status text,game_year integer,current_day_number integer);
 create table countries(id uuid primary key,iso_alpha2 text,name text);
 create table national_federation_selection_members(id uuid primary key default gen_random_uuid(),selection_list_id uuid,owner_team_id uuid,owner_director_id uuid,professional_rider_id uuid,junior_rider_id uuid,response_status text,responded_at timestamptz,created_at timestamptz default now());
 create index on national_federation_selection_members(selection_list_id);
 create table national_federation_selection_lists(id uuid primary key,country_id uuid,season_id uuid,slot_key text,status text,published_at timestamptz,updated_at timestamptz,created_by_director_id uuid);
 create table national_federation_selection_slots(slot_key text primary key,rider_category text,competition_code text,label text,profile_label text);
 create table national_federation_selection_preferences(country_id uuid,season_id uuid,automatic_selection boolean);
 create table riders(id uuid primary key,country_id uuid,first_name text,last_name text,status text);
 create table rider_contracts(id uuid primary key default gen_random_uuid(),rider_id uuid,team_id uuid,status text,created_at timestamptz default now());
 create index on rider_contracts(rider_id);
 create table rider_injuries(rider_id uuid,status text,started_at timestamptz,expected_recovery_at timestamptz);
 create index on rider_injuries(rider_id);
 create table rider_season_ratings(rider_id uuid,season_id uuid,mountain numeric default 70,hills numeric default 70,flat numeric default 70,sprint numeric default 70,cobbles numeric default 70,endurance numeric default 70,recovery numeric default 70,resistance numeric default 70,acceleration numeric default 70,time_trial numeric default 70,prologue numeric default 70);
 create table youth_academy_riders(id uuid primary key,country_id uuid,team_id uuid,birth_game_year integer,status text,first_name text,last_name text);
 create table international_nation_qualification_snapshots(country_id uuid,season_id uuid,competition_code text,is_qualified boolean);
 create table national_federation_terms(country_id uuid,start_game_year integer,end_game_year integer,president_director_id uuid);
 create table sporting_director_messages(sporting_director_id uuid,season_id uuid,message_type text,sender_name text,subject text,preview text,body text,action_href text,action_label text,source_reference text,is_important boolean,unique(sporting_director_id,source_reference));
 create table national_federation_journal_entries(country_id uuid,season_id uuid,day_number integer,category text,title text,detail text,source_reference text unique);
 create table national_federation_selection_race_links(selection_list_id uuid primary key,race_edition_id uuid,race_registration_id uuid,synced_at timestamptz);
 create table race_registrations(id uuid primary key default gen_random_uuid(),race_edition_id uuid,team_season_id uuid,historical_team_name text,entry_method text,status text,registered_at timestamptz,decided_at timestamptz);
 create table race_rosters(id uuid primary key default gen_random_uuid(),race_registration_id uuid,rider_id uuid,race_role text,status text,selected_at timestamptz,unique(race_registration_id,rider_id));
 create table race_editions(id uuid primary key,race_id uuid,season_id uuid,display_name text,status text);
 create table development_race_editions(id uuid primary key,status text);
 create table races(id uuid primary key,competition_type text,championship_continent_code text);
 create table stages(race_edition_id uuid,season_day_id uuid,day_slot text);
 create table test_targets(country_id uuid,season_id uuid,slot_key text,race_edition_id uuid,departure_at timestamptz);
 create function get_national_federation_selection_target(uuid,uuid,text) returns table(race_edition_id uuid,departure_at timestamptz) language sql as $$select t.race_edition_id,t.departure_at from public.test_targets t where t.country_id=$1 and t.season_id=$2 and t.slot_key=$3$$;
 create function get_national_federation_selection_schedule(uuid,uuid) returns table(slot_key text,label text,rider_category text,race_edition_id uuid,race_href text,departure_at timestamptz,closes_at timestamptz,is_open boolean) language sql as $$select t.slot_key,s.label,s.rider_category,t.race_edition_id,'/jeu/courses/test',t.departure_at,t.departure_at-interval '24 hours',true from public.test_targets t join public.national_federation_selection_slots s on s.slot_key=t.slot_key where t.country_id=$1 and t.season_id=$2$$;
 create function get_national_federation_callup_response_closes_at(text,text,timestamptz) returns timestamptz language sql as $$select $3-interval '1 hour'$$;
 create function assert_federation_callup_response_open(uuid,uuid,text) returns void language plpgsql as $$begin if current_setting('test.closed',true)='yes' then raise exception 'Date limite dépassée';end if;end$$;
 create function get_federation_selection_rider_limit(uuid,uuid,text) returns integer language sql as $$select case when $3='nc-hills' and current_setting('test.quota_zero',true)='yes' then 0 else 8 end$$;
 create function federation_selection_slot_is_available(text,integer) returns boolean language sql as $$select true$$;
 create function federation_selection_automatic_callup_is_due(uuid,text,text,timestamptz,timestamptz) returns boolean language sql as $$select true$$;
 create function federation_selection_slot_label(text,text,integer) returns text language sql as $$select $2$$;
 create function prioritize_federation_championship_rider(uuid,uuid) returns void language plpgsql as $$begin if current_setting('test.unavailable',true)=$2::text then raise exception 'Indisponible';end if;end$$;
 create function sync_national_federation_junior_lineup(uuid) returns integer language sql as $$select 0$$;
 create function get_current_federation_identity(text) returns table(country_id uuid,sporting_director_id uuid,team_id uuid) language sql as $$select '${id(201)}'::uuid,'${id(1)}'::uuid,'${id(101)}'::uuid$$;
 create function assert_federation_selection_open(uuid,uuid,text) returns void language plpgsql as $$begin return;end$$;
 alter table national_federation_terms add column governance_mode text default 'elected';
 alter table national_federation_selection_lists add column revision integer default 1;
 alter table national_federation_selection_lists add column manually_submitted_at timestamptz;
 insert into sporting_directors values('${id(1)}','${id(11)}','active'),('${id(2)}','${id(12)}','active');
 insert into teams values('${id(101)}','active','Test','Test'),('${id(102)}','active','Autre','Autre');
 insert into team_manager_assignments values('${id(1)}','${id(101)}','general_manager','active'),('${id(2)}','${id(102)}','general_manager','active');
 insert into seasons values('${id(301)}','active',4,10);
 insert into national_federation_selection_slots values('cc-pro-road','professional','continental_championship','Route','Vallons'),('cc-pro-itt','professional','continental_championship','CLM','Chrono'),('world-pro-road','professional','world_championship','Mondiaux','Vallons'),('cc-junior-road','junior','continental_championship_junior','CC juniors','Vallons');
 insert into countries values('${id(201)}','NL','Pays-Bas'),('${id(202)}','BW','Botswana'),('${id(203)}','AF','Afghanistan');
 insert into international_nation_qualification_snapshots select country.id,'${id(301)}',code,true from countries country cross join (values ('continental_championship'),('world_championship')) c(code);
 `);
 const scopes=[[201,'cc-pro-road',3],[201,'cc-pro-itt',1],[202,'cc-pro-road',1],[203,'cc-pro-road',1],[202,'world-pro-road',1],[203,'world-pro-road',1]];
 let n=0;
 for(let list=0;list<scopes.length;list++) {
  const [country,slot,count]=scopes[list];
  await db.query('insert into national_federation_selection_lists(id,country_id,season_id,slot_key,status,published_at,updated_at) values($1,$2,$3,$4,$5,now(),now())',[id(1000+list),id(country),id(301),slot,'pending_confirmation']);
  await db.query('insert into test_targets values($1,$2,$3,$4,$5)',[id(country),id(301),slot,id(2000+list),departure]);
  await db.query("insert into races values($1,'continental_championship','test')",[id(2100+list)]);
  await db.query("insert into race_editions values($1,$2,$3,'Test','planned')",[id(2000+list),id(2100+list),id(301)]);
  for(let j=0;j<count;j++,n++) {
   await db.query('insert into riders values($1,$2,$3,$4,$5)',[id(700+n),id(country),'Coureur',String(n),'active']);
   await db.query("insert into rider_contracts(rider_id,team_id,status) values($1,$2,'active')",[id(700+n),id(101)]);
   await db.query('insert into rider_season_ratings(rider_id,season_id) values($1,$2)',[id(700+n),id(301)]);
   await db.query('insert into national_federation_selection_members(id,selection_list_id,owner_team_id,owner_director_id,professional_rider_id,response_status) values($1,$2,$3,$4,$5,$6)',[id(3000+n),id(1000+list),id(101),id(1),id(700+n),n===0?'confirmed':'pending']);
  }
 }
 for(const name of ['refill_national_federation_professional_selection','sync_national_federation_championship_lineup','respond_to_national_federation_preselection','get_current_director_federation_callups','prepare_due_automatic_federation_professional_lineups','publish_national_federation_preselection']) {
  const row=baseline.find(row=>row.signature.startsWith(name+'(')||row.signature.startsWith('public.'+name+'('));
  assert.ok(row,`Missing baseline ${name}`); await db.exec(row.definition);
 }
 const migration=readFileSync('supabase/migrations/20261018090000_guard_federation_callup_eligibility.sql','utf8');
 await db.exec(migration); await db.exec(migration); checks++;
 await db.query("select set_config('test.uid',$1,false)",[id(11)]);
 const reason=async(member=3001,date=departure)=>(await db.query('select get_federation_callup_ineligibility_reason($1,$2) reason',[id(member),date])).rows[0].reason;
 const act=member=>db.query('select respond_to_national_federation_preselection($1,true)',[id(member)]);
 const callups=async()=>(await db.query('select * from get_current_director_federation_callups()')).rows;
 assert.equal((await callups()).filter(row=>row.can_respond).length,7); checks++;
 assert.equal(await reason(),null); checks++;
 for(const [change,restore,expected] of [
  ["update riders set status='retired' where id=$1","update riders set status='active' where id=$1",'rider_inactive'],
  [`update riders set country_id='${id(202)}' where id=$1`,`update riders set country_id='${id(201)}' where id=$1`,'nationality_changed'],
  ["update rider_contracts set status='terminated' where rider_id=$1","update rider_contracts set status='active' where rider_id=$1",'ownership_changed'],
 ]) {
  await db.query(change,[id(701)]); assert.equal(await reason(),expected);
  const visible=(await callups()).find(row=>row.member_id===id(3001));
  assert.equal(visible.can_respond,false); assert.equal(visible.response_status,'ineligible'); checks++;
  await db.query(restore,[id(701)]);
 }
 await db.query("insert into rider_injuries values($1,'active','2030-10-20','2030-10-22')",[id(701)]);
 assert.equal(await reason(),null); assert.equal(await reason(3001,null),'injury'); checks++;
 await db.exec("update rider_injuries set expected_recovery_at='2030-10-24'");
 assert.equal(await reason(),'injury');
 assert.equal((await callups()).find(row=>row.member_id===id(3001)).can_respond,false); checks++;
 await db.exec('delete from rider_injuries');
 await db.exec(`update international_nation_qualification_snapshots set is_qualified=false where country_id='${id(201)}'`);
 assert.equal(await reason(),'nation_unqualified'); checks++;
 await db.exec('update international_nation_qualification_snapshots set is_qualified=true');
 await db.exec(`update sporting_directors set status='inactive' where id='${id(1)}'`);
 assert.equal(await reason(),'ownership_changed'); checks++;
 await db.exec(`update sporting_directors set status='active' where id='${id(1)}'`);
 await db.query("select set_config('test.uid',$1,false)",[id(12)]); await assert.rejects(act(3001),/équipe/); checks++;
 await db.query("select set_config('test.uid',$1,false)",[id(11)]);
 await db.exec("select set_config('test.closed','yes',false)"); await assert.rejects(act(3001),/Date limite/); checks++;
 await db.exec("select set_config('test.closed','no',false)");
 for(let k=1;k<8;k++) { await act(3000+k); assert.equal((await db.query('select response_status from national_federation_selection_members where id=$1',[id(3000+k)])).rows[0].response_status,'confirmed'); checks++; }
 await assert.rejects(act(3001),/déjà été traitée/); checks++;
 // A later injury invalidates even a previously confirmed call-up and removes
 // its startlist entry, while the standard automatic refill calls a reserve.
 await db.query("insert into riders values($1,$2,'Réserve','Test','active')",[id(799),id(201)]);
 await db.query("insert into rider_contracts(rider_id,team_id,status) values($1,$2,'active')",[id(799),id(101)]);
 await db.query('insert into rider_season_ratings(rider_id,season_id) values($1,$2)',[id(799),id(301)]);
 await db.query("insert into rider_injuries values($1,'active','2030-10-20','2030-10-24')",[id(701)]);
 assert.equal((await db.query('select reconcile_federation_callup_eligibility() n')).rows[0].n,1); checks++;
 assert.equal((await db.query('select response_status from national_federation_selection_members where id=$1',[id(3001)])).rows[0].response_status,'ineligible'); checks++;
 assert.equal((await db.query("select count(*)::int n from race_rosters where rider_id=$1 and status in ('selected','confirmed')",[id(701)])).rows[0].n,0); checks++;
 assert.equal((await db.query("select response_status from national_federation_selection_members where professional_rider_id=$1 and selection_list_id=$2",[id(799),id(1000)])).rows[0].response_status,'pending'); checks++;
 assert.equal((await db.query('select reconcile_federation_callup_eligibility() n')).rows[0].n,0); checks++;
 // Invalid responses commit the invalidation instead of rolling it back.
 await db.query("update riders set status='retired' where id=$1",[id(799)]);
 const reserve=(await db.query('select id from national_federation_selection_members where professional_rider_id=$1 and selection_list_id=$2',[id(799),id(1000)])).rows[0].id;
 assert.equal((await db.query('select respond_to_national_federation_preselection($1,true) status',[reserve])).rows[0].status,'ineligible'); checks++;
 assert.equal((await db.query('select response_status from national_federation_selection_members where id=$1',[reserve])).rows[0].response_status,'ineligible'); checks++;
 // Juniors use the same ownership/nationality and 16–18 age boundary.
 await db.query("insert into national_federation_selection_lists(id,country_id,season_id,slot_key,status,published_at,updated_at) values($1,$2,$3,'cc-junior-road','pending_confirmation',now(),now())",[id(1100),id(201),id(301)]);
 await db.query("insert into youth_academy_riders values($1,$2,$3,-15,'active','Junior','Test')",[id(900),id(201),id(101)]);
 await db.query("insert into national_federation_selection_members(id,selection_list_id,owner_team_id,owner_director_id,junior_rider_id,response_status) values($1,$2,$3,$4,$5,'pending')",[id(3900),id(1100),id(101),id(1),id(900)]);
 assert.equal(await reason(3900),'junior_age'); checks++;
 await db.query('update youth_academy_riders set birth_game_year=-14 where id=$1',[id(900)]);
 assert.equal(await reason(3900),null); checks++;
 await db.query('update youth_academy_riders set team_id=$1 where id=$2',[id(102),id(900)]);
 assert.equal(await reason(3900),'ownership_changed'); checks++;
 // Publication must not create an actionable invitation for an invalid draft.
 await db.query("insert into national_federation_terms values($1,3,6,$2,'elected')",[id(201),id(1)]);
 await db.query("insert into national_federation_selection_members(id,selection_list_id,owner_team_id,owner_director_id,professional_rider_id,response_status) values($1,$2,$3,$4,$5,'draft')",[id(3999),id(1001),id(101),id(1),id(799)]);
 assert.equal((await db.query("select publish_national_federation_preselection('NL','cc-pro-itt') n")).rows[0].n,0); checks++;
 assert.equal((await db.query('select response_status from national_federation_selection_members where id=$1',[id(3999)])).rows[0].response_status,'ineligible'); checks++;
 await db.exec("insert into national_federation_selection_slots values('nc-hills','professional','nations_cup','Jeux','Vallons')");
 await db.query("insert into national_federation_selection_lists(id,country_id,season_id,slot_key,status,published_at,updated_at) values($1,$2,$3,'nc-hills','pending_confirmation',now(),now())",[id(1300),id(201),id(301)]);
 await db.query("insert into national_federation_selection_members(id,selection_list_id,owner_team_id,owner_director_id,professional_rider_id,response_status) values($1,$2,$3,$4,$5,'pending')",[id(4000),id(1300),id(101),id(1),id(703)]);
 await db.exec("select set_config('test.quota_zero','yes',false)");
 assert.equal(await reason(4000),'nation_unqualified'); checks++;
 await db.exec("select set_config('test.quota_zero','no',false)");
 assert.equal(await reason(4000),null); checks++;
 console.log(JSON.stringify({isolated:true,checks,allPassed:true,actualBaselineAndMigration:true,boundaries:'Calendar, conflict-priority and junior startlist helpers are synthetic. No production fixtures or participation decisions.'}));
} finally { await db.close(); }
