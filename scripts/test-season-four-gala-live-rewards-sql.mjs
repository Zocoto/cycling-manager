// Isolated PostgreSQL/WASM only. This test does not load production credentials.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]?.replaceAll('\\', '/').endsWith('/pglite/dist/index.js')) throw Error('Absolute isolated PGlite module required');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const editionId = 'cyclo-stickers-s5-s4-final-v1';
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const denied = async (fn, message) => { await assert.rejects(fn, message); checks++; };
const settle = directors => scalar('select public.settle_season_four_gala_live_rewards($1::uuid[])', [directors]);
const count = table => scalar(`select count(*)::int from ${table}`);

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
    create table public.seasons(id uuid primary key, game_year int unique, status text);
    create table public.teams(id uuid primary key, status text);
    create table public.sporting_directors(id uuid primary key, auth_user_id uuid unique, display_name text, status text);
    create table public.team_seasons(id uuid primary key, team_id uuid references public.teams(id), season_id uuid references public.seasons(id), status text);
    create table public.team_manager_assignments(team_id uuid references public.teams(id), sporting_director_id uuid references public.sporting_directors(id), role text, status text);
    create table public.equipment_catalog_items(id uuid primary key default gen_random_uuid(), catalog_key text unique, name text, slot_type text, status text, supplier_key text, supplier_name text, description text, price numeric, rarity text, image_path text, effect_summary text, effect_payload jsonb, acquisition_channel text);
    create table public.team_equipment_inventory(team_season_id uuid references public.team_seasons(id), equipment_item_id uuid references public.equipment_catalog_items(id), quantity int, last_purchase_price numeric, updated_at timestamptz, unique(team_season_id,equipment_item_id));
    insert into public.seasons values('${id(1)}',3,'completed'),('${id(2)}',4,'completed'),('${id(3)}',5,'active');
  `);
  // Use the real booster table and producer rather than a fake grant routine.
  const album = readFileSync('supabase/migrations/20261105140000_prepare_persistent_cyclo_stickers.sql', 'utf8');
  await db.exec(album.slice(album.indexOf('create table public.cyclo_stickers_editions ('), album.indexOf('create table public.cyclo_stickers_cards (')));
  await db.exec(album.slice(album.indexOf('create table public.cyclo_stickers_edition_boosters ('), album.indexOf('create or replace view public.cyclo_stickers_booster_inventory')));
  await db.exec(album.slice(album.indexOf('create function public.grant_cyclo_stickers_gala_boosters('), album.indexOf('create function private.current_cyclo_stickers_director()')));
  await db.exec(`revoke all on function public.grant_cyclo_stickers_gala_boosters(text,uuid[],text) from public,anon,authenticated;
    grant execute on function public.grant_cyclo_stickers_gala_boosters(text,uuid[],text) to service_role;`);

  const viewer = async (n, name, { verified = true, status = 'active', assigned = true, account = 1000 + n } = {}) => {
    await db.query('insert into public.sporting_directors values($1,$2,$3,$4)', [id(n), verified ? id(account) : null, name, status]);
    await db.exec(`insert into public.teams values('${id(200+n)}','active');
      insert into public.team_seasons values('${id(300+n)}','${id(200+n)}','${id(3)}','active');`);
    if (assigned) await db.exec(`insert into public.team_manager_assignments values('${id(200+n)}','${id(n)}','general_manager','active');`);
  };
  await viewer(10, 'Spectatrice A');
  await viewer(11, 'Spectateur B');
  await viewer(12, 'Déjà doté en boosters');
  await viewer(13, 'Compte suspendu', { status: 'inactive' });
  await viewer(14, 'Compte non rattaché', { verified: false });
  await viewer(15, 'Compte sans club', { assigned: false });

  await db.exec(readFileSync('supabase/migrations/20261107151000_prepare_season_four_gala_live_rewards.sql', 'utf8'));
  check(await count('public.season_gala_live_reward_grants'), 0);
  check(await count('public.team_equipment_inventory'), 0);
  check(await count('public.cyclo_stickers_edition_boosters'), 0);
  check(await scalar(`select effect_payload from public.equipment_catalog_items
    where catalog_key='gala-s4-live-gloves' and slot_type='gloves' and acquisition_channel='event_reward' and price=0 and status='active'`), {ratingBonuses:{hills:1}});
  check(await scalar("select relrowsecurity from pg_class where oid='public.season_gala_live_reward_grants'::regclass"), true);
  for (const role of ['anon', 'authenticated']) {
    check(await scalar(`select has_table_privilege('${role}','public.season_gala_live_reward_grants','SELECT')`), false);
    check(await scalar(`select has_function_privilege('${role}','public.settle_season_four_gala_live_rewards(uuid[])','EXECUTE')`), false);
  }
  check(await scalar("select has_table_privilege('service_role','public.season_gala_live_reward_grants','SELECT')"), true);
  check(await scalar("select has_table_privilege('service_role','public.season_gala_live_reward_grants','INSERT')"), false);
  await denied(() => settle([]), /Liste vérifiée/);
  await denied(() => settle([id(10), null]), /Liste vérifiée/);
  await denied(() => settle(Array(501).fill(id(10))), /Liste vérifiée/);

  // An S5 collection with a different source must not receive S4 Gala prizes.
  const addEdition = (name, source) => db.query(`insert into public.cyclo_stickers_editions(edition_id,source_season_id,collection_season_id,snapshot_sha256,snapshot)
    values($1,$2,$3,repeat('a',64),'{}')`, [name, id(source), id(3)]);
  await addEdition('wrong-source-edition', 1);
  await denied(() => settle([id(10)]), /édition Cyclo-Stickers S4\/S5/);
  await db.exec("delete from public.cyclo_stickers_editions where edition_id='wrong-source-edition'");
  await addEdition(editionId, 2);

  for (const invalid of [13, 14, 15, 99]) {
    await denied(() => settle([id(10), id(invalid)]), /équipe active unique/);
    check(await count('public.season_gala_live_reward_grants'), 0);
    check(await count('public.team_equipment_inventory'), 0);
  }
  await db.exec(`create function public.reject_fixture_boosters() returns trigger language plpgsql as $$begin
    raise exception 'fixture booster failure'; end$$;
    create trigger reject_fixture_boosters before insert on public.cyclo_stickers_edition_boosters for each row execute function public.reject_fixture_boosters();`);
  await denied(() => settle([id(10), id(11)]), /fixture booster failure/);
  check(await count('public.season_gala_live_reward_grants'), 0);
  check(await count('public.team_equipment_inventory'), 0);
  check(await count('public.cyclo_stickers_edition_boosters'), 0);
  await db.exec('drop trigger reject_fixture_boosters on public.cyclo_stickers_edition_boosters');

  await db.exec('set role service_role');
  check(await settle([id(11), id(10), id(10)]), {
    verifiedParticipants: 2, newGrants: 2, alreadyGranted: 0, equipmentUnits: 2, boosterUnitsAdded: 4, albumEditionId: editionId,
  });
  check(await scalar('select array_agg(participant_name order by participant_name) from public.season_gala_live_reward_grants'), ['Spectateur B', 'Spectatrice A']);
  check(await settle([id(10), id(11)]), {
    verifiedParticipants: 2, newGrants: 0, alreadyGranted: 2, equipmentUnits: 0, boosterUnitsAdded: 0, albumEditionId: editionId,
  });
  await db.exec('reset role');
  check(await scalar('select sum(quantity)::int from public.team_equipment_inventory'), 2);
  check(await scalar(`select count(*)::int from public.cyclo_stickers_edition_boosters
    where acquisition_source='gala' and source_reference='grand-gala-s4-live-2026-11-06' and source_season_id=$1 and collection_season_id=$2`, [id(2), id(3)]), 4);

  // A previously delivered booster-only package still counts toward the quota.
  check(await scalar("select public.grant_cyclo_stickers_gala_boosters($1,$2::uuid[],'prior-fixture-receipt')", [editionId, [id(12)]]), 2);
  const completion = await settle([id(12)]);
  check([completion.equipmentUnits, completion.boosterUnitsAdded], [1, 0]);
  check(await count('public.cyclo_stickers_edition_boosters'), 6);
  check(await scalar('select sum(quantity)::int from public.team_equipment_inventory'), 3);

  // Account deduplication survives a director profile being detached/recreated.
  await db.query('update public.sporting_directors set auth_user_id=null where id=$1', [id(10)]);
  await viewer(16, 'Profil recréé', { account: 1010 });
  check((await settle([id(16)])).alreadyGranted, 1);
  check(await count('public.season_gala_live_reward_grants'), 3);
  check(await count('public.cyclo_stickers_edition_boosters'), 6);
  check(await scalar('select sum(quantity)::int from public.team_equipment_inventory'), 3);

  console.log(`${checks} isolated PostgreSQL Gala live checks passed. No production access.`);
} finally {
  await db.close();
}
