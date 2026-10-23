// Isolated SQL fixtures only. Never uses HTTP, credentials or the live database.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
if(!process.argv[2]?.replaceAll('\\','/').endsWith('/pglite/dist/index.js'))throw Error('Isolated PGlite module required');
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let checks=0;
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const check=(value,expected)=>{assert.deepEqual(value,expected);checks++;};
const denied=async(sql,args=[])=>{await assert.rejects(()=>db.query(sql,args));checks++;};
const source=readFileSync('supabase/migrations/20261023173000_open_season_four_gala_registrations.sql','utf8');
const selection=(program='world-tour',start=100)=>Object.fromEntries(['mountain','hills',program==='world-tour'?'cobbles':'sprint'].map(profile=>[profile,Array.from({length:7},(_,i)=>id(start+i))]));
const save=(program,rows)=>scalar('select save_current_season_four_gala_registration($1,$2::jsonb)',[program,JSON.stringify(rows)]);
const login=uid=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid??'']);
try{
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;create role service_role bypassrls;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table seasons(id uuid primary key,game_year int unique,status text);
 create table teams(id uuid primary key,status text);
 create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,display_name text);
 create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
 create table team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text,start_season_id uuid,end_season_id uuid);
 create table riders(id uuid primary key,first_name text,last_name text,status text);
 create table rider_season_ratings(rider_id uuid,season_id uuid,mountain numeric,hills numeric,flat numeric,time_trial numeric,cobbles numeric,sprint numeric);
 create table rider_contracts(id uuid primary key,rider_id uuid,team_id uuid,start_season_id uuid,end_season_id uuid,left_season_id uuid,status text,joined_day_number int,signed_at timestamptz);
 create table team_sponsor_contracts(id uuid primary key,team_id uuid,start_season_id uuid,end_season_id uuid,status text,signed_at timestamptz,selected_jersey_id text);
 create table season_gala_result_imports(season_id uuid,event_key text);
 create table untouched_game(form int,cash int,points int);insert into untouched_game values(73,125000,150);
 insert into seasons values('${id(1)}',4,'active'),('${id(2)}',5,'planned');`);
 await db.exec(readFileSync('supabase/migrations/20261022220000_prepare_private_season_gala_startlists.sql','utf8'));
 const guards=readFileSync('supabase/migrations/20261023120000_prepare_season_four_gala_rewards.sql','utf8');
 await db.exec(guards.slice(guards.indexOf('create function public.guard_season_four_gala_registration()'),guards.indexOf('create function public.settle_season_four_gala_results(')));
 await db.exec(source);
 await db.exec(readFileSync('supabase/migrations/20261023190000_gala_course_by_course_registrations.sql','utf8'));
 check(await scalar("select timestamptz '2026-11-05 23:59 Europe/Paris'=timestamptz '2026-11-05 22:59Z'"),true);
 check(source.includes("now() < timestamptz '2026-11-05 23:59:00 Europe/Paris'"),true);
 // Controlled test clock, never installed in production.
 await db.exec(`create or replace function private.season_four_gala_is_open() returns boolean language sql stable set search_path='' as $$select true$$;`);
 for(const team of [10,11]){
  await db.exec(`insert into teams values('${id(team)}','active');insert into team_seasons values('${id(team+10)}','${id(team)}','${id(1)}','Club ${team}');insert into sporting_directors values('${id(team+20)}','${id(team+30)}','active');insert into team_manager_assignments values('${id(team)}','${id(team+20)}','general_manager','active','${id(1)}',null);`);
  for(let index=0;index<8;index++){
   const rider=100+(team-10)*20+index;
   await db.exec(`insert into riders values('${id(rider)}','Rider','${rider}','active');insert into rider_season_ratings values('${id(rider)}','${id(1)}',70,70,70,70,70,70);insert into rider_contracts values('${id(rider+1000)}','${id(rider)}','${id(team)}','${id(1)}','${id(2)}',null,'active',1,now());`);
  }
 }
 for(const role of ['anon','authenticated']){
  check(await scalar(`select has_table_privilege('${role}','season_gala_registrations','insert')`),false);
  check(await scalar(`select has_table_privilege('${role}','season_gala_registration_riders','select')`),false);
 }
 check(await scalar("select has_function_privilege('anon','save_current_season_four_gala_registration(text,jsonb)','execute')"),false);
 check(await scalar("select has_function_privilege('authenticated','private.season_four_gala_roster(uuid)','execute')"),false);
 check(await scalar("select has_function_privilege('authenticated','save_current_season_four_gala_registration(text,jsonb)','execute')"),true);
 await login(null);await denied('select get_current_season_four_gala_context()');await denied("select get_season_four_gala_entries('world-tour','mountain',0)");
 await login(id(41));await save('continental',selection('continental',120));
 await login(id(40));
 const first=await save('world-tour',selection());
 await db.exec('set role authenticated');
 check(await save('world-tour',selection()),first);
 await db.exec('reset role');
 check(await scalar('select count(*)::int from season_gala_registration_riders where registration_id=$1',[first]),21);
 check(await save('world-tour',selection()),first);
 check(await scalar('select count(*)::int from season_gala_registration_riders where registration_id=$1',[first]),21);
 const context=await scalar('select get_current_season_four_gala_context()');
 check(context.riders.length,8);check(context.team.id,id(10));check(context.counts,{'world-tour':1,continental:1});
 check(context.riders.some(r=>r.rider_id===id(120)),false);
 await denied('select save_current_season_four_gala_registration($1,$2::jsonb)',['world-tour',JSON.stringify({...selection(),sprint:selection().mountain})]);
 for(const rows of [{...selection(),mountain:selection().mountain.slice(0,6)},{...selection(),mountain:Array(7).fill(id(100))},{...selection(),mountain:[...selection().mountain.slice(0,6),id(120)]},{...selection(),mountain:Array(7).fill('not-a-uuid')},{...selection(),mountain:Array(7).fill(null)}]) await denied('select save_current_season_four_gala_registration($1,$2::jsonb)',['world-tour',JSON.stringify(rows)]);
 check(await scalar('select program from season_gala_registrations where id=$1',[first]),'world-tour');
 await db.exec(`update rider_season_ratings set hills=75.001 where rider_id='${id(100)}';`);
 await denied('select save_current_season_four_gala_registration($1,$2::jsonb)',['continental',JSON.stringify(selection('continental'))]);
 check(await scalar('select count(*)::int from season_gala_registration_riders where registration_id=$1',[first]),21);
 await db.exec(`update rider_season_ratings set hills=75 where rider_id='${id(100)}';`);
 check(await save('continental',selection('continental')),first);
 check(await scalar("select count(*)::int from season_gala_registration_riders where registration_id=$1 and profile='cobbles'",[first]),0);
 check(await scalar("select count(*)::int from season_gala_registration_riders where registration_id=$1 and profile='sprint'",[first]),7);
 // Latest eligible S4 contract must win, even against the original team's contract.
 await db.exec(`insert into rider_contracts values('${id(9999)}','${id(100)}','${id(11)}','${id(1)}','${id(2)}',null,'active',15,now());`);
 await denied('select save_current_season_four_gala_registration($1,$2::jsonb)',['world-tour',JSON.stringify(selection())]);
 await db.exec(`delete from rider_contracts where id='${id(9999)}';`);
 await db.exec(`insert into season_gala_result_imports values('${id(1)}','world-tour:mountain');`);
 await denied('select save_current_season_four_gala_registration($1,$2::jsonb)',['world-tour',JSON.stringify(selection())]);
 check(await scalar('select program from season_gala_registrations where id=$1',[first]),'continental');
 await db.exec('delete from season_gala_result_imports');
 const entries=await scalar("select get_season_four_gala_entries('continental','sprint',0)");
 check(entries.total,2);check(entries.teams.length,2);check('mountain' in entries.teams[0].riders[0],false);
 check(entries.favorites,[]);
 await denied("select get_season_four_gala_entries('continental','cobbles',0)");await denied("select get_season_four_gala_entries('continental','sprint',-1)");
 // More entrants than PCM's native capacity remain accepted and paginated.
 for(let i=0;i<21;i++)await db.exec(`insert into teams values('${id(500+i)}','active');insert into team_seasons values('${id(600+i)}','${id(500+i)}','${id(1)}','Page ${i}');insert into season_gala_registrations(season_id,team_id,program) values('${id(1)}','${id(500+i)}','continental');insert into season_gala_registration_riders select r.id,'sprint',rider_id,row_number() over() from season_gala_registrations r cross join (select id rider_id from riders order by id limit 7) riders where r.team_id='${id(500+i)}';`);
 check(await save('continental',selection('continental')),first);
 const page=await scalar("select get_season_four_gala_entries('continental','sprint',0)");check(page.teams.length,20);check(page.hasMore,true);
 check((await scalar("select get_season_four_gala_entries('continental','sprint',1)")).teams.length,3);
 await db.exec(`create or replace function private.season_four_gala_is_open() returns boolean language sql stable set search_path='' as $$select false$$;`);
 await denied('select save_current_season_four_gala_registration($1,$2::jsonb)',['world-tour',JSON.stringify(selection())]);await denied('select withdraw_current_season_four_gala_registration()');
 check((await scalar('select get_current_season_four_gala_context()')).isOpen,false);
 const finalEntries=await scalar("select get_season_four_gala_entries('continental','sprint',0)");
 check(finalEntries.favorites.length,3);check('score' in finalEntries.favorites[0],false);
 await db.exec(`create or replace function private.season_four_gala_is_open() returns boolean language sql stable set search_path='' as $$select true$$;`);
 await db.query('select withdraw_current_season_four_gala_registration()');
 check(await scalar('select count(*)::int from season_gala_registrations where team_id=$1',[id(10)]),0);
 check(await scalar('select count(*)::int from season_gala_registration_riders where registration_id=$1',[first]),0);
 check(await scalar('select count(*)::int from season_gala_registrations where team_id=$1',[id(11)]),1);
 // Independent course writes: first save, replacement and withdrawal must never
 // rewrite another profile, another club or any sporting/financial state.
 const saveCourse=(program,profile,riders)=>scalar('select save_current_season_four_gala_course($1,$2,$3::uuid[])',[program,profile,riders]);
 const changeProgram=(program,previous)=>scalar('select change_current_season_four_gala_program($1,$2)',[program,previous]);
 const ownIds=selection().mountain;
 const roster=profile=>scalar("select coalesce(jsonb_agg(rider_id order by position),'[]') from season_gala_registration_riders where registration_id=(select id from season_gala_registrations where team_id=$1) and profile=$2",[id(10),profile]);
 for(const name of ['save_current_season_four_gala_course(text,text,uuid[])','change_current_season_four_gala_program(text,text)']) {
  check(await scalar('select has_function_privilege($1,$2,$3)',['anon',name,'execute']),false);
  check(await scalar('select has_function_privilege($1,$2,$3)',['authenticated',name,'execute']),true);
 }
 await login(null);await denied("select save_current_season_four_gala_course('world-tour','mountain',$1::uuid[])",[ownIds]);await denied("select change_current_season_four_gala_program('world-tour',null)");
 await login(id(40));await db.exec('set role authenticated');
 const partial=await saveCourse('world-tour','mountain',ownIds);
 await db.exec('reset role');
 check(await roster('mountain'),ownIds);check(await roster('hills'),[]);
 check((await scalar("select get_season_four_gala_entries('world-tour','mountain',0)")).total,1);
 check((await scalar("select get_season_four_gala_entries('world-tour','hills',0)")).total,0);
 check((await scalar('select get_current_season_four_gala_context()')).courseCounts['world-tour:mountain'],1);
 check(await saveCourse('world-tour','hills',[...ownIds,id(107)]),partial);
 check(await roster('hills'),[...ownIds,id(107)]);check(await roster('mountain'),ownIds);
 const revised=ownIds.slice(1).concat(id(107));
 await saveCourse('world-tour','hills',revised);check(await roster('hills'),revised);check(await roster('mountain'),ownIds);
 await saveCourse('world-tour','hills',[]);check(await roster('hills'),[]);check(await roster('mountain'),ownIds);
 await denied("select save_current_season_four_gala_course('continental','sprint',$1::uuid[])",[ownIds]);
 await denied("select change_current_season_four_gala_program('continental','continental')");check(await roster('mountain'),ownIds);
 await changeProgram('continental','world-tour');check(await roster('mountain'),[]);
 check((await scalar("select get_season_four_gala_entries('continental','mountain',0)")).teams.some(team=>team.teamId===id(10)),false);
 await saveCourse('continental','mountain',ownIds);
 await denied("select save_current_season_four_gala_course('continental','cobbles',$1::uuid[])",[ownIds]);
 for(const invalid of [ownIds.slice(0,6),[...ownIds,id(107),id(120)],Array(7).fill(id(100)),[...ownIds.slice(1),id(120)],[...ownIds.slice(1),null]])
  await denied("select save_current_season_four_gala_course('continental','mountain',$1::uuid[])",[invalid]);
 await db.exec(`update rider_season_ratings set hills=75.001 where rider_id='${id(100)}';`);
 await denied("select save_current_season_four_gala_course('continental','mountain',$1::uuid[])",[ownIds]);check(await roster('mountain'),ownIds);
 await db.exec(`update rider_season_ratings set hills=75 where rider_id='${id(100)}';insert into rider_contracts values('${id(9999)}','${id(100)}','${id(11)}','${id(1)}','${id(2)}',null,'active',15,now());`);
 await denied("select save_current_season_four_gala_course('continental','mountain',$1::uuid[])",[ownIds]);check(await roster('mountain'),ownIds);
 await db.exec(`delete from rider_contracts where id='${id(9999)}';insert into season_gala_result_imports values('${id(1)}','continental:mountain');`);
 await denied("select save_current_season_four_gala_course('continental','mountain',$1::uuid[])",[revised]);
 await denied("select save_current_season_four_gala_course('continental','mountain','{}'::uuid[])");
 await denied("select change_current_season_four_gala_program('world-tour','continental')");check(await roster('mountain'),ownIds);
 await db.exec(`delete from season_gala_result_imports;create or replace function private.season_four_gala_is_open() returns boolean language sql stable set search_path='' as $$select false$$;`);
 await denied("select save_current_season_four_gala_course('continental','hills',$1::uuid[])",[ownIds]);
 await denied("select change_current_season_four_gala_program('world-tour','continental')");
 check(await scalar('select count(*)::int from season_gala_registration_riders where registration_id=$1',[partial]),7);
 check(await scalar('select count(*)::int from season_gala_registration_riders where registration_id=(select id from season_gala_registrations where team_id=$1)',[id(11)]),21);
 check((await db.query('select * from untouched_game')).rows,[{form:73,cash:125000,points:150}]);
 console.log(`${checks} isolated gala registration SQL checks passed; no production fixtures.`);
}finally{await db.close();}
