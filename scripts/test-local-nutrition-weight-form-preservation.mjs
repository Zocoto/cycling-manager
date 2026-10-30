// Disposable in-memory PostgreSQL only. Never loads credentials or contacts Supabase.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]?.endsWith('/dist/index.js')) throw Error('Pass an isolated PGlite module, not a database URL.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const source = file => readFileSync(`supabase/migrations/${file}`,'utf8').replaceAll('\r\n','\n');
function realFunction(file,name) {
  const text=source(file), start=text.search(new RegExp(`create(?: or replace)? function ${name.replaceAll('.','\\.')}\\(`));
  assert(start>=0,`Missing real function ${name}`);
  return text.slice(start,text.indexOf('$$;',start)+3);
}
let checks=0;
const check=(actual,expected,message) => { assert.deepEqual(actual,expected,message);checks++; };
const reject=async(action,pattern) => { await assert.rejects(action,pattern);checks++; };
const scalar=async(sql,args=[]) => Object.values((await db.query(sql,args)).rows[0])[0];
const program=(rider,delta) => ({riderId:id(rider),weightDeltaKg:delta});
const dose=rider => ({riderId:id(rider),nutritionistContractId:id(32),interventionCode:'recovery_snack'});
const apply=async(programs,interventions=[]) => scalar('select public.apply_current_team_nutrition_plan($1::jsonb,$2::jsonb)',[JSON.stringify(interventions),JSON.stringify(programs)]);
const percent=async() => Number(await scalar(`select private.get_team_weight_program_form_preservation('${id(20)}')`));
const quote=async(team=id(20),season=id(21)) => scalar('select public.get_team_medical_staff_effective_quotes($1,$2)',[team,season]);
const snapshot=async() => (await db.query(`select
  (select jsonb_agg(r order by id) from riders r) riders,
  (select jsonb_agg(c order by rider_id,season_day_id) from rider_condition_states c) states,
  (select jsonb_agg(e order by id) from rider_weight_events e) events,
  (select jsonb_agg(n order by id) from rider_nutrition_interventions n) nutrition,
  (select jsonb_agg(f order by source_reference) from team_finance_transactions f) ledger,
  (select jsonb_agg(t order by id) from team_seasons t) finances`)).rows[0];
const resetRiders=async() => db.exec(`delete from rider_weight_events where rider_id <> '${id(19)}';
  delete from rider_nutrition_interventions;delete from team_finance_transactions;
  update riders set weight_kg=72 where id<>'${id(19)}';
  update rider_condition_states set form=80,fatigue=8;
  update team_seasons set cash_balance=10000;`);
const attributes=async() => (await db.query(`select oid::regprocedure::text signature,proacl::text acl,proconfig,prosecdef
  from pg_proc where oid in('public.apply_current_team_nutrition_plan(jsonb,jsonb)'::regprocedure,
  'public.get_team_medical_staff_effective_quotes(uuid,uuid)'::regprocedure) order by 1`)).rows;
try {
  await db.exec(`create schema auth;create schema private;create role anon;create role authenticated;create role service_role;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table seasons(id uuid primary key,game_year integer,status text,current_day_number integer);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,cash_balance numeric,registration_country_id uuid);
    create table season_days(id uuid primary key,season_id uuid,day_number integer,calendar_date date);
    create table riders(id uuid primary key,country_id uuid,height_cm numeric,weight_kg numeric,baseline_weight_kg numeric);
    create table rider_contracts(rider_id uuid,team_id uuid,status text);
    create table staff_members(id uuid primary key,role text,level integer,country_id uuid,first_name text,last_name text,trainer_specialty text);
    create table staff_contracts(id uuid primary key,staff_member_id uuid,team_id uuid,status text,federal_multiplier numeric default 1);
    create table staff_talent_catalog(code text primary key,role text,display_name text,minimum_level integer default 1,is_active boolean default true);
    create table staff_member_talents(staff_member_id uuid,slot_number integer,talent_code text references staff_talent_catalog(code),unlocked_by text,
      unique(staff_member_id,slot_number),unique(staff_member_id,talent_code));
    create table rider_condition_states(rider_id uuid,season_day_id uuid,form numeric(5,2),fatigue integer,source text,updated_at timestamptz default now(),unique(rider_id,season_day_id));
    create table rider_nutrition_interventions(id uuid primary key,rider_id uuid,team_season_id uuid,season_day_id uuid,
      nutritionist_contract_id uuid,intervention_code text,nutritionist_level integer,base_form_gain numeric,level_form_bonus numeric,
      actual_form_gain numeric,base_price numeric,price_paid numeric,form_before numeric,form_after numeric,applied_at timestamptz default now(),
      weight_before_kg numeric,weight_delta_kg numeric,weight_after_kg numeric,unique(rider_id,season_day_id));
    create table team_finance_transactions(team_season_id uuid,season_day_id uuid,day_number integer,amount numeric,category text,status text,
      description text,source_reference text unique,posted_at timestamptz);
    create table rider_weight_events(id uuid primary key default gen_random_uuid(),rider_id uuid,team_id uuid,season_id uuid,season_day_id uuid,
      game_day_index integer,source text,weight_before_kg numeric(5,1),weight_delta_kg numeric(4,1),weight_after_kg numeric(5,1),form_cost numeric(5,1),
      source_reference text unique,applied_at timestamptz default now(),constraint rider_weight_events_source_allowed check(source in('supplement','weight_cut')));
    create table medical_protocol_catalog(code text,price numeric,duration_reduction_pct numeric,form_loss_per_day numeric,is_active boolean);
    create function sync_active_season_day() returns void language sql as $$select$$;
    create function settle_current_team_finances() returns void language sql as $$select$$;
    create function get_nutritionist_daily_capacity(integer) returns integer language sql as $$select 35$$;
    create function get_staff_contract_talent_flat_bonus(uuid,text,integer) returns integer language sql as $$select 0$$;
    create function get_nutritionist_intervention_price(uuid,numeric,integer) returns numeric language sql as $$select $2$$;
    create function physiology_seed_fraction(text) returns numeric language sql as $$select 0$$;
    create function get_team_doctor_protocol_price(uuid,numeric) returns numeric language sql as $$select $2$$;
    create function get_team_doctor_protocol_effectiveness(uuid,numeric) returns numeric language sql as $$select $2$$;
    create function get_team_doctor_protocol_form_loss(uuid,numeric) returns numeric language sql as $$select $2$$;
    create function get_staff_contract_federal_institute_multiplier(uuid) returns numeric language sql stable as $$select coalesce((select federal_multiplier from staff_contracts where id=$1),1)$$;
    insert into sporting_directors values('${id(90)}','${id(99)}','active');
    insert into team_manager_assignments values('${id(90)}','${id(20)}','general_manager','active');
    insert into seasons values('${id(10)}',4,'active',20),('${id(11)}',5,'planned',1);
    insert into team_seasons values('${id(21)}','${id(20)}','${id(10)}',10000,'${id(50)}');
    insert into season_days values('${id(100)}','${id(10)}',20,'2026-10-28'),('${id(101)}','${id(10)}',24,'2026-11-01'),
      ('${id(102)}','${id(10)}',25,'2026-11-02'),('${id(103)}','${id(11)}',1,'2026-11-06');
    insert into staff_members values('${id(31)}','nutritionist',1,'${id(51)}','Camille','Nutrition',null),
      ('${id(33)}','nutritionist',5,'${id(51)}','Strong','Nutrition',null),('${id(35)}','doctor',5,'${id(50)}','Wrong','Role',null);
    insert into staff_contracts(id,staff_member_id,team_id,status) values('${id(30)}','${id(31)}','${id(20)}','active'),
      ('${id(32)}','${id(33)}','${id(20)}','active'),('${id(34)}','${id(35)}','${id(20)}','active');
    insert into staff_talent_catalog(code,role,display_name) values('nutrition_daily_form','nutritionist','Suivi quotidien');
    insert into staff_member_talents values('${id(31)}',1,'nutrition_daily_form','generation');
    select set_config('test.user','${id(99)}',false);`);
  for(let n=1;n<=19;n++) {
    await db.query('insert into riders values($1,$2,180,72,72)',[id(n),id(50)]);
    await db.query("insert into rider_contracts values($1,$2,'active')",[id(n),n===18?id(999):id(20)]);
    await db.query("insert into rider_condition_states values($1,$2,80,8,'daily_settlement',now())",[id(n),id(100)]);
  }
  await db.exec(source('20260927100000_optimize_nutrition_batch_retry.sql'));
  await db.exec(source('20261007120000_increase_supplement_risk_with_regularity.sql'));
  await db.exec(`create trigger supplement_risk before insert on rider_nutrition_interventions for each row execute function apply_supplement_weight_risk()`);
  await db.exec(source('20261008160000_add_atomic_weight_programs.sql'));
  await db.exec(realFunction('20260727160000_create_unique_staff_talents.sql','public.get_staff_contract_nationality_multiplier'));
  await db.exec(realFunction('20260908210000_activate_federal_staff_institute_specializations.sql','public.get_staff_contract_talent_percentage'));
  await db.exec(realFunction('20260909140000_fix_staff_affix_effect_parity.sql','public.get_team_medical_staff_effective_quotes'));
  await db.exec(`revoke all on function get_team_medical_staff_effective_quotes(uuid,uuid) from public,anon,authenticated;
    grant execute on function get_team_medical_staff_effective_quotes(uuid,uuid) to service_role;`);
  await db.exec(realFunction('20261012190000_rework_staff_educator_talents.sql','public.get_staff_academy_available_talents'));
  const originalQuote=await quote(),originalAttributes=await attributes();
  const oldTalent=(await db.query('select * from staff_member_talents')).rows;
  await apply([program(19,-1)]);
  const oldEvent=(await db.query(`select * from rider_weight_events where rider_id='${id(19)}'`)).rows;
  await db.exec(source('20261030120000_add_nutrition_weight_program_form_preservation.sql'));
  check(await attributes(),originalAttributes,'Existing privilege, timeout and definer metadata preserved');
  check((await db.query('select * from staff_member_talents')).rows,oldTalent,'No retroactive staff reroll');
  check((await db.query(`select * from rider_weight_events where rider_id='${id(19)}'`)).rows,oldEvent,'Past programme cost unchanged');
  check(await quote(),{...originalQuote,weightProgramFormPreservationPercentage:0},'Existing quote fields preserved');
  check(await percent(),0);
  check((await quote(id(999),id(21))).weightProgramFormPreservationPercentage,0,'Mismatched quote context fails closed');
  check(await scalar(`select exists(select 1 from get_staff_academy_available_talents('${id(31)}') where code='nutrition_weight_program_form_preservation')`),true,'Academy automatically offers the new line');
  await db.exec(`insert into staff_member_talents values('${id(31)}',2,'nutrition_weight_program_form_preservation','professions_building');`);
  check(await scalar(`select exists(select 1 from get_staff_academy_available_talents('${id(31)}') where code='nutrition_weight_program_form_preservation')`),false,'Academy cannot grant a duplicate');
  // Every star level, programme direction and dose uses exact numeric form cost.
  for(let level=1;level<=5;level++) {
    await db.query('update staff_members set level=$1 where id=$2',[level,id(31)]);
    check(await percent(),level*5);
    check((await quote()).weightProgramFormPreservationPercentage,level*5);
    for(const sign of [-1,1]) for(const step of [0.2,0.4,0.6,0.8,1]) {
      await resetRiders();
      await apply([program(1,sign*step)]);
      const actual=(await db.query(`select event.form_cost,state.form,rider.weight_kg,rider.baseline_weight_kg
        from rider_weight_events event join riders rider on rider.id=event.rider_id
        join rider_condition_states state on state.rider_id=event.rider_id and state.season_day_id=event.season_day_id
        where event.rider_id='${id(1)}'`)).rows[0];
      const cost=Math.round(step*20*(1-level*.05)*10)/10;
      check(Number(actual.form_cost),cost);check(Number(actual.form),80-cost);
      check(Number(actual.weight_kg),Math.round((72+sign*step)*10)/10);check(Number(actual.baseline_weight_kg),72);
    }
  }
  await resetRiders();
  await db.exec(`insert into staff_member_talents values('${id(33)}',1,'nutrition_weight_program_form_preservation','generation');`);
  check(await percent(),25,'Two 5-star nutritionists do not stack');
  await db.query('update staff_members set country_id=$1 where id=$2',[id(50),id(31)]);
  check(await percent(),27.5,'Ordinary nationality efficiency applies');
  await db.query('update staff_contracts set federal_multiplier=1.12 where id=$1',[id(30)]);
  check(await percent(),30.8,'Ordinary federal efficiency applies');
  await db.query('update staff_contracts set federal_multiplier=4 where id=$1',[id(30)]);
  check(await percent(),35,'Protection remains bounded even with excessive multipliers');
  await db.exec(`update staff_contracts set status='expired' where id='${id(30)}'`);check(await percent(),25);
  await db.exec(`update staff_contracts set team_id='${id(999)}' where id='${id(32)}'`);check(await percent(),0,'Other teams do not contribute');
  await db.exec(`update staff_contracts set team_id='${id(20)}' where id='${id(32)}'`);
  await apply([program(1,0.2)]);const saved=await snapshot();
  await db.exec(`update staff_members set level=1 where id='${id(33)}'`);
  check(await apply([program(1,0.2)]),await apply([program(1,0.2)]));
  check(await snapshot(),saved,'Exact retry never reprices a past programme after an affix change');
  await reject(()=>apply([program(1,-0.2)]),/délai de cinq jours/);
  await reject(()=>db.query('select apply_current_team_weight_cut($1,0.2)',[id(1)]),/délai de cinq jours/);
  await db.exec(`update seasons set current_day_number=24 where id='${id(10)}'`);
  await reject(()=>apply([program(1,-0.2)]),/délai de cinq jours/);
  await db.exec(`update seasons set current_day_number=25 where id='${id(10)}'`);
  await apply([program(1,-0.2)]);checks++;
  await db.exec(`update seasons set current_day_number=20 where id='${id(10)}'`);
  await resetRiders();await db.query('update rider_condition_states set form=3.8 where rider_id=$1',[id(2)]);
  await apply([program(2,-0.2)]);check(Number(await scalar(`select form from rider_condition_states where rider_id='${id(2)}'`)),0,'Fractional saved form unlocks an otherwise unaffordable programme');
  await resetRiders();await db.query('update rider_condition_states set form=2 where rider_id=$1',[id(2)]);
  const beforeFailure=await snapshot();
  await reject(()=>apply([program(1,0.4),program(2,1)],[dose(3)]),/forme.*insuffisante/);
  check(await snapshot(),beforeFailure,'A later failure rolls back supplements, weight, form, cash and events');
  await reject(()=>apply([program(18,0.2)]),/effectif actif/);
  await reject(()=>apply([program(3,0.3)]),/ajustement de poids/);
  await reject(()=>apply([program(3,0.2),program(3,0.4)]),/seul programme/);
  await db.exec(`select set_config('test.user','',false)`);await reject(()=>apply([program(3,0.2)]),/Authentification/);
  await db.exec(`select set_config('test.user','${id(99)}',false);set role anon`);
  await reject(()=>apply([program(3,0.2)]),/permission denied/);await db.exec('reset role');
  const legacy=await scalar('select apply_current_team_weight_cut($1,0.2)',[id(3)]);
  check(await scalar('select apply_current_team_weight_cut($1,0.2)',[id(3)]),legacy,'Legacy single action shares reduced cost and retry protection');
  check(Number(await scalar(`select form_cost from rider_weight_events where rider_id='${id(3)}'`)),3.8);
  const helper='private.get_team_weight_program_form_preservation(uuid)';
  for(const role of ['anon','authenticated','service_role'])
    check(await scalar(`select has_function_privilege('${role}','${helper}','execute')`),false);
  check(await scalar(`select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='${helper}'::regprocedure`),true);
  console.log(JSON.stringify({checks,isolated:true,productionFixtures:false,realBatchAndPercentageAndPreviewFunctions:true}));
} catch(error) {
  console.error(JSON.stringify({message:error.message,code:error.code,where:error.where,stack:error.stack}));process.exitCode=1;
} finally { await db.close(); }
