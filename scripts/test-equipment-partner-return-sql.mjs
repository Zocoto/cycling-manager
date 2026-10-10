import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(pathToFileURL(process.env.EQUIPMENT_PARTNER_SQL_TEST_MODULE).href);
const db = new PGlite();
try {
  // Isolated database: exercise the actual signing function, never production fixtures.
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
    create table sporting_directors(id uuid, auth_user_id uuid, status text, reputation_points integer);
    create table team_manager_assignments(sporting_director_id uuid, team_id uuid, role text, status text);
    create table seasons(id uuid, status text);
    create table team_seasons(team_id uuid, season_id uuid);
    create table equipment_suppliers(supplier_key text, status text, supports_team_contract boolean);
    create table equipment_partner_contracts(
      id uuid primary key default gen_random_uuid(), team_id uuid, supplier_key text,
      start_season_id uuid, end_season_id uuid, status text default 'active',
      signed_at timestamptz default clock_timestamp(),
      constraint equipment_partner_contract_supplier_once unique(team_id,supplier_key)
    );
    create unique index equipment_partner_one_active_contract_per_team_idx
      on equipment_partner_contracts(team_id) where status='active';
    create table equipment_partner_products(supplier_key text, equipment_item_id uuid, offer_type text);
    create table equipment_catalog_items(id uuid, effect_payload jsonb);
    create table equipment_partner_item_effects(contract_id uuid, equipment_item_id uuid, effect_payload jsonb);
    create function ensure_transfer_next_season(uuid) returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000002'::uuid $$;
    insert into sporting_directors values(auth.uid(),auth.uid(),'active',200);
    insert into team_manager_assignments values(auth.uid(),auth.uid(),'general_manager','active');
    insert into seasons values(auth.uid(),'active');
    insert into team_seasons values(auth.uid(),auth.uid());
    insert into equipment_suppliers values('A','active',true),('B','active',true),('C','active',true);
  `);
  const migration = readFileSync('supabase/migrations/20261010090000_allow_equipment_partner_return.sql','utf8');
  await db.exec(migration);
  const sign = key => db.query('select public.sign_equipment_partner_contract($1)', [key]);
  const finish = () => db.exec("update equipment_partner_contracts set status='completed' where status='active'");
  await sign('A');
  await assert.rejects(sign('B'), /déjà en cours/);
  await finish();
  await assert.rejects(sign('A'), /changer d’équipementier/);
  await sign('B');
  await finish();
  await assert.rejects(sign('B'), /changer d’équipementier/);
  await sign('A');
  await finish();
  await assert.rejects(sign('A'), /changer d’équipementier/);
  await sign('B');
  const { rows } = await db.query('select supplier_key, start_season_id <> end_season_id as spans_two_seasons from equipment_partner_contracts order by signed_at,id');
  assert.deepEqual(rows.map(row => row.supplier_key), ['A','B','A','B']);
  assert.ok(rows.every(row => row.spans_two_seasons));
  await db.exec(migration);
  await assert.rejects(sign('C'), /déjà en cours/);
  console.log('PASS: A → B → A → B; consecutive renewal and active-contract replacement rejected; migration idempotent.');
} finally {
  await db.close();
}
