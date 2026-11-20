// This attribution is tested exclusively in isolated PostgreSQL.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ?? "";
if (!isAbsolute(modulePath) || !modulePath.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js")) {
  throw new Error("Pass the absolute local PGlite module path.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const migration = readFileSync(new URL("../supabase/migrations/20261120110000_grant_gala_presenter_reward.sql", import.meta.url), "utf8");
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
const director = "14243193-46f6-4003-8b7b-8da292baba14";

try {
  await db.exec(`
    create table sporting_directors(id uuid primary key, auth_user_id uuid, username text, status text);
    create table team_manager_assignments(sporting_director_id uuid, team_id int, role text, status text);
    create table seasons(id int primary key, game_year int, status text);
    create table team_seasons(id int primary key, team_id int, season_id int, status text);
    create table cyclo_stickers_editions(edition_id text, source_season_id int, collection_season_id int, configuration jsonb);
    create table equipment_catalog_items(
      id uuid primary key default gen_random_uuid(), catalog_key text unique, name text, slot_type text,
      status text, supplier_key text, supplier_name text, description text, price int, rarity text,
      image_path text, effect_summary text, effect_payload jsonb, acquisition_channel text
    );
    create table team_equipment_inventory(
      team_season_id int, equipment_item_id uuid, quantity int, last_purchase_price int, updated_at timestamptz,
      primary key(team_season_id,equipment_item_id)
    );
    create table cyclo_stickers_boosters(
      id uuid default gen_random_uuid(), sporting_director_id uuid, collection_season_id int,
      acquisition_source text, source_reference text, awarded_on date, opened_at timestamptz,
      unique(sporting_director_id,acquisition_source,source_reference)
    );
    create table sporting_director_messages(
      id uuid default gen_random_uuid(), sporting_director_id uuid, season_id int, team_season_id int,
      message_type text, sender_name text, subject text, preview text, body text, action_href text, action_label text,
      source_reference text, is_important boolean, unique(sporting_director_id,source_reference)
    );
    insert into sporting_directors values('14243193-46f6-4003-8b7b-8da292baba14','ee244935-5722-4626-a28f-dc3cf63aa6f4','gouilleTW','active');
    insert into team_manager_assignments values('14243193-46f6-4003-8b7b-8da292baba14', 1, 'general_manager', 'active');
    insert into seasons values(4,4,'completed'),(5,5,'active');
    insert into team_seasons values(1,1,5,'active');
    insert into cyclo_stickers_editions values('S4',4,5,'{"enabled":true,"publicApproved":true}');
    create function fail_gift_mail() returns trigger language plpgsql as $$
    begin
      raise exception 'Isolated mail failure';
    end $$;
    create trigger fail_gift before insert on sporting_director_messages for each row execute function fail_gift_mail();
  `);

  await assert.rejects(db.exec(migration), /Isolated mail failure/);
  await db.exec("rollback");
  assert.equal(await scalar("select count(*)::int from team_equipment_inventory"), 0);
  assert.equal(await scalar("select count(*)::int from cyclo_stickers_boosters"), 0);
  assert.equal(await scalar("select count(*)::int from equipment_catalog_items"), 0);
  await db.exec("drop trigger fail_gift on sporting_director_messages");
  await db.exec(migration);
  assert.equal(await scalar("select count(*)::int from cyclo_stickers_boosters where opened_at is null"), 3);
  assert.equal(await scalar("select sum(quantity)::int from team_equipment_inventory"), 2);
  assert.equal(await scalar("select count(*)::int from sporting_director_messages where is_important"), 1);
  assert.match(await scalar("select body from sporting_director_messages"), /3 boosters/);
  const items = (await db.query("select slot_type,effect_payload from equipment_catalog_items order by slot_type")).rows;
  assert.deepEqual(items, [
    { slot_type: "gloves", effect_payload: { ratingBonuses: { hills: 2, downhill: 1 } } },
    { slot_type: "helmet", effect_payload: { ratingBonuses: { sprint: 1, acceleration: 1, endurance: 1 } } },
  ]);

  await db.exec("update cyclo_stickers_boosters set opened_at=now(); delete from team_equipment_inventory;");
  await db.exec(migration);
  assert.equal(await scalar("select count(*)::int from cyclo_stickers_boosters"), 3);
  assert.equal(await scalar("select count(*)::int from team_equipment_inventory"), 0);
  assert.equal(await scalar("select count(*)::int from sporting_director_messages"), 1);
  assert.equal(await scalar("select count(*)::int from cyclo_stickers_boosters where sporting_director_id <> '" + director + "'"), 0);
  console.log("PASS: 3 boosters, 2 equipment items, important in-game mail, rollback on failure and safe replay after gifts are used.");
} finally {
  await db.close();
}
