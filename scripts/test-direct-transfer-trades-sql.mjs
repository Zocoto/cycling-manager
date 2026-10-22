// Disposable PostgreSQL/WASM only: no database URL, credentials or network.
// Execute with: node scripts/test-direct-transfer-trades-sql.mjs
// Historical roster, cash-offer, departure, chat and salary-scheduling functions
// are loaded from versioned SQL. Only unrelated settlements/quote inputs are
// controlled fixtures. PGlite is single-session: this proves SQL atomicity and
// stale-call protection, not a multi-session deadlock/concurrency benchmark.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const modulePath = process.env.TRADE_SQL_TEST_MODULE ?? resolve('artifacts/.tmp-performance-preparations/node_modules/@electric-sql/pglite/dist/index.js');
const {PGlite} = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const migrationPath = process.env.TRADE_SQL_TEST_MIGRATION ?? 'supabase/migrations/20261022190000_add_direct_transfer_trade_offers.sql';
let checks = 0;
let scenarios = 0;
let currentCase = 'initialisation';
const check = (actual, expected, message) => {assert.deepEqual(actual, expected, message); checks++;};
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const scalar = async (sql, params = []) => Object.values((await rows(sql, params))[0])[0];
const root = () => db.exec('reset role');
const auth = async (n, role = 'authenticated') => {
  await root();
  await db.query("select set_config('test.auth_uid',$1,false)", [n === null ? '' : id(n)]);
  assert(['authenticated', 'anon', 'service_role'].includes(role));
  await db.exec(`set role ${role}`);
};
const reject = async (sql, params = [], message) => {
  await db.exec('savepoint expected_rejection');
  try {
    await assert.rejects(() => db.query(sql, params), message ? error => error.message.includes(message) : undefined);
    checks++;
  } finally {
    await db.exec('rollback to savepoint expected_rejection; release savepoint expected_rejection');
  }
};
const scenario = async (name, callback) => {
  currentCase = name;
  scenarios++;
  await root();
  await db.exec('begin');
  try { await callback(); }
  finally { await db.exec('rollback'); await root(); }
};
function historicalFunction(path, name, schema = 'public') {
  const source = readFileSync(path, 'utf8');
  const start = source.toLowerCase().indexOf(`create or replace function ${schema}.${name}(`);
  assert(start >= 0, `${name}: historical definition missing`);
  const body = source.slice(start);
  const delimiter = /\bas\s+(\$[a-z_]*\$)/iu.exec(body);
  assert(delimiter, `${name}: body delimiter missing`);
  const end = body.indexOf(delimiter[1], delimiter.index + delimiter[0].length);
  assert(end >= 0, `${name}: body terminator missing`);
  return `${body.slice(0, end + delimiter[1].length)};`;
}
function historicalBlock(path, marker, delimiter) {
  const source = readFileSync(path, 'utf8');
  const markerIndex = source.indexOf(marker);
  assert(markerIndex >= 0, `${marker}: historical block missing`);
  const start = source.lastIndexOf(`do ${delimiter}`, markerIndex);
  const end = source.indexOf(`${delimiter};`, markerIndex);
  assert(start >= 0 && end > start, `${marker}: historical block boundary missing`);
  return source.slice(start, end + delimiter.length + 1);
}
const submit = (rider = 202, amount = 1000, offeredRider = 201, message = null) => scalar(
  'select public.submit_direct_transfer_trade_offer($1,$2,$3,$4)',
  [id(rider), amount, offeredRider === null ? null : id(offeredRider), message],
);
const respond = (offerId, accepted = true) => scalar('select public.respond_to_direct_transfer_offer($1,$2)', [offerId, accepted]);
const offerId = value => typeof value === 'string' ? value : value.offerId;
const snapshot = async () => {
  await root();
  return {
    contracts: await rows('select to_jsonb(c) as row from public.rider_contracts c order by id'),
    offers: await rows('select to_jsonb(o) as row from public.direct_transfer_offers o order by id'),
    balances: await rows('select id,cash_balance::text from public.team_seasons order by id'),
    finances: await rows('select to_jsonb(t) as row from public.team_finance_transactions t order by id'),
    listings: await rows('select to_jsonb(l) as row from public.transfer_market_listings l order by id'),
    messages: await rows('select to_jsonb(m) as row from public.sporting_director_messages m order by id'),
    chat: await rows('select to_jsonb(m) as row from public.direct_messages m order by id'),
    equipment: await rows('select to_jsonb(e) as row from public.race_stage_equipment_assignments e order by rider_id,stage_id'),
    riderEquipment: await rows('select to_jsonb(e) as row from public.rider_equipment_assignments e order by rider_id'),
    pendingEquipment: await rows('select to_jsonb(e) as row from public.rider_equipment_pending_assignments e order by rider_id'),
    naturalization: await rows('select to_jsonb(p) as row from public.rider_naturalization_country_progress p order by rider_id,country_id'),
    training: await rows('select to_jsonb(t) as row from public.rider_training_plan_versions t order by id'),
    rosters: await rows('select to_jsonb(r) as row from public.race_rosters r order by id'),
    camps: await rows('select to_jsonb(c) as row from public.rider_form_camps c order by id'),
    reconnaissance: await rows('select to_jsonb(r) as row from public.stage_reconnaissances r order by id'),
  };
};
const addRider = async (n, team, {status = 'active', start = 4, end = 4, acquisition = 'initial', locked = null, salary = 6000} = {}) => {
  await root();
  await db.query("insert into public.riders(id,first_name,last_name,status) values($1,$2,'Fixture','active') on conflict do nothing", [id(n), `Coureur ${n}`]);
  return scalar('insert into public.rider_contracts(rider_id,team_id,start_season_id,end_season_id,salary_per_season,status,acquisition_type,transfer_locked_season_id) values($1,$2,$3,$4,$5,$6,$7,$8) returning id', [id(n),id(team),id(start),id(end),salary,status,acquisition,locked === null ? null : id(locked)]);
};
const owner = rider => scalar("select team_id from public.rider_contracts where rider_id=$1 and status='active'", [id(rider)]);

try {
  await db.exec(`
    create schema auth; create schema private;
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.auth_uid',true),'')::uuid$$;
    create table public.seasons(id uuid primary key,game_year int unique,status text,current_day_number int);
    create table public.season_days(id uuid primary key default gen_random_uuid(),season_id uuid,day_number int,unique(season_id,day_number));
    create table public.teams(id uuid primary key,name text,status text default 'active');
    create table public.team_seasons(id uuid primary key,team_id uuid,season_id uuid,display_name text,cash_balance numeric default 1000000,currency text default 'EUR',status text default 'active',registration_country_id uuid,unique(team_id,season_id));
    create table public.sporting_directors(id uuid primary key,auth_user_id uuid,status text default 'active',display_name text,username text);
    create table public.team_manager_assignments(sporting_director_id uuid,team_id uuid,role text default 'general_manager',status text default 'active');
    create table public.riders(id uuid primary key default gen_random_uuid(),country_id uuid,first_name text,last_name text,status text default 'active',potential_steps int default 4);
    create table public.rider_contracts(id uuid primary key default gen_random_uuid(),rider_id uuid not null references public.riders(id),team_id uuid not null references public.teams(id),start_season_id uuid not null references public.seasons(id),end_season_id uuid not null references public.seasons(id),salary_per_season numeric(12,2) not null default 6000,currency text default 'EUR',currency_code text default 'EUR',status text default 'active',signed_at timestamptz,created_at timestamptz default now(),acquisition_type text default 'initial',transfer_locked_season_id uuid,joined_day_number int,left_season_id uuid,left_day_number int,transfer_fee numeric,homegrown_salary_before_discount numeric,roster_management_salary_before_discount numeric,roster_management_discount_percent numeric not null default 0,salary_billing_from_game_day_index int,squad_status text);
    create unique index rider_contracts_one_active on public.rider_contracts(rider_id) where status='active';
    create index rider_contracts_team_status_idx on public.rider_contracts(team_id,status);
    create table public.youth_academy_riders(id uuid primary key default gen_random_uuid(),team_id uuid,promoted_rider_id uuid,status text default 'promoted',promotion_game_year int);
    create table public.rider_special_abilities(rider_id uuid,ability_code text,primary key(rider_id,ability_code));
    create table public.team_infrastructures(team_id uuid,infrastructure_code text,level int,specialization_code text,primary key(team_id,infrastructure_code));
    create function public.get_team_infrastructure_specialization(p_team uuid,p_code text) returns text language sql stable as $$select specialization_code from public.team_infrastructures where team_id=p_team and infrastructure_code=p_code$$;
    create table public.test_team_specialization_power(team_id uuid primary key,power numeric default 0);
    create function public.get_team_specialization_power(p_team uuid,p_code text,p_branch text) returns numeric language sql stable as $$select coalesce((select power from public.test_team_specialization_power where team_id=p_team),0)$$;
    create table public.race_editions(id uuid primary key,status text);
    create table public.race_registrations(id uuid primary key,race_edition_id uuid,status text,team_season_id uuid);
    create table public.race_rosters(id uuid primary key default gen_random_uuid(),race_registration_id uuid,rider_id uuid,status text);
    create table public.rider_form_camps(id uuid primary key default gen_random_uuid(),rider_id uuid,season_id uuid,status text,team_season_id uuid,completed_at timestamptz);
    create table public.stage_reconnaissances(id uuid primary key,season_id uuid,status text,team_season_id uuid,completed_at timestamptz);
    create table public.stage_reconnaissance_riders(reconnaissance_id uuid,rider_id uuid,form_camp_id uuid);
    create table public.stages(id uuid primary key,status text);
    create table public.race_stage_equipment_assignments(rider_id uuid,stage_id uuid);
    create table public.rider_equipment_assignments(rider_id uuid,equipment_key text);
    create table public.rider_equipment_pending_assignments(rider_id uuid,team_season_id uuid,equipment_key text);
    create table public.rider_naturalization_country_progress(rider_id uuid,country_id uuid,accumulated_days int default 0,active_since_season_id uuid,active_since_day_number int,last_team_id uuid,updated_at timestamptz default now(),primary key(rider_id,country_id));
    create table public.rider_national_championship_titles(rider_id uuid,championship_type text);
    create table public.rider_training_plan_versions(id uuid primary key default gen_random_uuid(),rider_id uuid,season_id uuid,effective_from_day_number int,trainer_contract_id uuid);
    create table public.transfer_market_listings(id uuid primary key default gen_random_uuid(),rider_id uuid,season_id uuid,status text default 'open',salary_per_season numeric default 6000,settled_at timestamptz,listing_type text default 'director',seller_team_id uuid,winning_team_id uuid,winning_bid numeric,created_at timestamptz default now());
    create table public.transfer_market_bids(id uuid primary key default gen_random_uuid(),listing_id uuid,team_id uuid,amount numeric,created_at timestamptz default now());
    create table public.team_finance_transactions(id uuid primary key default gen_random_uuid(),team_season_id uuid,season_day_id uuid,day_number int,amount numeric(14,2),category text,status text default 'pending',description text,source_reference text,posted_at timestamptz,created_at timestamptz default now(),unique(team_season_id,source_reference));
    create table public.sporting_director_messages(id uuid primary key default gen_random_uuid(),sporting_director_id uuid,season_id uuid,team_season_id uuid,message_type text,sender_name text,subject text,preview text,body text,action_href text,action_label text,source_reference text,is_important boolean,created_at timestamptz default now(),unique(sporting_director_id,source_reference));
    create table public.alpha_bot_managers(sporting_director_id uuid primary key);
    create table public.direct_conversations(id uuid primary key default gen_random_uuid(),last_message_sender_id uuid,last_message_body text,last_message_at timestamptz,updated_at timestamptz);
    create table public.direct_messages(id uuid primary key default gen_random_uuid(),conversation_id uuid,sender_id uuid,recipient_id uuid,body text,created_at timestamptz default now(),edited_at timestamptz,message_type text default 'user',source_reference text unique);
    create table public.direct_conversation_states(conversation_id uuid,sporting_director_id uuid,unread_count int,last_activity_at timestamptz,last_read_at timestamptz,primary key(conversation_id,sporting_director_id));
    create function public.get_or_create_current_direct_conversation(p_recipient uuid) returns uuid language plpgsql as $$declare v_id uuid; begin insert into public.direct_conversations default values returning id into v_id; return v_id; end$$;
    -- Clock/finance/auction job orchestration is outside this bounded feature.
    create function public.sync_active_season_day() returns void language sql as $$select$$;
    create function public.settle_current_team_finances() returns void language sql as $$select$$;
    create function public.settle_transfer_market() returns void language sql as $$select$$;
    -- Exact deterministic quote inputs make swapped salary assignments visible.
    create table public.test_rider_salary(rider_id uuid primary key,amount numeric);
    create function public.calculate_rider_season_salary(p_rider uuid,p_season uuid) returns numeric language sql stable as $$select coalesce((select amount from public.test_rider_salary where rider_id=p_rider),6000::numeric)$$;
    create function public.get_projected_transfer_budget(p_team_season uuid) returns numeric language sql stable as $$select cash_balance from public.team_seasons where id=p_team_season$$;
  `);
  const legacyOffers = 'supabase/migrations/20260809140000_add_direct_transfer_offers_and_rider_dismissals.sql';
  await db.exec(readFileSync(legacyOffers, 'utf8'));
  const cashMigration = 'supabase/migrations/20260814150000_add_roster_aid_and_cash_based_recruitment.sql';
  // Apply the two actual production evolution blocks, not handwritten variants.
  for (const name of ['get_team_transfer_reserved_budget', 'submit_direct_transfer_offer', 'respond_to_direct_transfer_offer']) {
    await db.exec(historicalBlock(cashMigration, `'public.${name}(`, '$migration$'));
  }
  const rosterMigration = 'supabase/migrations/20260921130000_create_team_roster_management_center.sql';
  await db.exec(historicalFunction('supabase/migrations/20260903130000_arbitrate_youth_promotions_at_roster_limit.sql','get_team_roster_commitment_count'));
  for (const name of ['get_team_roster_management_level','get_team_roster_base_limit','get_team_roster_youth_reserve','get_team_roster_limit','is_team_homegrown_rider','get_team_non_homegrown_roster_commitment_count','can_team_reserve_roster_rider','enforce_team_roster_capacity']) {
    await db.exec(historicalFunction(rosterMigration,name));
  }
  await db.exec(historicalBlock(rosterMigration,"'public.submit_direct_transfer_offer(",'$direct_offers$'));
  const chatMigration = 'supabase/migrations/20260908110000_connect_direct_transfer_offers_to_chat.sql';
  await db.exec(historicalFunction(chatMigration,'submit_direct_transfer_offer_with_message'));
  await db.exec('revoke execute on function public.submit_direct_transfer_offer(uuid,numeric) from authenticated; revoke all on function public.submit_direct_transfer_offer_with_message(uuid,numeric,text) from public,anon; grant execute on function public.submit_direct_transfer_offer_with_message(uuid,numeric,text) to authenticated,service_role');
  const financeMigration = 'supabase/migrations/20260720203000_create_rewards_finances_and_rankings.sql';
  await db.exec(historicalFunction('scripts/fixtures/instant-junior-salary-before.sql','sync_rider_salary_installments'));
  await db.exec(historicalBlock('supabase/migrations/20261022154500_fix_instant_youth_promotion_salary.sql',"'public.sync_rider_salary_installments(uuid)'::regprocedure",'$installments$'));
  await db.exec(historicalFunction(financeMigration,'handle_finance_contract_change'));
  await db.exec(historicalFunction('supabase/migrations/20260828180000_replace_homegrown_rating_bonus_with_salary_discount.sql','apply_homegrown_salary_discount_to_contract'));
  await db.exec(historicalFunction('supabase/migrations/20260906143000_allow_one_rider_team_change_per_season.sql','enforce_rider_team_change_limit','private'));
  await db.exec(historicalFunction('supabase/migrations/20260727210000_create_rider_naturalization.sql','set_rider_contract_joined_day'));
  await db.exec(historicalFunction('supabase/migrations/20260809120000_secure_rider_career_transitions.sql','stamp_rider_contract_departure'));
  for (const name of ['get_game_day_ordinal','get_rider_country_progress_days','pause_rider_naturalization_progress','resume_rider_naturalization_progress','detach_departing_rider','handle_rider_contract_transition']) {
    await db.exec(historicalFunction('supabase/migrations/20260809120000_secure_rider_career_transitions.sql',name));
  }
  for (const name of ['apply_data_room_salary_discount','apply_data_room_transfer_rebate']) {
    await db.exec(historicalFunction('supabase/migrations/20260908154500_activate_remaining_team_specializations.sql',name));
  }
  await db.exec(`
    create trigger enforce_team_roster_capacity_after_write after insert or update of rider_id,team_id,start_season_id,end_season_id,status,acquisition_type on public.rider_contracts for each row execute function public.enforce_team_roster_capacity();
    create trigger rider_contract_finance_sync after insert or update or delete on public.rider_contracts for each row execute function public.handle_finance_contract_change();
    create trigger apply_homegrown_salary_discount_before_contract_write before insert or update of rider_id,team_id,start_season_id,salary_per_season on public.rider_contracts for each row execute function public.apply_homegrown_salary_discount_to_contract();
    create trigger rider_contracts_team_change_limit before insert on public.rider_contracts for each row execute function private.enforce_rider_team_change_limit();
    create trigger set_rider_contract_joined_day before insert on public.rider_contracts for each row execute function public.set_rider_contract_joined_day();
    create trigger stamp_rider_contract_departure_before_update before update of status on public.rider_contracts for each row execute function public.stamp_rider_contract_departure();
    create trigger handle_rider_contract_transition_after_write after insert or update or delete on public.rider_contracts for each row execute function public.handle_rider_contract_transition();
    create trigger apply_data_room_salary_discount_trigger before insert on public.rider_contracts for each row execute function public.apply_data_room_salary_discount();
    create trigger apply_data_room_transfer_rebate_trigger after insert or update of transfer_fee on public.rider_contracts for each row execute function public.apply_data_room_transfer_rebate();
    insert into public.seasons values('${id(3)}',3,'completed',28),('${id(4)}',4,'active',14),('${id(5)}',5,'planned',1);
    insert into public.season_days(season_id,day_number) select s.id,n from public.seasons s cross join generate_series(1,28) n;
    insert into public.teams values('${id(10)}','Acheteur','active'),('${id(11)}','Vendeur','active'),('${id(12)}','Tiers','active');
    insert into public.team_seasons(id,team_id,season_id,display_name) values('${id(104)}','${id(10)}','${id(4)}','Acheteur'),('${id(114)}','${id(11)}','${id(4)}','Vendeur'),('${id(124)}','${id(12)}','${id(4)}','Tiers');
    insert into public.sporting_directors(id,auth_user_id,display_name,username) values('${id(20)}','${id(1)}','Acheteur','acheteur'),('${id(21)}','${id(2)}','Vendeur','vendeur'),('${id(22)}','${id(3)}','Tiers','tiers');
    insert into public.team_manager_assignments(sporting_director_id,team_id) values('${id(20)}','${id(10)}'),('${id(21)}','${id(11)}'),('${id(22)}','${id(12)}');
    insert into public.test_rider_salary values('${id(201)}',7100),('${id(202)}',8200),('${id(203)}',9300);
    grant select on all tables in schema public to authenticated;
  `);
  await addRider(201,10,{salary:7100});
  await addRider(202,11,{salary:8200});
  await addRider(203,12,{salary:9300});
  // A real existing pending cash offer must survive the additive migration.
  await auth(3);
  const preexistingCash = await scalar('select public.submit_direct_transfer_offer_with_message($1,1000,null)',[id(202)]);
  const beforeMigration = await snapshot();
  const baselineHashes=await rows("select proname,md5(replace(pg_get_functiondef(oid),chr(13),'')) as hash from pg_proc where pronamespace='public'::regnamespace and proname in ('submit_direct_transfer_offer','respond_to_direct_transfer_offer','get_team_transfer_reserved_budget') order by proname");
  check(baselineHashes,[
    {proname:'get_team_transfer_reserved_budget',hash:'1e5a49a179207cebd1597ec51b07c650'},
    {proname:'respond_to_direct_transfer_offer',hash:'915a479051739453000889726bef123d'},
    {proname:'submit_direct_transfer_offer',hash:'a89fd68e61df7d153c31537ebd6b35fa'},
  ],'Versioned migrations reproduce exact production cash function definitions');
  const tradeMigration=readFileSync(migrationPath,'utf8');
  const originalSubmitDefinition=await scalar("select pg_get_functiondef('public.submit_direct_transfer_offer(uuid,numeric)'::regprocedure)");
  await db.exec(originalSubmitDefinition.replace('return v_offer_id;','return v_offer_id; -- deliberate test-only production drift'));
  await assert.rejects(() => db.exec(tradeMigration), error => error.message.includes('noyau des transferts a changé'));
  checks++;
  await db.exec('rollback');
  check(await scalar("select count(*)::int from information_schema.columns where table_schema='public' and table_name='direct_transfer_offers' and column_name='offered_rider_id'"),0,'Unexpected function drift prevents every schema change');
  await db.exec(originalSubmitDefinition);
  await db.exec(tradeMigration);
  const afterMigration = await snapshot();
  // New nullable fields are expected on existing records; every old field stays.
  const originalOfferFields=new Set(Object.keys(beforeMigration.offers[0].row));
  for (const entry of afterMigration.offers) {
    for (const field of Object.keys(entry.row)) {
      if (!originalOfferFields.has(field)) delete entry.row[field];
    }
  }
  check(afterMigration,beforeMigration,'Migration preserves existing contracts, balances, offers and notifications');
  check(await scalar("select md5(replace(replace(pg_get_functiondef('private.submit_direct_transfer_offer_cash_20261022(uuid,numeric)'::regprocedure),'private.submit_direct_transfer_offer_cash_20261022(', 'public.submit_direct_transfer_offer('),chr(13),''))"),'a89fd68e61df7d153c31537ebd6b35fa','Historical cash-only submit definition is byte-for-byte unchanged except its private name');
  check(await scalar("select md5(replace(replace(pg_get_functiondef('private.respond_to_direct_transfer_offer_cash_20261022(uuid,boolean)'::regprocedure),'private.respond_to_direct_transfer_offer_cash_20261022(', 'public.respond_to_direct_transfer_offer('),chr(13),''))"),'915a479051739453000889726bef123d','Historical cash-only response definition is byte-for-byte unchanged except its private name');
  check(await scalar("select md5(replace(pg_get_functiondef('public.get_team_transfer_reserved_budget(uuid,uuid,uuid)'::regprocedure),chr(13),''))"),'1e5a49a179207cebd1597ec51b07c650','The global auction/direct-offer cash reservation function is not modified');
  check(await scalar("select has_function_privilege('service_role','public.submit_direct_transfer_offer(uuid,numeric)','execute')"),false,'Preserve the live cash-only entry point permissions: no direct service-role bypass');
  check(await scalar("select has_function_privilege('authenticated','public.submit_direct_transfer_offer(uuid,numeric)','execute')"),false,'Players still cannot bypass the atomic cash-offer/chat entry point');
  check(await scalar("select has_function_privilege('service_role','private.submit_direct_transfer_offer_cash_20261022(uuid,numeric)','execute')"),false,'Even the server role cannot bypass the new cash wrapper locking');
  check((await rows(`select
    md5(replace(pg_get_functiondef(to_regprocedure('private.submit_direct_transfer_offer_cash_20261022(uuid,numeric)')),
      'FUNCTION private.submit_direct_transfer_offer_cash_20261022(', 'FUNCTION public.submit_direct_transfer_offer(')) as cash_submit_hash,
    md5(pg_get_functiondef('public.get_team_transfer_reserved_budget(uuid,uuid,uuid)'::regprocedure)) as reservation_hash,
    md5(replace(pg_get_functiondef(to_regprocedure('private.respond_to_direct_transfer_offer_cash_20261022(uuid,boolean)')),
      'FUNCTION private.respond_to_direct_transfer_offer_cash_20261022(', 'FUNCTION public.respond_to_direct_transfer_offer(')) as cash_response_core_hash`))[0],{
        cash_submit_hash:'a89fd68e61df7d153c31537ebd6b35fa',
        reservation_hash:'b1a108384677454acf87b5c65aac4019',
        cash_response_core_hash:'915a479051739453000889726bef123d',
      },'The exact raw hash reconstruction used by the reviewed delivery script also matches');

  // Scenarios below always roll back into the exact same isolated baseline.
  await scenario('cash-only historical offer and transfer unchanged',async () => {
    await auth(1);
    const created = await scalar('select public.submit_direct_transfer_offer_with_message($1,1234,$2)',[id(202),'Offre historique']);
    const selectedId=offerId(created);
    await root();
    check(Number(await scalar('select offered_amount from public.direct_transfer_offers where id=$1',[selectedId])),1200,'Cash amounts retain historical 100 EUR rounding');
    await auth(2);
    const contractId=await respond(selectedId);
    check(typeof contractId,'string');
    await root();
    check(await owner(202),id(10));
    check(await owner(201),id(10));
    check(Number(await scalar('select cash_balance from public.team_seasons where id=$1',[id(104)])),998800);
    check(Number(await scalar('select cash_balance from public.team_seasons where id=$1',[id(114)])),1001200);
    check(Number(await scalar('select salary_per_season from public.rider_contracts where id=$1',[contractId])),8200);
  });

  await scenario('pure rider swap, two contracts, unchanged cash',async () => {
    await auth(1);
    const selectedId=offerId(await submit(202,0,201,'Un échange pur'));
    await auth(3);
    const counterpartCash=offerId(await scalar('select public.submit_direct_transfer_offer_with_message($1,1000,null)',[id(201)]));
    await root();
    const pending=(await rows('select * from public.direct_transfer_offers where id=$1',[selectedId]))[0];
    check(pending.offered_rider_id,id(201));
    check(Number(pending.offered_rider_salary_per_season),7100);
    await auth(2);
    const contractId=await respond(selectedId);
    await root();
    check(await owner(202),id(10));
    check(await owner(201),id(11));
    check(Number(await scalar('select cash_balance from public.team_seasons where id=$1',[id(104)])),1000000);
    check(Number(await scalar('select cash_balance from public.team_seasons where id=$1',[id(114)])),1000000);
    check(Number(await scalar('select salary_per_season from public.rider_contracts where id=$1',[contractId])),8200);
    check(Number(await scalar("select salary_per_season from public.rider_contracts where rider_id=$1 and status='active'",[id(201)])),7100);
    check(await scalar("select count(*)::int from public.rider_contracts where rider_id=any($1::uuid[]) and status='active' and transfer_locked_season_id=$2",[[id(201),id(202)],id(4)]),2);
    check(await scalar('select status from public.direct_transfer_offers where id=$1',[offerId(preexistingCash)]),'cancelled','A departing target rider invalidates its competing cash offers');
    check(await scalar('select status from public.direct_transfer_offers where id=$1',[counterpartCash]),'cancelled','A departing offered rider invalidates its competing cash offers');
    const committed=await snapshot();
    await auth(2);
    await reject('select public.respond_to_direct_transfer_offer($1,true)',[selectedId]);
    check(await snapshot(),committed,'Second acceptance cannot move riders, money or messages twice');
  });

  await scenario('swap plus cash balances and outgoing planned contracts',async () => {
    await addRider(201,10,{status:'planned',start:5,end:5,salary:4000,acquisition:'renewal'});
    await addRider(202,11,{status:'planned',start:5,end:5,salary:5000,acquisition:'renewal'});
    await auth(1);
    const selectedId=offerId(await submit(202,12000,201));
    await auth(2);
    await respond(selectedId);
    await root();
    check(await owner(201),id(11));
    check(await owner(202),id(10));
    check(Number(await scalar('select cash_balance from public.team_seasons where id=$1',[id(104)])),988000);
    check(Number(await scalar('select cash_balance from public.team_seasons where id=$1',[id(114)])),1012000);
    check(await scalar("select count(*)::int from public.rider_contracts where rider_id=any($1::uuid[]) and start_season_id=$2 and status='cancelled'",[[id(201),id(202)],id(5)]),2);
    check(Number(await scalar("select sum(amount) from public.team_finance_transactions where category='transfer' and status='posted'")),0,'Cash is conserved across the two teams');
  });

  await scenario('successful trade preserves history but clears source-team future equipment and staff',async () => {
    await root();
    await db.query("insert into public.stages values($1,'planned'),($2,'completed')",[id(860),id(861)]);
    await db.query('insert into public.race_stage_equipment_assignments values($1,$2),($1,$3),($4,$2),($4,$3)',[id(201),id(860),id(861),id(202)]);
    await db.query('insert into public.rider_training_plan_versions(rider_id,season_id,effective_from_day_number,trainer_contract_id) values($1,$3,13,$4),($1,$3,14,$4),($2,$3,13,$5),($2,$3,15,$5)',[id(201),id(202),id(4),id(862),id(863)]);
    const oldSalaryPostings=await rows("update public.team_finance_transactions set status='posted',posted_at=now() where category='rider_salary' and day_number=7 returning to_jsonb(team_finance_transactions) as row");
    await auth(1);
    const selectedId=offerId(await submit(202,0,201));
    await auth(2);
    await respond(selectedId);
    await root();
    check(await scalar('select count(*)::int from public.race_stage_equipment_assignments where stage_id=$1',[id(860)]),0,'Future source-team equipment is removed');
    check(await scalar('select count(*)::int from public.race_stage_equipment_assignments where stage_id=$1',[id(861)]),2,'Completed-stage equipment history is retained');
    check(await scalar('select count(*)::int from public.rider_training_plan_versions where effective_from_day_number>=14 and trainer_contract_id is null'),2,'Future source-team trainers cannot follow the riders');
    check(await scalar('select count(*)::int from public.rider_training_plan_versions where effective_from_day_number<14 and trainer_contract_id is not null'),2,'Historical training assignments remain intact');
    for (const posting of oldSalaryPostings) {
      check((await rows('select to_jsonb(t) as row from public.team_finance_transactions t where id=$1',[posting.row.id]))[0],posting,'Past salary payments are not retroactively changed');
    }
    check(await scalar("select count(*)::int from public.team_finance_transactions where category='rider_salary' and status='cancelled'"),6,'Only unpaid source-team salary instalments are cancelled');
  });

  await scenario('late failure of second incoming contract rolls back everything',async () => {
    await auth(1);
    for (const sql of [
      'select private.submit_direct_transfer_offer_cash_20261022($1,1000)',
      'select private.respond_to_direct_transfer_offer_cash_20261022($1,true)',
      'select private.assert_rider_trade_eligible($1,$1,$1,4)',
      'select private.quote_direct_transfer_salary($1,$1,$1,1000)',
    ]) await reject(sql,[id(202)]);
    const selectedId=offerId(await submit(202,12000,201));
    await root();
    await db.query("insert into public.stages values($1,'planned')",[id(850)]);
    await db.query('insert into public.race_stage_equipment_assignments values($1,$2)',[id(202),id(850)]);
    await db.query('insert into public.rider_training_plan_versions(rider_id,season_id,effective_from_day_number,trainer_contract_id) values($1,$2,14,$3)',[id(202),id(4),id(851)]);
    await db.query("insert into public.rider_equipment_assignments values($1,'source A'),($2,'source B')",[id(201),id(202)]);
    await db.query("insert into public.rider_equipment_pending_assignments values($1,$2,'pending A'),($3,$4,'pending B')",[id(201),id(104),id(202),id(114)]);
    // The first incoming contract is inserted successfully. The second throws
    // after previous contracts, offer status and finances may have been touched.
    await db.exec(`create function public.test_fail_second_trade_contract() returns trigger language plpgsql as $$begin
      if new.acquisition_type='direct_offer' and new.rider_id='${id(201)}' then
        if not exists(select 1 from public.rider_contracts where rider_id='${id(202)}' and team_id='${id(10)}' and status='active')
          or not exists(select 1 from public.direct_transfer_offers where id='${selectedId}' and status='accepted') then
          raise exception 'TEST failure occurred before first contract and acceptance';
        end if;
        raise exception 'TEST second incoming contract failed';
      end if; return new; end$$;
      create trigger zz_test_fail_second_trade_contract before insert on public.rider_contracts for each row execute function public.test_fail_second_trade_contract()`);
    const before=await snapshot();
    await auth(2);
    await reject('select public.respond_to_direct_transfer_offer($1,true)',[selectedId],'TEST second incoming contract failed');
    check(await snapshot(),before,'Offer, both careers, salary schedules, notifications, chat and money are unchanged after a late error');
  });

  await scenario('authorization, input validation and no direct client writes',async () => {
    for (const role of ['anon','service_role']) {
      await auth(null,role);
      await reject('select public.submit_direct_transfer_trade_offer($1,0,$2,null)',[id(202),id(201)]);
    }
    await auth(null);
    await reject('select public.submit_direct_transfer_trade_offer($1,0,$2,null)',[id(202),id(201)]);
    await auth(3);
    await reject('select public.submit_direct_transfer_trade_offer($1,0,$2,null)',[id(202),id(201)]);
    await auth(1);
    for (const amount of [null,-1,100000001,'NaN','Infinity','-Infinity']) {
      await reject('select public.submit_direct_transfer_trade_offer($1,$2,$3,null)',[id(202),amount,id(201)]);
    }
    for (const params of [[id(202),0,null,null],[null,0,id(201),null],[id(201),0,id(201),null],[id(202),0,id(203),null],[id(202),0,id(9999),null],[id(202),0,id(201),'x'.repeat(701)]]) {
      await reject('select public.submit_direct_transfer_trade_offer($1,$2,$3,$4)',params);
    }
    await reject("update public.direct_transfer_offers set status='accepted' where id=$1",[offerId(preexistingCash)]);
    const selectedId=offerId(await submit(202,0,201));
    const before=await snapshot();
    for (const user of [1,3,null]) {
      await auth(user);
      await reject('select public.respond_to_direct_transfer_offer($1,true)',[selectedId]);
    }
    await auth(2);
    await reject('select public.respond_to_direct_transfer_offer($1,null)',[selectedId]);
    check(await snapshot(),before,'Unauthorized and malformed responses leave an offer pending');
    await auth(2);
    check(await respond(selectedId,false),null);
    await root();
    check(await scalar('select status from public.direct_transfer_offers where id=$1',[selectedId]),'rejected');
    check(await owner(201),id(10));
    check(await owner(202),id(11));
  });

  await scenario('counterpart cannot be pledged twice and leaving invalidates trade',async () => {
    await auth(1);
    const selectedId=offerId(await submit(202,1000,201));
    await reject('select public.submit_direct_transfer_trade_offer($1,1000,$2,null)',[id(203),id(201)]);
    await reject('select public.submit_direct_transfer_trade_offer($1,1000,$2,null)',[id(202),id(201)]);
    await root();
    await db.query("update public.rider_contracts set status='terminated' where rider_id=$1 and status='active'",[id(201)]);
    check(await scalar('select status from public.direct_transfer_offers where id=$1',[selectedId]),'cancelled','Normal contract departure cancels offers using the outgoing rider as payment');
    const before=await snapshot();
    await auth(2);
    await reject('select public.respond_to_direct_transfer_offer($1,true)',[selectedId]);
    check(await snapshot(),before);
  });

  await scenario('full teams can swap without a temporary capacity overflow',async () => {
    for (let n=0;n<34;n++) {
      await addRider(1000+n,10);
      await addRider(1100+n,11);
    }
    check(await scalar('select public.get_team_roster_commitment_count($1,4)',[id(10)]),35);
    check(await scalar('select public.get_team_roster_commitment_count($1,4)',[id(11)]),35);
    await auth(1);
    await reject('select public.submit_direct_transfer_offer_with_message($1,1000,null)',[id(202)]);
    const selectedId=offerId(await submit(202,0,201));
    await auth(2);
    await respond(selectedId);
    await root();
    check(await owner(201),id(11));
    check(await owner(202),id(10));
    check(await scalar('select public.get_team_roster_commitment_count($1,4)',[id(10)]),35);
    check(await scalar('select public.get_team_roster_commitment_count($1,4)',[id(11)]),35);
  });

  await scenario('homegrown reserve cannot be replaced by a foreign rider',async () => {
    await root();
    await db.query("insert into public.team_infrastructures values($1,'roster_management_center',3,'youth_pathway')",[id(10)]);
    await db.query("insert into public.youth_academy_riders(team_id,promoted_rider_id,status) values($1,$2,'promoted')",[id(10),id(201)]);
    for (let n=0;n<50;n++) await addRider(2000+n,10);
    check(await scalar('select public.get_team_non_homegrown_roster_commitment_count($1,4)',[id(10)]),50);
    await auth(1);
    await reject('select public.submit_direct_transfer_trade_offer($1,0,$2,null)',[id(202),id(201)]);
    await root();
    check(await owner(201),id(10));
    check(await owner(202),id(11));
  });

  await scenario('cash reservations retained and no annual salary gate introduced',async () => {
    await root();
    await db.query('update public.team_seasons set cash_balance=1000 where id=$1',[id(104)]);
    await auth(1);
    const selectedId=offerId(await submit(202,1000,201));
    await root();
    check(Number(await scalar('select public.get_team_transfer_reserved_budget($1)',[id(10)])),1000,'Only actual cash is reserved, not either annual salary');
    await auth(2);
    await respond(selectedId);
    await root();
    check(Number(await scalar('select cash_balance from public.team_seasons where id=$1',[id(104)])),0);
    check(await owner(202),id(10));
  });

  await scenario('pure swap remains possible in debt without an outgoing cash adjustment',async () => {
    await root();
    await db.query('update public.team_seasons set cash_balance=-500 where id=$1',[id(104)]);
    await db.query('update public.team_seasons set cash_balance=-800 where id=$1',[id(114)]);
    await auth(1);
    await reject('select public.submit_direct_transfer_trade_offer($1,1000,$2,null)',[id(202),id(201)]);
    const selectedId=offerId(await submit(202,0,201));
    await auth(2);
    await respond(selectedId);
    await root();
    check(await owner(202),id(10));
    check(await owner(201),id(11));
    check(Number(await scalar('select cash_balance from public.team_seasons where id=$1',[id(104)])),-500);
    check(Number(await scalar('select cash_balance from public.team_seasons where id=$1',[id(114)])),-800);
    check(await scalar("select count(*)::int from public.team_finance_transactions where category='transfer' and status='posted'"),0,'A pure swap never generates a fictitious cash debit');
  });

  await scenario('real departure triggers free equipment and pause/resume nationality for both riders',async () => {
    await root();
    await db.query('update public.team_seasons set registration_country_id=$1 where id=$2',[id(90),id(104)]);
    await db.query('update public.team_seasons set registration_country_id=$1 where id=$2',[id(91),id(114)]);
    await db.query('update public.riders set country_id=$1 where id=any($2::uuid[])',[id(92),[id(201),id(202)]]);
    await db.query('select public.resume_rider_naturalization_progress($1,$2,$3)',[id(201),id(90),id(10)]);
    await db.query('select public.resume_rider_naturalization_progress($1,$2,$3)',[id(202),id(91),id(11)]);
    await db.query('update public.seasons set current_day_number=16 where id=$1',[id(4)]);
    await db.query("insert into public.rider_equipment_assignments values($1,'source A'),($2,'source B'),($3,'unrelated')",[id(201),id(202),id(203)]);
    await db.query("insert into public.rider_equipment_pending_assignments values($1,$2,'pending A'),($3,$4,'pending B'),($5,$6,'unrelated')",[id(201),id(104),id(202),id(114),id(203),id(124)]);
    await auth(1);
    const selectedId=offerId(await submit(202,0,201));
    await auth(2);
    await respond(selectedId);
    await root();
    check(await rows('select rider_id,equipment_key from public.rider_equipment_assignments'),[{rider_id:id(203),equipment_key:'unrelated'}],'Source-team assigned equipment is released for both outgoing riders only');
    check(await rows('select rider_id,team_season_id,equipment_key from public.rider_equipment_pending_assignments'),[{rider_id:id(203),team_season_id:id(124),equipment_key:'unrelated'}]);
    for (const [rider,formerCountry,newCountry,newTeam] of [[201,90,91,11],[202,91,90,10]]) {
      const previous=(await rows('select accumulated_days,active_since_season_id from public.rider_naturalization_country_progress where rider_id=$1 and country_id=$2',[id(rider),id(formerCountry)]))[0];
      check(previous,{accumulated_days:2,active_since_season_id:null},'Previous nationality counter is frozen without losing accrued days');
      const next=(await rows('select accumulated_days,active_since_season_id,active_since_day_number,last_team_id from public.rider_naturalization_country_progress where rider_id=$1 and country_id=$2',[id(rider),id(newCountry)]))[0];
      check(next,{accumulated_days:0,active_since_season_id:id(4),active_since_day_number:16,last_team_id:id(newTeam)},'Destination nationality counter starts on the actual transfer day');
    }
    check(await scalar("select count(*)::int from public.rider_contracts where rider_id=any($1::uuid[]) and status='active' and joined_day_number=16",[[id(201),id(202)]]),2,'Both new contracts have the correct joined day');
    check(await scalar("select count(*)::int from public.rider_contracts where rider_id=any($1::uuid[]) and status='terminated' and left_day_number=16",[[id(201),id(202)]]),2,'Both previous contracts record the actual departure day');
  });

  await scenario('another offer reservation reduces available cash',async () => {
    await root();
    await db.query('update public.team_seasons set cash_balance=1500 where id=$1',[id(104)]);
    await auth(1);
    await scalar('select public.submit_direct_transfer_offer_with_message($1,1000,null)',[id(203)]);
    await reject('select public.submit_direct_transfer_trade_offer($1,1000,$2,null)',[id(202),id(201)]);
    await root();
    check(Number(await scalar('select public.get_team_transfer_reserved_budget($1)',[id(10)])),1000);
  });

  await scenario('cash spent while offer pending blocks acceptance atomically',async () => {
    await auth(1);
    const selectedId=offerId(await submit(202,12000,201));
    await root();
    await db.query('update public.team_seasons set cash_balance=100 where id=$1',[id(104)]);
    const before=await snapshot();
    await auth(2);
    await reject('select public.respond_to_direct_transfer_offer($1,true)',[selectedId]);
    check(await snapshot(),before);
  });

  await scenario('season change prevents stale trade acceptance',async () => {
    await auth(1);
    const selectedId=offerId(await submit(202,0,201));
    await root();
    await db.query("update public.seasons set status='completed' where id=$1",[id(4)]);
    await db.query("update public.seasons set status='active' where id=$1",[id(5)]);
    await db.query('insert into public.team_seasons(id,team_id,season_id,display_name) values($1,$2,$3,$4),($5,$6,$3,$7)',[id(105),id(10),id(5),'Acheteur S5',id(115),id(11),'Vendeur S5']);
    const before=await snapshot();
    await auth(2);
    await reject('select public.respond_to_direct_transfer_offer($1,true)',[selectedId]);
    check(await snapshot(),before);
  });

  await scenario('manager revocation after submission is enforced',async () => {
    await auth(1);
    const selectedId=offerId(await submit(202,0,201));
    await root();
    await db.query("update public.team_manager_assignments set status='inactive' where sporting_director_id=$1",[id(21)]);
    const before=await snapshot();
    await auth(2);
    await reject('select public.respond_to_direct_transfer_offer($1,true)',[selectedId]);
    check(await snapshot(),before);
  });

  await scenario('only the proposing team can withdraw, releasing its rider',async () => {
    await auth(1);
    const selectedId=offerId(await submit(202,0,201));
    for (const user of [2,3,null]) {
      await auth(user);
      await reject('select public.cancel_current_direct_transfer_offer($1)',[selectedId]);
    }
    await auth(1);
    await scalar('select public.cancel_current_direct_transfer_offer($1)',[selectedId]);
    await root();
    check(await scalar('select status from public.direct_transfer_offers where id=$1',[selectedId]),'cancelled');
    const withdrawn=await snapshot();
    await auth(1);
    await scalar('select public.cancel_current_direct_transfer_offer($1)',[selectedId]);
    check(await snapshot(),withdrawn,'Withdrawal replay is idempotent');
    await auth(2);
    await reject('select public.respond_to_direct_transfer_offer($1,true)',[selectedId]);
    await auth(1);
    const newOffer=offerId(await submit(203,0,201));
    check(typeof newOffer,'string','A withdrawn offer releases the counterpart for a new proposal');
  });

  for (const director of [20,21]) {
    await scenario(`automated manager ${director} cannot enter human player trades`,async () => {
      await root();
      await db.query('insert into public.alpha_bot_managers values($1)',[id(director)]);
      await auth(1);
      await reject('select public.submit_direct_transfer_trade_offer($1,0,$2,null)',[id(202),id(201)]);
    });
  }

  await scenario('live race ownership guard permits own team and national selection only',async () => {
    await root();
    await db.query("insert into public.race_editions values($1,'planned'),($2,'completed')",[id(870),id(871)]);
    await db.query("insert into public.race_registrations(id,race_edition_id,status,team_season_id) values($1,$2,'accepted',$3),($4,$2,'accepted',$5),($6,$2,'accepted',null),($7,$8,'accepted',$5)",[id(872),id(870),id(104),id(873),id(114),id(874),id(875),id(871)]);
    await db.query("insert into public.race_rosters(race_registration_id,rider_id,status) values($1,$2,'selected')",[id(872),id(201)]);
    await reject("insert into public.race_rosters(race_registration_id,rider_id,status) values($1,$2,'confirmed')",[id(873),id(201)]);
    await db.query("insert into public.race_rosters(race_registration_id,rider_id,status) values($1,$2,'selected')",[id(874),id(201)]);
    await db.query("insert into public.race_rosters(race_registration_id,rider_id,status) values($1,$2,'confirmed')",[id(875),id(201)]);
    check(await scalar('select count(*)::int from public.race_rosters where rider_id=$1',[id(201)]),3,'Own-team, national and historical race entries remain supported');
    await reject("update public.race_rosters set race_registration_id=$1 where race_registration_id=$2",[id(873),id(872)]);
  });

  await scenario('live training guard checks current owner without touching completed history',async () => {
    await root();
    await db.query("insert into public.rider_form_camps(id,rider_id,season_id,status,team_season_id) values($1,$2,$3,'planned',$4)",[id(880),id(201),id(4),id(104)]);
    await reject("insert into public.rider_form_camps(rider_id,season_id,status,team_season_id) values($1,$2,'active',$3)",[id(201),id(4),id(114)]);
    await db.query("insert into public.rider_form_camps(id,rider_id,season_id,status,team_season_id) values($1,$2,$3,'completed',$4)",[id(881),id(201),id(4),id(114)]);
    await reject("update public.rider_form_camps set status='active' where id=$1",[id(881)]);
    check(await scalar('select count(*)::int from public.rider_form_camps'),2);
    await db.query("insert into public.stage_reconnaissances(id,season_id,status,team_season_id) values($1,$2,'planned',$3),($4,$2,'planned',$5),($6,$2,'completed',$5)",[id(882),id(4),id(104),id(883),id(114),id(884)]);
    await db.query('insert into public.stage_reconnaissance_riders(reconnaissance_id,rider_id) values($1,$2)',[id(882),id(201)]);
    await reject('insert into public.stage_reconnaissance_riders(reconnaissance_id,rider_id) values($1,$2)',[id(883),id(201)]);
    await db.query('insert into public.stage_reconnaissance_riders(reconnaissance_id,rider_id) values($1,$2)',[id(884),id(201)]);
    check(await scalar('select count(*)::int from public.stage_reconnaissance_riders'),2,'Completed reconnaissance history can still refer to a former team');
  });

  await scenario('stale registration page cannot book a rider after the trade commits',async () => {
    await auth(1);
    const selectedId=offerId(await submit(202,0,201));
    await auth(2);
    await respond(selectedId);
    await root();
    await db.query("insert into public.race_editions values($1,'planned')",[id(890)]);
    await db.query("insert into public.race_registrations(id,race_edition_id,status,team_season_id) values($1,$2,'accepted',$3),($4,$2,'accepted',$5)",[id(891),id(890),id(104),id(892),id(114)]);
    await reject("insert into public.race_rosters(race_registration_id,rider_id,status) values($1,$2,'selected')",[id(891),id(201)]);
    await db.query("insert into public.race_rosters(race_registration_id,rider_id,status) values($1,$2,'selected')",[id(892),id(201)]);
    await reject("insert into public.rider_form_camps(rider_id,season_id,status,team_season_id) values($1,$2,'planned',$3)",[id(201),id(4),id(104)]);
    await db.query("insert into public.rider_form_camps(rider_id,season_id,status,team_season_id) values($1,$2,'planned',$3)",[id(201),id(4),id(114)]);
    check(await scalar('select count(*)::int from public.race_rosters where rider_id=$1',[id(201)]),1);
    check(await scalar('select count(*)::int from public.rider_form_camps where rider_id=$1',[id(201)]),1);
  });

  for (const rider of [201,202]) {
    await scenario(`rider ${rider} retired or locked cannot be traded`,async () => {
      await root();
      await db.query("update public.riders set status='retired' where id=$1",[id(rider)]);
      await auth(1);
      await reject('select public.submit_direct_transfer_trade_offer($1,0,$2,null)',[id(202),id(201)]);
      await root();
      await db.query("update public.riders set status='active' where id=$1",[id(rider)]);
      await db.query('update public.rider_contracts set transfer_locked_season_id=$1 where rider_id=$2',[id(4),id(rider)]);
      await auth(1);
      await reject('select public.submit_direct_transfer_trade_offer($1,0,$2,null)',[id(202),id(201)]);
    });

    await scenario(`rider ${rider} history enforces one team change even without lock flag`,async () => {
      await addRider(rider,12,{status:'terminated'});
      await auth(1);
      await reject('select public.submit_direct_transfer_trade_offer($1,0,$2,null)',[id(202),id(201)]);
    });

    await scenario(`rider ${rider} auction conflict checked at submission and acceptance`,async () => {
      await root();
      await db.query("insert into public.transfer_market_listings(id,rider_id,season_id,status,seller_team_id) values($1,$2,$3,'open',$4)",[id(800),id(rider),id(4),id(rider===201?10:11)]);
      await auth(1);
      await reject('select public.submit_direct_transfer_trade_offer($1,0,$2,null)',[id(202),id(201)]);
      await root();
      await db.query("update public.transfer_market_listings set status='cancelled' where id=$1",[id(800)]);
      await auth(1);
      const selectedId=offerId(await submit(202,0,201));
      await root();
      await db.query("update public.transfer_market_listings set status='open' where id=$1",[id(800)]);
      const before=await snapshot();
      await auth(2);
      await reject('select public.respond_to_direct_transfer_offer($1,true)',[selectedId]);
      check(await snapshot(),before);
    });

    await scenario(`rider ${rider} course commitment checked twice, completed race allowed`,async () => {
      await root();
      await db.query("insert into public.race_editions values($1,'planned')",[id(801)]);
      await db.query("insert into public.race_registrations(id,race_edition_id,status,team_season_id) values($1,$2,'accepted',$3)",[id(802),id(801),id(rider===201?104:114)]);
      await db.query("insert into public.race_rosters(race_registration_id,rider_id,status) values($1,$2,'confirmed')",[id(802),id(rider)]);
      await auth(1);
      await reject('select public.submit_direct_transfer_trade_offer($1,0,$2,null)',[id(202),id(201)]);
      await root();
      await db.query("update public.race_editions set status='completed' where id=$1",[id(801)]);
      await auth(1);
      const selectedId=offerId(await submit(202,0,201));
      await root();
      await db.query("update public.race_editions set status='ongoing' where id=$1",[id(801)]);
      const before=await snapshot();
      await auth(2);
      await reject('select public.respond_to_direct_transfer_offer($1,true)',[selectedId]);
      check(await snapshot(),before,'A new race commitment is not silently deleted to complete the trade');
      await root();
      await db.query("update public.race_editions set status='completed' where id=$1",[id(801)]);
      await auth(2);
      await respond(selectedId);
      await root();
      check(await scalar('select count(*)::int from public.race_rosters where rider_id=$1',[id(rider)]),1,'Historical completed-race roster remains intact');
    });

    for (const kind of ['form_camp','reconnaissance']) {
      await scenario(`rider ${rider} ${kind} commitment is protected`,async () => {
        const setStatus=async status => {
          await root();
          if (kind==='form_camp') await db.query('update public.rider_form_camps set status=$1 where id=$2',[status,id(803)]);
          else await db.query('update public.stage_reconnaissances set status=$1 where id=$2',[status,id(803)]);
        };
        await root();
        if (kind==='form_camp') {
          await db.query("insert into public.rider_form_camps(id,rider_id,season_id,status,team_season_id) values($1,$2,$3,'planned',$4)",[id(803),id(rider),id(4),id(rider===201?104:114)]);
        } else {
          await db.query("insert into public.stage_reconnaissances(id,season_id,status,team_season_id) values($1,$2,'planned',$3)",[id(803),id(4),id(rider===201?104:114)]);
          await db.query('insert into public.stage_reconnaissance_riders(reconnaissance_id,rider_id) values($1,$2)',[id(803),id(rider)]);
        }
        await auth(1);
        await reject('select public.submit_direct_transfer_trade_offer($1,0,$2,null)',[id(202),id(201)]);
        await setStatus('completed');
        await auth(1);
        const selectedId=offerId(await submit(202,0,201));
        await setStatus('active');
        const before=await snapshot();
        await auth(2);
        await reject('select public.respond_to_direct_transfer_offer($1,true)',[selectedId]);
        check(await snapshot(),before,'An active training/reconnaissance commitment blocks acceptance without being cancelled');
      });
    }
  }

  await scenario('net salary quotes, homegrown discount and data room applied once',async () => {
    await root();
    await db.query('insert into public.test_team_specialization_power values($1,1),($2,2)',[id(10),id(11)]);
    // Both riders return to the clubs that originally trained them, so each
    // destination is entitled to its existing homegrown salary reduction.
    await db.query("insert into public.youth_academy_riders(team_id,promoted_rider_id,status) values($1,$2,'promoted'),($3,$4,'promoted')",[id(10),id(202),id(11),id(201)]);
    await db.query("insert into public.rider_special_abilities values($1,'homegrown'),($2,'homegrown')",[id(201),id(202)]);
    await auth(1);
    const selectedId=offerId(await submit(202,10000,201));
    await root();
    const quoted=(await rows('select salary_per_season,offered_rider_salary_per_season from public.direct_transfer_offers where id=$1',[selectedId]))[0];
    check(Number(quoted.salary_per_season),3977,'8200 × .97 DataRoom / 2 homegrown');
    check(Number(quoted.offered_rider_salary_per_season),3337,'7100 × .94 DataRoom / 2 homegrown');
    await auth(2);
    await respond(selectedId);
    await root();
    check(Number(await scalar("select salary_per_season from public.rider_contracts where rider_id=$1 and status='active'",[id(202)])),3977,'Insertion must start from gross quote, not apply discounts twice');
    check(Number(await scalar("select salary_per_season from public.rider_contracts where rider_id=$1 and status='active'",[id(201)])),3337);
    check(Number(await scalar('select cash_balance from public.team_seasons where id=$1',[id(104)])),990400,'Cash payer retains its historical 4% DataRoom transfer rebate');
    check(Number(await scalar('select cash_balance from public.team_seasons where id=$1',[id(114)])),1010000,'Counterpart rider creates no fictitious fee or rebate');
  });

  await scenario('counterpart index supports bounded cancellation lookup',async () => {
    await root();
    const indexes=await rows("select indexname,indexdef from pg_indexes where schemaname='public' and tablename='direct_transfer_offers'");
    check(indexes.some(index => /offered_rider_id/iu.test(index.indexdef) && /WHERE.*pending/iu.test(index.indexdef)),true,'Counterpart invalidation has a partial pending index');
    await db.exec('set local enable_seqscan=off');
    const plan=await rows("explain (format json) select id from public.direct_transfer_offers where offered_rider_id=$1 and buyer_team_id=$2 and status='pending'",[id(201),id(10)]);
    check(/Index.*Scan/iu.test(JSON.stringify(plan)),true,'The planner can use an index for the counterpart lookup');
  });

  console.log(JSON.stringify({ok:true,checks,scenarios,isolated:true,productionData:false,multiSessionConcurrency:false,migration:migrationPath}));
} catch (error) {
  console.error(JSON.stringify({ok:false,scenario:currentCase,checks,error:error.message,code:error.code}));
  process.exitCode=1;
} finally {
  await db.close();
}
