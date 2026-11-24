// Isolated PostgreSQL only. Never connects to Supabase or changes player data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const modulePath=process.argv[2]??'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js';
const definitions=process.argv[3]??'C:/Dev/equipment-deferred-diagnostics-20261124';
if(!modulePath.replaceAll('\\','/').endsWith('/@electric-sql/pglite/dist/index.js'))throw Error('Use a local isolated PGlite installation.');
const {PGlite}=await import(pathToFileURL(modulePath).href);
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const read=name=>readFileSync(`${definitions}/public.${name}.sql`,'utf8').replace(/^\ufeff/,'').replaceAll('\r','')+';';
const migration=readFileSync('supabase/migrations/20261124143000_defer_permanent_equipment_until_race_completion.sql','utf8').replaceAll('\r','');
const rows=async(sql,args=[]) => (await db.query(sql,args)).rows;
const scalar=async(sql,args=[]) => Object.values((await rows(sql,args))[0])[0];
let checks=0;
const check=(actual,expected,why)=>{assert.deepEqual(actual,expected,why);checks++;};
const rejects=async(sql,pattern)=>{await assert.rejects(db.query(sql),pattern);checks++;};
const equip=(rider,item,slot='frame')=>`select public.equip_current_team_rider('${id(rider)}','${slot}','${id(item)}')`;
const unequip=(rider,slot='frame')=>`select public.unequip_current_team_rider('${id(rider)}','${slot}')`;
const save=assignments=>db.query('select public.save_current_team_equipment_assignments($1)',[JSON.stringify(assignments.map(([rider,item,slot='frame'])=>({riderId:id(rider),equipmentItemId:item===null?null:id(item),slot}))) ]);
const current=(rider=6,slot='frame')=>rows('select equipment_item_id from public.rider_equipment_assignments where rider_id=$1 and slot_type=$2',[id(rider),slot]).then(result=>result[0]?.equipment_item_id??null);
const pending=(rider=6,slot='frame')=>rows('select equipment_item_id,blocking_race_edition_ids,effective_at from public.rider_equipment_pending_assignments where rider_id=$1 and slot_type=$2',[id(rider),slot]).then(result=>result[0]??null);
const settle=()=>db.query(`select public.settle_due_equipment_assignments('${id(5)}')`);
async function reset(){
 await db.exec(`delete from rider_equipment_pending_assignments;delete from rider_equipment_assignments;delete from official_stage_simulations;
  update race_editions set status='planned';update race_registrations set team_season_id='${id(5)}';
  update rider_contracts set team_id='${id(3)}',status='active';
  update stages set departure_at=now()+interval '2 days',status='planned';
  update equipment_catalog_items set status='active';update team_equipment_inventory set quantity=1;
  update equipment_partner_contracts set status='active';
  select set_config('equipment_fixture.user','${id(1)}',false);select set_config('equipment_fixture.wheels','false',false);
  insert into rider_equipment_assignments(rider_id,slot_type,equipment_item_id) values('${id(6)}','frame','${id(20)}');`);
}
async function racing(){
 await db.exec(`update stages set departure_at=now()-interval '1 day',status='completed' where id='${id(110)}';`);
}
try{
 await db.exec(`create schema auth;create schema private;create role anon;create role authenticated;create role service_role;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('equipment_fixture.user',true),'')::uuid$$;
 create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
 create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
 create table seasons(id uuid primary key,game_year int,status text,current_day_number int default 1);
 create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,currency text default 'EUR',cash_balance numeric default 10000);
 create table season_days(id uuid primary key,season_id uuid,day_number int);
 create table riders(id uuid primary key);
 create table rider_contracts(id uuid primary key default gen_random_uuid(),rider_id uuid,team_id uuid,status text);
 create table equipment_catalog_items(id uuid primary key,name text,slot_type text,status text,acquisition_channel text,supplier_key text,owner_team_id uuid,resale_price bigint default 100,effect_payload jsonb default '{}');
 create table team_equipment_inventory(id uuid primary key default gen_random_uuid(),team_season_id uuid,equipment_item_id uuid,quantity int,updated_at timestamptz,unique(team_season_id,equipment_item_id));
 create table rider_equipment_assignments(rider_id uuid,slot_type text,equipment_item_id uuid not null,equipped_at timestamptz default now(),unique(rider_id,slot_type));
 create table rider_equipment_pending_assignments(id uuid primary key default gen_random_uuid(),team_season_id uuid,rider_id uuid,slot_type text,equipment_item_id uuid not null,requested_at timestamptz default now(),effective_at timestamptz,unique(rider_id,slot_type));
 create table equipment_partner_contracts(team_id uuid,status text,supplier_key text,start_season_id uuid,end_season_id uuid,reputation_extra_item_id uuid);
 create table equipment_partner_products(supplier_key text,equipment_item_id uuid,offer_type text);
 create table race_editions(id uuid primary key,season_id uuid,status text);
 create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid,status text);
 create table race_rosters(id uuid primary key,race_registration_id uuid,rider_id uuid,status text);
 create table stages(id uuid primary key,race_edition_id uuid,departure_at timestamptz,status text,distance_km numeric);
 create table official_stage_simulations(stage_id uuid,race_edition_id uuid);
 create table race_stage_equipment_assignments(id uuid primary key,team_season_id uuid,race_edition_id uuid,stage_id uuid,rider_id uuid,slot_type text,equipment_item_id uuid,updated_at timestamptz);
 create table team_finance_transactions(id uuid default gen_random_uuid(),team_season_id uuid,season_day_id uuid,day_number int,amount numeric,category text,status text,description text,source_reference text,posted_at timestamptz,unique(team_season_id,source_reference));
 create function public.settle_current_team_finances() returns void language sql as $$select$$;
 create function public.calculate_research_prototype_resale_price(jsonb) returns bigint language sql as $$select 100::bigint$$;
 create function public.equipment_slots_are_compatible(uuid,text,text) returns boolean language sql stable as $$
  select $2=$3 or ($2 in('front_wheel','rear_wheel') and $3 in('front_wheel','rear_wheel') and current_setting('equipment_fixture.wheels',true)='true')$$;
 insert into sporting_directors values('${id(2)}','${id(1)}','active');
 insert into team_manager_assignments values('${id(2)}','${id(3)}','general_manager','active');
 insert into seasons(id,game_year,status) values('${id(4)}',5,'active');
 insert into team_seasons(id,team_id,season_id) values('${id(5)}','${id(3)}','${id(4)}');
 insert into season_days values('${id(9)}','${id(4)}',1);
 insert into riders values('${id(6)}'),('${id(7)}'),('${id(8)}');
 insert into rider_contracts(rider_id,team_id,status) values('${id(6)}','${id(3)}','active'),('${id(7)}','${id(3)}','active'),('${id(8)}','${id(3)}','active');
 insert into equipment_catalog_items(id,name,slot_type,status,acquisition_channel,supplier_key) values
 ('${id(20)}','Old frame','frame','active','commercial','shop'),('${id(21)}','New frame','frame','active','commercial','shop'),
 ('${id(22)}','Third frame','frame','active','commercial','shop'),('${id(23)}','Partner frame','frame','active','equipment_partner','partner'),
 ('${id(24)}','Front wheel','front_wheel','active','commercial','shop'),('${id(25)}','Extra partner frame','frame','active','equipment_partner','partner');
 insert into team_equipment_inventory(team_season_id,equipment_item_id,quantity) select '${id(5)}',id,1 from equipment_catalog_items where acquisition_channel='commercial';
 insert into equipment_partner_contracts values('${id(3)}','active','partner','${id(4)}','${id(4)}','${id(25)}');
 insert into equipment_partner_products values('partner','${id(23)}','core'),('partner','${id(25)}','extra');
 insert into race_editions values('${id(100)}','${id(4)}','planned');
 insert into race_registrations values('${id(101)}','${id(100)}','${id(5)}','accepted');
 insert into race_rosters values('${id(102)}','${id(101)}','${id(6)}','confirmed');
 insert into stages values('${id(110)}','${id(100)}',now()+interval '2 days','planned',120),('${id(111)}','${id(100)}',now()+interval '3 days','planned',150);
 insert into race_stage_equipment_assignments values('${id(200)}','${id(5)}','${id(100)}','${id(111)}','${id(6)}','frame','${id(22)}',now());
 `);
 for(const name of ['enforce_equipment_assignment_slot','save_current_team_equipment_assignments','equip_current_team_rider','unequip_current_team_rider','settle_due_equipment_assignments','settle_all_due_equipment_assignments','sell_current_team_equipment_batch'])await db.exec(read(name));
 await db.exec(`create trigger enforce_pending_equipment_assignment_slot before insert or update of slot_type,equipment_item_id on rider_equipment_pending_assignments for each row execute function public.enforce_equipment_assignment_slot();
 create trigger enforce_equipment_assignment_slot before insert or update of slot_type,equipment_item_id on rider_equipment_assignments for each row execute function public.enforce_equipment_assignment_slot();
 revoke all on function public.save_current_team_equipment_assignments(jsonb) from public;grant execute on function public.save_current_team_equipment_assignments(jsonb) to authenticated,service_role;`);
 const preparation=await rows('select * from race_stage_equipment_assignments');
 const acl=await scalar(`select proacl::text from pg_proc where oid='public.save_current_team_equipment_assignments(jsonb)'::regprocedure`);
 await db.exec(migration.replaceAll('\n','\r\n'));
 await reset();await db.query(equip(6,21));check(await current(),id(21),'Out of race changes apply immediately');check(await pending(),null);
 await reset();await racing();await db.query(equip(6,21));check(await current(),id(20),'Worn setup stays during a tour');check((await pending()).equipment_item_id,id(21));check((await pending()).blocking_race_edition_ids,[id(100)]);
 await settle();check(await current(),id(20),'Between stages is still the same tour');
 await db.exec(`update rider_equipment_pending_assignments set effective_at=now()-interval '1 day';update stages set departure_at=now()-interval '2 days';`);await settle();check(await current(),id(20),'Elapsed estimate does not end an unhomologated event');
 await db.exec(`update rider_equipment_pending_assignments set effective_at='infinity';update race_editions set status='completed' where id='${id(100)}'`);check(await current(),id(21),'Completion trigger ignores future estimate and applies without a visit');check(await pending(),null);
 await reset();await racing();await db.query(unequip(6));check((await pending()).equipment_item_id,null,'Unequip is queued');check(await current(),id(20));await db.exec(`update race_editions set status='cancelled'`);check(await current(),null,'Cancelled event releases queued removal');check(await pending(),null);
 await reset();await racing();await db.query(equip(6,21));await db.query(equip(6,20));check(await pending(),null,'Selecting worn item cancels request');check(await current(),id(20));
 await reset();await db.exec('delete from rider_equipment_assignments');await racing();await db.query(equip(6,21));await db.query(unequip(6));check(await pending(),null,'No worn item + null cancels requested item');check(await current(),null);
 await reset();await racing();await db.query(equip(6,21));await db.query(equip(6,22));check((await pending()).equipment_item_id,id(22),'Latest request replaces prior reservation');await db.query(equip(7,21));check(await current(7),id(21),'Replaced reservation is released');await rejects(equip(8,22),/Stock insuffisant/);check(await current(8),null);
 await rejects(equip(8,20),/Stock insuffisant/);check(await current(),id(20),'Worn stock is not freed early');
 await reset();await racing();await save([[6,21],[7,22]]);check(await current(),id(20));check(await current(7),id(22),'Mixed batch updates idle riders');check((await pending()).equipment_item_id,id(21));
 await reset();await racing();await rejects(`select public.save_current_team_equipment_assignments('[{"riderId":"${id(6)}","slot":"frame","equipmentItemId":"${id(21)}"},{"riderId":"${id(7)}","slot":"frame","equipmentItemId":"${id(21)}"}]')`,/Stock insuffisant/);check(await pending(),null,'Invalid batch is atomic');check(await current(),id(20));
 await reset();await racing();await db.exec(`update race_registrations set team_season_id=null`);await db.query(equip(6,21));check((await pending()).blocking_race_edition_ids,[id(100)],'National selection with no club registration still blocks');
 await reset();await db.exec(`insert into official_stage_simulations values('${id(110)}','${id(100)}')`);await db.query(equip(6,21));check(await current(),id(20),'Already simulated future edition is protected');
 await reset();await db.exec(`update stages set departure_at=now()+interval '4 minutes' where id='${id(110)}'`);await db.query(equip(6,21));check(await current(),id(20),'H-5 freeze uses queue');
 await reset();await racing();await db.query(equip(6,21));await db.exec(`update rider_contracts set team_id='${id(99)}' where rider_id='${id(6)}'`);await settle();check(await pending(),null,'Transferred rider reservation is discarded');check(await current(),id(20),'No assignment changes across ownership boundary');
  await reset();await racing();await db.query(equip(6,21));await db.exec(`insert into race_editions values('${id(300)}','${id(4)}','in_progress');insert into race_registrations values('${id(301)}','${id(300)}','${id(5)}','accepted');insert into race_rosters values('${id(302)}','${id(301)}','${id(6)}','confirmed');update race_editions set status='completed' where id='${id(100)}'`);check(await current(),id(20),'A newly started event prevents a late promotion');
  check((await pending()).blocking_race_edition_ids.includes(id(300)),true,'The second event is retained for its terminal trigger');
  await db.exec(`update race_editions set status='completed' where id='${id(300)}'`);check(await current(),id(21),'The second completion applies the change before any maintenance call');
  check(await scalar('select public.settle_all_due_equipment_assignments()'),0,'Global worker is idempotent after terminal promotion');
  await reset();await racing();await db.query(`select public.save_current_team_equipment_assignments('[{"riderId":"${id(6)}","slot":"frame","equipmentItemId":"${id(21)}","blockingRaceEditionIds":[],"effectiveAt":"2000-01-01"}]')`);check(await current(),id(20),'Client cannot forge blocker metadata');
  await rejects(`select public.sell_current_team_equipment_batch('[{"equipmentItemId":"${id(20)}","quantity":1}]','${id(500)}')`,/figé/);check(await current(),id(20),'Resale cannot remove kit between tour stages');
  await reset();await racing();await db.query(equip(6,21));await db.exec(`
    create function private.fixture_equipment_failure() returns trigger language plpgsql as $$begin
      if current_setting('equipment_fixture.fail',true)='true' then raise exception 'isolated equipment promotion failure';end if;return new;end$$;
    create trigger fixture_equipment_failure before insert or update on rider_equipment_assignments for each row execute function private.fixture_equipment_failure();
    select set_config('equipment_fixture.fail','true',false);update race_editions set status='completed' where id='${id(100)}';
  `);check(await scalar(`select status from race_editions where id='${id(100)}'`),'completed','Equipment failure cannot roll back homologation');check(await current(),id(20));check((await pending()).equipment_item_id,id(21),'Failed promotion retains reservation atomically');await db.exec(`select set_config('equipment_fixture.fail','false',false)`);await db.query('select public.settle_all_due_equipment_assignments()');check(await current(),id(21),'Existing global maintenance retries failed promotion');
 await reset();await racing();await db.query(equip(6,23));await db.query(equip(7,23));check(await current(7),id(23),'Virtual partner core is unlimited');check((await pending()).equipment_item_id,id(23));
  await reset();await racing();await db.query(equip(6,25));await settle();check((await pending()).equipment_item_id,id(25),'Valid reputation extra remains reserved');await db.exec(`update race_editions set status='completed'`);check(await current(),id(25),'Reputation extra promotes after event');
  await reset();await racing();await db.query(equip(6,25));await db.exec(`update equipment_partner_contracts set status='completed'`);await settle();check(await pending(),null,'Expired partner request releases reservation');check(await current(),id(20));
 await reset();await db.exec("select set_config('equipment_fixture.wheels','true',false)");await db.query(equip(6,24,'rear_wheel'));check(await current(6,'rear_wheel'),id(24),'Mechanic wheel compatibility survives');await db.exec("select set_config('equipment_fixture.wheels','false',false)");await rejects(equip(7,24,'rear_wheel'),/emplacement|référence/);
 await reset();await db.exec(`select set_config('equipment_fixture.user','${id(999)}',false)`);await rejects(equip(6,21),/Aucune équipe/);
 await db.exec(`select set_config('equipment_fixture.user','',false)`);await rejects(equip(6,21),/Authentification/);
 check(await rows('select * from race_stage_equipment_assignments'),preparation,'Race preparation rows are untouched');
 check(await scalar(`select proacl::text from pg_proc where oid='public.save_current_team_equipment_assignments(jsonb)'::regprocedure`),acl,'Existing public RPC grants are preserved');
 check(await scalar(`select has_function_privilege('authenticated','private.get_rider_equipment_change_blockers(uuid,uuid,timestamptz)','execute')`),false,'Helper stays private');
 console.log(`PASS ${checks} isolated SQL assertions: actual live definitions, CRLF migration, whole-tour deferral, terminal trigger, stock, ownership, nullable removal, mixed batches and immutable preparations.`);
}catch(error){console.error(error.message);if(error.where)console.error(error.where);process.exitCode=1;}finally{await db.close();}
