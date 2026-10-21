// PostgreSQL-in-WASM fixtures only; never connects to production.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const id=name=>{const h=createHash('md5').update(name).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
let checks=0;
const one=async(sql,args=[]) => (await db.query(sql,args)).rows[0];
const equal=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const eligible=async(day,preview=false)=>(await db.query('select race_edition_id from public.get_cyclogazette_human_race_editions($1,$2) order by race_edition_id',[id(day),preview])).rows.map(row=>row.race_edition_id);
async function edition(name,day='today',competition='road'){
 await db.query('insert into races values($1,$2)',[id('race:'+name),competition]);
 await db.query('insert into race_editions values($1,$2)',[id(name),id('race:'+name)]);
 await db.query('insert into stages values($1,$2,$3)',[id('stage:'+name),id(name),id(day)]);
 return id(name);
}
async function entry(name,race,{human=true,bot=false,authBot=false,managerStatus='active',role='general_manager',rosterStatus='confirmed',registrationStatus='accepted',resultStatus='finished',empty=false}={}){
 const team=id('team:'+name),director=id('director:'+name),user=human?id('user:'+name):null;
 await db.query('insert into sporting_directors values($1,$2)',[director,user]);
 await db.query('insert into team_manager_assignments values($1,$2,$3,$4)',[team,director,role,managerStatus]);
 if(bot||authBot)await db.query('insert into alpha_bot_managers values($1,$2)',[authBot?id('different-director:'+name):director,user]);
 await db.query('insert into team_seasons values($1,$2)',[id('ts:'+name),team]);
 await db.query('insert into race_registrations values($1,$2,$3,$4)',[id('reg:'+name),id(race),id('ts:'+name),registrationStatus]);
 if(!empty){
  await db.query('insert into race_rosters values($1,$2,$3)',[id('roster:'+name),id('reg:'+name),rosterStatus]);
  if(resultStatus)await db.query('insert into stage_results values($1,$2,$3)',[id('stage:'+race),id('roster:'+name),resultStatus]);
 }
 return {team,director,user,roster:id('roster:'+name)};
}
try{
 await db.exec(`create schema private;create role anon;create role authenticated;create role service_role;
 create table sporting_directors(id uuid primary key,auth_user_id uuid);
 create table alpha_bot_managers(sporting_director_id uuid unique,auth_user_id uuid unique);
 create table team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text);
 create table team_seasons(id uuid primary key,team_id uuid);
 create table races(id uuid primary key,competition_type text);
 create table race_editions(id uuid primary key,race_id uuid);
 create table stages(id uuid primary key,race_edition_id uuid,season_day_id uuid);
 create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid,status text);
 create table race_rosters(id uuid primary key,race_registration_id uuid,status text);
 create table stage_results(stage_id uuid,race_roster_id uuid,status text);
 create table race_results(id uuid primary key,race_edition_id uuid,race_roster_id uuid,created_at timestamptz,final_rank int);
 create table youth_academy_riders(id uuid primary key,team_id uuid);
 create table development_race_results(race_edition_id uuid,academy_rider_id uuid);
 `);
 await db.exec(await readFile('supabase/migrations/20261021100000_filter_gazette_races_without_human_participants.sql','utf8'));
 const mixed=await edition('mixed'),human=await entry('human','mixed'),aiWinner=await entry('ai-winner','mixed',{human:false});
 await edition('ai-only');await entry('ai','ai-only',{human:false});
 await edition('bot-only');await entry('bot','bot-only',{bot:true});
 await edition('auth-bot-only');await entry('auth-bot','auth-bot-only',{authBot:true});
 await edition('dns');await entry('dns-human','dns',{resultStatus:'did_not_start'});
 const dnf=await edition('dnf');await entry('dnf-human','dnf',{resultStatus:'did_not_finish',rosterStatus:'withdrawn'});
 const dsq=await edition('dsq');await entry('dsq-human','dsq',{resultStatus:'disqualified'});
 const timeLimit=await edition('time-limit');await entry('time-limit-human','time-limit',{resultStatus:'outside_time_limit'});
 await edition('no-starter');await entry('empty-human','no-starter',{empty:true});
 await edition('assistant');await entry('assistant-human','assistant',{role:'assistant'});
 await edition('inactive-manager');await entry('inactive-manager','inactive-manager',{managerStatus:'inactive'});
 equal(await eligible('today'),[mixed,dnf,dsq,timeLimit].sort(),'Only races actually involving humans; all non-finish reasons except DNS still count');
 equal(await eligible('unknown'),[],'No race for an unknown day');
 const upcoming=await edition('upcoming','tomorrow');await entry('upcoming-human','upcoming',{resultStatus:null,rosterStatus:'selected'});
 await edition('upcoming-bot','tomorrow');await entry('upcoming-bot','upcoming-bot',{bot:true,resultStatus:null});
 await edition('upcoming-pending','tomorrow');await entry('pending-human','upcoming-pending',{registrationStatus:'pending',resultStatus:null});
 await edition('upcoming-withdrawn','tomorrow');await entry('withdrawn-human','upcoming-withdrawn',{rosterStatus:'withdrawn',resultStatus:null});
 equal(await eligible('tomorrow'),[],'Selected riders alone are not actual participants');
 equal(await eligible('tomorrow',true),[upcoming],'Previews count accepted human entries with a real selected roster');
 await db.query('insert into stages values($1,$2,$3)',[id('later-stage'),mixed,id('next-tour-day')]);
 equal(await eligible('next-tour-day'),[mixed],'A human who started an earlier stage remains a participant in the tour');
 await db.query('insert into race_registrations values($1,$2,null,$3)',[id('detection-reg'),id('ai-only'),'accepted']);
 equal(await eligible('today'),[mixed,dnf,dsq,timeLimit].sort(),'Autogenerated detection teams do not count');
 // More recent AI-only winners must not exhaust the limit before filtering.
 await db.query('insert into race_results values($1,$2,$3,now()-interval \'1 day\',1)',[id('mixed-win'),mixed,aiWinner.roster]);
 for(let i=0;i<20;i++)await db.query('insert into race_results values($1,$2,$3,now(),1)',[id('ai-win:'+i),id('ai-only'),id('roster:ai')]);
 const winners=(await db.query('select * from public.get_cyclogazette_human_race_victories($1,1)',[[mixed]])).rows;
 equal(winners.length,1,'Human race survives twenty newer AI-only victories');
 equal(winners[0].race_roster_id,aiWinner.roster,'AI winner is preserved when humans took part');
 equal(Number(winners[0].total_count),1,'Filtered total is coherent');
 equal((await db.query('select * from public.get_cyclogazette_human_race_victories($1,12)',[[]])).rows,[],'Empty allowlist never returns global victories');
 const nationals=await edition('nationals','today','national_road');await entry('national-human','nationals');
 await db.query('insert into race_results values($1,$2,$3,now(),1)',[id('national-win'),nationals,id('roster:national-human')]);
 equal((await db.query('select * from public.get_cyclogazette_human_race_victories($1,12)',[[nationals]])).rows,[],'Existing national-title victory rule remains intact');
 // A race with one real academy rider is covered even if an AI junior wins.
 await db.query('insert into youth_academy_riders values($1,$2),($3,$4)',[id('junior-human'),human.team,id('junior-bot'),id('team:bot')]);
 await db.query('insert into development_race_results values($1,$2),($1,null),($3,null),($4,$5)',[id('dev-mixed'),id('junior-human'),id('dev-ai'),id('dev-bot'),id('junior-bot')]);
 const juniorIds=(await db.query('select * from public.get_cyclogazette_human_development_editions($1)',[[id('dev-mixed'),id('dev-mixed'),id('dev-ai'),id('dev-bot')]])).rows.map(row=>row.race_edition_id);
 equal(juniorIds,[id('dev-mixed')],'Junior races filter AI/bots and deduplicate');
 for(const signature of ['public.get_cyclogazette_human_race_editions(uuid,boolean)','public.get_cyclogazette_human_race_victories(uuid[],integer)','public.get_cyclogazette_human_development_editions(uuid[])']){
  equal((await one("select has_function_privilege('anon',$1,'execute') allowed",[signature])).allowed,false,'No anonymous access');
  equal((await one("select has_function_privilege('authenticated',$1,'execute') allowed",[signature])).allowed,false,'No player access to editorial queries');
  equal((await one("select has_function_privilege('service_role',$1,'execute') allowed",[signature])).allowed,true,'Publication worker permitted');
 }
 console.log(`Isolated Gazette human-participation SQL: ${checks} checks passed.`);
}catch(error){console.error(error.stack??error);process.exitCode=1;}finally{await db.close();}
