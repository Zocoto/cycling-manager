// Isolated PostgreSQL/WASM regression tests. No credentials, HTTP or live data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2] ?? 'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js';
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const reward = async (n, key, { status = 'available', expiry = 4, director = 10, teamSeason = 13, usedAt = null, payload = {} } = {}) => {
  await db.query(`insert into daily_reward_inventory(id,sporting_director_id,team_season_id,source_claim_id,reward_key,status,expires_after_game_year,used_at,usage_payload)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
  [id(n), id(director), id(teamSeason), id(n + 10000), key, status, expiry, usedAt, JSON.stringify(payload)]);
};

try {
  await db.exec(`
    create role anon;create role authenticated;create role service_role;
    create schema auth;create schema private;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function public.sync_active_season_day() returns void language sql as $$select$$;
    create table seasons(id uuid primary key,game_year int unique,status text,current_day_number int);
    create table season_days(id uuid primary key,season_id uuid references seasons,day_number int);
    create table teams(id uuid primary key);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table team_manager_assignments(sporting_director_id uuid references sporting_directors,team_id uuid references teams,role text,status text);
    create table team_seasons(id uuid primary key,team_id uuid references teams,season_id uuid references seasons,status text,registration_country_id uuid);
    create table inventory_catalog_items(id uuid primary key default gen_random_uuid(),item_key text unique,name text,description text,effect_summary text,icon_key text,category text,effect_payload jsonb,rarity text,status text,is_consumable bool default true);
    create table equipment_catalog_items(id uuid primary key,name text,status text,acquisition_channel text,rarity text);
    create table team_equipment_inventory(team_season_id uuid references team_seasons,equipment_item_id uuid references equipment_catalog_items,quantity int,last_purchase_price numeric,updated_at timestamptz default now(),unique(team_season_id,equipment_item_id));
    create table team_item_inventory(id uuid primary key default gen_random_uuid(),team_season_id uuid references team_seasons,inventory_item_id uuid references inventory_catalog_items,quantity int check(quantity>=0),acquisition_source text,acquired_at timestamptz default now(),updated_at timestamptz default now(),unique(team_season_id,inventory_item_id));
    create table season_rollover_item_recoveries(source_season_id uuid references seasons,target_season_id uuid references seasons,team_id uuid references teams,inventory_item_id uuid references inventory_catalog_items,quantity int check(quantity>0),acquisition_source text,acquired_at timestamptz,recovered_at timestamptz default now(),primary key(source_season_id,target_season_id,team_id,inventory_item_id));
    create table daily_reward_catalog(reward_key text primary key,name text,description text,effect_summary text,icon_key text,effect_kind text,effect_payload jsonb,importance int,is_active bool);
    create table daily_reward_inventory(id uuid primary key default gen_random_uuid(),sporting_director_id uuid references sporting_directors,team_season_id uuid references team_seasons,source_claim_id uuid unique,source_referral_reward_id uuid,source_auction_compensation_id uuid,source_longevity_trophy_reward_id uuid,source_international_selection_compensation_id uuid,source_race_incident_compensation_id uuid,source_season_gala_reward_id uuid,reward_key text references daily_reward_catalog,
      status text not null default 'available' check(status in('available','used','expired')),expires_after_game_year int not null,acquired_at timestamptz not null default now(),used_at timestamptz,usage_payload jsonb not null default '{}'::jsonb check(jsonb_typeof(usage_payload)='object'),
      constraint daily_reward_inventory_exactly_one_source check(num_nonnulls(source_claim_id,source_referral_reward_id,source_auction_compensation_id,source_longevity_trophy_reward_id,source_international_selection_compensation_id,source_race_incident_compensation_id,source_season_gala_reward_id)=1));
    create table daily_reward_active_effects(id uuid primary key default gen_random_uuid(),source_inventory_id uuid unique references daily_reward_inventory,team_id uuid references teams,season_id uuid references seasons,effect_kind text,effect_payload jsonb,starts_day_number int,ends_day_number int,consumed_day_number int,status text,activated_at timestamptz default now());
    create table daily_reward_wildcard_reservations(id uuid primary key default gen_random_uuid(),source_inventory_id uuid unique references daily_reward_inventory,team_season_id uuid references team_seasons,race_edition_id uuid,status text default 'reserved',created_at timestamptz default now(),consumed_at timestamptz,unique(team_season_id,race_edition_id));
    create table rider_injury_care_item_applications(id uuid primary key default gen_random_uuid(),daily_reward_inventory_id uuid unique references daily_reward_inventory);
    create table team_scouting_visibility_activations(id uuid primary key default gen_random_uuid(),daily_reward_inventory_id uuid references daily_reward_inventory);
    create table riders(id uuid primary key,potential_steps int,status text,country_id uuid,career_race_days int default 0);
    create table rider_contracts(rider_id uuid references riders,team_id uuid references teams,status text);
    create table rider_season_ratings(rider_id uuid references riders,season_id uuid references seasons,mountain int default 50,hills int default 50,flat int default 50,time_trial int default 50,cobbles int default 50,sprint int default 50,acceleration int default 50,downhill int default 50,endurance int default 50,resistance int default 50,recovery int default 50,breakaway int default 50,prologue int default 50,updated_at timestamptz default now());
    insert into seasons values('${id(1)}',4,'completed',28),('${id(2)}',5,'active',1),('${id(3)}',6,'planned',1);
    insert into season_days values('${id(4)}','${id(2)}',1);
    insert into teams values('${id(12)}'),('${id(22)}'),('${id(32)}');
    insert into sporting_directors values('${id(10)}','${id(11)}','active'),('${id(20)}','${id(21)}','active'),('${id(30)}','${id(31)}','active');
    insert into team_manager_assignments values('${id(10)}','${id(12)}','general_manager','active'),('${id(20)}','${id(22)}','general_manager','active');
    insert into team_seasons values('${id(13)}','${id(12)}','${id(1)}','completed','${id(99)}'),('${id(14)}','${id(12)}','${id(2)}','active','${id(99)}'),('${id(23)}','${id(22)}','${id(1)}','completed','${id(99)}'),('${id(24)}','${id(22)}','${id(2)}','active','${id(99)}'),('${id(33)}','${id(32)}','${id(1)}','completed','${id(99)}');
    insert into inventory_catalog_items(id,item_key,name,category,effect_payload,status) values('${id(50)}','potential-notebook','Carnet','potential_boost','{"potentialBonus":1}','active');
    insert into equipment_catalog_items values('${id(70)}','Équipement commercial','active','commercial','premium');
    insert into team_item_inventory(team_season_id,inventory_item_id,quantity,acquisition_source)values('${id(13)}','${id(50)}',3,'original');
    insert into riders values('${id(60)}',2,'active','${id(99)}',0);
    insert into rider_contracts values('${id(60)}','${id(12)}','active');
    insert into rider_season_ratings(rider_id,season_id)select '${id(60)}',id from seasons;
    select set_config('request.jwt.claim.sub','${id(11)}',false);
  `);
  const baseline = JSON.parse(readFileSync('scripts/fixtures/ordinary-consumables-baseline.json', 'utf8'));
  for (const r of baseline.catalog.filter(row => row.source === 'daily_reward')) {
    await db.query('insert into daily_reward_catalog values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)', [r.key,r.name,r.description,r.effect_summary,r.icon_key,r.effect_kind,JSON.stringify(r.effect_payload),Number(r.tier),r.status === 'true']);
  }
  for (const fn of baseline.functions.filter(fn => /function public\.redeem_current_daily_reward/i.test(fn.definition))) await db.exec(fn.definition);
  await db.exec(readFileSync('supabase/migrations/20260911153000_carry_consumables_on_team_rollover.sql', 'utf8'));

  await reward(101, 'primary-breakthrough');
  await reward(102, 'secondary-technique', { status: 'expired' });
  await reward(103, 'secondary-specialization', { status: 'used', usedAt: '2026-11-01T12:00:00Z', payload: { riderId: id(60), ratingKey: 'endurance' } });
  await reward(104, 'ultimate-prototype', { status: 'used', usedAt: '2026-11-01T12:00:00Z', payload: { automatic: true, equipmentItemId: id(70) } });
  await reward(105, 'secondary-technique', { status: 'expired', usedAt: '2026-11-01T12:00:00Z' });
  await reward(106, 'secondary-technique', { status: 'expired', payload: { riderId: id(60) } });
  await reward(107, 'collective-training-150', { status: 'expired' });
  await db.exec(`insert into daily_reward_active_effects(source_inventory_id,team_id,season_id,effect_kind,status)values('${id(107)}','${id(12)}','${id(1)}','training_multiplier','expired')`);
  await reward(108, 'golden-ticket', { status: 'expired' });
  await db.exec(`insert into daily_reward_wildcard_reservations(source_inventory_id,team_season_id,race_edition_id,status)values('${id(108)}','${id(13)}','${id(80)}','consumed')`);
  await reward(109, 'primary-breakthrough', { director: 20, teamSeason: 23 });
  await reward(110, 'primary-breakthrough', { director: 30, teamSeason: 33 });
  await reward(111, 'primary-breakthrough', { director: 20, teamSeason: 13 });
  await reward(114, 'injury-care-recovery-kit', { status: 'expired' });
  await db.exec(`insert into rider_injury_care_item_applications(daily_reward_inventory_id)values('${id(114)}')`);
  await reward(115, 'scouting-clarity-pass', { status: 'expired' });
  await db.exec(`insert into team_scouting_visibility_activations(daily_reward_inventory_id)values('${id(115)}')`);
  await reward(116, 'ultimate-prototype', { status: 'expired' });
  const originalCount = await scalar('select count(*)::int from daily_reward_inventory');
  const originalUsed = await scalar("select md5(string_agg(row_to_json(i)::text,','order by id))from daily_reward_inventory i where status='used'");

  // Reproduce the actual S4 -> S5 failure: the prior fix carries generic stock
  // but excludes daily objects with expiry=4 from visibility and use.
  await db.exec(`update team_seasons set status=status where id='${id(14)}'`);
  check(await scalar(`select quantity from team_item_inventory where team_season_id='${id(14)}'`), 3);
  check(await scalar(`select count(*)::int from daily_reward_inventory where sporting_director_id='${id(10)}' and status='available' and expires_after_game_year>=5`), 0);
  await assert.rejects(() => db.query('select redeem_current_daily_reward($1,$2,$3)', [id(101), id(60), 'mountain']));checks++;

  const migration = readFileSync('supabase/migrations/20261106223000_persist_owned_inventory_rewards_across_seasons.sql', 'utf8');
  await db.exec(migration);
  check(await scalar('select count(*)::int from daily_reward_inventory'), originalCount);
  check(await scalar("select md5(string_agg(row_to_json(i)::text,','order by id))from daily_reward_inventory i where status='used'"), originalUsed);
  check(await scalar(`select status from daily_reward_inventory where id='${id(102)}'`), 'available');
  check(await scalar(`select expires_after_game_year from daily_reward_inventory where id='${id(101)}'`), 2147483647);
  for (const n of [105,106,107,108,114,115,116]) check(await scalar(`select status from daily_reward_inventory where id='${id(n)}'`), 'expired');
  check(await scalar(`select team_season_id::text from daily_reward_inventory where id='${id(101)}'`), id(14));
  check(await scalar(`select team_season_id::text from daily_reward_inventory where id='${id(109)}'`), id(24));
  check(await scalar(`select team_season_id::text from daily_reward_inventory where id='${id(110)}'`), id(33));
  check(await scalar(`select team_season_id::text from daily_reward_inventory where id='${id(111)}'`), id(13));

  // The existing real BEFORE INSERT conversion must run before the new
  // lifetime trigger. An equipment gift remains one physical unit + one used
  // provenance row, rather than also becoming an available daily object.
  const equipmentSource = readFileSync('supabase/migrations/20260816150000_group_and_bulk_use_inventory_rewards.sql', 'utf8');
  await db.exec(equipmentSource.slice(equipmentSource.indexOf('create or replace function public.store_daily_reward_equipment_in_inventory()'), equipmentSource.indexOf('-- Répare les cadeaux matériels')));
  await reward(117, 'ultimate-prototype', { expiry: 5, teamSeason: 14 });
  check(await scalar(`select status from daily_reward_inventory where id='${id(117)}'`), 'used');
  check(await scalar(`select expires_after_game_year from daily_reward_inventory where id='${id(117)}'`), 5);
  check(await scalar(`select quantity from team_equipment_inventory where team_season_id='${id(14)}'`), 1);
  check(await scalar(`select (usage_payload->>'equipmentItemId') from daily_reward_inventory where id='${id(117)}'`), id(70));

  await reward(112, 'primary-breakthrough', { expiry: 5, teamSeason: 14 });
  check(await scalar(`select expires_after_game_year from daily_reward_inventory where id='${id(112)}'`), 2147483647);
  await db.exec(`update daily_reward_inventory set expires_after_game_year=2 where id='${id(112)}'`);
  check(await scalar(`select expires_after_game_year from daily_reward_inventory where id='${id(112)}'`), 2147483647);

  await db.query('select redeem_current_daily_reward($1,$2,$3)', [id(101), id(60), 'mountain']);
  check(await scalar(`select mountain from rider_season_ratings where season_id='${id(2)}'`), 51);
  check(await scalar(`select status from daily_reward_inventory where id='${id(101)}'`), 'used');
  await assert.rejects(() => db.query('select redeem_current_daily_reward($1,$2,$3)', [id(101), id(60), 'mountain']));checks++;
  await assert.rejects(() => db.query('select redeem_current_daily_reward($1,$2,$3)', [id(109), id(60), 'mountain']));checks++;

  // Reapplying the repair and repeated rollover-trigger executions retain
  // original IDs, preserve already spent units, and never copy stock twice.
  await db.exec(migration);
  await db.exec(`update team_seasons set status=status where id='${id(14)}';update team_seasons set status=status where id='${id(14)}';`);
  check(await scalar(`select quantity from team_item_inventory where team_season_id='${id(14)}'`), 3);
  check(await scalar('select count(*)::int from daily_reward_inventory'), originalCount + 2);
  check(await scalar(`select quantity from team_equipment_inventory where team_season_id='${id(14)}'`), 1);
  check(await scalar(`select status from daily_reward_inventory where id='${id(101)}'`), 'used');
  await db.exec(`update seasons set status='completed' where id='${id(2)}';update seasons set status='active' where id='${id(3)}';
    insert into team_seasons values('${id(15)}','${id(12)}','${id(3)}','active','${id(99)}');`);
  check(await scalar(`select team_season_id::text from daily_reward_inventory where id='${id(112)}'`), id(15));
  check(await scalar(`select quantity from team_item_inventory where team_season_id='${id(15)}'`), 3);
  await db.exec(`update team_seasons set status=status where id='${id(15)}'`);
  check(await scalar(`select quantity from team_item_inventory where team_season_id='${id(15)}'`), 3);
  check(await scalar('select count(*)::int from daily_reward_inventory'), originalCount + 2);

  console.log(JSON.stringify({ checks, isolated: true, realPriorCarryFunction: true, realRedemptionBodies: true, realEquipmentConversion: true, recoveryIdempotent: true }));
} catch (error) {
  console.error(error.message, error.where ?? '');process.exitCode = 1;
} finally { await db.close(); }
