import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.env.EQUIPMENT_PARTNER_SQL_TEST_MODULE ?? "";
if (!isAbsolute(modulePath) || !modulePath.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js")) {
  throw new Error("Use an absolute path to an isolated local PGlite installation.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const migration = (name) => readFileSync(new URL("../supabase/migrations/" + name + ".sql", import.meta.url), "utf8");
const id = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const rows = async (sql, values = []) => (await db.query(sql, values)).rows;
const scalar = async (sql, values = []) => Object.values((await rows(sql, values))[0])[0];

async function buy(director, contract) {
  await scalar("select set_config('request.jwt.claim.sub', $1, false)", [director]);
  return scalar("select public.purchase_current_equipment_partner_reputation_extra($1)", [contract]);
}

const effect = (contract, item) => rows(
  "select effect_payload, revision from equipment_partner_item_effects where contract_id=$1 and equipment_item_id=$2",
  [contract, item],
);

try {
  await db.exec(`
    create schema auth;
    create schema private;
    create role anon;
    create role authenticated;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;
    create table sporting_directors(id uuid primary key, auth_user_id uuid, status text, reputation_points integer);
    create table team_manager_assignments(sporting_director_id uuid, team_id uuid, role text, status text);
    create table seasons(id uuid primary key, game_year integer, status text);
    create table equipment_catalog_items(id uuid primary key default gen_random_uuid(),
      catalog_key text unique, name text, slot_type text, status text, supplier_key text, supplier_name text,
      description text, price integer, rarity text, image_path text, effect_summary text, effect_payload jsonb,
      acquisition_channel text, updated_at timestamptz default now());
    create table equipment_partner_products(supplier_key text, equipment_item_id uuid, offer_type text,
      research_rating_key text, display_order integer, primary key(supplier_key,equipment_item_id));
    create table equipment_partner_contracts(id uuid primary key, team_id uuid, supplier_key text, status text);
    create table equipment_partner_item_effects(contract_id uuid, equipment_item_id uuid, effect_payload jsonb,
      revision integer default 0, updated_at timestamptz default now(), primary key(contract_id,equipment_item_id));
    create table spend_receipts(director_id uuid, amount integer, reference text primary key);
    create function private.spend_reputation(uuid,uuid,integer,text,text,jsonb) returns void
       language plpgsql as $$
    begin
      insert into spend_receipts values($1,$3,$4);
      update sporting_directors set reputation_points=reputation_points-$3 where id=$1;
    end $$;
  `);
  await db.exec(migration("20260927204000_add_s4_equipment_partner_reputation_extra"));
  for (const n of [1, 2, 3]) {
    await db.query("insert into sporting_directors values($1,$1,'active',1450)", [id(n)]);
    await db.query("insert into team_manager_assignments values($1,$2,'general_manager','active')", [id(n), id(10 + n)]);
    await db.query("insert into equipment_partner_contracts(id,team_id,supplier_key,status) values($1,$2,'sylva-dynamics','active')",
      [id(20 + n), id(10 + n)]);
  }
  await db.query("insert into seasons values($1,5,'active')", [id(40)]);
  const existing = id(21), archived = id(22), future = id(23);
  const glasses = await buy(id(1), existing);
  assert.equal(await buy(id(2), archived), glasses);
  await db.query("update equipment_partner_contracts set status='completed' where id=$1", [archived]);
  const before = await effect(existing, glasses);
  const contractBefore = (await rows("select * from equipment_partner_contracts where id=$1", [existing]))[0];
  assert.equal(before[0].effect_payload.ratingBonuses.hills, 3);

  // The same supplier's core equipment is unaffected.
  const core = id(45);
  await db.query("insert into equipment_catalog_items(id,catalog_key,slot_type,supplier_key,effect_payload,acquisition_channel) values($1,'sylva-test-frame','frame','sylva-dynamics',$2,'equipment_partner')",
    [core, before[0].effect_payload]);
  await db.query("insert into equipment_partner_item_effects(contract_id,equipment_item_id,effect_payload) values($1,$2,$3)",
    [existing, core, before[0].effect_payload]);

  const balance = migration("20261118235900_rebalance_equipment_partner_fourth_dotation");
  await db.exec(balance);
  await db.exec(balance); // Reapplying does not increment the active revision twice.

  const extras = await rows("select effect_payload from equipment_catalog_items where catalog_key <> 'sylva-test-frame'");
  const mainKeys = ["mountain", "hills", "flat", "timeTrial", "cobbles", "sprint"];
  assert.equal(extras.length, 7);
  for (const { effect_payload: { ratingBonuses } } of extras) {
    assert.equal(Object.values(ratingBonuses).reduce((total, bonus) => total + bonus, 0), 4);
    assert.ok(mainKeys.every((key) => (ratingBonuses[key] ?? 0) <= 1));
  }

  const newPayload = { ratingBonuses: { hills: 1, acceleration: 1, breakaway: 1, downhill: 1 } };
  assert.equal(await scalar("select effect_summary from equipment_catalog_items where id=$1", [glasses]), "+1 VAL, +1 ACC, +1 BAR et +1 DES.");
  assert.deepEqual(await effect(existing, glasses), [{ effect_payload: newPayload, revision: 1 }]);
  assert.deepEqual(await effect(archived, glasses), before);
  assert.deepEqual(await effect(existing, core), before);
  assert.deepEqual((await rows("select * from equipment_partner_contracts where id=$1", [existing]))[0], contractBefore);
  assert.equal(await scalar("select count(*)::int from spend_receipts"), 2);
  assert.equal(await buy(id(3), future), glasses);
  assert.deepEqual(await effect(future, glasses), [{ effect_payload: newPayload, revision: 0 }]);
  assert.equal(await scalar("select amount from spend_receipts where director_id=$1", [id(3)]), 200);
  await assert.rejects(buy(id(3), future), /déjà été obtenue/);
  console.log("PASS: seven balanced accessories, existing and future unlocks, archived effects, price, and idempotence.");
} finally {
  await db.close();
}
