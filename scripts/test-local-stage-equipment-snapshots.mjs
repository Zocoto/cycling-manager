// Isolated PostgreSQL only. This script never loads credentials or connects to Supabase.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
await db.exec(`
  create table public.seasons(id uuid primary key, status text, game_year int);
  create table public.race_editions(id uuid primary key, season_id uuid, status text);
  create table public.stages(id uuid primary key, race_edition_id uuid, stage_number int, status text);
  create table public.race_registrations(id uuid primary key, race_edition_id uuid, team_season_id uuid, status text);
  create table public.race_rosters(id uuid primary key, race_registration_id uuid, rider_id uuid, status text);
  create table public.team_seasons(id uuid primary key, team_id uuid);
  create table public.race_stage_equipment_assignments(id uuid primary key, stage_id uuid, team_season_id uuid, rider_id uuid, slot_type text, equipment_item_id uuid);
  create table public.rider_equipment_assignments(rider_id uuid, slot_type text, equipment_item_id uuid);
  create table public.equipment_catalog_items(id uuid primary key, name text, slot_type text, acquisition_channel text, effect_payload jsonb, status text, supplier_key text);
  create table public.equipment_partner_item_effects(contract_id uuid, equipment_item_id uuid, effect_payload jsonb);
  create table public.equipment_partner_contracts(id uuid, team_id uuid, supplier_key text, status text, start_season_id uuid, end_season_id uuid);
  create role service_role;
  create table public.stage_results(stage_id uuid, race_roster_id uuid, status text, rank smallint, elapsed_time_ms bigint, gap_to_winner_ms bigint, mountain_points integer, sprint_points integer, time_bonus_seconds smallint, time_penalty_seconds smallint, abandonment_reason text, injury_id uuid, updated_at timestamptz);
  insert into public.stage_results(stage_id,race_roster_id,status,rank) values ('${uid(999)}','${uid(998)}','finished',1);
  insert into seasons values ('${uid(1)}', 'active', 4);
  insert into race_editions values ('${uid(2)}', '${uid(1)}', 'registration_open');
  insert into stages values ('${uid(3)}', '${uid(2)}', 1, 'planned'), ('${uid(4)}', '${uid(2)}', 2, 'planned'), ('${uid(5)}', '${uid(2)}', 3, 'cancelled');
  insert into team_seasons values ('${uid(6)}', '${uid(7)}');
  insert into race_registrations values ('${uid(8)}', '${uid(2)}', '${uid(6)}', 'accepted');
  insert into equipment_catalog_items values
    ('${uid(30)}', 'Habituel', 'frame', 'commercial', '{"ratingBonuses":{"mountain":1,"flat":2}}', 'active', 'shop'),
    ('${uid(31)}', 'Cadre montagne', 'frame', 'commercial', '{"ratingBonuses":{"mountain":4},"timeTrialRatingBonuses":{"timeTrial":3}}', 'active', 'shop'),
    ('${uid(32)}', 'Gants de Gala', 'gloves', 'event_reward', '{"ratingBonuses":{"hills":2,"acceleration":2}}', 'active', 'gala'),
    ('${uid(33)}', 'Roue partenaire', 'front_wheel', 'equipment_partner', '{"ratingBonuses":{"flat":999}}', 'active', 'partner'),
    ('${uid(34)}', 'Prototype', 'frame', 'research_prototype', '{"ratingBonuses":{"flat":999}}', 'active', 'partner'),
    ('${uid(35)}', 'Archivé', 'frame', 'commercial', '{"ratingBonuses":{"flat":999}}', 'archived', 'shop');
  insert into equipment_partner_contracts values ('${uid(40)}', '${uid(7)}', 'partner', 'active', '${uid(1)}', '${uid(1)}');
  insert into equipment_partner_item_effects values ('${uid(40)}', '${uid(33)}', '{"ratingBonuses":{"flat":2.5}}'), ('${uid(40)}', '${uid(34)}', '{"ratingBonuses":{"mountain":5}}');
`);
for (let n = 10; n <= 18; n++) {
  await db.query("insert into race_rosters values ($1,$2,$3,'confirmed')", [uid(n + 100), uid(8), uid(n)]);
  if (n !== 17) await db.query("insert into rider_equipment_assignments values ($1,'frame',$2)", [uid(n), uid(30)]);
}
const planned = [[10, "frame", 31], [11, "frame", null], [12, "frame", 30], [13, "gloves", 32], [14, "front_wheel", 33], [15, "frame", 34], [16, "frame", 35], [17, "frame", null]];
for (const [index, [rider, slot, item]] of planned.entries()) {
  await db.query("insert into race_stage_equipment_assignments values ($1,$2,$3,$4,$5,$6)", [uid(200 + index), uid(3), uid(6), uid(rider), slot, item ? uid(item) : null]);
}
const original = await readFile(new URL("../supabase/migrations/20260809101000_plan_race_stage_equipment.sql", import.meta.url), "utf8");
const start = original.indexOf("create or replace function public.get_active_calendar_stage_equipment_effects(");
const end = original.indexOf("$$;", start) + 3;
await db.exec(original.slice(start, end).replaceAll("item.acquisition_channel = 'commercial'", "item.acquisition_channel in ('commercial', 'event_reward')"));
const before = (await db.query("select * from get_active_calendar_stage_equipment_effects(null)")).rows;
await db.exec(await readFile(new URL("../supabase/migrations/20260827140000_serialize_official_stage_result_replacement.sql", import.meta.url), "utf8"));
await db.exec(await readFile(new URL("../supabase/migrations/20261009120000_snapshot_stage_equipment_changes.sql", import.meta.url), "utf8"));
const after = (await db.query("select * from get_active_calendar_stage_equipment_effects(null)")).rows;
const totals = (values) => {
  const result = {};
  for (const value of values) for (const [key, payload] of Object.entries(value ?? {})) {
    if (key.startsWith("_")) continue;
    if (typeof payload === "number") result[key] = (result[key] ?? 0) + payload;
    else if (payload && typeof payload === "object") for (const [axis, number] of Object.entries(payload)) result[`${key}.${axis}`] = (result[`${key}.${axis}`] ?? 0) + number;
  }
  return result;
};
assert.equal(after.length, before.length);
for (let i = 0; i < before.length; i++) {
  assert.equal(after[i].stage_id, before[i].stage_id);
  assert.equal(after[i].rider_id, before[i].rider_id);
  assert.deepEqual(totals(after[i].equipment_effects), totals(before[i].equipment_effects));
}
const changes = (rider, stage = 3) => after.find((row) => row.rider_id === uid(rider) && row.stage_id === uid(stage)).equipment_effects.filter((effect) => effect._stageSpecific);
assert.equal(changes(10)[0]._equipmentName, "Cadre montagne");
assert.deepEqual(changes(10)[0]._permanentEffect, { ratingBonuses: { mountain: 1, flat: 2 } });
assert.equal(changes(11)[0]._equipmentItemId, null);
assert.deepEqual(changes(11)[0]._permanentEffect, { ratingBonuses: { mountain: 1, flat: 2 } });
assert.equal(changes(12).length, 0); // Same item, not an actual equipment change.
assert.equal(changes(13)[0]._equipmentName, "Gants de Gala");
assert.equal(changes(14)[0].ratingBonuses.flat, 2.5); // Actual R&D effect, not catalog placeholder.
assert.equal(changes(15)[0].ratingBonuses.mountain, 5);
assert.equal(changes(16).length, 0); // Archived equipment has no applied bonus.
assert.equal(changes(17).length, 0); // Empty -> empty is not a change.
assert.equal(changes(18).length, 0); // Permanent inheritance.
assert.equal(changes(10, 4).length, 0); // No leaking plans to another stage.
assert.equal((await db.query("select * from get_active_calendar_stage_equipment_effects($1::uuid[])", [[uid(999)]])).rows.length, 0);
assert.equal(after.some((row) => row.stage_id === uid(5)), false);
const historic = (await db.query("select rank,equipment_snapshot from stage_results where stage_id=$1", [uid(999)])).rows[0];
assert.deepEqual(historic, { rank: 1, equipment_snapshot: null });
const receipt = { items: [{ slot: "frame", equipmentItemId: uid(31), name: "Cadre montagne" }], ratingBonuses: { mountain: 4 }, ratingChanges: { mountain: 3 } };
await db.query("select replace_official_stage_results($1,$2::jsonb)", [uid(3), JSON.stringify([{ race_roster_id: uid(110), status: "finished", rank: 1, elapsed_time_ms: 10000, equipment_snapshot: receipt }])]);
assert.deepEqual((await db.query("select equipment_snapshot from stage_results where stage_id=$1", [uid(3)])).rows[0].equipment_snapshot, receipt);
await db.query("select replace_official_stage_results($1,$2::jsonb)", [uid(4), JSON.stringify([{ race_roster_id: uid(110), status: "finished", rank: 1 }])]);
assert.equal((await db.query("select equipment_snapshot from stage_results where stage_id=$1", [uid(4)])).rows[0].equipment_snapshot, null);
assert.equal((await db.query("select has_function_privilege('service_role','public.replace_official_stage_results(uuid,jsonb)','execute') as allowed")).rows[0].allowed, true);
await db.close();
console.log(`Isolated PostgreSQL: ${after.length} rider/stage effect sets unchanged; 18 provenance, scope and receipt-persistence checks passed.`);
