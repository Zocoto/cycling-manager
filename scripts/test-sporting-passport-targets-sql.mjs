// Every fixture runs exclusively in disposable in-memory PostgreSQL, never Supabase.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
if(!process.env.PASSPORT_SQL_TEST_MODULE) throw Error('An isolated PGlite module is required');
const {PGlite}=await import(pathToFileURL(process.env.PASSPORT_SQL_TEST_MODULE).href);
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let checks=0;
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const source=readFileSync('supabase/migrations/20260827110000_add_injury_care_items.sql','utf8');
const start=source.indexOf('create or replace function public.get_current_team_item_target_values()');
const original=source.slice(start,source.indexOf('$$;',start)+3);
const migration=readFileSync('supabase/migrations/20261022090000_expose_sporting_passport_eligible_targets.sql','utf8');
const roster=async()=> (await db.query('select public.get_current_team_item_target_values() as riders')).rows[0].riders;
try{
 await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('passport_test.user',true),'')::uuid $$;
 create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
 create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
 create table seasons(id uuid primary key,game_year int,status text,current_day_number int default 1);
 create table team_seasons(team_id uuid,season_id uuid,registration_country_id uuid,status text,primary key(team_id,season_id));
 create table countries(id uuid primary key,name text);
 create table riders(id uuid primary key,first_name text,last_name text,country_id uuid,status text,career_race_days int default 0,potential_steps int default 4);
 create table rider_contracts(rider_id uuid,team_id uuid,status text,start_season_id uuid,end_season_id uuid);
 create table rider_season_ratings(rider_id uuid,season_id uuid,mountain int default 60,hills int default 60,flat int default 60,time_trial int default 60,cobbles int default 60,sprint int default 60,acceleration int default 60,downhill int default 60,endurance int default 60,resistance int default 60,recovery int default 60,breakaway int default 60,prologue int default 60);
 create table season_days(id uuid primary key,season_id uuid,day_number int);
 create table rider_condition_states(rider_id uuid,season_day_id uuid,form numeric,updated_at timestamptz);
 create table rider_special_abilities(rider_id uuid,ability_code text);
 create table rider_injuries(id uuid primary key,rider_id uuid,diagnosis_code text,expected_recovery_at timestamptz,status text);
 create table rider_national_championship_titles(rider_id uuid,championship_type text,is_active bool,season_id uuid);
 create index rider_national_titles_rider_id_idx on rider_national_championship_titles(rider_id);
 insert into countries values('${id(1)}','Same translated name'),('${id(2)}','Same translated name');
 insert into seasons values('${id(3)}',4,'active',1),('${id(4)}',5,'planned',1);
 insert into sporting_directors values('${id(5)}','${id(6)}','active'),('${id(7)}','${id(8)}','active');
 insert into team_manager_assignments values('${id(5)}','${id(9)}','general_manager','active'),('${id(7)}','${id(10)}','general_manager','active');
 insert into team_seasons values('${id(9)}','${id(3)}','${id(1)}','active'),('${id(9)}','${id(4)}','${id(2)}','planned'),('${id(10)}','${id(3)}','${id(2)}','active');
 select set_config('passport_test.user','${id(6)}',false);`);
 for(let n=20;n<=27;n++){
   await db.query(`insert into riders(id,first_name,last_name,country_id,status) values($1,'Rider',$2,$3,$4)`,[id(n),String(n),id(n===21?1:2),n===26?'retired':'active']);
   await db.query(`insert into rider_contracts values($1,$2,'active',$3,$3)`,[id(n),id(n===25?10:9),id(3)]);
   await db.query(`insert into rider_season_ratings(rider_id,season_id) values($1,$2)`,[id(n),id(3)]);
 }
 // Past and current road/TT titles must both block, but world titles do not.
 await db.exec(`insert into rider_national_championship_titles values('${id(22)}','road',false,'${id(4)}'),('${id(23)}','time_trial',true,'${id(3)}'),('${id(24)}','world_road',true,'${id(3)}');
 update rider_contracts set status='expired' where rider_id='${id(27)}';`);
 await db.exec(original);
 await db.exec(`revoke all on function public.get_current_team_item_target_values() from public,anon;grant execute on function public.get_current_team_item_target_values() to authenticated,service_role;`);
 const before=await roster();
 await db.exec(migration);
 const after=await roster();
 check(after.map(row=>row.id),[20,21,22,23,24].map(id));
 check(after.map(row=>row.canNaturalizeWithPassport),[true,false,false,false,true]);
 check(after.map(({canNaturalizeWithPassport:flag,...rest})=>{assert.equal(typeof flag,'boolean');return rest;}),before);
 // No tenure restriction: the eligible rider has zero career days on J1.
 check(after[0].experienceDays,0);
 check(after[0].countryName,after[1].countryName); // IDs, never translated names.
 check((await db.query(`select has_function_privilege('anon','public.get_current_team_item_target_values()','execute') as anon,has_function_privilege('authenticated','public.get_current_team_item_target_values()','execute') as player`)).rows[0],{anon:false,player:true});
 await db.exec(`select set_config('passport_test.user','${id(8)}',false);`);
 check((await roster()).map(row=>[row.id,row.canNaturalizeWithPassport]),[[id(25),false]]);
 await db.exec(`select set_config('passport_test.user','',false);`);
 check(await roster(),[]);
 await db.exec(`select set_config('passport_test.user','${id(6)}',false);update riders set country_id='${id(1)}' where id='${id(20)}';`);
 check((await roster())[0].canNaturalizeWithPassport,false);
 await db.exec(`delete from team_seasons where season_id='${id(3)}';`);
 check((await roster()).map(row=>row.canNaturalizeWithPassport),[false,false,false,false,false]);
 check((await roster()).length,before.length); // Missing eligibility never hides other consumable targets.
 await assert.rejects(()=>db.exec(migration),/metadata already exists/);checks++;
 await db.exec('rollback');
 console.log(JSON.stringify({checks,isolated:true,productionFixtures:false}));
}finally{await db.close();}
