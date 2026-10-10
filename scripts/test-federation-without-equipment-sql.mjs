import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(pathToFileURL(process.env.FEDERATION_EQUIPMENT_SQL_TEST_MODULE).href);
const db = new PGlite();
const source = readFileSync('supabase/migrations/20260920170000_create_federation_equipment_and_race_preparation.sql','utf8');
function originalFunction(name) {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('$$;', start) + 3);
}
try {
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
    create table sporting_directors(id uuid primary key, auth_user_id uuid, status text);
    create table countries(id uuid primary key, iso_alpha2 text);
    create table seasons(id uuid primary key, status text, game_year integer, current_day_number integer);
    create table team_manager_assignments(sporting_director_id uuid, team_id uuid, role text, status text);
    create table team_seasons(team_id uuid,season_id uuid,registration_country_id uuid);
    create table national_federation_terms(country_id uuid,start_game_year integer,end_game_year integer,president_director_id uuid);
    create table equipment_suppliers(supplier_key text primary key);
    create table national_federation_equipment_offers(offer_key text primary key,supplier_key text,name text,season_price numeric,status text);
    create table national_federation_equipment_offer_items(id uuid,offer_key text,slot_type text,equipment_name text,effect_summary text,effect_payload jsonb,display_order integer);
    create table national_federation_equipment_contract_items(contract_id uuid,slot_type text,equipment_name text,effect_summary text,effect_payload jsonb,display_order integer);
    create table national_federation_accounts(id uuid,country_id uuid,season_id uuid,balance numeric,updated_at timestamptz);
    create table national_federation_transactions(account_id uuid,day_number integer,amount numeric,category text,description text,source_reference text,metadata jsonb);
    create table national_federation_journal_entries(country_id uuid,season_id uuid,day_number integer,category text,title text,detail text,source_reference text,metadata jsonb);
  `);
  const start = source.indexOf('create table public.national_federation_equipment_contracts (');
  await db.exec(source.slice(start, source.indexOf('\n);', start) + 3));
  await db.exec(`
    insert into sporting_directors values(auth.uid(),auth.uid(),'active');
    insert into countries values(auth.uid(),'FR');
    insert into seasons values(auth.uid(),'active',4,2);
    insert into team_manager_assignments values(auth.uid(),auth.uid(),'general_manager','active');
    insert into team_seasons values(auth.uid(),auth.uid(),auth.uid());
    insert into national_federation_terms values(auth.uid(),3,6,auth.uid());
    insert into equipment_suppliers values('brand-a');
    insert into national_federation_equipment_offers values('paid-offer','brand-a','Paid offer',500000,'active');
    insert into national_federation_equipment_offer_items values(auth.uid(),'paid-offer','frame','Frame','+1', '{"ratingBonuses":{"flat":1}}',1);
    insert into national_federation_accounts values(auth.uid(),auth.uid(),auth.uid(),0,now());
  `);
  const migration = readFileSync('supabase/migrations/20261010093000_allow_federation_without_equipment.sql','utf8');
  await db.exec(migration);
  await db.exec(originalFunction('get_current_federation_equipment_alert'));
  const alert = async () => (await db.query('select selection_required from get_current_federation_equipment_alert()')).rows[0].selection_required;
  const choose = key => db.query("select choose_national_federation_equipment_offer('FR',$1)",[key]);
  assert.equal(await alert(),true);
  await assert.rejects(choose('paid-offer'), /trésorerie fédérale ne permet/);
  await assert.rejects(db.query("select choose_national_federation_equipment_offer('DE','sans-equipement')"),/ne correspond pas/);
  await db.exec('update national_federation_terms set president_director_id=null');
  await assert.rejects(choose('sans-equipement'),/Seul le président/);
  await db.exec('update national_federation_terms set president_director_id=auth.uid()');
  await choose('sans-equipement');
  assert.equal(await alert(),false);
  const decision = (await db.query('select offer_key,supplier_key,offer_name,price_paid from national_federation_equipment_contracts')).rows[0];
  assert.deepEqual(decision,{offer_key:null,supplier_key:null,offer_name:'Sans équipement',price_paid:'0.00'});
  assert.equal((await db.query('select balance from national_federation_accounts')).rows[0].balance,'0');
  assert.equal((await db.query('select count(*)::int as n from national_federation_equipment_contract_items')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int as n from national_federation_transactions')).rows[0].n,0);
  await assert.rejects(choose('paid-offer'),/déjà été choisi/);
  await assert.rejects(choose('sans-equipement'),/déjà été choisi/);
  await db.exec(migration);
  await db.exec(`
    update seasons set status='completed';
    insert into seasons values('00000000-0000-0000-0000-000000000002','active',5,1);
    insert into team_seasons values(auth.uid(),'00000000-0000-0000-0000-000000000002',auth.uid());
    insert into national_federation_accounts values('00000000-0000-0000-0000-000000000002',auth.uid(),'00000000-0000-0000-0000-000000000002',600000,now());
  `);
  assert.equal(await alert(),true);
  await choose('paid-offer');
  assert.equal(await alert(),false);
  assert.equal((await db.query("select balance from national_federation_accounts where id <> auth.uid()")).rows[0].balance,'100000');
  assert.equal((await db.query('select count(*)::int as n from national_federation_equipment_contract_items')).rows[0].n,1);
  await assert.rejects(choose('sans-equipement'),/déjà été choisi/);
  console.log('PASS: free choice clears alert, adds no equipment or charge, requires president, locks season, and resets next season; paid offers preserved.');
} finally {
  await db.close();
}
