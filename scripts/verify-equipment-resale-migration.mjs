// Real PL/pgSQL and stock constraint, exercised only in isolated in-memory PostgreSQL.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : "@electric-sql/pglite");
const db = new PGlite();
const read = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8").replaceAll("\r", "");
const definition = (source, name) => {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert(start >= 0, `Missing ${name}`);
  const end = source.indexOf("\n$$;", start);
  assert(end >= start); return source.slice(start, end + 4);
};
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const scalar = async (sql, params = []) => (await db.query(sql, params)).rows[0].value;
let checks = 0, request = 1000;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const sale = (lines, saleId = uuid(request++)) => scalar("select sell_current_team_equipment_batch($1::jsonb,$2::uuid) as value", [JSON.stringify(lines), saleId]);
const line = (quantity, item = 80, extra = {}) => ({ equipmentItemId: uuid(item), quantity, ...extra });
const unit = (rider, slot = "front_wheel") => ({ riderId: uuid(rider), slot });
const stock = () => scalar(`select coalesce((select quantity from team_equipment_inventory where team_season_id='${uuid(40)}' and equipment_item_id='${uuid(80)}'),0) as value`);
const money = () => scalar(`select cash_balance::integer as value from team_seasons where id='${uuid(40)}'`);
const count = table => scalar(`select count(*)::integer as value from ${table}`);
const reject = async (lines, pattern) => { await assert.rejects(sale(lines), pattern); checks++; };
async function reset(quantity = 6) {
  await db.exec(`
    truncate race_stage_equipment_assignments,race_rosters,race_registrations,stages,race_editions,
      rider_equipment_pending_assignments,rider_equipment_assignments,team_equipment_inventory,team_finance_transactions;
    update team_seasons set cash_balance=10000;
    set request.jwt.claim.sub='${uuid(1)}';
    insert into team_equipment_inventory(team_season_id,equipment_item_id,quantity) values
      ('${uuid(40)}','${uuid(80)}',${quantity}),('${uuid(40)}','${uuid(81)}',3),('${uuid(50)}','${uuid(80)}',9);
  `);
}
async function assign(rider, slot = "front_wheel", item = 80) {
  await db.query("insert into rider_equipment_assignments(rider_id,slot_type,equipment_item_id) values($1,$2,$3)", [uuid(rider),slot,uuid(item)]);
}
async function pending(rider = 92, due = false) {
  await db.query(`insert into rider_equipment_pending_assignments(team_season_id,rider_id,slot_type,equipment_item_id,effective_at)
    values($1,$2,'front_wheel',$3,now()+$4::interval)`, [uuid(40),uuid(rider),uuid(80),due ? "-1 minute" : "1 day"]);
}
async function race(frozen = false, completed = false) {
  await db.exec(`
    insert into race_editions values ('${uuid(200)}','scheduled');
    insert into stages values ('${uuid(201)}','${uuid(200)}','${completed ? "completed" : "scheduled"}',now()+interval '${frozen ? "1 minute" : "1 day"}',120,1);
    insert into race_registrations values ('${uuid(202)}','${uuid(200)}','${uuid(40)}','accepted');
    insert into race_rosters(race_registration_id,rider_id,status) values
      ('${uuid(202)}','${uuid(90)}','selected'),('${uuid(202)}','${uuid(91)}','confirmed');
  `);
}
async function plan(rider, slot = "front_wheel") {
  await db.query(`insert into race_stage_equipment_assignments(team_season_id,race_edition_id,stage_id,rider_id,slot_type,equipment_item_id)
    values($1,$2,$3,$4,$5,$6)`, [uuid(40),uuid(200),uuid(201),uuid(rider),slot,uuid(80)]);
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table seasons(id uuid primary key,game_year integer,current_day_number integer,status text);
    create table season_days(id uuid primary key,season_id uuid,day_number integer);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,status text,currency text,cash_balance numeric);
    create table equipment_catalog_items(id uuid primary key,name text,status text,acquisition_channel text,owner_team_id uuid,resale_price bigint,effect_payload jsonb,slot_type text,supplier_key text);
    create table team_equipment_inventory(id uuid primary key default gen_random_uuid(),team_season_id uuid,equipment_item_id uuid references equipment_catalog_items,quantity integer check(quantity>0),updated_at timestamptz default now(),unique(team_season_id,equipment_item_id));
    create table rider_contracts(rider_id uuid,team_id uuid,status text);
    create table rider_equipment_assignments(id uuid primary key default gen_random_uuid(),rider_id uuid,slot_type text,equipment_item_id uuid references equipment_catalog_items,equipped_at timestamptz default now(),unique(rider_id,slot_type));
    create table rider_equipment_pending_assignments(id uuid primary key default gen_random_uuid(),team_season_id uuid,rider_id uuid,slot_type text,equipment_item_id uuid references equipment_catalog_items,requested_at timestamptz default now(),effective_at timestamptz,unique(rider_id,slot_type));
    create table race_editions(id uuid primary key,status text);
    create table stages(id uuid primary key,race_edition_id uuid,status text,departure_at timestamptz,distance_km numeric,stage_number integer);
    create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid,status text);
    create table race_rosters(id uuid primary key default gen_random_uuid(),race_registration_id uuid,rider_id uuid,status text);
    create table race_stage_equipment_assignments(id uuid primary key default gen_random_uuid(),team_season_id uuid,race_edition_id uuid,stage_id uuid,rider_id uuid,slot_type text,equipment_item_id uuid references equipment_catalog_items,updated_at timestamptz default now(),unique(stage_id,team_season_id,rider_id,slot_type));
    create table team_finance_transactions(id uuid primary key default gen_random_uuid(),team_season_id uuid,season_day_id uuid,day_number integer,amount numeric,category text,status text,description text,source_reference text,posted_at timestamptz,unique(team_season_id,source_reference));
    create function settle_current_team_finances() returns void language sql as $$ select $$;
  `);
  for (const [file, name] of [
    ["20260812160000_rework_equipment_partner_system.sql", "equip_current_team_rider"],
    ["20260726100000_add_unequip_current_team_rider.sql", "unequip_current_team_rider"],
    ["20260809101000_plan_race_stage_equipment.sql", "save_current_team_race_equipment_plan"],
    ["20260827120000_fix_interactive_jobs_reliability.sql", "settle_due_equipment_assignments"],
    ["20260830170000_repeat_name_and_resell_rnd_prototypes.sql", "calculate_research_prototype_resale_price"],
  ]) await db.exec(definition(read(file), name));
  await db.exec(read("20260816130000_enforce_race_equipment_available_stock.sql"));
  const migration = read("20261008120000_bulk_resell_and_unequip_owned_equipment.sql");
  await db.exec(migration);
  await db.exec(migration); // Reapplying does not duplicate a lock or replace subsequent logic.
  for (const signature of ["equip_current_team_rider(uuid,text,uuid)","unequip_current_team_rider(uuid,text)","save_current_team_race_equipment_plan(uuid,uuid,jsonb,boolean)"]) {
    const sql = await scalar("select pg_get_functiondef($1::regprocedure) as value", [signature]);
    check((sql.match(/for update of team_season/g) ?? []).length, 1);
  }
  await db.exec(`
    insert into sporting_directors values ('${uuid(1)}','${uuid(1)}','active'),('${uuid(2)}','${uuid(2)}','active');
    insert into team_manager_assignments values ('${uuid(1)}','${uuid(10)}','general_manager','active'),('${uuid(2)}','${uuid(20)}','general_manager','active');
    insert into seasons values ('${uuid(30)}',2026,1,'active');
    insert into season_days values ('${uuid(31)}','${uuid(30)}',1);
    insert into team_seasons values ('${uuid(40)}','${uuid(10)}','${uuid(30)}','active','EUR',10000),('${uuid(50)}','${uuid(20)}','${uuid(30)}','active','EUR',10000);
    insert into equipment_catalog_items values
      ('${uuid(80)}','Aero','active','commercial',null,500,'{}','front_wheel','aero'),
      ('${uuid(81)}','Prototype','active','research_prototype','${uuid(10)}',999,'{"ratingBonuses":{"mountain":2}}','frame','lab'),
      ('${uuid(82)}','Other prototype','active','research_prototype','${uuid(20)}',999,'{}','frame','lab'),
      ('${uuid(83)}','Partner','active','equipment_partner',null,500,'{}','frame','partner'),
      ('${uuid(84)}','No price','active','commercial',null,0,'{}','frame','none');
    insert into rider_contracts values ('${uuid(90)}','${uuid(10)}','active'),('${uuid(91)}','${uuid(10)}','active'),('${uuid(92)}','${uuid(10)}','active'),('${uuid(93)}','${uuid(10)}','active'),('${uuid(95)}','${uuid(20)}','active');
  `);
  await reset(); await assign(90); await assign(91); await pending(); await assign(95);
  let result = await sale([line(3,80,{unequip:[],cancelPending:[]}), line(2,81,{unequip:[],cancelPending:[]})],uuid(999));
  check(result.resalePrice,15500); check(result.quantitySold,5); check(result.unequippedCount,0);
  check(await stock(),3); check(await money(),25500); check(await count("team_finance_transactions"),1);
  check(await scalar(`select quantity as value from team_equipment_inventory where team_season_id='${uuid(50)}' and equipment_item_id='${uuid(80)}'`),9);
  result = await sale([line(3),line(2,81)],uuid(999)); check(result.alreadySold,true); check(await stock(),3); check(await money(),25500);

  await reset(); await assign(90); await assign(91); await pending();
  result=await sale([line(5,80,{cancelPending:[unit(92)],unequip:[unit(90)]})]);
  check(result.unequippedCount,1); check(result.pendingCancelledCount,1); check(await stock(),1);
  check(await count("rider_equipment_assignments"),1); check(await count("rider_equipment_pending_assignments"),0);
  check(await scalar("select rider_id as value from rider_equipment_assignments"),uuid(91));

  await reset(2); await assign(90); await assign(90,"rear_wheel");
  result=await sale([line(1,80,{cancelPending:[],unequip:[unit(90)]})]);
  check(result.unequippedCount,1); check(await scalar("select slot_type as value from rider_equipment_assignments"),"rear_wheel");
  result=await scalar("select sell_current_team_equipment($1) as value",[uuid(80)]);
  check(result.unequippedCount,1); check(result.itemName,"Aero"); check(await stock(),0); check(await count("rider_equipment_assignments"),0);

  await reset(1); await pending(90,true);
  result=await sale([line(1)]); check(result.unequippedCount,1); check(await count("rider_equipment_pending_assignments"),0);
  check(await scalar("select settle_due_equipment_assignments($1) as value",[uuid(40)]),0); check(await count("rider_equipment_assignments"),0);

  await reset(); await assign(90);
  await reject([line(6,80,{unequip:[],cancelPending:[]})],/affectations ont changé/);
  check(await stock(),6); check(await money(),10000); check(await count("rider_equipment_assignments"),1);
  await reject([line(1),line(4,81)],/Stock insuffisant/); check(await stock(),6); check(await count("team_finance_transactions"),0);
  for (const bad of [[line(7)],[line(0)],[line(-1)],[line(1.5)],[line(1),line(1)],[line(1,82)],[line(1,83)],[line(1,84)],[line(501)],null,[]])
    await reject(bad,/Stock insuffisant|invalide|Seul le matériel|valeur de reprise|qu’une fois|Sélectionnez/);
  await db.exec("set request.jwt.claim.sub=''"); await reject([line(1)],/Authentification requise/);
  await db.exec(`set request.jwt.claim.sub='${uuid(2)}'`); await reject([line(1,81)],/réellement possédé/);
  check(await money(),10000);

  await reset(2); await assign(90); await race(true);
  result=await sale([line(1)]); check(result.unequippedCount,0); check(await stock(),1);
  await reject([line(1)],/figé/); check(await stock(),1); check(await count("rider_equipment_assignments"),1);

  await reset(3); await assign(93); await race(); await plan(90); await plan(91);
  result=await sale([line(1)]); check(result.racePlansUpdated,1); check(await stock(),2);
  check(await scalar("select count(*)::integer as value from race_stage_equipment_assignments where equipment_item_id is null"),1);
  check(await scalar("select count(*)::integer as value from race_stage_equipment_assignments where equipment_item_id is not null"),1);
  result=await sale([line(1)]); check(result.racePlansUpdated,1); check(await count("rider_equipment_assignments"),1);

  await reset(4); await race(); await plan(90); await plan(91);
  result=await sale([line(1)]); check(result.racePlansUpdated,0); check(await count("race_stage_equipment_assignments"),2);
  await reset(2); await race(true); await plan(90); await plan(91);
  await reject([line(1)],/montage de course figé/); check(await stock(),2); check(await money(),10000);
  check(await scalar("select count(*)::integer as value from race_stage_equipment_assignments where equipment_item_id is not null"),2);
  await reset(2); await race(false,true); await plan(90); await plan(91);
  result=await sale([line(2)]); check(result.racePlansUpdated,0);
  check(await scalar("select count(*)::integer as value from race_stage_equipment_assignments where equipment_item_id is not null"),2);

  await reset(1); await assign(90); await assign(91);
  await reject([line(1)],/stock affecté/); check(await stock(),1); check(await money(),10000);
  check(await scalar("select has_function_privilege('anon','sell_current_team_equipment_batch(jsonb,uuid)','EXECUTE') as value"),false);
  check(await scalar("select has_function_privilege('authenticated','sell_current_team_equipment_batch(jsonb,uuid)','EXECUTE') as value"),true);
  console.log(`${checks} PostgreSQL equipment-resale checks passed (isolated memory database).`);
} catch(error) {
  console.error(`Equipment-resale check failed: ${error.message}`);
  if(error.where) console.error(error.where);
  process.exitCode=1;
} finally { await db.close(); }
