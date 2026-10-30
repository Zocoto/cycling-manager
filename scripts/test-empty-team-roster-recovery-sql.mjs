// Disposable in-memory PostgreSQL only. Never connects to Supabase.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

if (!process.env.EMPTY_ROSTER_SQL_TEST_MODULE) throw Error('An isolated PGlite module is required');
const { PGlite } = await import(pathToFileURL(process.env.EMPTY_ROSTER_SQL_TEST_MODULE).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const source = path => readFileSync(`supabase/migrations/${path}`, 'utf8').replaceAll('\r\n','\n');
const migration = source('20261030100000_add_empty_team_roster_recovery.sql');
const functionSource = (file,name) => {
  const text = source(file);
  const start = text.search(new RegExp(`create(?: or replace)? function ${name.replaceAll('.','\\.')}\\(`));
  assert(start >= 0, `Missing real function ${name}`);
  return text.slice(start,text.indexOf('$$;',start)+3);
};
let checks=0;
const check = (actual,expected) => { assert.deepEqual(actual,expected); checks++; };
const scalar = async (sql,args=[]) => Object.values((await db.query(sql,args)).rows[0])[0];
const reject = async (action,pattern) => { await assert.rejects(action,pattern); checks++; };
const identities = Array.from({length:7},(_,index) => ({first_name:`First${index}`,last_name:`Last${index}`,avatar_seed:String(100+index)}));
const recover = (data=identities,country=id(2)) => scalar('select public.recover_current_empty_team_roster($1::jsonb,$2::uuid)',[JSON.stringify(data),country]);
const state = async () => (await db.query('select * from public.get_current_empty_roster_recovery_state()')).rows[0];
const login = async (n=6) => db.query("select set_config('empty_roster_test.user',$1,false)",[n ? id(n) : '']);
try {
  await db.exec(`
    create schema auth; create schema private; create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('empty_roster_test.user',true),'')::uuid$$;
    create table countries(id uuid primary key,name text,iso_alpha2 text,is_active boolean default true);
    create table country_rider_generation_profiles(country_id uuid primary key,name_profile_code text,avatar_profile_key text);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text default 'active');
    create table teams(id uuid primary key,home_country_id uuid,status text default 'active');
    create table team_manager_assignments(id uuid primary key default gen_random_uuid(),sporting_director_id uuid,team_id uuid,role text,status text);
    create table seasons(id uuid primary key,game_year integer,starts_on date,status text,current_day_number integer default 22);
    create table team_seasons(id uuid primary key default gen_random_uuid(),team_id uuid,season_id uuid,registration_country_id uuid,status text,
      cash_balance numeric default 32100,operating_budget numeric default 50000,unique(team_id,season_id));
    create table initial_career_generations(team_id uuid primary key,sporting_director_id uuid,season_id uuid);
    create table riders(id uuid primary key default gen_random_uuid(),country_id uuid,first_name text,last_name text,status text,
      generated_name_profile_code text,avatar_profile_key text,avatar_seed bigint unique,potential_steps smallint,
      decline_resistance_multiplier numeric,created_at timestamptz default now());
    create sequence public.rider_avatar_seed_seq start 50000;
    create table rider_contracts(id uuid primary key default gen_random_uuid(),rider_id uuid,team_id uuid,start_season_id uuid,end_season_id uuid,
      salary_per_season numeric default 0,currency text,currency_code text default 'EUR',acquisition_type text,status text,
      signed_at timestamptz,salary_billing_from_game_day_index integer);
    create table rider_season_ratings(id uuid primary key default gen_random_uuid(),rider_id uuid,season_id uuid,age integer,
      mountain smallint,hills smallint,flat smallint,time_trial smallint,cobbles smallint,sprint smallint,acceleration smallint,
      downhill smallint,endurance smallint,resistance smallint,recovery smallint,breakaway smallint,prologue smallint,created_at timestamptz default now(),
      unique(rider_id,season_id));
    create table rider_season_summaries(rider_id uuid,season_id uuid,points numeric default 0,primary key(rider_id,season_id));
    create table season_days(id uuid primary key default gen_random_uuid(),season_id uuid,day_number integer);
    create table rider_condition_states(rider_id uuid,season_day_id uuid,form numeric,fatigue numeric,source text,primary key(rider_id,season_day_id));
    create table team_finance_transactions(id uuid primary key default gen_random_uuid(),team_season_id uuid,season_day_id uuid,day_number integer,
      amount numeric,category text,status text,description text,source_reference text,unique(team_season_id,source_reference));
    create table direct_transfer_offers(id uuid primary key,rider_id uuid,offered_rider_id uuid,status text);
    create function public.get_team_specialization_power(uuid,text,text) returns numeric language sql stable as $$select 3::numeric$$;
    insert into countries values('${id(1)}','France','FR',true),('${id(2)}','Rwanda','RW',true);
    insert into country_rider_generation_profiles values('${id(1)}','france','europe'),('${id(2)}','east_africa','east_africa');
    insert into sporting_directors(id,auth_user_id) values('${id(5)}','${id(6)}'),('${id(7)}','${id(8)}');
    insert into teams(id,home_country_id) values('${id(9)}','${id(1)}'),('${id(10)}','${id(1)}');
    insert into seasons(id,game_year,starts_on,status) values('${id(3)}',4,'2026-10-09','active'),('${id(4)}',5,'2026-11-06','planned'),('${id(11)}',3,'2026-09-11','completed');
    insert into team_manager_assignments(sporting_director_id,team_id,role,status) values('${id(5)}','${id(9)}','general_manager','active'),('${id(7)}','${id(10)}','general_manager','active');
    insert into team_seasons(team_id,season_id,registration_country_id,status) values('${id(9)}','${id(3)}','${id(2)}','active'),('${id(10)}','${id(3)}','${id(1)}','active');
    insert into initial_career_generations values('${id(9)}','${id(5)}','${id(11)}'),('${id(10)}','${id(7)}','${id(11)}');
    insert into season_days(season_id,day_number) select '${id(3)}',generate_series(1,28);
    create function public.get_current_dashboard_assistant_summary() returns table(game_date date,journal_items jsonb)
    language sql stable security definer set search_path='' set statement_timeout='3000ms' as $$
      with current_context as (select director.id as sporting_director_id,assignment.team_id,season.id as season_id
        from public.sporting_directors director join public.team_manager_assignments assignment on assignment.sporting_director_id=director.id
        join public.seasons season on season.status='active' where director.auth_user_id=auth.uid())
      select current_date,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('title','Existing mail')),
        'naturalizationAlerts',jsonb_build_array(),'equipmentPartnerSignatureAvailable', (select true))
      from current_context $$;
    revoke all on function public.get_current_dashboard_assistant_summary() from public,anon;
    grant execute on function public.get_current_dashboard_assistant_summary() to authenticated;
  `);
  // Use the production generation/defaults, salary quote and scheduler code.
  for (const name of ['calculate_initial_rider_potential_steps','assign_default_rider_potential'])
    await db.exec(functionSource('20260721210000_create_training_management.sql',`public.${name}`));
  for (const name of ['calculate_initial_rider_decline_resistance','assign_default_rider_decline_resistance'])
    await db.exec(functionSource('20260726113000_add_exponential_rider_decline.sql',`public.${name}`));
  await db.exec(functionSource('20260719221500_create_unique_rider_avatars.sql','public.assign_rider_avatar_identity'));
  await db.exec(functionSource('20260719230000_create_rider_profile_foundations.sql','public.initialize_rider_profile_state'));
  await db.exec(functionSource('20260721233000_randomize_initial_amateur_rider_ratings.sql','private.randomize_initial_amateur_rating'));
  const salarySource=source('20261014140000_profile_based_future_rider_salaries.sql');
  await db.exec(salarySource.slice(salarySource.indexOf('create or replace function'),salarySource.indexOf('do $patch$')));
  await db.exec(functionSource('20260720203000_create_rewards_finances_and_rankings.sql','public.sync_rider_salary_installments'));
  const promotionSource=source('20261022154500_fix_instant_youth_promotion_salary.sql');
  await db.exec(promotionSource.slice(promotionSource.indexOf('do $installments$'),promotionSource.indexOf('$installments$;')+16));
  await db.exec(functionSource('20260720203000_create_rewards_finances_and_rankings.sql','public.handle_finance_contract_change'));
  await db.exec(functionSource('20260908154500_activate_remaining_team_specializations.sql','public.apply_data_room_salary_discount'));
  await db.exec(functionSource('20261022190000_add_direct_transfer_trade_offers.sql','private.lock_direct_transfer_scope'));
  await db.exec(`
    create trigger default_potential before insert on public.riders for each row execute function public.assign_default_rider_potential();
    create trigger default_decline before insert on public.riders for each row execute function public.assign_default_rider_decline_resistance();
    create trigger default_avatar before insert on public.riders for each row execute function public.assign_rider_avatar_identity();
    create trigger default_profile after insert on public.riders for each row execute function public.initialize_rider_profile_state();
    create trigger data_room before insert on public.rider_contracts for each row execute function public.apply_data_room_salary_discount();
    create trigger salary_sync after insert or update of status,salary_per_season on public.rider_contracts for each row execute function public.handle_finance_contract_change();
  `);
  await login();
  const previousPayload=await scalar('select journal_items from public.get_current_dashboard_assistant_summary()');
  const originalFinances=(await db.query('select cash_balance,operating_budget from team_seasons order by team_id')).rows;
  await db.exec(migration);
  let current=await state();
  check(current,{available:true,team_country_id:id(2),team_country_name:'Rwanda',team_country_iso_alpha2:'RW',name_profile_code:'east_africa',recovered_this_season:false,has_committed_riders:false});
  const {emptyRosterRecoveryAvailable,...preservedPayload}=await scalar('select journal_items from public.get_current_dashboard_assistant_summary()');
  check(emptyRosterRecoveryAvailable,true);check(preservedPayload,previousPayload);
  check((await db.query(`select has_function_privilege('anon','public.recover_current_empty_team_roster(jsonb,uuid)','execute') as anon,
    has_function_privilege('authenticated','public.recover_current_empty_team_roster(jsonb,uuid)','execute') as player,
    has_function_privilege('authenticated','private.can_recover_empty_team_roster(uuid,uuid,uuid)','execute') as private_helper,
    has_table_privilege('authenticated','private.empty_team_roster_recoveries','select') as private_table`)).rows[0],
    {anon:false,player:true,private_helper:false,private_table:false});
  await login(null);check(await state(),undefined);await reject(()=>recover(),/session/);await login();
  await db.exec(`update sporting_directors set status='inactive' where id='${id(5)}'`);check(await state(),undefined);await reject(()=>recover(),/Aucune équipe/);
  await db.exec(`update sporting_directors set status='active' where id='${id(5)}';update team_manager_assignments set role='assistant' where sporting_director_id='${id(5)}'`);
  check(await state(),undefined);await reject(()=>recover(),/Aucune équipe/);
  await db.exec(`update team_manager_assignments set role='general_manager' where sporting_director_id='${id(5)}';delete from initial_career_generations where team_id='${id(9)}'`);
  check((await state()).available,false);await reject(()=>recover(),/équipes fondées/);
  await db.exec(`insert into initial_career_generations values('${id(9)}','${id(5)}','${id(11)}')`);
  await reject(()=>recover(null),/exactement sept/);await reject(()=>recover({}),/exactement sept/);
  await reject(()=>recover(identities.slice(0,6)),/exactement sept/);await reject(()=>recover([...identities,identities[0]]),/exactement sept/);
  for(const replacement of [null,{}, {...identities[0],first_name:''},{...identities[0],last_name:'<b>Bad</b>'},{...identities[0],avatar_seed:'-1'}, {...identities[0],avatar_seed:'1'.repeat(19)}])
    await reject(()=>recover([replacement,...identities.slice(1)]),/invalides/);
  await reject(()=>recover([identities[1],...identities.slice(1)]),/invalides/);
  await reject(()=>recover(identities,id(1)),/pays.*changé/);
  await db.exec(`insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status) values('${id(30)}','${id(9)}','${id(3)}','${id(3)}','active')`);
  check((await state()).has_committed_riders,true);check((await state()).available,false);await reject(()=>recover(),/sans contrat/);
  await db.exec(`update rider_contracts set status='planned'`);await reject(()=>recover(),/sans contrat/);
  await db.exec(`update rider_contracts set start_season_id='${id(4)}',end_season_id='${id(4)}'`);
  check((await state()).available,true);check((await state()).has_committed_riders,false);
  const futureContract=(await db.query('select * from rider_contracts')).rows;
  // A failing downstream trigger must roll back riders, contracts and receipt.
  await db.exec(`create function private.fail_recovery_test() returns trigger language plpgsql as $$begin
    if new.first_name='First3' then raise exception 'isolated downstream failure'; end if; return new; end$$;
    create trigger isolated_failure before insert on public.riders for each row execute function private.fail_recovery_test()`);
  await reject(()=>recover(),/isolated downstream failure/);
  check(Number(await scalar('select count(*) from riders')),0);check(Number(await scalar('select count(*) from private.empty_team_roster_recoveries')),0);
  await db.exec('drop trigger isolated_failure on public.riders');
  check(await recover(identities.map(row=>({...row,country_id:id(1),potential_steps:8,mountain:100}))),{status:'created',rider_count:7});
  const riders=(await db.query('select * from riders order by first_name')).rows;
  check(riders.length,7);check(riders.every(row=>row.country_id===id(2)&&row.generated_name_profile_code==='east_africa'&&row.avatar_profile_key==='east_africa'),true);
  check(riders.every(row=>row.potential_steps>=1&&row.potential_steps<=2&&Number(row.decline_resistance_multiplier)>=.55),true);
  check(new Set(riders.map(row=>row.avatar_seed)).size,7);
  const ratings=(await db.query('select * from rider_season_ratings order by age')).rows;
  check(ratings.map(row=>row.age),[18,19,20,21,22,23,24]);
  const axes=['mountain','hills','flat','time_trial','cobbles','sprint','acceleration','downhill','endurance','resistance','recovery','breakaway','prologue'];
  check(ratings.every(row=>axes.every(axis=>row[axis]>=35&&row[axis]<=70)),true);
  check(Number(await scalar('select count(*) from rider_condition_states where form=75 and fatigue=0')),7);
  check(Number(await scalar('select count(*) from rider_season_summaries')),7);
  check(Number(await scalar(`select count(*) from rider_contracts contract where rider_id in(select id from riders)
    and salary_per_season=round(public.calculate_rider_season_salary(contract.rider_id,'${id(3)}')*.91,2)
    and salary_per_season>0 and salary_billing_from_game_day_index=133 and end_season_id='${id(3)}'`)),7);
  check(Number(await scalar("select count(*) from team_finance_transactions where category='rider_salary' and day_number=28 and amount<0 and status='pending'")),7);
  check(Number(await scalar('select count(*) from team_finance_transactions where day_number<22')),0);
  check((await db.query('select cash_balance,operating_budget from team_seasons order by team_id')).rows,originalFinances);
  check((await db.query(`select * from rider_contracts where rider_id='${id(30)}'`)).rows,futureContract);
  check(Number(await scalar('select count(*) from initial_career_generations')),2);
  check(await recover(),{status:'already_recovered',rider_count:0});check(Number(await scalar('select count(*) from riders')),7);
  check((await state()).available,false);check((await state()).recovered_this_season,true);
  check(await scalar("select journal_items->'emptyRosterRecoveryAvailable' from public.get_current_dashboard_assistant_summary()"),false);
  await db.exec(`update rider_contracts set status='completed' where rider_id in(select id from riders)`);
  check((await state()).available,false);check(await recover(),{status:'already_recovered',rider_count:0});
  // Both sides of the once-per-season receipt survive manager changes.
  await db.exec(`update team_manager_assignments set status='ended';insert into team_manager_assignments(sporting_director_id,team_id,role,status)
    values('${id(5)}','${id(10)}','general_manager','active'),('${id(7)}','${id(9)}','general_manager','active')`);
  check((await state()).recovered_this_season,true);check((await state()).available,false);
  await login(8);check((await state()).recovered_this_season,true);check((await state()).available,false);await login();
  await db.exec(`update team_manager_assignments set status='ended';insert into team_manager_assignments(sporting_director_id,team_id,role,status)
    values('${id(5)}','${id(9)}','general_manager','active');update rider_contracts set status='completed';
    update seasons set status='completed' where id='${id(3)}';update seasons set status='active' where id='${id(4)}';
    insert into team_seasons(team_id,season_id,registration_country_id,status) values('${id(9)}','${id(4)}','${id(1)}','active');
    insert into season_days(season_id,day_number) select '${id(4)}',generate_series(1,28)`);
  check((await state()).available,true);check((await state()).team_country_name,'France');
  check(await recover(identities,id(1)),{status:'created',rider_count:7});
  check(Number(await scalar('select count(*) from private.empty_team_roster_recoveries')),2);
  check(Number(await scalar(`select count(*) from riders where country_id='${id(1)}'`)),7);
  // Receipt foreign keys do not block normal DS/team account removal.
  await db.exec(`delete from private.empty_team_roster_recoveries where season_id='${id(4)}';
    delete from sporting_directors where id='${id(5)}'`);
  check(Number(await scalar('select count(*) from private.empty_team_roster_recoveries')),0);
  console.log(JSON.stringify({checks,isolated:true,productionFixtures:false,realSalaryAndBillingFunctions:true}));
} catch(error) {
  console.error(JSON.stringify({message:error.message,code:error.code,where:error.where,stack:error.stack}));process.exitCode=1;
} finally { await db.close(); }
