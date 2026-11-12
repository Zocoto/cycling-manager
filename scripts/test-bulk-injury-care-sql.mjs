// Run with an isolated local PGlite module. No credentials or remote database.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ?? "";
if (!isAbsolute(modulePath) || !modulePath.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js")) {
  throw new Error("Pass the absolute path to an isolated local PGlite module.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const director = id(1);
const user = id(2);
const team = id(3);
const teamSeason = id(4);
const season = id(5);
const rider = id(6);
const injuredRider = id(7);
const fatigueRider = id(8);
const foreignRider = id(9);
const injury = id(10);
const longerInjury = id(11);
const fatigueInjury = id(12);
const foreignInjury = id(13);
const catalogItem = id(14);
const stock = id(15);
const firstGift = id(16);
const secondGift = id(17);
const expiredGift = id(18);
const foreignGift = id(19);
const otherDirector = id(20);
const catalogKey = "injury-care-cryotherapy-pack";
const rows = async (sql, values = []) => (await db.query(sql, values)).rows;
const scalar = async (sql, values = []) => Object.values((await rows(sql, values))[0])[0];
const readMigration = filename => readFile(new URL(`../supabase/migrations/${filename}`, import.meta.url), "utf8");
const redeem = (item, target, quantity, owner = injuredRider) => scalar(
  "select public.redeem_injury_care_rewards($1, $2, $3, $4)", [item, owner, target, quantity],
);
const remainingStock = () => scalar(
  "select coalesce((select quantity from public.team_item_inventory where id = $1), 0)", [stock],
);
const remainingGifts = () => scalar(
  "select count(*)::int from public.daily_reward_inventory where id in ($1, $2) and status = 'available'",
  [firstGift, secondGift],
);
const stateOf = target => rows(
  "select status, expected_recovery_at::text, recovered_at::text from public.rider_injuries where id = $1", [target],
).then(result => result[0]);
const applicationCount = () => scalar("select count(*)::int from public.rider_injury_care_item_applications");

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create schema private;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function public.sync_active_season_day() returns void language plpgsql as $$ begin end $$;
    create table public.sporting_directors(id uuid primary key, auth_user_id uuid, status text);
    create table public.teams(id uuid primary key, status text);
    create table public.team_manager_assignments(sporting_director_id uuid, team_id uuid, role text, status text);
    create table public.seasons(id uuid primary key, game_year int, status text);
    create table public.team_seasons(id uuid primary key, team_id uuid, season_id uuid, status text);
    create table public.riders(id uuid primary key, first_name text, last_name text, status text);
    create table public.rider_contracts(rider_id uuid, team_id uuid, start_season_id uuid, end_season_id uuid, status text);
    create table public.rider_injuries(
      id uuid primary key, rider_id uuid, diagnosis_code text, status text, started_at timestamptz default now(),
      expected_recovery_at timestamptz, recovered_at timestamptz, updated_at timestamptz default now()
    );
    create table public.daily_reward_catalog(
      reward_key text primary key, effect_kind text, effect_payload jsonb, name text, is_active boolean
    );
    create table public.daily_reward_inventory(
      id uuid primary key, sporting_director_id uuid, team_season_id uuid, reward_key text, status text,
      expires_after_game_year int, acquired_at timestamptz default now(), used_at timestamptz, usage_payload jsonb
    );
    create table public.inventory_catalog_items(
      id uuid primary key, item_key text, category text, effect_payload jsonb, name text, status text, is_consumable boolean
    );
    create table public.team_item_inventory(
      id uuid primary key, team_season_id uuid, inventory_item_id uuid, quantity int,
      acquired_at timestamptz default now(), updated_at timestamptz default now(),
      unique(team_season_id, inventory_item_id)
    );
    create table public.rider_injury_care_item_applications(
      id uuid primary key default gen_random_uuid(), rider_id uuid, rider_injury_id uuid, team_season_id uuid,
      source_type text, inventory_item_id uuid, daily_reward_inventory_id uuid unique, item_name text,
      requested_recovery_hours int, recovery_seconds_reduced int, previous_expected_recovery_at timestamptz,
      adjusted_expected_recovery_at timestamptz, completed_injury boolean, applied_at timestamptz default now()
    );
    insert into public.sporting_directors values ('${director}', '${user}', 'active'), ('${otherDirector}', '${id(21)}', 'active');
    insert into public.teams values ('${team}', 'active'), ('${id(22)}', 'active');
    insert into public.team_manager_assignments values ('${director}', '${team}', 'general_manager', 'active');
    insert into public.seasons values ('${season}', 5, 'active');
    insert into public.team_seasons values ('${teamSeason}', '${team}', '${season}', 'active');
    insert into public.riders values
      ('${rider}', 'Sain', 'Benoît', 'active'), ('${injuredRider}', 'Gaston', 'Leroux', 'active'),
      ('${fatigueRider}', 'Émilie', 'Thomas', 'active'), ('${foreignRider}', 'Bruno', 'Lafleur', 'active');
    insert into public.rider_contracts values
      ('${rider}', '${team}', '${season}', '${season}', 'active'),
      ('${injuredRider}', '${team}', '${season}', '${season}', 'active'),
      ('${fatigueRider}', '${team}', '${season}', '${season}', 'active'),
      ('${foreignRider}', '${id(22)}', '${season}', '${season}', 'active');
    insert into public.rider_injuries (id, rider_id, diagnosis_code, status, expected_recovery_at) values
      ('${injury}', '${injuredRider}', 'clavicle_fracture', 'active', now() + interval '30 hours'),
      ('${longerInjury}', '${injuredRider}', 'wrist_sprain', 'active', now() + interval '72 hours'),
      ('${fatigueInjury}', '${fatigueRider}', 'fatigue_exhaustion', 'active', now() + interval '72 hours'),
      ('${foreignInjury}', '${foreignRider}', 'wrist_sprain', 'active', now() + interval '72 hours');
    insert into public.daily_reward_catalog values
      ('${catalogKey}', 'injury_care', '{"level":2,"recoveryHours":6}', 'Poche de cryothérapie', true);
    insert into public.inventory_catalog_items values
      ('${catalogItem}', '${catalogKey}', 'injury_care', '{"effectKind":"injury_care","level":2,"recoveryHours":6}',
       'Poche de cryothérapie', 'active', true);
    insert into public.team_item_inventory(id, team_season_id, inventory_item_id, quantity)
    values ('${stock}', '${teamSeason}', '${catalogItem}', 2);
    insert into public.daily_reward_inventory(id,sporting_director_id,team_season_id,reward_key,status,expires_after_game_year) values
      ('${firstGift}', '${director}', '${teamSeason}', '${catalogKey}', 'available', 6),
      ('${secondGift}', '${director}', '${teamSeason}', '${catalogKey}', 'available', 6),
      ('${expiredGift}', '${director}', '${teamSeason}', '${catalogKey}', 'available', 4),
      ('${foreignGift}', '${otherDirector}', '${teamSeason}', '${catalogKey}', 'available', 6);
  `);

  const legacyMigration = (await readMigration("20260827110000_add_injury_care_items.sql")).replaceAll("\r", "");
  const legacyStart = legacyMigration.indexOf("create or replace function public.redeem_injury_care_reward(");
  const legacyEnd = legacyMigration.indexOf("$$;", legacyStart);
  assert.ok(legacyStart >= 0 && legacyEnd > legacyStart);
  await db.exec(legacyMigration.slice(legacyStart, legacyEnd + 3)
    // 20260827120000 removes this global settlement from interactive writes.
    .replace("  perform public.settle_current_health_and_form();\n", ""));
  await db.exec(`
    revoke all on function public.redeem_injury_care_reward(uuid,uuid) from public, anon;
    grant execute on function public.redeem_injury_care_reward(uuid,uuid) to authenticated;
  `);
  await db.exec(await readMigration("20261112213000_bulk_injury_care_rewards.sql"));
  await scalar("select set_config('request.jwt.claim.sub', $1, false)", [user]);

  const signature = "public.redeem_injury_care_rewards(uuid,uuid,uuid,integer)";
  assert.equal(await scalar("select has_function_privilege('anon', $1, 'execute')", [signature]), false);
  assert.equal(await scalar("select has_function_privilege('authenticated', $1, 'execute')", [signature]), true);
  const untouchedLongerInjury = await stateOf(longerInjury);

  await db.exec("set role authenticated");
  const mixed = await redeem(firstGift, injury, 3);
  await db.exec("reset role");
  assert.equal(mixed.quantityApplied, 3);
  assert.equal(mixed.injuryId, injury);
  assert.equal(mixed.recoverySecondsReduced, 18 * 3600);
  assert.equal(await remainingStock() + await remainingGifts(), 1);
  assert.equal(await scalar("select count(distinct source_type)::int from public.rider_injury_care_item_applications"), 2);
  assert.equal(await applicationCount(), 3);
  assert.deepEqual(await stateOf(longerInjury), untouchedLongerInjury);
  assert.equal(await scalar("select status from public.daily_reward_inventory where id = $1", [expiredGift]), "available");
  assert.equal(await scalar("select status from public.daily_reward_inventory where id = $1", [foreignGift]), "available");

  const lastItem = await remainingStock() ? catalogItem : await scalar(
    "select id from public.daily_reward_inventory where id in ($1, $2) and status = 'available'",
    [firstGift, secondGift],
  );
  assert.equal((await redeem(lastItem, injury, 1)).quantityApplied, 1);
  assert.equal(await remainingStock() + await remainingGifts(), 0);
  await db.query(
    "insert into public.team_item_inventory(id,team_season_id,inventory_item_id,quantity) values($1,$2,$3,3)",
    [stock, teamSeason, catalogItem],
  );
  await db.query("update public.rider_injuries set expected_recovery_at = now() + interval '8 hours' where id = $1", [injury]);
  const capped = await redeem(catalogItem, injury, 3);
  assert.equal(capped.quantityApplied, 2);
  assert.equal(capped.completedInjury, true);
  assert.equal((await stateOf(injury)).status, "recovered");
  assert.equal(await remainingStock(), 1);
  assert.deepEqual(await stateOf(longerInjury), untouchedLongerInjury);
  assert.equal(await applicationCount(), 6);

  await assert.rejects(redeem(catalogItem, injury, 1));
  await assert.rejects(redeem(catalogItem, fatigueInjury, 1, fatigueRider));
  await assert.rejects(redeem(catalogItem, foreignInjury, 1, foreignRider));
  await assert.rejects(redeem(catalogItem, longerInjury, 1, rider));
  await assert.rejects(redeem(foreignGift, longerInjury, 1));
  await assert.rejects(redeem(catalogItem, longerInjury, 0));
  await assert.rejects(redeem(catalogItem, longerInjury, 31));
  await assert.rejects(redeem(catalogItem, longerInjury, 2));
  assert.equal(await remainingStock(), 1);
  assert.deepEqual(await stateOf(longerInjury), untouchedLongerInjury);
  assert.equal((await stateOf(fatigueInjury)).status, "active");
  assert.equal(await applicationCount(), 6);

  const legacy = await scalar("select public.redeem_injury_care_reward($1,$2)", [catalogItem, injuredRider]);
  assert.equal(legacy.injuryId, longerInjury);
  assert.equal(legacy.recoverySecondsReduced, 6 * 3600);
  assert.equal(await remainingStock(), 0);
  assert.equal(await applicationCount(), 7);

  const firstAtomicGift = id(25);
  const secondAtomicGift = id(26);
  const atomicGiftCount = () => scalar(
    "select count(*)::int from public.daily_reward_inventory where id in ($1, $2) and status = 'available'",
    [firstAtomicGift, secondAtomicGift],
  );
  await db.exec(`
    insert into public.team_item_inventory(id,team_season_id,inventory_item_id,quantity)
    values ('${stock}', '${teamSeason}', '${catalogItem}', 1);
    insert into public.daily_reward_inventory(id,sporting_director_id,team_season_id,reward_key,status,expires_after_game_year) values
      ('${firstAtomicGift}', '${director}', '${teamSeason}', '${catalogKey}', 'available', 6),
      ('${secondAtomicGift}', '${director}', '${teamSeason}', '${catalogKey}', 'available', 6);
    alter table public.rider_injury_care_item_applications
      add constraint fixture_reject_second_gift check (daily_reward_inventory_id is distinct from '${secondAtomicGift}');
  `);
  const beforeRollback = await stateOf(longerInjury);
  await assert.rejects(redeem(catalogItem, longerInjury, 3), /fixture_reject_second_gift/);
  assert.equal(await atomicGiftCount(), 2);
  assert.equal(await remainingStock(), 1);
  assert.deepEqual(await stateOf(longerInjury), beforeRollback);
  assert.equal(await applicationCount(), 7);

  await db.exec(`
    alter table public.rider_injury_care_item_applications drop constraint fixture_reject_second_gift;
    update public.daily_reward_catalog set effect_payload = '{"level":2,"recoveryHours":12}';
  `);
  await assert.rejects(redeem(catalogItem, longerInjury, 2), /Le stock de cet objet de soin a changé/);
  assert.equal(await atomicGiftCount(), 2);
  assert.equal(await remainingStock(), 1);
  assert.deepEqual(await stateOf(longerInjury), beforeRollback);
  assert.equal(await applicationCount(), 7);
  const differentDuration = await redeem(firstAtomicGift, longerInjury, 2);
  assert.equal(differentDuration.recoverySecondsReduced, 24 * 3600);
  assert.equal(await atomicGiftCount(), 0);
  assert.equal(await remainingStock(), 1);
  assert.equal(await applicationCount(), 9);

  console.log("PASS: mixed care stock, exact injury, recovery cap, rollback, access checks, and legacy single use.");
} finally {
  await db.close();
}
