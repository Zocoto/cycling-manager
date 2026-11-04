// Actual SQL engines in isolated PostgreSQL only. No network or environment files.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();let checks=0;
const id=label=>{const s=createHash('md5').update(label).digest('hex');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;};
const read=name=>readFileSync(`supabase/migrations/${name}.sql`,'utf8').replaceAll('\r','');
const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
const scalar=async(sql,args=[]) => Object.values((await query(sql,args))[0])[0];
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
function definition(source,name){
 const match=new RegExp(`create (?:or replace )?function public\\.${name}\\(`,'i').exec(source);assert(match,name);
 return source.slice(match.index,source.indexOf('$$;',match.index)+3);
}
const signatures=[
 'public.simulate_development_race_pre_federation_juniors(uuid)',
 'public.simulate_development_race_stage(uuid,uuid)',
 'public.get_national_federation_equipment_junior_stage_bonus(uuid,uuid,text,text)',
 'public.simulate_development_race(uuid)',
 'public.get_national_federation_equipment_rating_bonus(uuid,uuid,text,boolean)',
];
const attributes=()=>query('select oid::regprocedure::text signature,proacl::text acl,proconfig,prosecdef,provolatile from pg_proc where oid=any($1::regprocedure[]) order by oid::regprocedure::text',[signatures]);
const digest=()=>query('select oid::regprocedure::text signature,md5(pg_get_functiondef(oid)) hash from pg_proc where oid=any($1::regprocedure[]) order by oid::regprocedure::text',[signatures]);
const ratings=['mountain','hills','flat','time_trial','cobbles','sprint','acceleration','downhill','endurance','resistance','recovery','breakaway','prologue'];
async function event(key,profile='hilly',type='open',stages=1){
 await db.query(`insert into development_race_editions(id,season_id,name,status,start_day_number,end_day_number,is_world_championship,competition_type,race_format,points_scale)
 values($1,$2,$3,'planned',1,$4,$5,$6,$7,$8)`,[id(key),id('season'),key,stages,type.startsWith('world_'),type,stages>1?'stage_race':'one_day',type==='open'?'standard':'world']);
 for(let n=1;n<=stages;n++)await db.query('insert into development_race_stages values($1,$2,$3,$3,$4,$5,$6)',[id(`${key}-stage-${n}`),id(key),n,profile==='time_trial'?27:142,profile==='time_trial'?'individual_time_trial':'road',profile]);
 return id(key);
}
async function rider(key,label,value,country='plain',federal=false){
 const riderId=id(`${key}-${label}`),team=id(`team-${key}-${label}`),registration=id(`reg-${key}-${label}`);
 await db.query('insert into development_teams values($1,$2)',[team,label]);
 await db.query(`insert into youth_academy_riders(id,country_id,first_name,last_name,${ratings.join(',')}) values($1,$2,$3,'Rider',${ratings.map((_,i)=>`$${i+4}`).join(',')})`,[riderId,id(country),label,...ratings.map(()=>value)]);
 if(federal){
  await db.query("insert into national_federation_junior_race_registrations values($1,$2,$3,'registered',now())",[registration,id(key),id(country)]);
  await db.query('insert into national_federation_junior_race_registration_riders values($1,$2,$3)',[registration,riderId,team]);
 }else{
  await db.query("insert into development_race_registrations values($1,$2,$3,'registered',now())",[registration,id(key),team]);
  await db.query('insert into development_race_registration_riders values($1,$2)',[registration,riderId]);
 }
 return riderId;
}
const simulate=key=>db.query('select simulate_development_race($1)',[id(key)]);
const results=(key,scope='general')=>query('select competitor_key,academy_rider_id,rank,elapsed_time_seconds,gap_to_winner_seconds,points from development_race_results where race_edition_id=$1 and result_scope=$2 order by stage_id,rank',[id(key),scope]);
async function checkHumansAhead(key,count,scope='general'){
 const rows=await results(key,scope),human=rows.filter(r=>r.academy_rider_id),bots=rows.filter(r=>!r.academy_rider_id);
 eq(human.length,count,`${key}: real entrants retained`);assert(bots.length>0);checks++;
 assert(Math.max(...human.map(r=>r.rank))<Math.min(...bots.map(r=>r.rank)),`${key}: even the weakest player rider beats virtual fillers`);checks++;
 assert(rows.every(r=>r.elapsed_time_seconds>=300&&r.gap_to_winner_seconds>=0));checks++;
 return rows;
}
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table countries(id uuid primary key,name text,iso_alpha2 text,continent_code text,is_active boolean);
 create table seasons(id uuid primary key,current_day_number integer,game_year integer);
 create table development_race_editions(id uuid primary key,season_id uuid,name text,status text,start_day_number integer,end_day_number integer,is_world_championship boolean,competition_type text,race_format text,points_scale text,championship_continent_code text,simulated_at timestamptz,updated_at timestamptz);
 create table development_race_stages(id uuid primary key,race_edition_id uuid,stage_number integer,day_number integer,distance_km numeric,stage_type text,profile_type text);
 create table development_teams(id uuid primary key,display_name text);
 create table youth_academy_riders(id uuid primary key,country_id uuid,first_name text,last_name text,${ratings.map(key=>`${key} numeric not null check(${key} between 1 and 6)`).join(',')});
 create table development_race_registrations(id uuid primary key,race_edition_id uuid,development_team_id uuid,status text,updated_at timestamptz);
 create table development_race_registration_riders(registration_id uuid,academy_rider_id uuid);
 create table national_federation_junior_race_registrations(id uuid primary key,race_edition_id uuid,country_id uuid,status text,synced_at timestamptz);
 create table national_federation_junior_race_registration_riders(registration_id uuid,academy_rider_id uuid,development_team_id uuid);
 create table development_race_results(id uuid primary key default gen_random_uuid(),race_edition_id uuid,stage_id uuid,result_scope text,competitor_key text,academy_rider_id uuid,development_team_id uuid,rider_name text,team_name text,country_code text,rank integer,elapsed_time_seconds integer,gap_to_winner_seconds integer,points integer);
 create unique index development_result_competitor on development_race_results(race_edition_id,result_scope,coalesce(stage_id,'00000000-0000-0000-0000-000000000000'::uuid),competitor_key);
 create unique index development_result_rank on development_race_results(race_edition_id,result_scope,coalesce(stage_id,'00000000-0000-0000-0000-000000000000'::uuid),rank);
 create index development_result_edition on development_race_results(race_edition_id);
 create table national_federation_equipment_contracts(id uuid primary key,country_id uuid,season_id uuid);
 create table national_federation_equipment_contract_items(contract_id uuid,effect_payload jsonb);
 create function ensure_automatic_federation_junior_lineups(uuid) returns integer language sql as $$select 0$$;
 create function refresh_development_rankings(uuid) returns integer language sql as $$select 0$$;`);
 await db.exec(definition(read('20260812130000_create_development_team'),'development_hash_unit'));
 await db.exec(definition(read('20260825140000_add_season_three_junior_competition'),'get_development_result_points'));
 await db.exec(definition(read('20260920170000_create_federation_equipment_and_race_preparation'),'get_national_federation_equipment_rating_bonus'));
 if(process.argv[3]){
  const captured=JSON.parse(readFileSync(process.argv[3],'utf8'));
  for(const fn of captured)await db.exec(fn.definition);
 }else{
  await db.exec(definition(read('20260812130000_create_development_team'),'simulate_development_race').replace('public.simulate_development_race(','public.simulate_development_race_pre_federation_juniors('));
  await db.exec(definition(read('20260831173000_publish_development_tour_stages_daily'),'simulate_development_race_stage'));
  await db.exec(definition(read('20260920170000_create_federation_equipment_and_race_preparation'),'get_national_federation_equipment_junior_stage_bonus'));
  await db.exec(definition(read('20260904110000_federation_junior_championship_registrations'),'simulate_development_race'));
  const gearSource=read('20260920170000_create_federation_equipment_and_race_preparation');
  const anchor=gearSource.indexOf('-- Ajoute le matériel national au score');
  await db.exec(gearSource.slice(gearSource.indexOf('do $migration$',anchor),gearSource.indexOf('$migration$;',anchor)+13));
 }
 for(const signature of signatures){
  await db.exec(`revoke all on function ${signature} from public,anon,authenticated;grant execute on function ${signature} to service_role;`);
  if(signature.includes('get_national_federation_equipment'))await db.exec(`grant execute on function ${signature} to authenticated;`);
 }
 await db.query('insert into seasons values($1,28,4)',[id('season')]);
 for(const [country,code] of [['plain','FR'],['equipped','BR'],['other','JP']])await db.query("insert into countries values($1,$2,$3,'europe',true)",[id(country),country,code]);
 await db.query('insert into national_federation_equipment_contracts values($1,$2,$3)',[id('contract'),id('equipped'),id('season')]);
 const payload={ratingBonuses:Object.fromEntries(['mountain','hills','flat','timeTrial','cobbles','sprint','acceleration','downhill','endurance','resistance','recovery','prologue'].map(key=>[key,1])),timeTrialRatingBonuses:{timeTrial:.5,prologue:.5,flat:.5,endurance:.5,resistance:.5}};
 await db.query('insert into national_federation_equipment_contract_items values($1,$2)',[id('contract'),payload]);
 const gear=(profile,stage='road')=>scalar('select get_national_federation_equipment_junior_stage_bonus($1,$2,$3,$4)',[id('equipped'),id('season'),profile,stage]);
 eq(Number(await gear('hilly')),1,'Reproduces unconverted professional points before the fix');
 await event('old');await rider('old','minimum',1);await simulate('old');
 eq((await results('old')).find(r=>r.academy_rider_id)?.rank,48,'Reproduces all fillers beating a player rider');
 const oldResults=await results('old'),attrs=await attributes();
 const mutation=read('20261104133000_balance_junior_virtual_riders_and_equipment');
 await db.exec(mutation);
 eq(await attributes(),attrs,'Function permissions, execution settings and volatility preserved');
 eq(await results('old'),oldResults,'Migration never rewrites completed races');
 eq(await scalar('select simulate_development_race($1)',[id('old')]),0,'Completed edition remains immutable');
 const profiles=['flat','sprint','hilly','mountain','cobbles','time_trial','mixed'];
 for(const profile of profiles){
  eq(Number(await gear(profile,profile==='time_trial'?'individual_time_trial':'road')),profile==='time_trial'?.1875:.125,`${profile}: equipment converted to internal youth units`);
 }
 eq(Number(await gear('mixed','individual_time_trial')),.13375,'Mixed chrono keeps its existing time-trial weight');
 eq(Number(await scalar("select get_national_federation_equipment_junior_stage_bonus($1,$2,'hilly','road')",[id('plain'),id('season')])),0,'Absent equipment stays zero');
 eq(Number(await scalar("select get_national_federation_equipment_rating_bonus($1,$2,'timeTrial',true)",[id('equipped'),id('season')])),1.5,'Professional equipment effects unchanged');
 for(const profile of profiles){
  const key=`open-${profile}`;await event(key,profile);await rider(key,'minimum',1);await rider(key,'strong',6);await simulate(key);
  const rows=await checkHumansAhead(key,2);eq(rows.length,48,`${key}: field size unchanged`);
  eq(rows[0].academy_rider_id,id(`${key}-strong`),`${key}: human quality still decides the winner`);
  const snapshot=await results(key);await simulate(key);eq(await results(key),snapshot,`${key}: duplicate settlement is idempotent`);
 }
 for(const [type,profile] of [['world_road','hilly'],['world_time_trial','time_trial'],['continental_road','hilly'],['continental_time_trial','time_trial']]){
  const key=`federal-${type}`;await event(key,profile,type);await rider(key,'minimum',1,'plain',true);await rider(key,'strong',6,'plain',true);await rider(key,'equipped',2,'equipped',true);
  await simulate(key);const rows=await checkHumansAhead(key,3);eq(rows.length,51,`${type}: all federation selections and all fillers retained`);
  eq(rows[0].academy_rider_id,id(`${key}-strong`),`${type}: equipment does not erase a large native quality difference`);
 }
 // Daily stages and final settlement must use exactly the same weak bot model.
 await event('tour','hilly','open',2);await rider('tour','minimum',1);await rider('tour','strong',6);
 await db.query('select simulate_development_race_stage($1,$2)',[id('tour'),id('tour-stage-1')]);
 const daily=await results('tour','stage');await checkHumansAhead('tour',2,'stage');
 eq(await scalar('select simulate_development_race_stage($1,$2)',[id('tour'),id('tour-stage-1')]),0,'An already-published daily stage is not run twice');
 eq((await results('tour')).length,0,'Daily publication creates no premature final classification');
 await simulate('tour');await checkHumansAhead('tour',2);
 const stageOne=await query("select competitor_key,academy_rider_id,rank,elapsed_time_seconds,gap_to_winner_seconds,points from development_race_results where stage_id=$1 and result_scope='stage' order by rank",[id('tour-stage-1')]);
 eq(stageOne,daily,'Daily and final engines agree on the same stage');
 for(const row of await results('tour'))eq(row.elapsed_time_seconds,Number(await scalar("select sum(elapsed_time_seconds) from development_race_results where race_edition_id=$1 and result_scope='stage' and competitor_key=$2",[id('tour'),row.competitor_key])),'Tour final time is the sum of stage times');
 // A bot-only event still settles normally and retains deterministic variety.
 await event('empty');await simulate('empty');const empty=await results('empty');eq(empty.length,48,'Empty player field still has a valid virtual field');
 assert(new Set(empty.map(r=>r.elapsed_time_seconds)).size>1);checks++;
 await event('future');await db.query('update development_race_stages set day_number=29 where race_edition_id=$1',[id('future')]);
 await assert.rejects(db.query('select simulate_development_race_stage($1,$2)',[id('future'),id('future-stage-1')]),/pas encore/);checks++;
 await db.query("update development_race_editions set status='cancelled' where id=$1",[id('future')]);
 eq(await scalar('select simulate_development_race($1)',[id('future')]),0,'Cancellation guard retained');
 const hashes=await digest();await db.exec(mutation);eq(await digest(),hashes,'Reapplying the patch cannot divide equipment twice or weaken fillers again');
 eq(await results('old'),oldResults,'Historical classifications remain byte-for-byte unchanged');
 eq(await attributes(),attrs,'All permissions/settings remain identical after repeated application');
 console.log(`PASS ${checks} isolated SQL checks: equipment units, all seven profiles, world/continental road and TT, weakest humans before bots, stages/final consistency, historical results, retries and permissions.`);
}catch(error){console.error('FAIL:',error.message,error.where??'',error.detail??'');process.exitCode=1;}
finally{await db.close();}
