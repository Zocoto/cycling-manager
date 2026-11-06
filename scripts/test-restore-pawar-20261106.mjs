// Isolated PostgreSQL/WASM only: no credentials, remote connections or production mutations.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]?.replaceAll('\\','/').endsWith('/pglite/dist/index.js')) throw Error('Pass the existing local PGlite module.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const artifact = 'C:/Dev/artifacts/draft-free-agent-incident-20261106/';
const live = JSON.parse(readFileSync(artifact+'functions-curative.json','utf8'));
const migration = readFileSync('supabase/migrations/20261106113000_restore_pawar_to_samuelrodri.sql','utf8');
const ids = {
  rider:'ed560026-792d-456c-b4d6-484e46d9020a',s4:'c0c5824c-43a4-442e-907c-265c479efa0a',
  s5:'7ea43c15-30fd-4878-b18f-ab2a43ad3be8',s6:'a626036c-b5c7-4d5e-be10-9d4b748e6c25',
  buyer:'6d29ce14-c55f-4e3e-bd73-59f410484210',samuel:'c7d4f299-3430-4aaf-a029-ac9b97a07ed2',
  bts:'3704d760-5161-469b-baae-5395b7726503',sts:'36dfc2d7-6102-456d-b49a-64bfdcb090a2',
  invalid:'08c6c30e-c972-4213-b31c-df6a5358c856',future:'9f63fedb-0738-4bb9-a601-69bd9d918f71',
  offer:'70012872-d73e-497a-be9d-b7bcda127eeb',restore:'83d8990f-25ce-4e45-9f0a-11f201a78af0',
};
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rows = async (s,p=[]) => (await db.query(s,p)).rows;
const scalar = async (s,p=[]) => Object.values((await rows(s,p))[0]??{})[0];
let checks=0;
const check = (a,b,label) => {assert.deepEqual(a,b,label); checks++;};
const fn = (path,name) => {
  const sql=readFileSync(path,'utf8').replaceAll('\r\n','\n');
  const start=sql.indexOf('create or replace function '+name+'(');
  assert(start>=0,name);
  const delim=sql.indexOf('as $$',start);
  return sql.slice(start,sql.indexOf('$$;',delim+5)+3);
};
const snapshot=async()=>({
  contracts:await rows('select * from rider_contracts order by id'),
  ledger:await rows('select * from team_finance_transactions order by id'),
  accounts:await rows('select * from team_seasons order by id'),
  offers:await rows('select * from direct_transfer_offers order by id'),
  gear:await rows('select * from rider_equipment_assignments order by rider_id'),
  log:await rows('select * from test_lifecycle_log order by seq'),
});
try {
  await db.exec(`
    create schema private;
    create table seasons(id uuid primary key,game_year int,status text,current_day_number int);
    create table season_days(id uuid primary key default gen_random_uuid(),season_id uuid,day_number int);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,currency text default 'EUR',cash_balance numeric,registration_country_id uuid);
    create table riders(id uuid primary key,first_name text,last_name text,status text);
    create table rider_contracts(id uuid primary key default gen_random_uuid(),rider_id uuid,team_id uuid,start_season_id uuid,end_season_id uuid,
      salary_per_season numeric,currency text,currency_code text,status text,signed_at timestamptz,acquisition_type text,transfer_locked_season_id uuid,
      transfer_fee numeric default 0,squad_status text,left_season_id uuid,left_day_number int,roster_management_salary_before_discount numeric,
      roster_management_discount_percent numeric default 0,salary_billing_from_game_day_index int);
    create unique index rider_one_active on rider_contracts(rider_id) where status='active';
    create table direct_transfer_offers(id uuid primary key,rider_id uuid,buyer_team_id uuid,seller_team_id uuid,season_id uuid,
      effective_season_id uuid,effective_contract_id uuid,offered_effective_contract_id uuid,status text,offered_amount numeric,offered_rider_id uuid,
      escrowed_at timestamptz,released_at timestamptz,released_team_season_id uuid,salary_before_team_discounts numeric,response_note text);
    create table team_finance_transactions(id uuid primary key default gen_random_uuid(),team_season_id uuid,season_day_id uuid,
      day_number int check(day_number between 1 and 28),amount numeric check(amount<>0),category text,status text,description text,source_reference text,posted_at timestamptz,
      unique(team_season_id,source_reference));
    create table rider_form_camps(id uuid primary key default gen_random_uuid(),rider_id uuid,team_season_id uuid,created_at timestamptz,status text,completed_at timestamptz);
    create table rider_performance_preparations(rider_id uuid,team_id uuid,created_at timestamptz);
    create table daily_reward_inventory(team_season_id uuid,used_at timestamptz,usage_payload jsonb);
    create table halloween_rider_effects(rider_id uuid,used_at timestamptz);
    create table rider_training_sessions(rider_id uuid,team_id uuid,processed_at timestamptz);
    create table rider_daily_nutrition_effects(rider_id uuid,team_id uuid,applied_at timestamptz);
    create table race_editions(id uuid primary key,status text);
    create table race_registrations(id uuid primary key,team_season_id uuid,race_edition_id uuid);
    create table race_rosters(rider_id uuid,race_registration_id uuid,status text);
    create table stages(id uuid primary key,status text);
    create table race_stage_equipment_assignments(rider_id uuid,team_season_id uuid,stage_id uuid);
    create table rider_training_plan_versions(rider_id uuid,team_id uuid,season_id uuid,effective_from_day_number int,trainer_contract_id uuid);
    create table rider_equipment_assignments(rider_id uuid,equipment text);
    create table rider_equipment_pending_assignments(rider_id uuid,team_season_id uuid);
    create table stage_reconnaissances(id uuid primary key,team_season_id uuid,status text,completed_at timestamptz);
    create table stage_reconnaissance_riders(reconnaissance_id uuid,form_camp_id uuid);
    create table test_lifecycle_log(seq serial,action text,rider_id uuid,team_id uuid);
    create function public.pause_rider_naturalization_progress(uuid,uuid,int) returns void language sql as $$insert into public.test_lifecycle_log(action,rider_id) values('pause',$1)$$;
    create function public.resume_rider_naturalization_progress(uuid,uuid,uuid) returns void language sql as $$insert into public.test_lifecycle_log(action,rider_id,team_id) values('resume',$1,$3)$$;
    create function public.get_roster_management_renewal_discount(uuid) returns numeric language sql as $$select 5::numeric$$;
  `);
  for(const sig of ['private.lock_direct_transfer_scope(uuid,uuid[],uuid[])','private.enforce_rider_team_change_limit()',
    'private.guard_deferred_transfer_contract()','detach_departing_rider(uuid,uuid,uuid,integer)','handle_rider_contract_transition()',
    'handle_finance_contract_change()']) {
    const found=live.find(row=>row.signature===sig); assert(found,sig); await db.exec(found.definition);
  }
  const sync=JSON.parse(readFileSync(artifact+'functions-finance.json','utf8'))[0].definition;
  await db.exec(sync);
  await db.exec(fn('supabase/migrations/20260921130000_create_team_roster_management_center.sql','public.apply_roster_management_renewal_discount'));
  const deferredSchema=readFileSync('supabase/migrations/20261102090000_add_deferred_direct_transfers.sql','utf8').replaceAll('\r\n','\n');
  const constraintStart=deferredSchema.indexOf('alter table public.direct_transfer_offers add constraint direct_transfer_offers_deferred_shape');
  assert(constraintStart>=0);
  await db.exec(deferredSchema.slice(constraintStart,deferredSchema.indexOf('\n);',constraintStart)+4));
  // Seed historical state before attaching real guards, as a migration fixture.
  await db.exec(`
    insert into seasons values('${ids.s4}',4,'completed',28),('${ids.s5}',5,'active',1),('${ids.s6}',6,'planned',1);
    insert into season_days(season_id,day_number) select s.id,n from seasons s cross join generate_series(7,28,7)n;
    insert into team_seasons(id,team_id,season_id,cash_balance) values('${ids.bts}','${ids.buyer}','${ids.s5}',793466.89),('${ids.sts}','${ids.samuel}','${ids.s5}',107835);
    insert into riders values('${ids.rider}','Hemant','Pawar','active');
    insert into rider_contracts(id,rider_id,team_id,start_season_id,end_season_id,salary_per_season,status,acquisition_type,transfer_locked_season_id,transfer_fee,squad_status)
    values('${ids.invalid}','${ids.rider}','${ids.buyer}','${ids.s5}','${ids.s5}',13500,'active','free_agent','${ids.s5}',0,'non_defined'),
      ('${ids.future}','${ids.rider}','${ids.samuel}','${ids.s6}','${ids.s6}',12000,'planned','direct_offer','${ids.s6}',600,'non_defined'),
      ('a0862837-b113-42f1-b16d-87642b49f1b4','${ids.rider}','${ids.samuel}','${ids.s4}','${ids.s4}',13000,'completed','direct_offer',null,0,'absolute_leader'),
      ('e90d51fb-ab61-4577-8b57-268123905a81','${ids.rider}','${id(199)}','${ids.s4}','${ids.s5}',13000,'terminated','initial',null,0,'non_defined');
    insert into direct_transfer_offers(id,rider_id,buyer_team_id,seller_team_id,season_id,effective_season_id,effective_contract_id,status,offered_amount,escrowed_at,salary_before_team_discounts)
      values('${ids.offer}','${ids.rider}','${ids.samuel}','${ids.buyer}','${ids.s5}','${ids.s6}','${ids.future}','accepted',600,'2026-11-06T09:54:00Z',12000);
    insert into team_finance_transactions(team_season_id,day_number,amount,category,status,source_reference)
      values('${ids.sts}',1,-600,'transfer','posted','direct-transfer-purchase:${ids.offer}'),('${ids.bts}',1,5000,'other','posted','objective:06c4b043-b579-49f1-8d75-3dcfa93e0b62');
    select public.sync_rider_salary_installments('${ids.invalid}');
    insert into rider_equipment_assignments values('${ids.rider}','owned-bike');
    insert into rider_equipment_pending_assignments values('${ids.rider}','${ids.bts}');
    create trigger deferred_contract before update or delete on rider_contracts for each row execute function private.guard_deferred_transfer_contract();
    create trigger rider_contracts_team_change_limit before insert on rider_contracts for each row execute function private.enforce_rider_team_change_limit();
    create trigger zz_apply_roster_management_renewal_discount before insert or update of salary_per_season,status,acquisition_type,team_id on rider_contracts for each row execute function public.apply_roster_management_renewal_discount();
    create trigger rider_contract_transition after insert or update or delete on rider_contracts for each row execute function public.handle_rider_contract_transition();
    create trigger finance_contract_change after insert or update of status,salary_per_season on rider_contracts for each row execute function public.handle_finance_contract_change();
  `);
  await assert.rejects(()=>db.query('update rider_contracts set status=\'cancelled\' where id=$1',[ids.invalid]),/rester dans son équipe/);checks++;
  await assert.rejects(()=>db.query('update direct_transfer_offers set status=\'cancelled\' where id=$1',[ids.offer]),/direct_transfer_offers_deferred_shape/);checks++;
  await db.exec('begin;');
  await db.query('update direct_transfer_offers set status=\'cancelled\',effective_contract_id=null,offered_effective_contract_id=null,escrowed_at=null,released_at=null,released_team_season_id=null where id=$1',[ids.offer]);
  await db.query('update rider_contracts set status=\'terminated\' where id=$1',[ids.invalid]);
  await assert.rejects(()=>db.query(`insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type) values($1,$2,$3,$3,'active','renewal')`,[ids.rider,ids.samuel,ids.s5]),/déjà changé/);checks++;
  await db.exec('rollback;');
  // All failing repairs must roll back their complete transaction.
  for(const [label,setup,cleanup,pattern] of [
    ['new investment',`insert into rider_training_sessions values('${ids.rider}','${ids.buyer}',now())`,'delete from rider_training_sessions',/investment appeared/],
    ['paid salary',`update team_finance_transactions set status='posted' where source_reference like 'rider-salary:%'`,`update team_finance_transactions set status='pending' where source_reference like 'rider-salary:%'`,/paid Pawar salary/],
    ['released escrow',`update direct_transfer_offers set released_at=now(),released_team_season_id='${ids.bts}'`,`update direct_transfer_offers set released_at=null,released_team_season_id=null`,/transfer\/escrow changed/],
    ['day changed',`update seasons set current_day_number=2 where id='${ids.s5}'`,`update seasons set current_day_number=1 where id='${ids.s5}'`,/S5 J1 changed/],
  ]) {
    await db.exec(setup);const before=await snapshot();
    await assert.rejects(()=>db.exec(migration),pattern,label);checks++;await db.exec('rollback;');
    check(await snapshot(),before,label+' is atomic');await db.exec(cleanup);
  }
  const before=await snapshot();
  await db.exec(migration);
  check(await scalar('select status from rider_contracts where id=$1',[ids.invalid]),'cancelled','Invalid acquisition cancelled');
  check((await rows('select status,team_id,salary_per_season::text as salary,transfer_locked_season_id from rider_contracts where id=$1',[ids.restore]))[0],
    {status:'active',team_id:ids.samuel,salary:'13000',transfer_locked_season_id:null},'Historical salary restored for S5 only');
  check((await rows('select status,acquisition_type,salary_per_season::text as salary,transfer_fee::text as fee,transfer_locked_season_id from rider_contracts where id=$1',[ids.future]))[0],
    {status:'planned',acquisition_type:'direct_offer',salary:'12000',fee:'0',transfer_locked_season_id:null},'S6 salary preserved without renewal discount');
  check(Number(await scalar('select cash_balance from team_seasons where id=$1',[ids.bts])),793466.89,'Buyer receives no unearned cash');
  check(Number(await scalar('select cash_balance from team_seasons where id=$1',[ids.sts])),108435,'Samuel refunded exact escrow');
  check(Number(await scalar("select count(*) from team_finance_transactions where source_reference like $1 and status='cancelled'",['rider-salary:'+ids.invalid+':%'])),4,'All four unpaid buyer salaries cancelled');
  check(Number(await scalar("select sum(amount) from team_finance_transactions where source_reference like $1 and status='pending'",['rider-salary:'+ids.restore+':%'])),-13000,'Samuel normal salary installments generated');
  check(await rows('select * from rider_equipment_assignments'),[],'Source equipment reservation released');
  check(await rows('select * from rider_equipment_pending_assignments'),[],'Pending source gear released');
  check(Number(await scalar("select count(*) from test_lifecycle_log where action='pause'")),1,'Explicit detach runs once despite preserved successor');
  check(await scalar('select team_id from test_lifecycle_log where action=\'resume\''),ids.samuel,'Naturalization resumes under receiving club');
  check(await scalar('select status from direct_transfer_offers where id=$1',[ids.offer]),'cancelled','No escrow can settle next season');
  check((await rows('select effective_season_id,effective_contract_id,escrowed_at,released_at,released_team_season_id from direct_transfer_offers where id=$1',[ids.offer]))[0],
    {effective_season_id:ids.s6,effective_contract_id:null,escrowed_at:null,released_at:null,released_team_season_id:null},'Cancelled shape releases all escrow pointers and preserves season');
  const cancellationNote=await scalar('select response_note from direct_transfer_offers where id=$1',[ids.offer]);
  const originalEscrow=cancellationNote.match(/séquestre initial : ([^;]+) ;/)?.[1];
  check(cancellationNote.includes(ids.future)&&new Date(originalEscrow).toISOString()==='2026-11-06T09:54:00.000Z'&&/600(?:\.0+)? EUR/.test(cancellationNote),true,'Audit note preserves former contract, escrow date and refund');
  check((await rows('select * from rider_contracts where id=$1',['a0862837-b113-42f1-b16d-87642b49f1b4']))[0],before.contracts.find(c=>c.id==='a0862837-b113-42f1-b16d-87642b49f1b4'),'Historical contract unchanged');
  const after=await snapshot(); await db.exec(migration);check(await snapshot(),after,'Retry is an exact no-op');
  console.log(JSON.stringify({checks,liveDefinitions:6,passed:true}));
} catch(error) {
  console.error(JSON.stringify({message:error.message,detail:error.detail,where:error.where,stack:error.stack?.split('\n').slice(0,4)}));
  process.exitCode=1;
} finally {await db.close();}
