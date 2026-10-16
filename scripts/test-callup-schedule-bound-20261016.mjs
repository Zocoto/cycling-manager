// Isolated fixtures only: no network, credentials or live gameplay.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const base=readFileSync('supabase/migrations/20261004083000_split_federation_selection_and_callup_deadlines.sql','utf8');
const functionStart=base.indexOf('create or replace function public.get_current_director_federation_callups()');
assert.ok(functionStart>=0);
const source=base.slice(functionStart,base.indexOf('$$;',functionStart)+3);
const migration=readFileSync('supabase/migrations/20261016160000_bound_federation_callup_schedule_work.sql','utf8');
try {
 await db.exec(`create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table sporting_directors(id uuid,auth_user_id uuid,status text);
 create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
 create table national_federation_selection_members(id uuid,selection_list_id uuid,owner_team_id uuid,owner_director_id uuid,professional_rider_id uuid,junior_rider_id uuid,response_status text,created_at timestamptz);
 create table national_federation_selection_lists(id uuid,country_id uuid,season_id uuid,slot_key text,published_at timestamptz);
 create table seasons(id uuid,status text);create table countries(id uuid,iso_alpha2 text,name text);
 create table national_federation_selection_slots(slot_key text,competition_code text,rider_category text);
 create table race_editions(id uuid,race_id uuid,season_id uuid,display_name text,status text);
 create table development_race_editions(id uuid,status text);
 create table riders(id uuid,first_name text,last_name text);
 create table youth_academy_riders(id uuid,first_name text,last_name text);
 create table race_rosters(rider_id uuid,race_registration_id uuid,status text);
 create table race_registrations(id uuid,race_edition_id uuid,status text);
 create table races(id uuid,competition_type text,championship_continent_code text);
 create table stages(race_edition_id uuid,season_day_id uuid,day_slot text);
 create sequence schedule_calls;
 create sequence publication_sync_calls;
 create function sync_national_federation_championship_lineup(uuid) returns integer language plpgsql as $$begin perform nextval('public.publication_sync_calls');return 1;end$$;
 create function publish_national_federation_preselection(text,text) returns integer language plpgsql as $$declare v_notified integer:=4;v_list record;begin select '${id(1000)}'::uuid id into v_list;
  return v_notified;
end$$;
 create function public.get_national_federation_selection_schedule(uuid,uuid)
 returns table(slot_key text,label text,rider_category text,race_edition_id uuid,race_href text,departure_at timestamptz)
 language plpgsql volatile as $$begin perform nextval('public.schedule_calls');return query
 select s.slot_key,s.slot_key,s.rider_category,
 case when s.rider_category='junior' then '${id(401)}'::uuid else '${id(400)}'::uuid end,
 '/race/'||s.slot_key,'2030-10-20T12:00:00Z'::timestamptz
 from public.national_federation_selection_slots s;end$$;
 create function get_national_federation_callup_response_closes_at(text,text,timestamptz) returns timestamptz language sql stable as $$select $3-interval '1 hour'$$;
 insert into sporting_directors values('${id(1)}','${id(11)}','active'),('${id(2)}','${id(12)}','active');
 insert into team_manager_assignments values('${id(1)}','${id(101)}','general_manager','active'),('${id(2)}','${id(102)}','general_manager','active');
 insert into countries values('${id(201)}','FR','France'),('${id(202)}','BE','Belgique');
 insert into seasons values('${id(301)}','active'),('${id(302)}','completed');
 insert into national_federation_selection_slots values('pro','continental_championship','professional'),('junior','world_championship_junior','junior');
 insert into race_editions values('${id(400)}','${id(500)}','${id(301)}','Target','scheduled'),('${id(402)}','${id(502)}','${id(301)}','Other race','scheduled');
 insert into development_race_editions values('${id(401)}','scheduled');
 insert into races values('${id(500)}','continental_championship','EU'),('${id(502)}','tour',null);
 insert into stages values('${id(400)}','${id(600)}','late'),('${id(402)}','${id(600)}','late');
 insert into race_rosters values('${id(700)}','${id(800)}','confirmed');
 insert into race_registrations values('${id(800)}','${id(402)}','accepted');
 `);
 for(let n=0;n<25;n++) {
  await db.query('insert into national_federation_selection_lists values($1,$2,$3,$4,now())',[id(1000+n),id(n<20?201:202),id(n===24?302:301),n%2?'junior':'pro']);
  await db.query('insert into national_federation_selection_members values($1,$2,$3,$4,$5,$6,$7,now())',
   [id(2000+n),id(1000+n),id(n===23?102:101),id(n===23?2:1),n%2?null:id(700+n),n%2?id(700+n):null,n===22?'draft':n===21?'declined':n===20?'confirmed':'pending']);
  await db.query(`insert into ${n%2?'youth_academy_riders':'riders'} values($1,'Rider',$2)`,[id(700+n),String(n)]);
 }
 await db.exec(source);
 const get=async user=>{await db.query("select set_config('test.uid',$1,false)",[user]);return (await db.query('select * from get_current_director_federation_callups()')).rows;};
 const before=await get(id(11));
 const otherBefore=await get(id(12));
 assert.equal(before.length,22);assert.equal(otherBefore.length,1);
 assert.deepEqual(before.find(r=>r.rider_id===id(700)).conflicting_race_names,['Other race']);
 await db.exec(migration);
 assert.equal((await db.query("select publish_national_federation_preselection('FR','pro') result")).rows[0].result,4,'Notification count unchanged');
 assert.equal((await db.query('select last_value from publication_sync_calls')).rows[0].last_value,1,'Only the published selection is synchronized once');
 await db.exec('alter sequence schedule_calls restart with 1');
 const after=await get(id(11));
 assert.deepEqual(after,before,'Every invitation, deadline, conflict and response flag must be identical');
 assert.equal((await db.query('select last_value from schedule_calls')).rows[0].last_value,2,'Only two distinct country/season calculations for 22 invitations');
 assert.deepEqual(await get(id(12)),otherBefore,'Other director remains isolated');
 assert.deepEqual(await get(id(99)),[],'Unknown player sees no invitations');
 assert.deepEqual(await get(''),[],'Anonymous caller sees no invitations');
 await db.exec(migration);
 assert.deepEqual(await get(id(11)),before,'Reapplying migration is idempotent');
 console.log(JSON.stringify({isolated:true,checks:11,invitations:22,scheduleCalculations:2,allPassed:true}));
} finally {await db.close();}
