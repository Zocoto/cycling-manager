import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.EQUIPMENT_PARTNER_SQL_TEST_MODULE ?? '';
if (!isAbsolute(modulePath) || !modulePath.replaceAll('\\', '/').endsWith('/@electric-sql/pglite/dist/index.js')) {
  throw new Error('Use an absolute path to an isolated local PGlite installation.');
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const directorId = id(1);
const teamId = id(2);
const riderId = id(3);
const coreItemId = id(4);
const optionalItemId = id(5);
const seasonId = year => id(10 + year);
const teamSeasonId = year => id(20 + year);
const migration = name => readFileSync(
  new URL(`../supabase/migrations/${name}.sql`, import.meta.url),
  'utf8',
).replaceAll('\r', '');
const rows = async (sql, values = []) => (await db.query(sql, values)).rows;
const scalar = async (sql, values = []) => Object.values((await rows(sql, values))[0])[0];
const sign = key => scalar('select public.sign_equipment_partner_contract($1)', [key]);
const sync = () => db.exec('select public.sync_current_team_equipment_partner()');
const advance = async year => db.query(
  "update public.seasons set status = case when game_year < $1 then 'completed' when game_year = $1 then 'active' else 'planned' end",
  [year],
);
const currentAndPending = async () => ({
  current: await scalar('select count(*)::int from public.rider_equipment_assignments'),
  pending: await scalar('select count(*)::int from public.rider_equipment_pending_assignments'),
});
const addAssignments = () => db.exec(`
  insert into public.rider_equipment_assignments values ('${riderId}', '${coreItemId}');
  insert into public.rider_equipment_pending_assignments values ('${riderId}', '${coreItemId}');
`);
const addExtraAssignments = () => db.exec(`
  insert into public.rider_equipment_assignments values ('${riderId}', '${optionalItemId}');
  insert into public.rider_equipment_pending_assignments values ('${riderId}', '${optionalItemId}');
`);
const assertOnlyCoreAssignments = async () => {
  for (const table of ['rider_equipment_assignments', 'rider_equipment_pending_assignments']) {
    assert.deepEqual(await rows(`select equipment_item_id from public.${table}`), [{ equipment_item_id: coreItemId }]);
  }
};
const dashboard = () => scalar('select public.get_current_dashboard_assistant_summary()');

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table sporting_directors(id uuid, auth_user_id uuid, status text, reputation_points integer);
    create table team_manager_assignments(sporting_director_id uuid, team_id uuid, role text, status text);
    create table seasons(id uuid primary key, game_year integer, status text);
    create table team_seasons(id uuid, team_id uuid, season_id uuid);
    create table equipment_suppliers(supplier_key text, status text, supports_team_contract boolean);
    create table equipment_partner_contracts(
      id uuid primary key default gen_random_uuid(), team_id uuid, supplier_key text,
      start_season_id uuid, end_season_id uuid, status text default 'active',
      signed_at timestamptz default clock_timestamp(), completed_at timestamptz,
      constraint equipment_partner_contract_supplier_once unique(team_id,supplier_key)
    );
    create unique index equipment_partner_one_active_contract_per_team_idx
      on equipment_partner_contracts(team_id) where status='active';
    create table equipment_partner_products(supplier_key text, equipment_item_id uuid, offer_type text);
    create table equipment_catalog_items(id uuid, effect_payload jsonb, acquisition_channel text);
    create table equipment_partner_item_effects(contract_id uuid, equipment_item_id uuid, effect_payload jsonb);
    create table rider_contracts(rider_id uuid, team_id uuid, status text);
    create table rider_equipment_assignments(rider_id uuid, equipment_item_id uuid);
    create table rider_equipment_pending_assignments(rider_id uuid, equipment_item_id uuid);
    create table team_equipment_inventory(team_season_id uuid, equipment_item_id uuid);
    create function ensure_transfer_next_season(p_source uuid) returns uuid language sql as $$
      select target.id from public.seasons source
      join public.seasons target on target.game_year = source.game_year + 1
      where source.id = p_source
    $$;
    create function public.get_current_dashboard_assistant_summary() returns jsonb
    language sql stable security definer set search_path = '' as $$
      with current_context as (select '${teamId}'::uuid as team_id, '${directorId}'::uuid as sporting_director_id)
      select jsonb_build_object(
      'nextSeasonRosterProjection', (
        select 'fixture preserved'::text
      ));
    $$;
    insert into sporting_directors values('${directorId}','${directorId}','active',200);
    insert into team_manager_assignments values('${directorId}','${teamId}','general_manager','active');
    insert into seasons values
      ${Array.from({ length: 6 }, (_, index) =>
        `('${seasonId(index + 1)}', ${index + 1}, '${index === 0 ? 'active' : 'planned'}')`).join(', ')};
    insert into team_seasons values
      ${Array.from({ length: 6 }, (_, index) =>
        `('${teamSeasonId(index + 1)}', '${teamId}', '${seasonId(index + 1)}')`).join(', ')};
    insert into equipment_suppliers values('A','active',true),('B','active',false),('C','retired',true);
    insert into equipment_catalog_items values
      ('${coreItemId}', '{"ratingBonuses":{"mountain":2}}', 'equipment_partner'),
      ('${optionalItemId}', '{"ratingBonuses":{"sprint":1}}', 'equipment_partner');
    insert into equipment_partner_products values
      ('A', '${coreItemId}', 'core'), ('A', '${optionalItemId}', 'optional');
    insert into rider_contracts values('${riderId}', '${teamId}', 'active');
  `);

  await db.exec(migration('20261010090000_allow_equipment_partner_return'));
  const syncSource = migration('20260812160000_rework_equipment_partner_system');
  const syncStart = syncSource.indexOf('create or replace function public.sync_current_team_equipment_partner()');
  const syncEnd = syncSource.indexOf('$$;', syncStart);
  assert.ok(syncStart >= 0 && syncEnd > syncStart);
  await db.exec(syncSource.slice(syncStart, syncEnd + 3));

  // Load the exact equipment part of the rollover without unrelated game tables.
  const rolloverSource = migration('20260811130000_implement_atomic_season_rollover');
  const rolloverStart = rolloverSource.indexOf('  -- Partner equipment contracts are inclusive of end_season_id.');
  const rolloverEnd = rolloverSource.indexOf('  insert into public.team_equipment_inventory', rolloverStart);
  assert.ok(rolloverStart >= 0 && rolloverEnd > rolloverStart);
  await db.exec(`
    create function public.rollover_game_season(p_target_season_id uuid, p_force boolean) returns jsonb
    language plpgsql security definer set search_path = '' as $$
    declare v_target public.seasons%rowtype;
    begin
      select * into strict v_target from public.seasons where id = p_target_season_id;
      ${rolloverSource.slice(rolloverStart, rolloverEnd)}
      return jsonb_build_object('gameYear', v_target.game_year);
    end;
    $$;
  `);
  await db.exec(migration('20260908103000_add_equipment_partner_dashboard_alert'));
  await db.exec(`
    revoke execute on function public.sign_equipment_partner_contract(text) from public, anon;
    grant execute on function public.sign_equipment_partner_contract(text) to authenticated, service_role;
  `);
  await scalar("select set_config('request.jwt.claim.sub', $1, false)", [directorId]);

  const initial = await sign('A');
  await db.query(
    'insert into equipment_partner_item_effects select $1, id, effect_payload from equipment_catalog_items where id = $2',
    [initial, optionalItemId],
  );
  await addAssignments();
  await addExtraAssignments();
  await assert.rejects(sign('A'), /déjà en cours/);
  await advance(2);
  await sync();
  assert.deepEqual(await currentAndPending(), { current: 2, pending: 2 });
  await advance(3);
  await sync();
  assert.deepEqual(await currentAndPending(), { current: 0, pending: 0 });
  await assert.rejects(sign('A'), /changer d’équipementier/);
  assert.equal((await dashboard()).equipmentPartnerSignatureAvailable, false);

  await db.exec(migration('20261111190000_allow_equipment_partner_renewal'));
  assert.deepEqual(await dashboard(), {
    equipmentPartnerSignatureAvailable: true,
    nextSeasonRosterProjection: 'fixture preserved',
  });
  assert.equal(await scalar("select has_function_privilege('anon', 'public.sign_equipment_partner_contract(text)', 'execute')"), false);
  assert.equal(await scalar("select has_function_privilege('authenticated', 'public.sign_equipment_partner_contract(text)', 'execute')"), true);
  await scalar("select set_config('request.jwt.claim.sub', $1, false)", [id(999)]);
  await assert.rejects(sign('A'), /Aucune équipe active/);
  await scalar("select set_config('request.jwt.claim.sub', $1, false)", [directorId]);
  await db.exec('update sporting_directors set reputation_points = 199');
  assert.equal((await dashboard()).equipmentPartnerSignatureAvailable, false);
  await assert.rejects(sign('A'), /200 points/);
  await db.exec('update sporting_directors set reputation_points = 200');
  await assert.rejects(sign('B'), /ne propose pas de contrat/);
  await assert.rejects(sign('C'), /ne propose pas de contrat/);
  await db.exec(`update equipment_catalog_items set effect_payload = '{"ratingBonuses":{"mountain":3}}' where id = '${coreItemId}';`);

  await db.exec('begin');
  await db.exec('set role authenticated');
  const renewal = await sign('A');
  const holdsTeamLock = await scalar(
    "select exists (select 1 from pg_locks where pid = pg_backend_pid() and locktype = 'advisory' and mode = 'ExclusiveLock' and granted)",
  );
  assert.equal(holdsTeamLock, true);
  await db.exec('reset role');
  await db.exec('commit');

  assert.notEqual(renewal, initial);
  assert.deepEqual(await rows(
    'select supplier_key, start_season_id, end_season_id, status from equipment_partner_contracts order by signed_at, id',
  ), [
    { supplier_key: 'A', start_season_id: seasonId(1), end_season_id: seasonId(2), status: 'completed' },
    { supplier_key: 'A', start_season_id: seasonId(3), end_season_id: seasonId(4), status: 'active' },
  ]);
  assert.deepEqual(await rows(
    'select effect_payload from equipment_partner_item_effects where contract_id = $1 and equipment_item_id = $2',
    [renewal, coreItemId],
  ), [{ effect_payload: { ratingBonuses: { mountain: 3 } } }]);
  assert.equal(await scalar('select count(*)::int from equipment_partner_item_effects where contract_id = $1', [renewal]), 1);
  assert.deepEqual(await scalar(
    'select effect_payload from equipment_partner_item_effects where contract_id = $1 and equipment_item_id = $2',
    [initial, coreItemId],
  ), { ratingBonuses: { mountain: 2 } });
  await assert.rejects(sign('A'), /déjà en cours/);
  await db.exec("update equipment_suppliers set supports_team_contract = true where supplier_key = 'B'");
  await assert.rejects(sign('B'), /déjà en cours/);
  await assert.rejects(db.query(
    "insert into equipment_partner_contracts(team_id,supplier_key,start_season_id,end_season_id) values ($1,'A',$2,$3)",
    [teamId, seasonId(3), seasonId(4)],
  ), /equipment_partner_one_active_contract_per_team_idx/);
  assert.equal((await dashboard()).equipmentPartnerSignatureAvailable, false);

  await addAssignments();
  await addExtraAssignments();
  await sync();
  await assertOnlyCoreAssignments();
  await addExtraAssignments();
  assert.deepEqual(await scalar('select public.rollover_game_season($1, false)', [seasonId(4)]), { gameYear: 4 });
  await assertOnlyCoreAssignments();
  await db.query(
    'insert into equipment_partner_item_effects select $1, id, effect_payload from equipment_catalog_items where id = $2',
    [renewal, optionalItemId],
  );
  await addExtraAssignments();
  await sync();
  assert.deepEqual(await currentAndPending(), { current: 2, pending: 2 });
  await scalar('select public.rollover_game_season($1, false)', [seasonId(4)]);
  assert.deepEqual(await currentAndPending(), { current: 2, pending: 2 });
  await advance(4);
  await sync();
  assert.deepEqual(await currentAndPending(), { current: 2, pending: 2 });
  await scalar('select public.rollover_game_season($1, false)', [seasonId(5)]);
  assert.deepEqual(await currentAndPending(), { current: 0, pending: 0 });
  assert.equal(await scalar('select status from equipment_partner_contracts where id = $1', [renewal]), 'completed');
  await advance(5);
  assert.equal((await dashboard()).equipmentPartnerSignatureAvailable, true);
  assert.ok(await sign('B'));
  console.log('PASS: consecutive two-season renewal, access and serialization, current effects, sync and rollover cleanup, and dashboard eligibility.');
} finally {
  await db.close();
}
