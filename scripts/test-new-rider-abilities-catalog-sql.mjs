// Prospective ability-catalogue migration in isolated PostgreSQL.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

if (!process.argv[2]?.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js")) {
  throw new Error("Pass the absolute path to the local PGlite module.");
}
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const read = async (file) => (await readFile(new URL("../supabase/migrations/" + file, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
let assertions = 0;
const check = (actual, expected, description) => {
  assert.deepEqual(actual, expected, description);
  assertions += 1;
};
const oldCodes = [
  "flahute", "panache", "bottle_carrier", "locomotive", "giclette", "chase_potato",
  "sandwich_man", "iron_health", "first_in_class", "homegrown", "pistard", "three_lungs",
  "cyclocrossman", "metronome", "etapovore", "locker_room_favorite",
];
try {
  const base = await read("20260721020000_create_special_abilities_and_attacks.sql");
  const inventory = await read("20260721200000_create_team_item_inventory.sql");
  await db.exec("create role anon; create role authenticated; create role service_role;");
  await db.exec(base.match(/create table public\.special_ability_catalog \([\s\S]*?\n\);/)[0]);
  await db.exec(inventory.match(/create table public\.inventory_catalog_items \([\s\S]*?\n\);/)[0]);
  await db.exec(`
    alter table public.special_ability_catalog drop constraint special_ability_catalog_code_allowed;
    alter table public.special_ability_catalog add constraint special_ability_catalog_code_allowed
      check (code in (${oldCodes.map(code => "'" + code + "'").join(",")}));
    insert into public.special_ability_catalog(code,name,effect_description,icon_key,medallion_tone)
      select code,code,'Historical effect','historical','silver'
      from unnest(array[${oldCodes.map(code => "'" + code + "'").join(",")}]) as codes(code);
    grant select on public.special_ability_catalog, public.inventory_catalog_items to authenticated;
    create table public.rider_special_abilities(rider_id uuid,ability_code text references public.special_ability_catalog(code));
    insert into public.rider_special_abilities values('00000000-0000-4000-8000-000000000001','panache');
    insert into public.inventory_catalog_items(item_key,name,category,rarity,effect_payload)
      values('historical-medallion','Historical medal','special_ability','rare','{"abilityCode":"panache"}'::jsonb);
  `);
  const snapshot = async () => scalar(`select jsonb_build_object(
    'abilities',(select jsonb_agg(to_jsonb(t) order by code) from public.special_ability_catalog t where code not in ('nail_layer','crowd_surge')),
    'inventory',(select jsonb_agg(to_jsonb(t) order by item_key) from public.inventory_catalog_items t where item_key='historical-medallion'),
    'riders',(select jsonb_agg(to_jsonb(t)) from public.rider_special_abilities t)
  )`);
  const before = await snapshot();
  const beforeGrants = (await db.query("select relname,relacl::text from pg_class where oid in ('public.special_ability_catalog'::regclass,'public.inventory_catalog_items'::regclass) order by relname")).rows;
  await db.exec(await read("20261120150000_add_nail_layer_and_crowd_surge.sql"));
  check(await snapshot(), before, "existing riders, catalogue and inventory remain intact");
  check((await db.query("select relname,relacl::text from pg_class where oid in ('public.special_ability_catalog'::regclass,'public.inventory_catalog_items'::regclass) order by relname")).rows, beforeGrants, "catalogue access grants are preserved");
  check(await scalar("select count(*)::int from public.special_ability_catalog"), 18, "both abilities are added");
  check((await db.query("select code,name,icon_key,medallion_tone,is_active from public.special_ability_catalog where code in ('nail_layer','crowd_surge') order by code")).rows, [
    { code: "crowd_surge", name: "Coup de pression", icon_key: "beer_mug", medallion_tone: "amber", is_active: true },
    { code: "nail_layer", name: "Poseur de clous", icon_key: "nails", medallion_tone: "anthracite", is_active: true },
  ], "new catalogue definitions are active");
  const medallions = (await db.query(`select item_key,name,category,rarity,effect_payload,icon_key,is_consumable,status
    from public.inventory_catalog_items where item_key in ('medallion-nail-layer','medallion-crowd-surge') order by item_key`)).rows;
  check(medallions, [
    { item_key: "medallion-crowd-surge", name: "Médaillon Coup de pression", category: "special_ability", rarity: "epic", effect_payload: { abilityCode: "crowd_surge" }, icon_key: "medallion", is_consumable: true, status: "active" },
    { item_key: "medallion-nail-layer", name: "Médaillon Poseur de clous", category: "special_ability", rarity: "epic", effect_payload: { abilityCode: "nail_layer" }, icon_key: "medallion", is_consumable: true, status: "active" },
  ], "medallions use the existing generic consumable contract");
  for (const code of ["nail_layer", "crowd_surge"]) {
    check(await scalar(`select effect_description=(select effect_summary from public.inventory_catalog_items where effect_payload->>'abilityCode'='${code}')
      from public.special_ability_catalog where code='${code}'`), true, "medallion and ability descriptions agree");
  }
  await db.exec("set role authenticated");
  check(await scalar("select count(*)::int from public.special_ability_catalog where is_active and code in ('nail_layer','crowd_surge')"), 2, "the generic active-ability reward selection sees the additions");
  await db.exec("reset role");
  await assert.rejects(db.query("insert into public.special_ability_catalog(code,name,effect_description,icon_key,medallion_tone) values ('unknown','Unknown','Invalid','object','silver')"), /special_ability_catalog_code_allowed/);
  assertions += 1;
  check(await scalar("select count(*)::int from public.rider_special_abilities"), 1, "migration grants no unrequested player ability");
  console.log(JSON.stringify({ isolated: true, productionActions: false, assertions, existingCataloguePreserved: true, genericMedallionsSupported: true }));
} finally {
  await db.close();
}

