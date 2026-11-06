// Only an isolated PGlite database. Exercises the real registration RPC/guards.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]??'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js').href);
const db=new PGlite();let checks=0;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const denied=async(fn,pattern)=>{await assert.rejects(fn,pattern);checks++;};
const baseline=JSON.parse(readFileSync('scripts/fixtures/roster-health-recovery-baseline-20261106.json','utf8'));
const migration=readFileSync('supabase/migrations/20261106190000_respect_actual_injury_recovery_on_roster.sql','utf8');
const injury=async({status='recovered',started='2026-11-05T13:20:19Z',expected='2026-11-08T07:20:19Z',recovered='2026-11-06T00:28:34Z',rider=30}={})=>{
  await db.query('insert into rider_injuries values($1,$2,$3,$4,$5)',[id(rider),status,started,expected,recovered]);
};
const save=async(edition=60,rider=30)=>scalar('select registered_rider_count from save_current_team_race_roster($1,$2::uuid[])',[id(edition),[id(rider)]]);
const direct=async(registration,rider=30,status='confirmed',roster=100)=>db.query('insert into race_rosters(id,race_registration_id,rider_id,status)values($1,$2,$3,$4)',[id(roster),id(registration),id(rider),status]);
const reset=async()=>db.exec(`truncate race_rosters,race_registrations,rider_injuries,rider_form_camps,international_selection_stage_race_repairs;
  update stages set departure_at='2026-11-07T12:00Z' where id='${id(70)}';`);
try{
  await db.exec(`create role anon;create role authenticated;create schema private;create schema auth;
    create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text,reputation_points numeric);
    create table seasons(id uuid primary key,status text,game_year int);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,status text);
    create table riders(id uuid primary key,first_name text,last_name text,status text,country_id uuid);
    create table rider_contracts(id uuid primary key,rider_id uuid,team_id uuid,status text,start_season_id uuid,end_season_id uuid);
    create table race_categories(id uuid primary key,minimum_roster_size int,maximum_roster_size int);
    create table races(id uuid primary key,country_id uuid,competition_type text);
    create table race_editions(id uuid primary key,race_id uuid,season_id uuid,race_category_id uuid,status text,registration_policy text,minimum_reputation numeric,
      registration_closes_at timestamptz,withdrawal_closes_at timestamptz,field_limit int,display_name text);
    create table season_days(id uuid primary key,calendar_date date,day_number int);
    create table stages(id uuid primary key,race_edition_id uuid,season_day_id uuid,day_slot text,departure_at timestamptz);
    create table race_registrations(id uuid primary key default gen_random_uuid(),race_edition_id uuid,team_season_id uuid,status text,entry_method text,registered_at timestamptz,decided_at timestamptz,unique(race_edition_id,team_season_id));
    create table race_rosters(id uuid primary key default gen_random_uuid(),race_registration_id uuid,rider_id uuid,status text,selected_at timestamptz,unique(race_registration_id,rider_id));
    create table rider_injuries(rider_id uuid,status text,started_at timestamptz,expected_recovery_at timestamptz,recovered_at timestamptz);
    create index on rider_injuries(rider_id);
    create table rider_form_camps(rider_id uuid,season_id uuid,status text,start_day_number int,end_day_number int,camp_type text);
    create table international_selection_stage_race_repairs(race_roster_id uuid,incident_key text,restore_authorized bool);
    create table youth_academy_riders(id uuid primary key,team_id uuid,status text);
    create table academy_competition_rider_links(academy_rider_id uuid,rider_id uuid,season_id uuid);
    create table national_federation_olympic_events(season_id uuid,race_edition_id uuid,time_trial_race_edition_id uuid);
    create table national_federation_selection_lists(id uuid primary key,country_id uuid,season_id uuid,slot_key text);
    create table national_federation_selection_members(selection_list_id uuid,professional_rider_id uuid,response_status text);
    create function get_federation_selection_rider_limit(uuid,uuid,text)returns int language sql stable as $$select 1$$;
    insert into seasons values('${id(1)}','active',5);
    insert into sporting_directors values('${id(10)}','${id(11)}','active',100);
    insert into team_manager_assignments values('${id(10)}','${id(20)}','general_manager','active');
    insert into team_seasons values('${id(21)}','${id(20)}','${id(1)}','active');
    insert into riders values('${id(30)}','Test','Rider','active','${id(40)}'),('${id(31)}','Other','Rider','active','${id(40)}'),('${id(32)}','CN','Junior','academy','${id(40)}');
    insert into rider_contracts values('${id(35)}','${id(30)}','${id(20)}','active','${id(1)}','${id(1)}');
    insert into race_categories values('${id(45)}',1,4);
    insert into races values('${id(50)}','${id(40)}','ordinary'),('${id(51)}','${id(40)}','national_road');
    insert into race_editions values
    ('${id(60)}','${id(50)}','${id(1)}','${id(45)}','registration_open','open',0,'2099-12-31','2099-12-31',100,'Test Classic'),
    ('${id(61)}','${id(50)}','${id(1)}','${id(45)}','registration_open','open',0,'2099-12-31','2099-12-31',100,'Other Classic'),
    ('${id(62)}','${id(51)}','${id(1)}','${id(45)}','registration_open','open',0,'2099-12-31','2099-12-31',100,'National Championship'),
    ('${id(63)}','${id(50)}','${id(1)}','${id(45)}','registration_open','open',0,'2099-12-31','2099-12-31',100,'Olympics');
    insert into season_days values('${id(65)}','2026-11-07',2),('${id(66)}','2026-11-09',4);
    insert into stages values('${id(70)}','${id(60)}','${id(65)}','early','2026-11-07T12:00Z'),('${id(71)}','${id(61)}','${id(65)}','early','2026-11-07T12:00Z'),
      ('${id(72)}','${id(62)}','${id(65)}','late','2026-11-07T18:00Z'),('${id(73)}','${id(63)}','${id(66)}','early','2026-11-09T12:00Z');
    select set_config('request.jwt.claim.sub','${id(11)}',false);
  `);
  for(const f of ['health_trigger','save_roster','pending_conflicts'])await db.exec(baseline[f].definition);
  await db.exec(readFileSync('supabase/migrations/20261106120000_fix_cn_junior_fallback_ownership.sql','utf8'));
  const olympic=readFileSync('supabase/migrations/20261016180000_olympic_individual_time_trial.sql','utf8')
    .match(/create or replace function public.guard_olympic_roster\(\)[\s\S]*?\$\$;/i)?.[0];assert.ok(olympic);await db.exec(olympic);
  await db.exec(`create trigger enforce_rider_health_availability_on_roster before insert or update of rider_id,status,race_registration_id on race_rosters for each row execute function enforce_rider_health_availability_on_roster();
    create trigger enforce_pending_race_roster_conflicts before insert or update of rider_id,status,race_registration_id on race_rosters for each row execute function enforce_pending_race_roster_conflicts();
    create trigger guard_race_roster_transfer_ownership before insert or update of rider_id,status,race_registration_id on race_rosters for each row execute function private.guard_live_rider_commitment_ownership();
    create trigger guard_olympic_roster before insert or update of rider_id,status,race_registration_id on race_rosters for each row execute function guard_olympic_roster();`);
  const signatures=['public.save_current_team_race_roster(uuid,uuid[])','public.enforce_pending_race_roster_conflicts()','private.guard_live_rider_commitment_ownership()','public.guard_olympic_roster()'];
  const hash=signature=>scalar('select md5(pg_get_functiondef($1::regprocedure))',[signature]);
  const beforeHashes=await Promise.all(signatures.map(hash));
  await injury();const beforeInjury=await scalar('select to_jsonb(i) from rider_injuries i');
  await denied(()=>save(),/blessé/);check(await scalar('select count(*)::int from race_registrations'),0);
  await db.exec(migration);check(await save(),1);check(await scalar('select to_jsonb(i) from rider_injuries i'),beforeInjury);
  const patchedHash=await hash('public.enforce_rider_health_availability_on_roster()');await db.exec(migration);
  check(await hash('public.enforce_rider_health_availability_on_roster()'),patchedHash);
  check(await Promise.all(signatures.map(hash)),beforeHashes);

  for(const options of [{status:'active',recovered:null},{status:'active',recovered:'2026-11-06T00:00Z'},
    {recovered:null},{recovered:'2026-11-07T12:00:00.001Z'}]){
    await reset();await injury(options);await denied(()=>save(),/blessé/);
  }
  await reset();await injury();await db.query("update stages set departure_at='2026-11-05T14:00Z' where id=$1",[id(70)]);await denied(()=>save(),/blessé/);
  await reset();await injury({expected:'2026-11-06T00:00Z',recovered:'2026-11-08T00:00Z'});check(await save(),1);
  await reset();await injury({recovered:'2026-11-07T12:00Z'});check(await save(),1);
  await reset();await injury({status:'active',recovered:null,started:'2026-11-07T19:59:59Z'});await denied(()=>save(),/blessé/);
  await reset();await injury({status:'active',recovered:null,started:'2026-11-07T20:00Z'});check(await save(),1);
  await reset();await injury({recovered:'2026-11-07T11:00Z'});await db.query('update stages set departure_at=null where id=$1',[id(70)]);check(await save(),1);
  await reset();await injury({status:'active',recovered:null,started:'2026-11-08T12:00Z',expected:'2026-11-10T12:00Z'});
  await db.query('insert into stages values($1,$2,$3,$4,$5)',[id(74),id(60),id(66),'early','2026-11-09T12:00Z']);await denied(()=>save(),/blessé/);await db.query('delete from stages where id=$1',[id(74)]);
  for(const [camp,status,pattern] of [['classic','planned',/remise en forme/],['reconnaissance','active',/reconnaissance/]]){
    await reset();await injury();await db.query('insert into rider_form_camps values($1,$2,$3,2,2,$4)',[id(30),id(1),status,camp]);await denied(()=>save(),pattern);
  }
  await reset();await injury();await db.query("insert into rider_form_camps values($1,$2,'cancelled',2,2,'classic')",[id(30),id(1)]);check(await save(),1);
  await reset();await db.query("insert into race_registrations(id,race_edition_id,team_season_id,status)values($1,$2,$3,'pending')",[id(80),id(61),id(21)]);await direct(80);
  await denied(()=>save(),/reserve/);await db.query("update stages set day_slot='late' where id=$1",[id(71)]);check(await save(),1);
  await reset();await db.query("update stages set day_slot='early' where id=$1",[id(71)]);
  await db.query("insert into race_registrations(id,race_edition_id,team_season_id,status)values($1,$2,$3,'accepted')",[id(80),id(60),id(21)]);
  await injury({status:'active',recovered:null});await direct(80,30,'withdrawn');
  await denied(()=>db.query("update race_rosters set status='confirmed' where id=$1",[id(100)]),/blessé/);
  await db.query("insert into international_selection_stage_race_repairs values($1,'international-selection-stage-race-withdrawals-2026-09-03',true)",[id(100)]);
  await db.query("update race_rosters set status='confirmed' where id=$1",[id(100)]);checks++;
  await reset();await denied(()=>save(60,31),/effectif actif/);
  await db.query("insert into race_registrations(id,race_edition_id,team_season_id,status)values($1,$2,$3,'accepted')",[id(80),id(60),id(21)]);await denied(()=>direct(80,31),/effectif actif/);
  // Same-season CN junior ownership exception remains valid, ordinary races do not gain it.
  await db.exec(`insert into youth_academy_riders values('${id(90)}','${id(20)}','active');
    insert into academy_competition_rider_links values('${id(90)}','${id(32)}','${id(1)}');
    insert into race_registrations(id,race_edition_id,team_season_id,status)values('${id(81)}','${id(62)}','${id(21)}','accepted');`);
  await direct(81,32,'confirmed',101);checks++;await denied(()=>direct(80,32,'confirmed',102),/effectif actif/);
  await reset();await db.query('insert into national_federation_olympic_events values($1,$2,null)',[id(1),id(63)]);
  await denied(()=>save(63),/accord confirmé/);
  await db.exec(`insert into national_federation_selection_lists values('${id(95)}','${id(40)}','${id(1)}','nc-hills');
    insert into national_federation_selection_members values('${id(95)}','${id(30)}','confirmed');`);check(await save(63),1);
  check(await Promise.all(signatures.map(hash)),beforeHashes);
  console.log(JSON.stringify({isolated_sql:'passed',checks,real_rpc:true,all_guard_hashes_unchanged:true,injury_data_unchanged:true,production_touched:false}));
}finally{await db.close();}
