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
 for(let n=1;n<=stages;n++)await db.query(`insert into development_race_stages
  (id,race_edition_id,stage_number,day_number,distance_km,stage_type,profile_type) values($1,$2,$3::smallint,$3::smallint,$4,$5,$6)`,
  [id(`${key}-stage-${n}`),id(key),n,profile==='time_trial'?27:142,profile==='time_trial'?'individual_time_trial':'road',profile]);
 return id(key);
}
async function rider(key,label,value,country='plain',federal=false,group=label){
 const riderId=id(`${key}-${label}`),team=id(`team-${key}-${group}`),registration=id(`reg-${key}-${group}`);
 await db.query('insert into development_teams(id,display_name) values($1,$2) on conflict do nothing',[team,group]);
 await db.query(`insert into youth_academy_riders(id,country_id,first_name,last_name,${ratings.join(',')}) values($1,$2,$3,'Rider',${ratings.map((_,i)=>`$${i+4}`).join(',')})`,[riderId,id(country),label,...ratings.map(()=>value)]);
 if(federal){
  await db.query("insert into national_federation_junior_race_registrations values($1,$2,$3,'registered',now()) on conflict do nothing",[registration,id(key),id(country)]);
  await db.query('insert into national_federation_junior_race_registration_riders values($1,$2,$3)',[registration,riderId,team]);
 }else{
  await db.query("insert into development_race_registrations values($1,$2,$3,'registered',now()) on conflict do nothing",[registration,id(key),team]);
  await db.query('insert into development_race_registration_riders values($1,$2)',[registration,riderId]);
 }
 return riderId;
}
const simulate=key=>db.query('select simulate_development_race($1)',[id(key)]);
const results=(key,scope='general')=>query('select competitor_key,academy_rider_id,rank,elapsed_time_seconds,gap_to_winner_seconds,points from development_race_results where race_edition_id=$1 and result_scope=$2 order by stage_id,rank',[id(key),scope]);
const stageTimes=key=>query(`select stage.stage_number,result.academy_rider_id,result.competitor_key,result.elapsed_time_seconds
 from development_race_results result join development_race_stages stage on stage.id=result.stage_id
 where result.race_edition_id=$1 and result.result_scope='stage' order by stage.stage_number,result.competitor_key`,[id(key)]);
const simulateDaily=(key,n)=>db.query('select simulate_development_race_stage($1,$2)',[id(key),id(`${key}-stage-${n}`)]);
const character=(riderId,key)=>db.query('update youth_academy_riders set personality_key=$2 where id=$1',[riderId,key]);
async function rollbackAfter(action){
 await db.exec('begin');
 try{return await action();}
 finally{await db.exec('rollback');}
}
async function pickImprevisible(key,options={}){
 const candidates=await query(`select label from unnest($2::text[],$3::uuid[]) as candidates(label,rider_id)
 where floor(development_hash_unit('junior-imprevisible:' || $1::uuid::text || ':' || rider_id::text)*3)=$4 limit 1`,
 [id(key),Array.from({length:24},(_,i)=>`imprevisible-${i}`),Array.from({length:24},(_,i)=>id(`${key}-imprevisible-${i}`)),options.roll??2]);
 assert(candidates[0],`No deterministic score roll for ${key}`);
 return rider(key,candidates[0].label,3,options.country,options.federal);
}
async function compareCharacterTimes(key,riderId,run,changedStage,direction=-1){
 const baseline=await rollbackAfter(async()=>{await run();return stageTimes(key);});
 await character(riderId,'imprevisible');
 await run();
 const adjusted=await stageTimes(key);
 eq(adjusted.length,baseline.length,`${key}: same riders and stages`);
 eq(adjusted.filter(row=>row.academy_rider_id===riderId&&row.stage_number===changedStage).length,1,`${key}: the affected rider has a stage result`);
 for(let i=0;i<baseline.length;i++){
  const before=baseline[i],after=adjusted[i];
  const delta=after.elapsed_time_seconds-before.elapsed_time_seconds;
  eq(after.competitor_key,before.competitor_key,`${key}: same rider`);
  if(before.academy_rider_id===riderId&&before.stage_number===changedStage){
   assert(Math.sign(delta)===direction&&Math.abs(delta)<=5,`${key}: expected a small signed road time change, got ${delta}`);
   checks++;
  }else eq(delta,0,`${key}: only the chosen rider and road stage change`);
 }
 return adjusted;
}
async function checkHumansAhead(key,count,scope='general'){
 const rows=await results(key,scope),human=rows.filter(r=>r.academy_rider_id),bots=rows.filter(r=>!r.academy_rider_id);
 eq(human.length,count,`${key}: real entrants retained`);assert(bots.length>0);checks++;
 assert(Math.max(...human.map(r=>r.rank))<Math.min(...bots.map(r=>r.rank)),`${key}: even the weakest player rider beats virtual fillers`);checks++;
 assert(rows.every(r=>r.elapsed_time_seconds>=300&&r.gap_to_winner_seconds>=0));checks++;
 return rows;
}

async function checkJuniorTactics() {
 await db.exec(`create schema if not exists private;
   create table public.development_race_stage_plans (
     stage_id uuid not null, academy_rider_id uuid not null, development_registration_id uuid,
     federation_registration_id uuid, instruction text not null
   );
   create unique index club_plan on development_race_stage_plans(stage_id, development_registration_id, academy_rider_id)
     where development_registration_id is not null;
   create unique index federation_plan on development_race_stage_plans(stage_id, federation_registration_id, academy_rider_id)
     where federation_registration_id is not null;`);
 const plan = (key, stage, riderLabel, group, instruction, federation = false) => db.query(
  `insert into development_race_stage_plans values ($1,$2,$3,$4,$5)`,
  [id(`${key}-stage-${stage}`), id(`${key}-${riderLabel}`), federation ? null : id(`reg-${key}-${group}`),
   federation ? id(`reg-${key}-${group}`) : null, instruction],
 );
 const tacticalRows = (key, stage = 1, federation = false) => query(
  `select academy_rider_id, adjustment::float8
   from private.get_development_race_tactical_adjustments($1,$2,$3) order by academy_rider_id`,
  [id(key), id(`${key}-stage-${stage}`), federation],
 );
 const reopen = (key, federation = false) => db.query(
  `with deleted as (delete from development_race_results where race_edition_id=$1),
   reopened as (update development_race_editions set status='planned' where id=$1)
   update ${federation ? 'national_federation_junior_race_registrations' : 'development_race_registrations'}
   set status='registered' where race_edition_id=$1`, [id(key)],
 );
 const times = async (key) => new Map((await results(key, 'stage')).map(row => [row.competitor_key, row.elapsed_time_seconds]));

 const clubKey = 'tactics-club-road';
 await event(clubKey, 'hilly');
 for (const [label, value] of [['captain', 4], ['helper', 5], ['helper2', 5], ['neutral', 3]]) {
  await rider(clubKey,label,value,'plain',false,'home');
 }
 await rider(clubKey,'rival',1);
 await rider(clubKey,'orphan',2);
 await simulate(clubKey);
 const clubBase = await results(clubKey, 'stage');
 const clubTimes = await times(clubKey);
 await reopen(clubKey);

 const migration = read('20261116225000_apply_junior_race_tactics');
 const attributesBefore = await attributes();
 await db.exec(migration);
 eq(await attributes(), attributesBefore, 'Tactical migration preserves public grants and execution settings');
 eq(await scalar("select has_function_privilege('authenticated', 'private.get_development_race_tactical_adjustments(uuid,uuid,boolean)', 'execute')"), false, 'Private scorer cannot be called by players');
 await plan(clubKey,1,'neutral','home','free');
 await simulate(clubKey);
 eq(await results(clubKey, 'stage'), clubBase, 'Neutral road and absent plans reproduce exact times and ranks');
 await reopen(clubKey);

 await plan(clubKey,1,'captain','home','leader');
 await plan(clubKey,1,'helper','home','domestique');
 await plan(clubKey,1,'helper2','home','domestique');
 await plan(clubKey,1,'rival','rival','leader');
 await plan(clubKey,1,'orphan','orphan','domestique');
 await plan(clubKey,1,'rival','home','domestique'); // Wrong roster must never provide support.
 const adjustments = new Map((await tacticalRows(clubKey)).map(row => [row.academy_rider_id,row.adjustment]));
 assert(adjustments.get(id(`${clubKey}-captain`)) > .16 && adjustments.get(id(`${clubKey}-captain`)) <= .18); checks++;
 assert(adjustments.get(id(`${clubKey}-helper`)) < 0); checks++;
 eq(adjustments.get(id(`${clubKey}-rival`)), 0, 'Leader without helpers gains nothing');
 eq(adjustments.get(id(`${clubKey}-orphan`)), 0, 'Helper without a leader spends no effort');
 eq(adjustments.size, 5, 'Wrong-roster and neutral plans are excluded');
 await simulate(clubKey);
 const plannedClubTimes = await times(clubKey);
 for (const [label, relation] of [['captain', -1], ['helper', 1], ['helper2', 1], ['neutral', 0], ['rival', 0], ['orphan', 0]]) {
  const key = `youth:${id(`${clubKey}-${label}`)}`;
  eq(Math.sign(plannedClubTimes.get(key) - clubTimes.get(key)), relation, `Road tactical effect in published result: ${label}`);
 }
 await checkHumansAhead(clubKey, 6, 'stage');

 const tourKey = 'tactics-club-tour';
 await event(tourKey,'mountain','open',2);
 await rider(tourKey,'attacker',1);
 await rider(tourKey,'captain',6,'plain',false,'elite');
 await rider(tourKey,'helper',5,'plain',false,'elite');
 await plan(tourKey,1,'attacker','attacker','attack');
 await plan(tourKey,1,'captain','elite','leader');
 await plan(tourKey,1,'helper','elite','domestique');
 const attacks = await tacticalRows(tourKey);
 eq(await tacticalRows(tourKey), attacks, 'Risk uses a deterministic stage and rider seed');
 assert(attacks.every(row => Number.isFinite(row.adjustment) && Math.abs(row.adjustment) <= .18)); checks++;
 await db.query('select simulate_development_race_stage($1,$2)', [id(tourKey), id(`${tourKey}-stage-1`)]);
 const publishedStage = () => query('select * from development_race_results where stage_id=$1 and result_scope=$2 order by rank', [id(`${tourKey}-stage-1`),'stage']);
 const priorStage = await publishedStage();
 await db.query('update youth_academy_riders set mountain=1, recovery=1, endurance=1 where id=$1', [id(`${tourKey}-captain`)]);
 await plan(tourKey,2,'attacker','attacker','attack');
 await simulate(tourKey);
 eq(await publishedStage(), priorStage, 'Final settlement preserves every published stage value despite changed training ratings');
 const tourStages = await results(tourKey,'stage');
 eq(tourStages.length,96,'Missing second stage settles with the same scorer and real/virtual field counts');
 for (const row of await results(tourKey)) {
  eq(row.elapsed_time_seconds, tourStages.filter(stageRow => stageRow.competitor_key === row.competitor_key)
   .reduce((total,stageRow) => total + stageRow.elapsed_time_seconds,0), 'Final classification sums authoritative stage times');
 }

 for (const [kind, profile, instruction, federation] of [
  ['world_time_trial','time_trial','progressive',true],
  ['continental_road','hilly','leader',true],
  ['open','time_trial','aggressive',false],
 ]) {
  const key = `tactics-${kind}-${instruction}`;
  await event(key, profile, kind);
  await rider(key,'target',6,'equipped',federation,'squad');
  await rider(key,'helper',4,'equipped',federation,'squad');
  await simulate(key);
  const baselines = await times(key);
  const neutral = profile === 'time_trial' ? 'steady' : 'free';
  const targetKey = `${federation ? 'federation-youth' : 'youth'}:${id(`${key}-target`)}`;
  await reopen(key, federation);
  await plan(key,1,'target','squad',neutral,federation);
  await plan(key,1,'helper','squad',profile === 'time_trial' ? 'domestique' : 'progressive',federation);
  await simulate(key);
  eq(await times(key), baselines, `${kind}: neutral and off-discipline orders preserve exact times`);
  await reopen(key, federation);
  await db.query('delete from development_race_stage_plans where stage_id=$1', [id(`${key}-stage-1`)]);
  await plan(key,1,'target','squad',instruction,federation);
  if (instruction === 'leader') await plan(key,1,'helper','squad','domestique',federation);
  const riderTactic = (await tacticalRows(key,1,federation)).find(row => row.academy_rider_id === id(`${key}-target`));
  assert(riderTactic.adjustment > 0 && riderTactic.adjustment <= .18); checks++;
  await simulate(key);
  assert((await times(key)).get(targetKey) < baselines.get(targetKey), `${kind}: the calculated tactic changes the actual published time`); checks++;
 }
 const settledTour = await results(tourKey);
 await db.exec(migration);
 eq(await results(tourKey), settledTour, 'Reapplying tactical migration cannot change published results');
 eq(await scalar('select simulate_development_race($1)',[id(tourKey)]), 0, 'Settled tour remains immutable on retry');
 eq(await attributes(), attributesBefore, 'Tactical migration still preserves function execution settings after reapplication');
}
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;
 create table countries(id uuid primary key,name text,iso_alpha2 text,continent_code text,is_active boolean);
 create table seasons(id uuid primary key,current_day_number integer,game_year integer,status text);
 create table season_days(id uuid primary key,season_id uuid,day_number integer,calendar_date date);
 create table development_race_editions(id uuid primary key default gen_random_uuid(),season_id uuid,name text,status text default 'planned',start_day_number integer,end_day_number integer,is_world_championship boolean,competition_type text,race_format text,points_scale text,championship_continent_code text,simulated_at timestamptz,updated_at timestamptz,slug text,short_name text,location_name text,country_code text,profile_type text,selection_minimum integer,selection_maximum integer,selection_mode text,reward_pool integer,unique(season_id,slug));
 create table development_race_stages(id uuid primary key default gen_random_uuid(),race_edition_id uuid,stage_number smallint,day_number integer,distance_km numeric,stage_type text,profile_type text,name text,unique(race_edition_id,stage_number));
 create table development_teams(id uuid primary key,display_name text,season_id uuid);
 create table development_team_roster(development_team_id uuid,academy_rider_id uuid);
 create table youth_academy_riders(id uuid primary key,country_id uuid,first_name text,last_name text,${ratings.map(key=>`${key} numeric not null check(${key} between 1 and 6)`).join(',')},personality_key text,morale numeric default 60,updated_at timestamptz,status text default 'active',birth_game_year integer default 2);
 create table youth_rider_morale_events(id uuid primary key default gen_random_uuid(),academy_rider_id uuid,season_day_id uuid,source_type text,source_reference text,requested_delta numeric,applied_delta numeric,morale_before numeric,morale_after numeric,description text,metadata jsonb,unique(academy_rider_id,source_type,source_reference));
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
 await db.query("insert into seasons values($1,28,4,'active')",[id('season')]);
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
 await checkJuniorTactics();

 await db.exec(definition(read('20260905150000_polish_federations_and_add_lightweight_junior_nationals'),'settle_due_lightweight_junior_national_championships'));
 const moraleSource=read('20260927233500_reapply_persistent_rider_morale');
 await db.exec(definition(moraleSource,'apply_youth_rider_morale_event'));
 await db.exec(definition(moraleSource,'apply_development_result_morale'));
 await db.exec('create trigger development_race_results_apply_morale after insert on development_race_results for each row execute function apply_development_result_morale()');
 for(let day=1;day<=10;day++)await db.query('insert into season_days values($1,$2,$3,$4)',[id(`day-${day}`),id('season'),day,`2026-11-${10+day}`]);
 await event('legacy-tour','hilly','open',2);
 const legacyRider=await pickImprevisible('legacy-tour');
 await character(legacyRider,'imprevisible');
 await simulateDaily('legacy-tour',1);
 const legacyExpected=await rollbackAfter(async()=>{await simulate('legacy-tour');return stageTimes('legacy-tour');});

 await db.exec(read('20261117102000_apply_junior_race_personalities'));
 eq(await scalar("select rider_personalities_enabled from development_race_editions where id=$1",[id('legacy-tour')]),false,'A partially published tour keeps its original scoring');
 await simulate('legacy-tour');
 eq(await stageTimes('legacy-tour'),legacyExpected,'Old tour results remain consistent during final settlement');
 eq(await results('old'),oldResults,'Character migration leaves completed classifications unchanged');

 await event('character-tour','hilly','open',3);
 const tourRider=await pickImprevisible('character-tour');
 await db.query("update development_race_stages set stage_type='individual_time_trial',profile_type='time_trial' where id=$1",[id('character-tour-stage-3')]);
 const dailyTour=await compareCharacterTimes('character-tour',tourRider,async()=>{for(let n=1;n<=3;n++)await simulateDaily('character-tour',n);},2);
 await simulate('character-tour');
 eq(await stageTimes('character-tour'),dailyTour,'Daily and final engines apply the identical road delta and leave the trailing time trial unchanged');

 await event('character-world','hilly','world_road');
 const worldRider=await pickImprevisible('character-world',{federal:true,roll:0});
 await compareCharacterTimes('character-world',worldRider,()=>simulate('character-world'),1,1);

 await db.exec("update countries set is_active=false; update youth_academy_riders set status='retired'");
 await db.query("insert into countries values($1,'National','GB','europe',true)",[id('national')]);
 const nationalRoad='championnat-junior-gb-route',nationalTt='championnat-junior-gb-clm';
 for(const [key,type,profile] of [[nationalRoad,'national_road','hilly'],[nationalTt,'national_time_trial','time_trial']]){
  await event(key,profile,type);
  await db.query("update development_race_editions set slug=$2,country_code='GB' where id=$1",[id(key),key]);
 }
 const nationalRider=await pickImprevisible(nationalRoad,{country:'national'});
 await db.query("update youth_academy_riders set birth_game_year=(select game_year-17 from seasons where id=$2) where id=$1",[nationalRider,id('season')]);
 const settleNational=()=>db.exec('select settle_due_lightweight_junior_national_championships()');
 const nationalTtBaseline=await rollbackAfter(async()=>{await settleNational();return stageTimes(nationalTt);});
 eq(nationalTtBaseline[0]?.academy_rider_id,nationalRider,'The same junior starts the national time trial');
 await compareCharacterTimes(nationalRoad,nationalRider,settleNational,1);
 eq(await stageTimes(nationalTt),nationalTtBaseline,'The junior national time trial ignores the road character');

 await event('globe-trotteur-start');
 const globe=await rider('globe-trotteur-start','globe',3);
 await character(globe,'globe_trotteur');
 const travels=()=>query(`select event.requested_delta,event.source_reference,event.metadata,day.day_number
 from youth_rider_morale_events event join season_days day on day.id=event.season_day_id
 where event.academy_rider_id=$1 and event.metadata->>'personalityKey'='globe_trotteur'
 order by day.day_number`,[globe]);
 async function recordTravel(key,country,day,scope='stage',season='season'){
  await event(key);
  await db.query('update development_race_editions set country_code=$2,season_id=$3 where id=$1',[id(key),country,id(season)]);
  await db.query('update development_race_stages set day_number=$2 where id=$1',[id(`${key}-stage-1`),day]);
  await db.query(`insert into development_race_results(race_edition_id,stage_id,result_scope,competitor_key,academy_rider_id,rank)
   values ($1,$2,$3,$4,$5,4)`,[id(key),id(`${key}-stage-1`),scope,key,globe]);
 }
 for(const [country,code] of [['new-one','IT'],['new-two','ES'],['new-three','AU']]){
  await db.query("insert into countries values($1,$2,$3,'europe',true)",[id(country),country,code]);
 }
 await db.query("update development_race_editions set country_code='FR' where id=$1",[id('globe-trotteur-start')]);
 await simulate('globe-trotteur-start');
 eq((await travels()).length,1,'An actual junior result in a new country gives one bonus');
 eq(Number((await travels())[0].requested_delta),1,'The persistent junior bonus is +1 morale');
 eq((await travels())[0].metadata.countryId,id('plain'),'The ledger names the visited country');
 await recordTravel('globe-repeat','FR',2);
 await recordTravel('globe-general','JP',2,'general');
 eq((await travels()).length,1,'A country revisit and a general-only result give no bonus');
 await recordTravel('globe-new-country-2','JP',3);
 await recordTravel('globe-new-country-3','IT',4);
 await recordTravel('globe-season-cap','ES',5);
 eq((await travels()).map(event=>event.day_number),[1,3,4],'The first three new junior countries of the season give a bonus');
 await db.query('delete from development_race_results where race_edition_id=$1',[id('globe-new-country-2')]);
 await db.query("insert into development_race_results(race_edition_id,stage_id,result_scope,competitor_key,academy_rider_id,rank) values ($1,$2,'stage','retry',$3,4)",[id('globe-new-country-2'),id('globe-new-country-2-stage-1'),globe]);
 eq((await travels()).length,3,'A junior result replay cannot duplicate the reward');
 await db.query("insert into seasons values($1,28,5,'planned')",[id('next-season')]);
 await db.query('insert into season_days values($1,$2,1,$3),($4,$2,2,$5)',[id('next-day-1'),id('next-season'),'2026-12-01',id('next-day-2'),'2026-12-02']);
 await recordTravel('globe-once-per-career','ES',1,'stage','next-season');
 eq((await travels()).length,3,'A country visited after the previous season cap is still a career visit');
 await recordTravel('globe-season-reset','AU',2,'stage','next-season');
 eq((await travels()).length,4,'A new country earns the bonus again after the season rolls over');
 console.log(`PASS ${checks} isolated SQL checks: junior balance, club and federation tactics, all character scoring paths, authoritative published stages, in-progress tours, junior morale and retries.`);
}catch(error){console.error('FAIL:',error.message,error.where??'',error.detail??'');process.exitCode=1;}
finally{await db.close();}
