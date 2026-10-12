import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(pathToFileURL(process.env.GALA_EQUIPMENT_SQL_TEST_MODULE).href);
const db = new PGlite();
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
function extract(path, name) {
  const source = readFileSync(path,'utf8');
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('$$;',start)+3);
}
try {
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select '${id(1)}'::uuid $$;
    create table sporting_directors(id uuid,auth_user_id uuid,status text);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table seasons(id uuid,status text,game_year integer);
    create table team_seasons(id uuid,team_id uuid,season_id uuid);
    create table race_editions(id uuid,season_id uuid,status text);
    create table stages(id uuid,race_edition_id uuid,status text,departure_at timestamptz,stage_number integer);
    create table race_registrations(id uuid,race_edition_id uuid,team_season_id uuid,status text);
    create table race_rosters(id uuid,race_registration_id uuid,rider_id uuid,status text);
    create table stage_rider_unavailabilities(race_edition_id uuid,rider_id uuid);
    create table equipment_catalog_items(id uuid,name text,status text,slot_type text,acquisition_channel text,supplier_key text,effect_payload jsonb);
    create table team_equipment_inventory(team_season_id uuid,equipment_item_id uuid,quantity integer);
    create table rider_equipment_assignments(rider_id uuid,slot_type text,equipment_item_id uuid);
    create table rider_equipment_pending_assignments(team_season_id uuid,equipment_item_id uuid);
    create table rider_contracts(rider_id uuid,team_id uuid,status text);
    create table equipment_partner_contracts(id uuid,team_id uuid,supplier_key text,status text,start_season_id uuid,end_season_id uuid);
    create table equipment_partner_products(supplier_key text,equipment_item_id uuid,offer_type text);
    create table equipment_partner_offers(contract_id uuid,equipment_item_id uuid,status text);
    create table equipment_partner_item_effects(contract_id uuid,equipment_item_id uuid,effect_payload jsonb);
    create table race_stage_equipment_assignments(id uuid default gen_random_uuid(),team_season_id uuid,race_edition_id uuid,stage_id uuid,rider_id uuid,slot_type text,equipment_item_id uuid);
    create function is_race_registration_preparable(uuid) returns boolean language sql as $$ select status='accepted' from race_registrations where id=$1 $$;
    create function equipment_slots_are_compatible(uuid,text,text) returns boolean language sql as $$ select $2=$3 $$;
    insert into sporting_directors values('${id(1)}','${id(1)}','active');
    insert into team_manager_assignments values('${id(1)}','${id(2)}','general_manager','active');
    insert into seasons values('${id(3)}','active',4),('${id(4)}','planned',5);
    insert into team_seasons values('${id(5)}','${id(2)}','${id(3)}');
    insert into race_editions values('${id(6)}','${id(3)}','planned');
    insert into stages values('${id(7)}','${id(6)}','planned',now()+interval '1 day',1),('${id(8)}','${id(6)}','planned',now()+interval '2 days',2);
    insert into race_registrations values('${id(9)}','${id(6)}','${id(5)}','accepted');
    insert into race_rosters values('${id(10)}','${id(9)}','${id(11)}','confirmed'),('${id(12)}','${id(9)}','${id(13)}','confirmed');
    insert into equipment_catalog_items values
      ('${id(20)}','Gala shoes','active','shoes','event_reward',null,'{"ratingBonuses":{"acceleration":2,"sprint":1}}'),
      ('${id(21)}','Unowned gala helmet','active','helmet','event_reward',null,'{}'),
      ('${id(22)}','Commercial helmet','active','helmet','commercial',null,'{"ratingBonuses":{"flat":1}}'),
      ('${id(23)}','Partner frame','active','frame','equipment_partner','brand-a','{}');
    insert into team_equipment_inventory values('${id(5)}','${id(20)}',1),('${id(5)}','${id(22)}',1),('${id(99)}','${id(21)}',1);
    insert into equipment_partner_contracts values('${id(24)}','${id(2)}','brand-a','active','${id(3)}','${id(4)}');
    insert into equipment_partner_products values('brand-a','${id(23)}','core');
    insert into equipment_partner_item_effects values('${id(24)}','${id(23)}','{"ratingBonuses":{"flat":2}}');
  `);
  const base = 'supabase/migrations/20260809101000_plan_race_stage_equipment.sql';
  const names = ['save_current_team_race_equipment_plan','prevent_reserved_race_equipment_inventory_reduction'];
  // Optionally test the exact read-only production snapshot in an isolated database.
  const snapshot = process.env.GALA_EQUIPMENT_FUNCTION_SNAPSHOT
    ? JSON.parse(readFileSync(process.env.GALA_EQUIPMENT_FUNCTION_SNAPSHOT,'utf8').replace(/^\uFEFF/,'')) : null;
  for (const name of [...names,'get_active_calendar_stage_equipment_effects','validate_race_stage_equipment_available_stock']) {
    const live = snapshot?.rows.find(row => row.proname === name)?.definition;
    await db.exec(live ?? extract(name === 'get_active_calendar_stage_equipment_effects'
      ? 'supabase/migrations/20261009120000_snapshot_stage_equipment_changes.sql'
      : name === 'validate_race_stage_equipment_available_stock'
        ? 'supabase/migrations/20260816130000_enforce_race_equipment_available_stock.sql' : base, name));
  }
  await db.exec(`
    create constraint trigger stock after insert or update or delete on race_stage_equipment_assignments
      deferrable initially deferred for each row execute function validate_race_stage_equipment_available_stock();
    create trigger reserved_stock before update or delete on team_equipment_inventory
      for each row execute function prevent_reserved_race_equipment_inventory_reduction();
  `);
  const slots = ['helmet','gloves','bib_shorts','glasses','shoes','front_wheel','rear_wheel','frame'];
  const loadouts = changes => [11,13].flatMap(rider => slots.map(slot => ({
    riderId:id(rider),slot,mode:changes[`${rider}:${slot}`] ? 'item' : 'inherit',
    equipmentItemId:changes[`${rider}:${slot}`] ?? null,
  })));
  const save = (changes,tour=false) => db.query('select save_current_team_race_equipment_plan($1,$2,$3,$4) as stages',[id(6),id(7),JSON.stringify(loadouts(changes)),tour]);
  await assert.rejects(save({'11:shoes':id(20)}),/référence choisie/);
  const migration = readFileSync('supabase/migrations/20261012090000_allow_gala_rewards_in_race_equipment_plans.sql','utf8');
  await db.exec(migration);
  assert.equal((await save({'11:shoes':id(20)},true)).rows[0].stages,2);
  const effects = (await db.query('select * from get_active_calendar_stage_equipment_effects($1)',[[id(6)]])).rows;
  for(const stage of [id(7),id(8)]) {
    const shoe = effects.find(row => row.stage_id===stage && row.rider_id===id(11)).equipment_effects.find(item => item._slotType==='shoes');
    assert.equal(shoe.ratingBonuses.acceleration,2);
    assert.equal(shoe._equipmentItemId,id(20));
  }
  await assert.rejects(save({'11:helmet':id(21)}),/référence choisie/);
  await assert.rejects(save({'11:helmet':id(20)}),/référence choisie/);
  await assert.rejects(save({'11:shoes':id(20),'13:shoes':id(20)}),/Stock insuffisant/);
  await assert.rejects(db.exec(`update team_equipment_inventory set quantity=0 where equipment_item_id='${id(20)}'`),/Impossible de réduire le stock/);
  await db.exec(`insert into rider_equipment_pending_assignments values('${id(5)}','${id(20)}')`);
  await assert.rejects(save({'11:shoes':id(20)}),/Stock insuffisant/);
  await db.exec('delete from rider_equipment_pending_assignments');
  await save({'11:shoes':id(20),'11:helmet':id(22),'11:frame':id(23),'13:frame':id(23)});
  await db.exec(migration);
  // Permanent inheritance continues to use the same prize bonus, without a stage override.
  await db.exec(`insert into rider_equipment_assignments values('${id(11)}','shoes','${id(20)}')`);
  await save({});
  const inherited = (await db.query('select equipment_effects from get_active_calendar_stage_equipment_effects($1) where stage_id=$2 and rider_id=$3',[[id(6)],id(7),id(11)])).rows[0].equipment_effects;
  assert.equal(inherited.find(item => item._slotType==='shoes').ratingBonuses.acceleration,2);
  console.log('PASS: reproduces gala rejection; owned prizes save for stage/tour and reach simulation; ownership, slot, finite stock, pending reservations, commercial/partner items and inheritance preserved.');
} finally {
  await db.close();
}
