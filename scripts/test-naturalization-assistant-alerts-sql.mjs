// Disposable in-memory PostgreSQL only. Never connects to Supabase.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
if(!process.env.NATURALIZATION_SQL_TEST_MODULE)throw Error('An isolated PGlite module is required');
const {PGlite}=await import(pathToFileURL(process.env.NATURALIZATION_SQL_TEST_MODULE).href);
const db=new PGlite();const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const migration=readFileSync('supabase/migrations/20261022100000_add_naturalization_assistant_alerts.sql','utf8');
let checks=0;const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const alerts=(director=5,team=9,day=8)=>scalar('select private.get_dashboard_naturalization_alerts($1,$2,$3,5,$4)',[id(director),id(team),id(3),day]);
const contains=(rows,n)=>rows.some(row=>row.subjectId===id(n));
const ignore=(kind,n,country=1)=>db.query('select public.ignore_current_naturalization_alert($1,$2,$3)',[kind,id(n),id(country)]);
const reject=async(action,pattern)=>{await assert.rejects(action,pattern);checks++;};
try{
 await db.exec(`create schema auth;create schema private;create role anon;create role authenticated;create role service_role;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('naturalization_test.user',true),'')::uuid$$;
 create table countries(id uuid primary key,name text,is_active bool default true);
 create table teams(id uuid primary key,status text default 'active');
 create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
 create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
 create table seasons(id uuid primary key,game_year int,status text,current_day_number int default 8);
 create table team_seasons(team_id uuid,season_id uuid,registration_country_id uuid,status text,primary key(team_id,season_id));
 create table riders(id uuid primary key,first_name text,last_name text,country_id uuid,status text);
 create table rider_contracts(rider_id uuid,team_id uuid,status text,start_season_id uuid,end_season_id uuid);
 create table rider_national_championship_titles(rider_id uuid,championship_type text,is_active bool);
 create table rider_naturalization_country_progress(rider_id uuid,country_id uuid,accumulated_days int default 0,active_since_season_id uuid,active_since_day_number int,required_days_override int,primary key(rider_id,country_id));
 create table youth_academy_riders(id uuid primary key,team_id uuid,first_name text,last_name text,country_id uuid,status text,naturalization_country_id uuid,naturalization_started_season_id uuid,naturalization_started_day_number int,promoted_rider_id uuid);
 create table junior_championship_titles(academy_rider_id uuid,title_level text,championship_type text);
 create table isolated_naturalization_rates(team_id uuid primary key,pro_days int,youth_days int);
 create function public.get_team_professional_naturalization_days(uuid) returns int language sql stable as $$select pro_days from public.isolated_naturalization_rates where team_id=$1$$;
 create function public.get_team_youth_naturalization_days(uuid) returns int language sql stable as $$select youth_days from public.isolated_naturalization_rates where team_id=$1$$;
 insert into countries(id,name) values('${id(1)}','Belgique'),('${id(2)}','France'),('${id(11)}','Espagne');
 insert into teams(id) values('${id(9)}'),('${id(10)}');
 insert into seasons(id,game_year,status) values('${id(3)}',5,'active'),('${id(4)}',4,'completed'),('${id(12)}',6,'planned');
 insert into team_seasons values('${id(9)}','${id(3)}','${id(1)}','active'),('${id(10)}','${id(3)}','${id(2)}','active'),('${id(9)}','${id(12)}','${id(2)}','planned');
 insert into sporting_directors values('${id(5)}','${id(6)}','active'),('${id(7)}','${id(8)}','active');
 insert into team_manager_assignments values('${id(5)}','${id(9)}','general_manager','active'),('${id(7)}','${id(10)}','general_manager','active');
 insert into isolated_naturalization_rates values('${id(9)}',84,28),('${id(10)}',84,28);
 select set_config('naturalization_test.user','${id(6)}',false);`);
 const progressSource=readFileSync('supabase/migrations/20260809120000_secure_rider_career_transitions.sql','utf8');
 for(const name of ['get_game_day_ordinal','get_rider_country_progress_days']){
   const start=progressSource.indexOf(`create or replace function public.${name}(`);
   await db.exec(progressSource.slice(start,progressSource.indexOf('$$;',start)+3));
 }
 await db.exec(`create function public.get_current_dashboard_assistant_summary() returns table(game_date date,journal_items jsonb)
 language sql stable security definer set search_path='' set statement_timeout='3000ms' as $$
 with current_context as(select director.id as sporting_director_id,assignment.team_id,season.id as season_id,season.game_year,season.current_day_number
 from public.sporting_directors director join public.team_manager_assignments assignment on assignment.sporting_director_id=director.id and assignment.status='active'
 join public.seasons season on season.status='active' where director.auth_user_id=auth.uid())
 select current_date,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('title','Existing mail')),
 'physiotherapistOpportunity',jsonb_build_object('freeSlotCount',2),'equipmentPartnerSignatureAvailable', (select true))
 from current_context $$;
 revoke all on function public.get_current_dashboard_assistant_summary() from public,anon;
 grant execute on function public.get_current_dashboard_assistant_summary() to authenticated;`);
 for(let n=20;n<=31;n++){
   await db.query(`insert into riders values($1,'Pro',$2,$3,$4)`,[id(n),String(n),id(n===21?1:2),n===28?'retired':'active']);
   await db.query('insert into rider_contracts values($1,$2,$3,$4,$5)',[id(n),id(n===26?10:9),n===31?'expired':'active',id(n===27?12:3),id(n===27?12:3)]);
   await db.query('insert into rider_naturalization_country_progress(rider_id,country_id,accumulated_days,required_days_override) values($1,$2,$3,$4)',[id(n),id(1),n===25?28:n===30?0:84,n===25?28:n===30?0:null]);
 }
 await db.exec(`update rider_naturalization_country_progress set accumulated_days=56,active_since_season_id='${id(4)}',active_since_day_number=8 where rider_id='${id(20)}';
 update rider_naturalization_country_progress set accumulated_days=56,active_since_season_id='${id(4)}',active_since_day_number=9 where rider_id='${id(24)}';
 insert into rider_national_championship_titles values('${id(22)}','road',false),('${id(23)}','time_trial',true),('${id(29)}','world_road',true);
 insert into rider_contracts select * from rider_contracts where rider_id='${id(20)}';`);
 for(let n=50;n<=60;n++){
   await db.query('insert into youth_academy_riders values($1,$2,\'Junior\',$3,$4,$5,$6,$7,$8,null)',[
     id(n),id(n===58?10:9),String(n),id(n===51?1:2),n===57?'release_pending':'active',
     id(n===56?2:1),n===55?null:id(4),n===55?null:n===52?9:8]);
 }
 await db.exec(`insert into junior_championship_titles values('${id(53)}','national','road'),('${id(59)}','national','time_trial'),('${id(54)}','world','road');`);
 const previous=await scalar('select journal_items from public.get_current_dashboard_assistant_summary()');
 await db.exec(migration);
 const initial=await alerts();
 check(initial.map(row=>row.subjectId),[20,25,29,30,50,54,60].map(id));
 const payload=await scalar('select journal_items from public.get_current_dashboard_assistant_summary()');
 const {naturalizationAlerts,...otherPayload}=payload;check(otherPayload,previous);check(naturalizationAlerts,initial);
 check((await db.query(`select has_function_privilege('anon','public.ignore_current_naturalization_alert(text,uuid,uuid)','execute') as anon,
 has_function_privilege('authenticated','public.ignore_current_naturalization_alert(text,uuid,uuid)','execute') as player,
 has_function_privilege('authenticated','private.get_dashboard_naturalization_alerts(uuid,uuid,uuid,integer,integer)','execute') as private_helper,
 has_table_privilege('authenticated','private.dashboard_naturalization_dismissals','select') as private_table`)).rows[0],{anon:false,player:true,private_helper:false,private_table:false});
 for(const row of initial.filter(row=>row.subjectType==='professional'))check(row.elapsedDays,Number(await scalar('select coalesce(public.get_rider_country_progress_days($1,$2,$3,8),0)',[row.subjectId,id(1),id(3)])));
 check(initial.find(row=>row.subjectId===id(25)).requiredDays,28); // Promotion carry-over override.
 check(contains(await alerts(5,9,9),24),true);check(contains(await alerts(5,9,9),52),true); // Exact day boundary.
 await db.exec(`update isolated_naturalization_rates set pro_days=28,youth_days=0 where team_id='${id(9)}'`);
 check(contains(await alerts(),24),true);check(contains(await alerts(),55),true);check(contains(await alerts(),56),true);
 await db.exec(`update isolated_naturalization_rates set pro_days=84,youth_days=28 where team_id='${id(9)}'`);
 await ignore('professional',20);check(contains(await alerts(),20),false);check(contains(await alerts(),25),true);
 check(contains(await alerts(5,9,9),20),false); // Tomorrow does not reset the saved preference.
 await ignore('professional',20);check(Number(await scalar('select count(*) from private.dashboard_naturalization_dismissals')),1);
 await reject(()=>ignore('professional',26),/ne fait plus partie/);
 await reject(()=>ignore('youth',58),/ne fait plus partie/);
 await reject(()=>ignore('youth',20),/ne fait plus partie/);
 await reject(()=>ignore('staff',20),/invalide/);
 await reject(()=>ignore('professional',25,2),/ne correspond plus/);
 await db.exec(`select set_config('naturalization_test.user','',false)`);await reject(()=>ignore('professional',25),/session/);
 await db.exec(`select set_config('naturalization_test.user','${id(6)}',false)`);
 await ignore('youth',60);check(contains(await alerts(),60),false);check(contains(await alerts(),50),true);
 await db.exec(`update youth_academy_riders set status='promoted',promoted_rider_id='${id(40)}' where id='${id(60)}';
 insert into riders values('${id(40)}','Promoted','Junior','${id(2)}','active');
 insert into rider_contracts values('${id(40)}','${id(9)}','active','${id(3)}','${id(3)}');
 insert into rider_naturalization_country_progress(rider_id,country_id,accumulated_days,required_days_override) values('${id(40)}','${id(1)}',28,28)`);
 check(contains(await alerts(),40),false); // Ignoring the junior survives promotion.
 check(contains(await alerts(7),20),true); // A different DS does not inherit this preference.
 await db.exec(`insert into rider_naturalization_country_progress(rider_id,country_id,accumulated_days) values('${id(20)}','${id(11)}',84);
 update team_seasons set registration_country_id='${id(11)}' where team_id='${id(9)}' and season_id='${id(3)}'`);
 check(contains(await alerts(),20),true); // A genuinely new target country is not silently suppressed.
 await db.exec(`update team_seasons set registration_country_id='${id(1)}' where team_id='${id(9)}' and season_id='${id(3)}';
 update riders set country_id='${id(1)}' where id='${id(25)}'`);
 check(contains(await alerts(),25),false); // Manual naturalization removes the opportunity.
 check(await scalar('select country_id from riders where id=$1',[id(20)]),id(2)); // Ignoring never naturalizes.
 check(await scalar('select country_id from youth_academy_riders where id=$1',[id(60)]),id(2));
 check(Number(await scalar('select count(*) from private.dashboard_naturalization_dismissals')),2);
 console.log(JSON.stringify({checks,isolated:true,productionFixtures:false}));
}catch(error){console.error(JSON.stringify({message:error.message,code:error.code,where:error.where}));process.exitCode=1;}
finally{await db.close();}
