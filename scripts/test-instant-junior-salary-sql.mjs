// Disposable PostgreSQL/WASM only. No network, credentials or live database.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const {PGlite} = await import(pathToFileURL(process.env.JUNIOR_SALARY_SQL_TEST_MODULE ?? resolve('artifacts/.tmp-performance-preparations/node_modules/@electric-sql/pglite/dist/index.js')).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let checks = 0;
const check = (actual, expected, message) => {assert.deepEqual(actual, expected, message); checks++;};
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const scalar = async (sql, params = []) => Object.values((await rows(sql, params))[0])[0];
const reject = async (sql, params = [], message) => {
  await assert.rejects(() => db.query(sql, params), message ? error => error.message.includes(message) : undefined);
  checks++;
};
function historicalFunction(path, name) {
  const source = readFileSync(path, 'utf8');
  const start = source.toLowerCase().indexOf(`create or replace function public.${name}(`);
  assert(start >= 0, `${name} historical definition missing`);
  const body = source.slice(start);
  const delimiter = /\bas\s+(\$[a-z_]*\$)/iu.exec(body);
  assert(delimiter, `${name} body delimiter missing`);
  const end = body.indexOf(delimiter[1], delimiter.index + delimiter[0].length);
  assert(end >= 0, `${name} body terminator missing`);
  return `${body.slice(0, end + delimiter[1].length)};`;
}
const migration = readFileSync('supabase/migrations/20261022154500_fix_instant_youth_promotion_salary.sql', 'utf8');
const salaryMigration = 'supabase/migrations/20261014140000_profile_based_future_rider_salaries.sql';
const contract = n => rows('select * from public.rider_contracts where rider_id=$1 order by start_season_id', [id(n)]);
const due = contractId => rows('select day_number,amount::text,status,description,source_reference,posted_at from public.team_finance_transactions where source_reference like $1 order by day_number', [`rider-salary:${contractId}:%`]);
const promote = (inventory, academy) => scalar('select public.redeem_instant_youth_promotion_reward($1,$2)', [id(inventory), id(academy)]);

try {
  await db.exec(`
    create schema auth; create schema private;
    create role anon; create role authenticated; create role service_role bypassrls;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.auth_uid',true),'')::uuid $$;
    create table public.seasons(id uuid primary key default gen_random_uuid(),game_year int unique,name text,starts_on date,ends_on date,status text,current_day_number int);
    create table public.season_days(id uuid primary key default gen_random_uuid(),season_id uuid,day_number smallint,unique(season_id,day_number));
    create table public.teams(id uuid primary key,name text,status text default 'active');
    create table public.team_seasons(id uuid primary key default gen_random_uuid(),team_id uuid,season_id uuid,status text,currency text default 'EUR',cash_balance numeric default 100000,registration_country_id uuid);
    create table public.sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table public.team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table public.riders(id uuid primary key default gen_random_uuid(),country_id uuid,first_name text,last_name text,status text,potential_steps smallint);
    create table public.rider_season_ratings(rider_id uuid,season_id uuid,age smallint,mountain smallint,hills smallint,flat smallint,time_trial smallint,cobbles smallint,sprint smallint,acceleration smallint,downhill smallint,endurance smallint,resistance smallint,recovery smallint,breakaway smallint,prologue smallint,primary key(rider_id,season_id));
    create table public.rider_season_summaries(rider_id uuid,season_id uuid,points int default 0,primary key(rider_id,season_id));
    create table public.rider_condition_states(rider_id uuid,season_day_id uuid,form smallint,fatigue smallint,source text,primary key(rider_id,season_day_id));
    create table public.youth_academy_riders(id uuid primary key default gen_random_uuid(),team_id uuid,country_id uuid,first_name text,last_name text,birth_game_year int,potential_steps smallint,mountain numeric default 2,hills numeric default 2,flat numeric default 2,time_trial numeric default 2,cobbles numeric default 2,sprint numeric default 2,acceleration numeric default 2,downhill numeric default 2,endurance numeric default 2,resistance numeric default 2,recovery numeric default 2,breakaway numeric default 2,prologue numeric default 2,status text default 'active',promotion_game_year int,promoted_rider_id uuid,updated_at timestamptz default now());
    create table public.rider_special_abilities(rider_id uuid,ability_code text,source_type text,source_reference text,primary key(rider_id,ability_code));
    create table public.rider_contracts(id uuid primary key default gen_random_uuid(),rider_id uuid not null,team_id uuid not null,start_season_id uuid not null,end_season_id uuid not null,salary_per_season numeric(14,2) not null default 0,currency text default 'EUR',currency_code text default 'EUR',status text default 'planned',signed_at timestamptz,created_at timestamptz default now(),acquisition_type text default 'initial',transfer_locked_season_id uuid,joined_day_number smallint,left_season_id uuid,left_day_number smallint,transfer_fee numeric,homegrown_salary_before_discount numeric,roster_management_salary_before_discount numeric,roster_management_discount_percent numeric not null default 0,squad_status text,unique(rider_id,team_id,start_season_id));
    create table public.team_finance_transactions(id uuid primary key default gen_random_uuid(),team_season_id uuid not null,season_day_id uuid,day_number smallint not null,amount numeric(14,2) not null,category text not null,status text not null default 'pending',description text not null,source_reference text not null,created_at timestamptz default now(),posted_at timestamptz,unique(team_season_id,source_reference));
    create table public.youth_development_notifications(id uuid primary key default gen_random_uuid(),team_id uuid,notification_type text,title text,message text,source_reference text,read_at timestamptz,created_at timestamptz default now(),unique(team_id,source_reference));
    create table public.daily_reward_catalog(reward_key text primary key,effect_kind text,name text,is_active boolean default true);
    create table public.daily_reward_inventory(id uuid primary key,sporting_director_id uuid,reward_key text,status text default 'available',expires_after_game_year int,used_at timestamptz,usage_payload jsonb);
    create table public.inventory_catalog_items(id uuid primary key,effect_payload jsonb,name text,status text default 'active');
    create table public.team_item_inventory(id uuid primary key,team_season_id uuid,inventory_item_id uuid,quantity int,updated_at timestamptz default now());
    create table public.development_teams(id uuid primary key,team_id uuid,season_id uuid,status text);
    create table public.development_team_roster(development_team_id uuid,academy_rider_id uuid);
    create table public.development_race_editions(id uuid primary key,status text,start_day_number int,end_day_number int,race_format text,selection_minimum int);
    create table public.development_race_registrations(id uuid primary key,development_team_id uuid,race_edition_id uuid,status text,updated_at timestamptz default now());
    create table public.development_race_registration_riders(registration_id uuid,academy_rider_id uuid);
    create table public.development_race_results(race_edition_id uuid,academy_rider_id uuid,result_scope text);
    create table public.test_team_bonuses(team_id uuid primary key,data_room numeric default 0,retention numeric default 0);
    create function public.get_team_specialization_power(p_team uuid,p_building text,p_branch text) returns numeric language sql stable as $$ select coalesce((select data_room from public.test_team_bonuses where team_id=p_team),0) $$;
    create function public.get_roster_management_renewal_discount(p_team uuid) returns numeric language sql stable as $$ select coalesce((select retention from public.test_team_bonuses where team_id=p_team),0) $$;
    -- Unrelated external settlement/clock paths are deliberately inert in the isolated fixture.
    create function public.sync_active_season_day() returns void language sql as $$ select $$;
    create function public.settle_current_team_finances() returns void language sql as $$ select $$;
    create function public.ensure_transfer_next_season(p_season uuid) returns uuid language sql as $$ select id from public.seasons where game_year=(select game_year+1 from public.seasons where id=p_season) $$;
  `);
  for (const name of ['calculate_rider_salary_profile_score','calculate_rider_salary_base','rider_salary_result_multiplier','rider_two_season_salary_adjustment']) {
    await db.exec(historicalFunction(salaryMigration,name));
  }
  const baseline = readFileSync('scripts/fixtures/instant-junior-salary-before.sql','utf8');
  await db.exec(baseline);
  // Assert the scheduling function is the exact captured production definition,
  // not an easier hand-written stand-in for its four weekly instalments.
  check(await scalar("select md5(pg_get_functiondef('public.sync_rider_salary_installments(uuid)'::regprocedure))"),'e1a4dff62565674534147a2d1bb182fb');
  await db.exec(historicalFunction('supabase/migrations/20260727101000_add_homegrown_special_ability.sql','grant_homegrown_ability_from_academy'));
  await db.exec('create trigger grant_homegrown_ability_from_academy_after_write after insert or update on public.youth_academy_riders for each row execute function public.grant_homegrown_ability_from_academy()');
  await db.exec(`
    insert into public.seasons values ('${id(4)}',4,'Saison 4','2026-10-09','2026-11-05','active',18),('${id(5)}',5,'Saison 5','2026-11-06','2026-12-03','planned',1),('${id(6)}',6,'Saison 6','2026-12-04','2026-12-31','planned',1);
    insert into public.season_days(season_id,day_number) select s.id,g from public.seasons s cross join generate_series(1,28) g;
    insert into public.teams(id,name) values('${id(10)}','Club formateur'),('${id(11)}','Autre club');
    insert into public.team_seasons(id,team_id,season_id,status) select ('00000000-0000-4000-8000-'||lpad((100+s.game_year)::text,12,'0'))::uuid,'${id(10)}',s.id,s.status from public.seasons s;
    insert into public.team_seasons(id,team_id,season_id,status) values('${id(114)}','${id(11)}','${id(4)}','active');
    insert into public.sporting_directors values('${id(20)}','${id(1)}','active');
    insert into public.team_manager_assignments values('${id(20)}','${id(10)}','general_manager','active');
    select set_config('test.auth_uid','${id(1)}',false);
    insert into public.test_team_bonuses values('${id(10)}',2,10);
    insert into public.daily_reward_catalog values('instant','instant_youth_promotion','Contrat Espoir immédiat',true);
    insert into public.inventory_catalog_items values('${id(51)}','{"effectKind":"instant_youth_promotion"}','Contrat Espoir immédiat','active');
    insert into public.development_teams values('${id(60)}','${id(10)}','${id(4)}','active');
  `);
  // Existing affected and unaffected careers before the migration.
  for (let n=201;n<=209;n++) {
    await db.query('insert into public.riders(id,country_id,first_name,last_name,status,potential_steps) values($1,$2,$3,$4,$5,4)',[id(n),id(90),`Junior ${n}`,'Fixture','active']);
    await db.query('insert into public.rider_season_ratings values($1,$2,18,50,50,50,50,50,50,50,50,50,50,50,50,50)',[id(n),id(4)]);
    await db.query("insert into public.youth_academy_riders(id,team_id,country_id,first_name,last_name,birth_game_year,potential_steps,status,promoted_rider_id) values($1,$2,$3,$4,'Fixture',-14,4,'promoted',$5)",[id(n+1000),id(10),id(90),`Junior ${n}`,id(n)]);
    await db.query("insert into public.rider_special_abilities values($1,'homegrown','youth_academy',$2) on conflict do nothing",[id(n),`academy:${id(n+1000)}`]);
    if (![204,205,209].includes(n)) await db.query("insert into public.youth_development_notifications(team_id,notification_type,title,message,source_reference) values($1,'promoted','Promotion immédiate en équipe première','Fixture',$2)",[id(10),`instant-youth-promotion:${id(n+1000)}`]);
    const status=n===208?'completed':'active';
    const acquisition=n===204?'initial':'academy';
    await db.query('insert into public.rider_contracts(id,rider_id,team_id,start_season_id,end_season_id,salary_per_season,status,acquisition_type) values($1,$2,$3,$4,$4,$5,$6,$7)',[id(n+2000),id(n),id(n===207?11:10),id(4),n===206?12000:0,status,acquisition]);
  }
  for(const [n,end] of [[202,5],[203,6],[209,5]]) {
    await db.query("insert into public.rider_contracts(id,rider_id,team_id,start_season_id,end_season_id,salary_per_season,status,acquisition_type) values($1,$2,$3,$4,$5,0,'planned','renewal')",[id(n+3000),id(n),id(10),id(5),id(end)]);
  }
  // A historical zero posting must remain byte-for-byte unchanged; a pending
  // pre-correction debt is cancelled instead of being charged retrospectively.
  await db.query("insert into public.team_finance_transactions(team_season_id,season_day_id,day_number,amount,category,status,description,source_reference,posted_at) select $1,d.id,d.day_number,0,'rider_salary','posted','Historique salaire nul',$2, '2026-10-15T18:00:00Z' from public.season_days d where season_id=$3 and day_number=7",[id(104),`rider-salary:${id(2201)}:${id(4)}:1`,id(4)]);
  await db.query("insert into public.team_finance_transactions(team_season_id,season_day_id,day_number,amount,category,status,description,source_reference) select $1,d.id,d.day_number,-123,'rider_salary','pending','Ancienne échéance',$2 from public.season_days d where season_id=$3 and day_number=14",[id(104),`rider-salary:${id(2201)}:${id(4)}:2`,id(4)]);
  const postedBefore=(await due(id(2201)))[0];
  const postedCompleteBefore=await rows("select to_jsonb(tx) as data from public.team_finance_transactions tx where status='posted' order by id");
  const cashBefore=await scalar('select cash_balance::text from public.team_seasons where id=$1',[id(104)]);
  const positiveBefore=(await contract(206))[0];
  const untouchedFunctions=await rows("select oid::regprocedure::text as signature,md5(pg_get_functiondef(oid)) as definition_hash from pg_proc where oid in ('public.calculate_rider_season_salary(uuid,uuid)'::regprocedure,'public.calculate_rider_season_salary_quotes(uuid[],uuid)'::regprocedure,'public.apply_homegrown_salary_discount_to_contract()'::regprocedure,'public.renew_current_team_rider(uuid)'::regprocedure) order by oid");
  const promotionBefore=await scalar("select pg_get_functiondef('public.redeem_instant_youth_promotion_reward(uuid,uuid)'::regprocedure)");
  await db.exec(promotionBefore.replace("result.result_scope = 'general'","result.result_scope in ('general')"));
  await assert.rejects(()=>db.exec(migration),error=>error.message.includes('Unexpected instant youth promotion definition'));checks++;
  await db.exec('rollback');
  check(await scalar("select count(*)::int from information_schema.columns where table_schema='public' and table_name='rider_contracts' and column_name='salary_billing_from_game_day_index'"),0,'Unexpected production drift rolls the whole migration back');
  await db.exec(promotionBefore);
  await db.exec(migration);
  check((await due(id(2201)))[0],postedBefore,'Posted zero-salary history is immutable');
  check(await rows("select to_jsonb(tx) as data from public.team_finance_transactions tx where status='posted' order by id"),postedCompleteBefore,'Every field of historical postings stays identical');
  check(await rows("select oid::regprocedure::text as signature,md5(pg_get_functiondef(oid)) as definition_hash from pg_proc where oid in ('public.calculate_rider_season_salary(uuid,uuid)'::regprocedure,'public.calculate_rider_season_salary_quotes(uuid[],uuid)'::regprocedure,'public.apply_homegrown_salary_discount_to_contract()'::regprocedure,'public.renew_current_team_rider(uuid)'::regprocedure) order by oid"),untouchedFunctions,'Quote, homegrown and legacy-renewal functions are not modified');
  check(await scalar('select cash_balance::text from public.team_seasons where id=$1',[id(104)]),cashBefore,'Repair never settles or debits historical finances');
  for(const n of [201,202,203]) {
    const active=(await contract(n)).find(c=>c.status==='active');
    check(Number(active.salary_per_season),3055,'6500 quote × .94 DataRoom / 2 homegrown');
    check(Number(active.homegrown_salary_before_discount),6110,'Homegrown discount is applied exactly once');
    check(active.salary_billing_from_game_day_index,129,'Active repair starts on current day, not signing day');
  }
  for(const n of [204,205,207,208,209]) {
    check(Number((await contract(n))[0].salary_per_season),0,`Unrelated zero salary ${n} unchanged`);
  }
  check((await contract(206))[0],{...positiveBefore,salary_billing_from_game_day_index:null},'Already paid contracts keep their terms');
  const plannedOne=(await contract(202)).find(c=>c.status==='planned');
  const plannedTwo=(await contract(203)).find(c=>c.status==='planned');
  check(Number(plannedOne.salary_per_season),2749.5,'Planned S+1 retains both DataRoom and staff/club reductions');
  check(Number(plannedTwo.salary_per_season),3436.88,'Planned S+1/S+2 adds the under-25 premium');
  check(plannedOne.salary_billing_from_game_day_index,140);
  check((await due(id(2201))).map(x=>[x.day_number,x.status]),[[7,'posted'],[14,'cancelled'],[21,'pending'],[28,'pending']]);
  check((await due(id(2201))).filter(x=>x.status==='pending').map(x=>Number(x.amount)),[-763.75,-763.75]);
  check((await due(id(2206))).map(x=>x.day_number),[7,14,21,28],'A null boundary keeps the existing four-instalment schedule');
  const correctionsBefore=await rows('select * from private.instant_youth_salary_corrections order by contract_id');
  assert(correctionsBefore.length>=5);checks++;
  await db.exec(migration);
  check(await rows('select * from private.instant_youth_salary_corrections order by contract_id'),correctionsBefore,'Repair replay is idempotent');
  check((await due(id(2201)))[0],postedBefore);
  await db.query('select public.sync_rider_salary_installments($1)',[id(99999)]);
  check((await due(id(2201)))[0],postedBefore,'An unknown contract remains a harmless scheduler no-op');

  // Real reward RPC: daily reward, generic stack, final item and stale replay.
  for(const n of [301,302,303,304,305,306]) {
    await db.query("insert into public.youth_academy_riders(id,team_id,country_id,first_name,last_name,birth_game_year,potential_steps) values($1,$2,$3,$4,'Espoir',-13,4)",[id(n),id(10),id(90),`Nouveau ${n}`]);
    await db.query("insert into public.daily_reward_inventory(id,sporting_director_id,reward_key,expires_after_game_year) values($1,$2,'instant',4)",[id(n+100),id(20)]);
    await db.query('insert into public.development_team_roster values($1,$2)',[id(60),id(n)]);
  }
  await db.query("insert into public.team_finance_transactions(team_season_id,day_number,amount,category,description,source_reference) values($1,21,-300,'youth_tuition','Scolarité',$2)",[id(104),`youth-tuition:${id(301)}:4:21`]);
  const daily=await promote(401,301);
  const dailyContract=(await rows('select * from public.rider_contracts where rider_id=$1',[daily.riderId]))[0];
  const quote=Number(await scalar('select public.calculate_rider_season_salary($1,$2)',[daily.riderId,id(4)]));
  check(quote,6500);
  check(Number(dailyContract.salary_per_season),quote*.94/2);
  check(dailyContract.salary_billing_from_game_day_index,129);
  check(dailyContract.joined_day_number,18);
  check(Number(dailyContract.homegrown_salary_before_discount),quote*.94);
  await db.query('update public.rider_contracts set salary_per_season=salary_per_season where id=$1',[dailyContract.id]);
  check(Number(await scalar('select salary_per_season from public.rider_contracts where id=$1',[dailyContract.id])),quote*.94/2,'A repeated synchronization never halves homegrown salary twice');
  check(await scalar('select status from public.daily_reward_inventory where id=$1',[id(401)]),'used');
  check(await scalar('select status from public.youth_academy_riders where id=$1',[id(301)]),'promoted');
  check(await scalar("select status from public.team_finance_transactions where source_reference=$1",[`youth-tuition:${id(301)}:4:21`]),'cancelled');
  check(await scalar('select count(*)::int from public.development_team_roster where academy_rider_id=$1',[id(301)]),0);
  check((await due(dailyContract.id)).map(x=>x.day_number),[21,28]);
  await db.query("update public.team_finance_transactions set status='posted',posted_at='2026-10-22T12:00:00Z' where source_reference=$1",[`rider-salary:${dailyContract.id}:${id(4)}:3`]);
  const currentPosted=(await due(dailyContract.id))[0];
  await db.query('select public.sync_rider_salary_installments($1)',[dailyContract.id]);
  check((await due(dailyContract.id))[0],currentPosted,'A posted instalment at or after the boundary is also immutable');
  check(await scalar('select count(*)::int from public.rider_condition_states where rider_id=$1 and form=75 and fatigue=0',[daily.riderId]),1);
  const beforeReplay=await scalar('select count(*)::int from public.riders');
  await reject('select public.redeem_instant_youth_promotion_reward($1,$2)',[id(401),id(301)]);
  check(await scalar('select count(*)::int from public.riders'),beforeReplay,'Replay cannot create another professional');
  await db.query('insert into public.team_item_inventory values($1,$2,$3,2,now())',[id(70),id(104),id(51)]);
  const generic1=await promote(51,302);
  check(await scalar('select quantity from public.team_item_inventory where id=$1',[id(70)]),1);
  check(Number((await rows('select salary_per_season from public.rider_contracts where rider_id=$1',[generic1.riderId]))[0].salary_per_season),3055);
  const generic2=await promote(51,303);
  check(await scalar('select count(*)::int from public.team_item_inventory where id=$1',[id(70)]),0);
  await reject('select public.redeem_instant_youth_promotion_reward($1,$2)',[id(51),id(304)]);

  // Existing DevTeam live-race lock stays intact; completed race remains allowed.
  await db.query("insert into public.development_race_editions values($1,'planned',17,20,'stage_race',1)",[id(80)]);
  await db.query("insert into public.development_race_registrations values($1,$2,$3,'registered',now())",[id(81),id(60),id(80)]);
  await db.query('insert into public.development_race_registration_riders values($1,$2)',[id(81),id(304)]);
  await reject('select public.redeem_instant_youth_promotion_reward($1,$2)',[id(404),id(304)],'Development Team');
  check(await scalar('select status from public.daily_reward_inventory where id=$1',[id(404)]),'available');
  await db.query("update public.development_race_editions set status='completed' where id=$1",[id(80)]);
  const completed=await promote(404,304);
  assert(completed.riderId);checks++;
  // A future selection is removed; a now-underfilled entry is withdrawn.
  await db.query("insert into public.development_race_editions values($1,'planned',22,22,'one_day',2)",[id(82)]);
  await db.query("insert into public.development_race_registrations values($1,$2,$3,'registered',now())",[id(83),id(60),id(82)]);
  await db.query('insert into public.development_race_registration_riders values($1,$2),($1,$3)',[id(83),id(305),id(306)]);
  const future=await promote(405,305);
  check(future.withdrawnRegistrationCount,1);
  check(await scalar('select status from public.development_race_registrations where id=$1',[id(83)]),'withdrawn');
  // A one-day race still requires its general result. Once published, it no
  // longer blocks a promotion, even if its edition remains technically planned.
  await db.query("insert into public.development_race_editions values($1,'planned',18,18,'one_day',1)",[id(84)]);
  await db.query("insert into public.development_race_registrations values($1,$2,$3,'registered',now())",[id(85),id(60),id(84)]);
  await db.query('insert into public.development_race_registration_riders values($1,$2)',[id(85),id(306)]);
  await reject('select public.redeem_instant_youth_promotion_reward($1,$2)',[id(406),id(306)],'Development Team');
  await db.query("insert into public.development_race_results values($1,$2,'general')",[id(84),id(306)]);
  await db.query('update public.youth_academy_riders set mountain=0,hills=0,flat=0,time_trial=0,cobbles=0,sprint=0,acceleration=0,downhill=0,endurance=0,resistance=0,recovery=0,breakaway=0,prologue=0 where id=$1',[id(306)]);
  const minimum=await promote(406,306);
  check(Number(await scalar('select public.calculate_rider_season_salary($1,$2)',[minimum.riderId,id(4)])),6000,'Weak profiles retain the canonical 6000 minimum gross quote');
  check(Number(await scalar('select salary_per_season from public.rider_contracts where rider_id=$1',[minimum.riderId])),2820,'Infrastructure/homegrown reductions still apply after the minimum gross quote');

  // Future renewals and S+2 upgrades stay positive and preserve each discount.
  const nextId=await scalar('select public.renew_current_team_rider_until($1,5)',[daily.riderId]);
  const next=(await rows('select * from public.rider_contracts where id=$1',[nextId]))[0];
  check(Number(next.salary_per_season),2749.5);
  const upgradeId=await scalar('select public.renew_current_team_rider_until($1,6)',[daily.riderId]);
  check(upgradeId,nextId,'S+2 upgrade edits the existing planned renewal');
  check(Number(await scalar('select salary_per_season from public.rider_contracts where id=$1',[nextId])),3436.88);
  check(await scalar('select count(*)::int from public.rider_contracts where rider_id=$1 and status=$2',[daily.riderId,'planned']),1);
  await reject('select public.renew_current_team_rider_until($1,6)',[daily.riderId]);
  for(const [rider,memory] of [[generic1.riderId,0],[generic2.riderId,null]]) {
    const brokenMemoryId=await scalar('select public.renew_current_team_rider_until($1,5)',[rider]);
    await db.query('update public.rider_contracts set homegrown_salary_before_discount=$1 where id=$2',[memory,brokenMemoryId]);
    check(Number(await scalar('select salary_per_season from public.rider_contracts where id=$1',[brokenMemoryId])),2749.5);
    check(Number(await scalar('select roster_management_salary_before_discount from public.rider_contracts where id=$1',[brokenMemoryId])),3055);
    await db.query('select public.renew_current_team_rider_until($1,6)',[rider]);
    check(Number(await scalar('select salary_per_season from public.rider_contracts where id=$1',[brokenMemoryId])),3656.25,'Missing homegrown gross memory must not reuse a net salary and halve it again');
  }
  const legacyRenewalId=await scalar('select public.renew_current_team_rider($1)',[minimum.riderId]);
  check(Number(await scalar('select salary_per_season from public.rider_contracts where id=$1',[legacyRenewalId])),2538,'The untouched legacy one-season renewal also remains positive');
  const legacyUpgradeId=await scalar('select public.renew_current_team_rider_until($1,6)',[id(209)]);
  check(Number(await scalar('select salary_per_season from public.rider_contracts where id=$1',[legacyUpgradeId])),3656.25,'A zero planned base falls back to a real quote before the two-season premium');
  check(await scalar('select relrowsecurity from pg_class where oid=$1::regclass',['private.instant_youth_salary_corrections']),true);
  for(const role of ['anon','authenticated','service_role']) {
    check(await scalar('select has_table_privilege($1,$2,$3)',[role,'private.instant_youth_salary_corrections','SELECT']),false,`Repair journal stays private from ${role}`);
  }
  for(const [n,day,expectedDays] of [[307,21,[21,28]],[308,28,[28]]]) {
    await db.query('update public.seasons set current_day_number=$1 where id=$2',[day,id(4)]);
    await db.query("insert into public.youth_academy_riders(id,team_id,country_id,first_name,last_name,birth_game_year,potential_steps) values($1,$2,$3,'Junior','Dernier jour',-13,4)",[id(n),id(10),id(90)]);
    await db.query("insert into public.daily_reward_inventory(id,sporting_director_id,reward_key,expires_after_game_year) values($1,$2,'instant',4)",[id(n+100),id(20)]);
    const exactDueDay=await promote(n+100,n);
    const exactContract=(await rows('select * from public.rider_contracts where rider_id=$1',[exactDueDay.riderId]))[0];
    check(exactContract.salary_billing_from_game_day_index,4*28+day-1);
    check((await due(exactContract.id)).map(tx=>tx.day_number),expectedDays,'The current due date is included without reviving older instalments');
  }
  await db.query("select set_config('test.auth_uid','',false)");
  await reject('select public.redeem_instant_youth_promotion_reward($1,$2)',[id(406),id(306)],'connecté');
  console.log(JSON.stringify({ok:true,checks,isolated:true,realRewardRpc:true,productionData:false}));
} finally {
  await db.close();
}
