import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ?? "C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js";
if (!isAbsolute(modulePath) || !modulePath.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js")) {
  throw new Error("An absolute local PGlite module is required; production database connections are unsupported.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const one = async (sql, args = []) => (await query(sql, args))[0];
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    grant usage on schema auth to authenticated;
    create table public.sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table public.team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table public.seasons(id uuid primary key,status text,game_year int);
    create table public.team_seasons(id uuid primary key,team_id uuid,season_id uuid,status text);
    create table public.riders(id uuid primary key,status text,personality_key text,potential_steps int,mountain int);
    create table public.rider_contracts(rider_id uuid,team_id uuid,status text,start_season_id uuid,end_season_id uuid);
    create table public.inventory_catalog_items(id uuid primary key default gen_random_uuid(),
      item_key text unique,name text,category text,rarity text,description text,effect_summary text,
      effect_payload jsonb,icon_key text,is_consumable boolean,status text,updated_at timestamptz);
    create table public.team_item_inventory(id uuid primary key,team_season_id uuid,
      inventory_item_id uuid,quantity int check(quantity>0),updated_at timestamptz);
    create function public.get_current_team_item_target_values() returns jsonb language sql as $$
      select coalesce(jsonb_agg(jsonb_build_object(
        'potentialSteps', rider.potential_steps,
        'id', rider.id
      )), '[]'::jsonb) from public.riders as rider;
    $$;
  `);
  const migration = readFileSync("supabase/migrations/20261121173021_add_personality_reroll_consumable.sql", "utf8");
  const definitions = readFileSync("lib/game/rider-personalities.ts", "utf8");
  const expected = [...definitions.matchAll(/^  ([a-z_]+): \{\s*label: "([^"]+)"/gm)].map(m => [m[1], m[2]]);
  const options = JSON.parse(migration.match(/v_personalities constant jsonb := '([\s\S]*?)'::jsonb/)[1]);
  assert.deepEqual(Object.entries(options), expected, "The roll must use the real character catalog and labels");
  await db.exec(migration);
  const item = await one("select * from inventory_catalog_items where item_key='personality-reroll'");
  assert.equal(item.effect_payload.level, 5);
  assert.equal(item.effect_payload.effectKind, "personality_reroll");
  await db.exec(`
    insert into sporting_directors values ('${id(1)}','${id(2)}','active');
    insert into team_manager_assignments values ('${id(1)}','${id(3)}','general_manager','active');
    insert into seasons values ('${id(4)}','active',6),('${id(5)}','planned',7),('${id(6)}','completed',5);
    insert into team_seasons values ('${id(7)}','${id(3)}','${id(4)}','active');
    insert into riders values ('${id(8)}','active','assidu',4,77),('${id(9)}','active','sociable',5,69),
      ('${id(10)}','active','prudent',4,70),('${id(11)}','retired','collectif',4,75);
    insert into rider_contracts values
      ('${id(8)}','${id(3)}','active','${id(4)}','${id(5)}'),
      ('${id(9)}','${id(30)}','active','${id(4)}','${id(5)}'),
      ('${id(10)}','${id(3)}','active','${id(5)}','${id(5)}'),
      ('${id(11)}','${id(3)}','active','${id(4)}','${id(5)}');
    insert into team_item_inventory values ('${id(12)}','${id(7)}','${item.id}',2,now());
  `);
  const redeem = (rider = id(8), inventory = item.id) => one("select public.redeem_personality_reroll_reward($1,$2) as result", [inventory, rider]);
  await assert.rejects(redeem(), /Vous devez être connecté/);
  await query("select set_config('request.jwt.claim.sub',$1,false)", [id(2)]);
  await db.exec("set role authenticated");
  await assert.rejects(redeem(id(9)), /Sélectionnez un coureur professionnel/);
  await assert.rejects(redeem(id(10)), /Sélectionnez un coureur professionnel/);
  await assert.rejects(redeem(id(11)), /caractère de ce coureur est indisponible/);
  await assert.rejects(redeem(id(8), id(99)), /ne possède plus/);
  await assert.rejects(query("select * from rider_personality_changes"), /permission denied/);
  const first = (await redeem()).result;
  assert.equal(first.fromPersonalityKey, "assidu");
  assert.notEqual(first.personalityKey, "assidu");
  assert.ok(Object.hasOwn(options, first.personalityKey));
  assert.ok(first.message.includes(options[first.personalityKey]));
  const second = (await redeem()).result;
  assert.equal(second.fromPersonalityKey, first.personalityKey);
  assert.notEqual(second.personalityKey, first.personalityKey);
  await assert.rejects(redeem(), /ne possède plus/);
  await db.exec("reset role");
  assert.equal((await one("select count(*)::int as count from rider_personality_changes")).count, 2);
  assert.equal((await one("select count(*)::int as count from team_item_inventory")).count, 0);
  const unchanged = await one("select potential_steps,mountain from riders where id=$1", [id(8)]);
  assert.deepEqual(unchanged, { potential_steps: 4, mountain: 77 });
  assert.equal((await one("select personality_key from riders where id=$1", [id(9)])).personality_key, "sociable");
  const targets = (await one("select get_current_team_item_target_values() as value")).value;
  assert.equal(targets.find(r => r.id === id(8)).personalityKey, second.personalityKey);
  // Repeated rolls also exclude the latest result, not the original identity.
  await query("insert into team_item_inventory values ($1,$2,$3,80,now())", [id(13), id(7), item.id]);
  let current = second.personalityKey;
  const seen = new Set();
  await db.exec("set role authenticated");
  for (let i = 0; i < 80; i++) {
    const next = (await redeem()).result;
    assert.equal(next.fromPersonalityKey, current);
    assert.notEqual(next.personalityKey, current);
    assert.ok(Object.hasOwn(options, next.personalityKey));
    seen.add(next.personalityKey); current = next.personalityKey;
  }
  await assert.rejects(redeem(), /ne possède plus/);
  await db.exec("reset role");
  assert.equal((await one("select count(*)::int as count from rider_personality_changes")).count, 82);
  assert.ok(seen.size > 8, "Rolls must not be bound to the fixed rider identity");
  console.log("Personality consumable SQL passed: migration, real catalog, auth, ownership, contract dates, retired riders, stock exhaustion, RLS, random distinct results, target metadata and unchanged stats.");
} finally {
  await db.close();
}
