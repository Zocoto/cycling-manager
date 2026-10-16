// This harness only opens an in-memory PostgreSQL database. Never production.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
if(!process.env.FINANCE_SQL_TEST_MODULE) throw new Error('An isolated PGlite module is required');
const {PGlite}=await import(pathToFileURL(process.env.FINANCE_SQL_TEST_MODULE).href);
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const migration=readFileSync('supabase/migrations/20261016120000_add_financial_director.sql','utf8');
const functions=JSON.parse(readFileSync('artifacts/.tmp-financial-director/functions.json','utf8'));
let checks=0;
const check=(actual,expected)=>{assert.equal(actual,expected);checks++;};
try {
  await db.exec(`
    create schema private; create schema auth; create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql as $$ select '${id(10)}'::uuid $$;
    create table sporting_directors(id uuid,auth_user_id uuid,status text);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table team_infrastructures(team_id uuid,infrastructure_code text,level integer);
    create function settle_due_infrastructure_projects() returns void language plpgsql as $$ begin end $$;
    create function settle_due_staff_academy_trainings() returns integer language plpgsql as $$ begin return 0; end $$;
    create function get_team_staff_academy_educator_bonuses(uuid) returns jsonb language sql as $$ select '{"activeEducatorCount":1}'::jsonb $$;
    create table staff_academy_trainings(
      id uuid default gen_random_uuid(),team_id uuid,team_season_id uuid,started_season_id uuid,
      staff_contract_id uuid,staff_member_id uuid,improvement_type text,previous_level integer,
      previous_talent_count integer,target_slot integer,cost numeric,duration_days integer,
      started_day_number integer,starts_game_day_index integer,completes_game_day_index integer,
      educator_cost_reduction_percentage numeric,educator_duration_reduction_percentage numeric,
      educator_mentorship_reduction_days integer,educator_talent_choice_count integer,
      talent_choice_codes text[] default '{}',status text default 'active');
    create table countries(id uuid primary key,is_active boolean default true);
    create table seasons(id uuid primary key,status text,current_day_number integer,game_year integer default 4);
    create table season_days(id uuid primary key,season_id uuid,day_number integer,calendar_date date);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,status text default 'active',registration_country_id uuid,cash_balance numeric default 0);
    create table staff_members(id uuid primary key default gen_random_uuid(),role text,level integer,country_id uuid,first_name text,last_name text,trainer_specialty text,architect_specialty text,
      constraint staff_members_role_allowed check(role in ('educator','trainer')));
    create table staff_talent_catalog(code text primary key,role text,display_name text,minimum_level integer,is_active boolean default true,
      constraint staff_talent_catalog_role_allowed check(role in ('educator','trainer')));
    create table recruitment_alerts(staff_role text,constraint recruitment_alerts_staff_role_allowed check(staff_role is null or staff_role in ('educator','trainer')));
    create table staff_member_talents(staff_member_id uuid,slot_number integer,talent_code text,unlocked_by text default 'generation',created_at timestamptz default now(),unique(staff_member_id,slot_number),unique(staff_member_id,talent_code));
    create table staff_contracts(id uuid primary key default gen_random_uuid(),staff_member_id uuid,team_id uuid,status text default 'active',signed_at timestamptz default now());
    create table team_sponsor_contracts(id uuid primary key,team_id uuid,role text);
    create table team_finance_transactions(id uuid primary key default gen_random_uuid(),team_season_id uuid,season_day_id uuid,day_number integer,amount numeric,category text,status text,description text,source_reference text,posted_at timestamptz,unique(team_season_id,source_reference));
    create table staff_market_batches(id uuid primary key default gen_random_uuid(),market_date date unique,staff_count integer default 25);
    create table staff_market_listings(id uuid primary key default gen_random_uuid(),batch_id uuid,staff_member_id uuid,daily_slot integer,signing_fee numeric,salary_per_season numeric,status text default 'available',unique(batch_id,daily_slot));
    create function calculate_staff_signing_fee(text,integer) returns numeric language plpgsql as $$ begin return calculate_staff_salary($1,$2)*0.15; end $$;
  `);
  for(const fn of functions) await db.exec(fn.definition);
  await db.exec(`insert into team_finance_transactions(team_season_id,day_number,amount,category,status,description,source_reference,posted_at)
    values('${id(6)}',1,1234,'race_prize','posted','Historical win','historical:unchanged',now()-interval '2 days')`);
  await db.exec(migration);
  check(Number(await scalar(`select amount from team_finance_transactions where source_reference='historical:unchanged'`)),1234);
  check(await scalar(`select count(*)::int from team_finance_transactions`),1);
  await db.exec(`delete from team_finance_transactions`);
  for(const fn of functions) check(await scalar(`select position('financial_director' in pg_get_functiondef($1::regprocedure))>0`,[fn.signature]),true);
  check(Number(await scalar(`select calculate_staff_salary('financial_director',5)`)),90000);
  await db.exec(`insert into countries values('${id(1)}',true),('${id(2)}',true);
    insert into seasons(id,status,current_day_number) values('${id(3)}','active',8);
    insert into season_days values('${id(4)}','${id(3)}',8,(now() at time zone 'Europe/Paris')::date),('${id(5)}','${id(3)}',7,(now() at time zone 'Europe/Paris')::date-1);
    insert into team_seasons(id,team_id,season_id,registration_country_id) values('${id(6)}','${id(7)}','${id(3)}','${id(1)}');
    insert into team_sponsor_contracts values('${id(8)}','${id(7)}','principal');`);
  // Real market functions: exactly one generated affix even for a five-star hire.
  const candidate={country_id:id(1),first_name:'Test',last_name:'Finance',role:'financial_director',level:5,talent_code:'finance_race_prizes'};
  check(await scalar(`select append_staff_market_wave(current_date,0,$1::jsonb)`,[JSON.stringify(Array(5).fill(candidate))]),5);
  check(await scalar(`select count(*)::int from staff_member_talents`),5);
  check(await scalar(`select append_staff_market_wave(current_date,0,$1::jsonb)`,[JSON.stringify(Array(5).fill(candidate))]),0);
  check(await scalar(`select create_daily_staff_market(current_date+1,$1::jsonb)`,[JSON.stringify(Array(25).fill(candidate))]),25);
  check(await scalar(`select count(*)::int from staff_member_talents`),30);
  const member=await scalar(`select id from staff_members limit 1`);
  await db.query(`update staff_members set level=1 where id=$1`,[member]);
  await db.query(`insert into staff_contracts(id,staff_member_id,team_id,signed_at) values($1,$2,$3,date_trunc('day',now() at time zone 'Europe/Paris') at time zone 'Europe/Paris')`,[id(9),member,id(7)]);
  await db.exec(`insert into sporting_directors values('${id(10)}','${id(10)}','active');
    insert into team_manager_assignments values('${id(10)}','${id(7)}','general_manager','active');
    insert into team_infrastructures values('${id(7)}','staff_academy',1);`);
  await assert.rejects(db.query(`select start_current_team_staff_academy_training($1,'talent')`,[id(9)]),/niveau du Directeur/);checks++;
  await assert.rejects(db.query(`insert into staff_contracts(staff_member_id,team_id) select id,$1 from staff_members where id<>$2 limit 1`,[id(7),member]),/seul Directeur financier/);checks++;
  await assert.rejects(db.query(`insert into staff_member_talents(staff_member_id,slot_number,talent_code,unlocked_by) values($1,2,'finance_daily_income','professions_building')`,[member]),/niveau/);checks++;
  await db.query(`update staff_members set level=2 where id=$1`,[member]);
  await db.query(`select start_current_team_staff_academy_training($1,'talent')`,[id(9)]);
  check(Number(await scalar(`select cost from staff_academy_trainings limit 1`)),0);
  check(await scalar(`select count(*)::int from staff_member_talents where staff_member_id=$1`,[member]),1);
  await db.exec(`delete from staff_academy_trainings`);
  await assert.rejects(db.query(`insert into staff_member_talents(staff_member_id,slot_number,talent_code) values($1,2,'finance_daily_income')`,[member]),/Académie/);checks++;
  await db.query(`insert into staff_member_talents(staff_member_id,slot_number,talent_code,unlocked_by) values($1,2,'finance_daily_income','professions_building')`,[member]);
  const post=async(source,category='race_prize',amount=1000,status='posted',day=4)=>{
    await db.query(`insert into team_finance_transactions(team_season_id,season_day_id,day_number,amount,category,status,description,source_reference,posted_at)
      values($1,$2,$3,$4,$5,$6,'Test receipt',$7,now()) on conflict(team_season_id,source_reference) do nothing`,
      [id(6),id(day),day===4?8:7,amount,category,status,source]);
  };
  const bonuses=()=>scalar(`select count(*)::int from team_finance_transactions where source_reference like 'financial-director:bonus:%'`);
  const balance=async()=>Number(await scalar(`select cash_balance from team_seasons where id=$1`,[id(6)]));
  await post('race:1');check(await balance(),44); // 2 stars: 4%, +10% affinity.
  await post('race:1');check(await balance(),44);
  await post('race:pending','race_prize',1000,'pending');check(await balance(),44);
  await db.exec(`update team_finance_transactions set status='posted' where source_reference='race:pending'`);check(await balance(),88);
  await db.exec(`update team_finance_transactions set status='posted' where source_reference='race:pending'`);check(await balance(),88);
  await post('refund:race');await post('race:negative','race_prize',-1000);await post('transfer:1','transfer');
  await post('old-race','race_prize',1000,'posted',5);await post('sponsor-main-objective:1','sponsor');
  check(await bonuses(),2);
  check(await scalar(`select settle_due_financial_director_income()`),1);check(await balance(),418);
  check(await scalar(`select settle_due_financial_director_income()`),0);check(await balance(),418);
  await db.query(`update staff_members set level=5 where id=$1`,[member]);
  check(await scalar(`select settle_due_financial_director_income()`),0);check(await balance(),418);
  await db.query(`insert into staff_member_talents(staff_member_id,slot_number,talent_code,unlocked_by) values($1,3,'finance_main_sponsor','professions_building')`,[member]);
  await post(`sponsor:${id(8)}:${id(3)}:2`,'sponsor',10000);check(await balance(),693); // 2.75%.
  await post('secondary-sponsor-objective:1','sponsor',10000);check(await balance(),693); // Not owned.
  await db.query(`update staff_member_talents set talent_code='finance_secondary_sponsor' where staff_member_id=$1 and slot_number=3`,[member]);
  await post('secondary-sponsor-objective:2','sponsor',10000);check(await balance(),1243); // 5.5%.
  await db.query(`update staff_members set country_id=$1 where id=$2`,[id(2),member]);
  await post('race:no-affinity');check(await balance(),1343); // 10%, not 11%.
  await post('race:corrected');check(await balance(),1443);
  await db.exec(`update team_finance_transactions set amount=500 where source_reference='race:corrected'`);check(await balance(),1393);
  await db.exec(`update team_finance_transactions set status='cancelled' where source_reference='race:corrected'`);check(await balance(),1343);
  await db.exec(`update team_finance_transactions set status='posted' where source_reference='race:corrected'`);check(await balance(),1393);
  await db.exec(`update staff_contracts set status='terminated' where id='${id(9)}'`);
  await post('race:after-dismissal');check(await balance(),1393);
  // Replacing a director cannot pay another daily income for the same team/day.
  const replacement=await scalar(`select id from staff_members where id<>$1 limit 1`,[member]);
  await db.query(`update staff_member_talents set talent_code='finance_daily_income' where staff_member_id=$1`,[replacement]);
  await db.query(`insert into staff_contracts(staff_member_id,team_id) values($1,$2)`,[replacement,id(7)]);
  check(await scalar(`select settle_due_financial_director_income()`),0);
  check(await scalar(`select has_function_privilege('authenticated','public.settle_due_financial_director_income()','EXECUTE')`),false);
  console.log(JSON.stringify({isolatedPostgres:true,checks,productionFixtures:false}));
} finally {await db.close();}
