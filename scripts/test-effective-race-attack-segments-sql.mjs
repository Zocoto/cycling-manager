// Real preparation RPCs in isolated PostgreSQL/WASM. No live credentials,
// network connection, production fixture or gameplay mutation is used.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2] || 'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js';
if (!modulePath.replaceAll('\\', '/').endsWith('/pglite/dist/index.js')) throw Error('Pass an existing local PGlite module.');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const read = name => readFileSync(`supabase/migrations/${name}.sql`, 'utf8').replaceAll('\r\n', '\n');
const extractFunction = (source, name) => {
  const escapedName = name.replaceAll('.', '\\.');
  const match = new RegExp(`create(?: or replace)? function ${escapedName}\\(`, 'i').exec(source);
  assert.ok(match, `Missing real function ${name}`);
  return source.slice(match.index, source.indexOf('$$;', match.index) + 3);
};
const initial = read('20260808164000_create_race_preparations');
const availability = read('20260827130000_exclude_unavailable_riders_from_race_preparation');
const wildcard = read('20260918160000_prepare_pending_elite_wildcards');
const sprint = read('20261022200000_add_optional_ordered_sprint_trains');
const migration = read('20261027190000_validate_effective_race_attack_segments');
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const scalar = async (sql, args = []) => Object.values((await query(sql, args))[0])[0];
let checks = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks += 1; };
const rejects = async (operation, pattern, label) => { await assert.rejects(operation, pattern, label); checks += 1; };

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.auth_user_id', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated;
    create table public.sporting_directors(id uuid primary key, auth_user_id uuid);
    create table public.team_manager_assignments(sporting_director_id uuid, team_id uuid, role text, status text);
    create table public.race_categories(id uuid primary key, code text);
    create table public.race_editions(id uuid primary key, season_id uuid, race_category_id uuid);
    create table public.team_seasons(id uuid primary key, team_id uuid, season_id uuid);
    create table public.race_registrations(id uuid primary key, team_season_id uuid, race_edition_id uuid, status text, entry_method text);
    create table public.race_rosters(id uuid primary key default gen_random_uuid(), race_registration_id uuid, rider_id uuid, status text,
      unique(race_registration_id, rider_id));
    create table public.stages(id uuid primary key, race_edition_id uuid, stage_number integer, status text,
      departure_at timestamptz, distance_km numeric);
    create table public.stage_segments(id uuid primary key default gen_random_uuid(), stage_id uuid, segment_number integer, distance_km numeric,
      unique(stage_id, segment_number));
    create table public.official_stage_simulations(stage_id uuid primary key);
    create table public.stage_rider_unavailabilities(race_edition_id uuid, rider_id uuid);
    create table public.race_roster_stage_roles(race_registration_id uuid, rider_id uuid, stage_id uuid, race_role text, updated_at timestamptz,
      primary key(race_registration_id, rider_id, stage_id));
    create table public.race_stage_strategies(race_registration_id uuid, stage_id uuid, team_id uuid, objective text, collective_posture text,
      breakaway_policy text, chase_policy text, lieutenant_rider_id uuid, danger_pacer_rider_id uuid, protector_rider_id uuid,
      breakaway_rider_id uuid, attack_orders jsonb, updated_at timestamptz, sprint_train_order uuid[] not null default '{}',
      constraint race_stage_strategies_pkey primary key(race_registration_id, stage_id), unique(team_id, stage_id));
    insert into public.sporting_directors values('${id(1)}', '${id(101)}');
    insert into public.team_manager_assignments values('${id(1)}', '${id(11)}', 'general_manager', 'active');
    insert into public.race_categories values('${id(5)}', 'continental'), ('${id(6)}', 'elite');
    insert into public.race_editions values('${id(31)}', '${id(4)}', '${id(5)}'), ('${id(32)}', '${id(4)}', '${id(6)}');
    insert into public.team_seasons values('${id(12)}', '${id(11)}', '${id(4)}');
    insert into public.race_registrations values('${id(21)}', '${id(12)}', '${id(31)}', 'accepted', 'requested');
    insert into public.race_rosters(race_registration_id, rider_id, status) values
      ('${id(21)}', '${id(51)}', 'confirmed'), ('${id(21)}', '${id(52)}', 'confirmed'), ('${id(21)}', '${id(53)}', 'selected');
    insert into public.stages values
      ('${id(41)}', '${id(31)}', 1, 'planned', clock_timestamp() + interval '1 day', 204),
      ('${id(42)}', '${id(31)}', 2, 'planned', clock_timestamp() + interval '2 days', 40),
      ('${id(43)}', '${id(31)}', 3, 'planned', clock_timestamp() + interval '3 days', 204),
      ('${id(44)}', '${id(31)}', 4, 'planned', clock_timestamp() + interval '4 days', 204),
      ('${id(45)}', '${id(31)}', 5, 'planned', clock_timestamp() + interval '5 days', 204),
      ('${id(46)}', '${id(32)}', 1, 'planned', clock_timestamp() + interval '6 days', 204);
    insert into public.stage_segments(stage_id, segment_number, distance_km)
      select '${id(41)}', n, case when n = 19 then 10 else 12.5 end from generate_series(1, 19) n;
    insert into public.stage_segments(stage_id, segment_number, distance_km) values
      ('${id(42)}', 1, 25), ('${id(42)}', 2, 15),
      ('${id(43)}', 99, 1),
      ('${id(44)}', 1, 102.02), ('${id(44)}', 2, 102.02),
      ('${id(45)}', 1, 102.025), ('${id(45)}', 2, 102.025);
  `);

  await db.exec(extractFunction(initial, 'public.save_current_team_race_preparation'));
  // Execute the real canonical availability patch, without loading unrelated
  // readers/equipment routines or replacing authorization with test doubles.
  const declarationStart = availability.indexOf('declare\n');
  const bodyStart = availability.indexOf('begin\n  v_signature :=', declarationStart);
  const canonicalStart = availability.indexOf("  v_signature :=\n    'public.save_current_team_race_preparation(", bodyStart);
  const canonicalEnd = availability.indexOf('\n  v_signature :=', canonicalStart + 1);
  assert.ok(declarationStart >= 0 && bodyStart >= 0 && canonicalStart >= 0 && canonicalEnd > canonicalStart);
  await db.exec(`do $migration$\n${availability.slice(declarationStart, bodyStart)}begin\n${availability.slice(canonicalStart, canonicalEnd)}\nend;\n$migration$;`);
  await db.exec(extractFunction(wildcard, 'public.is_race_registration_preparable'));
  const beforeWildcard = await scalar("select pg_get_functiondef('public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)'::regprocedure)");
  assert.equal(beforeWildcard.split("registration.status = 'accepted'").length - 1, 1);
  await db.exec(beforeWildcard.replace("registration.status = 'accepted'", 'public.is_race_registration_preparable(registration.id)'));
  await db.exec(extractFunction(sprint, 'private.store_sprint_train_order'));
  await db.exec(extractFunction(sprint, 'public.save_current_team_race_preparation_with_sprint'));
  await db.exec(`
    revoke all on function public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb) from public, anon;
    revoke all on function private.store_sprint_train_order(uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
    revoke all on function public.save_current_team_race_preparation_with_sprint(uuid,uuid,jsonb,jsonb) from public, anon;
    grant execute on function public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb) to authenticated, service_role;
    grant execute on function public.save_current_team_race_preparation_with_sprint(uuid,uuid,jsonb,jsonb) to authenticated, service_role;
    select set_config('test.auth_user_id', '${id(101)}', false);
  `);

  const roles = [{ riderId: id(51), role: 'leadout' }, { riderId: id(52), role: 'sprinter' }, { riderId: id(53), role: 'domestique' }];
  const strategy = (segment, rider = id(53)) => ({
    objective: 'stage_win', collectivePosture: 'aggressive', breakawayPolicy: 'opportunistic', chasePolicy: 'dangerous_breakaway',
    attackOrders: [{ riderId: rider, segmentNumber: segment, intensity: 'strong', condition: 'always' }],
    sprintTrainOrder: [id(51)],
  });
  const save = (segment, options = {}) => query(
    `select * from public.${options.wrapper ? 'save_current_team_race_preparation_with_sprint' : 'save_current_team_race_preparation'}($1,$2,$3,$4)`,
    [options.edition ?? id(31), options.stage ?? id(41), JSON.stringify(options.roles ?? roles), JSON.stringify(options.strategy ?? strategy(segment, options.rider))],
  );
  const snapshot = () => query('select race_registration_id, stage_id, objective, collective_posture, attack_orders, sprint_train_order from public.race_stage_strategies order by stage_id');
  const unavailableMessage = /Un ordre d attaque vise un coureur ou un tronçon indisponible/;

  check((await query('select count(*)::integer n, max(segment_number) maximum, sum(distance_km)::integer km from public.stage_segments where stage_id=$1', [id(41)]))[0],
    { n: 19, maximum: 19, km: 235 }, 'Montferrato reproduction: stored 19 segments / 235 km for official 204 km');
  await rejects(() => save(20), unavailableMessage, 'old canonical validation reproduces rejection of effective segment 20');
  await rejects(() => save(21), unavailableMessage, 'old canonical validation reproduces rejection of effective segment 21');
  const wrapperHash = await scalar("select md5(pg_get_functiondef('public.save_current_team_race_preparation_with_sprint(uuid,uuid,jsonb,jsonb)'::regprocedure))");
  const canonicalBefore = await scalar("select pg_get_functiondef('public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)'::regprocedure)");
  await db.exec(migration);
  check(await scalar("select md5(pg_get_functiondef('public.save_current_team_race_preparation_with_sprint(uuid,uuid,jsonb,jsonb)'::regprocedure))"), wrapperHash, 'sprint wrapper itself unchanged');
  const canonicalAfter = await scalar("select pg_get_functiondef('public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)'::regprocedure)");
  check(canonicalAfter.split('stage_rider_unavailabilities').length, canonicalBefore.split('stage_rider_unavailabilities').length, 'all availability guards retained');
  check(canonicalAfter.includes('public.is_race_registration_preparable(registration.id)'), true, 'accepted / eligible pending wildcard gate retained');

  await db.exec('set role authenticated');
  check((await save(20))[0].updated_rider_count, 3, 'effective segment 20 saves for the authenticated owner');
  check((await save(21, { wrapper: true }))[0].updated_rider_count, 3, 'effective segment 21 saves through real sprint wrapper');
  await db.exec('reset role');
  check((await snapshot())[0].attack_orders[0].segmentNumber, 21, 'requested attack segment persists without remapping');
  check((await snapshot())[0].sprint_train_order, [id(51)], 'sprint order persists with attack plan');
  const persisted = await snapshot();
  const persistedRoles = await query('select * from public.race_roster_stage_roles order by stage_id, rider_id');
  await rejects(() => save(22, { wrapper: true, roles: roles.map(role => ({ ...role, role: 'domestique' })) }), unavailableMessage, 'segment after effective finish rejected');
  check(await snapshot(), persisted, 'rejected wrapper request preserves roles / attack / sprint plan atomically');
  check(await query('select * from public.race_roster_stage_roles order by stage_id, rider_id'), persistedRoles, 'rejected request does not apply otherwise valid new roles');

  const available = (stage, segment) => scalar('select private.is_effective_race_attack_segment_available($1,$2)', [stage, segment]);
  check(await available(id(42), 2), true, 'complete custom 25+15 km route preserves its second physical segment');
  check(await available(id(42), 3), false, 'complete custom route is not expanded into four fake segments');
  check(await available(id(43), 21), true, 'incomplete physical numbering uses effective generated finish');
  check(await available(id(43), 99), false, 'physical index 99 is not accepted on regenerated route');
  check(await available(id(44), 2), true, 'sum 204.04 stays within the JavaScript tolerance');
  check(await available(id(44), 3), false, 'sum 204.04 retains physical numbering');
  check(await available(id(45), 21), true, 'sum 204.05 follows double-precision fallback at the exact boundary');
  check(await available(id(45), 22), false, 'boundary fallback does not exceed the official distance');
  for (const segment of [null, 0, -1]) check(await available(id(41), segment), false, 'null/nonpositive effective index rejected');
  check(await available(null, 1), false, 'null stage rejected');
  check(await available(id(999), 1), false, 'unknown stage rejected');
  await rejects(() => save(3, { stage: id(42) }), unavailableMessage, 'canonical writer rejects fake segment on complete custom route');
  await save(2, { stage: id(42) });
  await rejects(() => save(99, { stage: id(43) }), unavailableMessage, 'canonical writer rejects stale physical segment on fallback route');

  await db.exec("select set_config('test.auth_user_id', '', false)");
  await rejects(() => save(21), /Vous devez être connecté/, 'authentication guard retained');
  await db.exec(`select set_config('test.auth_user_id', '${id(102)}', false)`);
  await rejects(() => save(21), /Aucune inscription acceptée/, 'another user cannot write another team plan');
  await db.exec(`select set_config('test.auth_user_id', '${id(101)}', false)`);
  await rejects(() => save(21, { rider: id(61) }), unavailableMessage, 'attack rider outside registration rejected');
  await db.exec(`insert into public.stage_rider_unavailabilities values('${id(31)}', '${id(53)}')`);
  await rejects(() => save(21, { roles: roles.slice(0, 2), rider: id(53) }), unavailableMessage, 'withdrawn rider remains unavailable even with otherwise valid roster');
  await rejects(() => save(21), /Le plan doit couvrir exactement les coureurs encore engagés/, 'stale full roster still rejected');
  await db.exec('delete from public.stage_rider_unavailabilities');
  await db.exec(`update public.race_rosters set status='withdrawn' where rider_id='${id(53)}'`);
  await rejects(() => save(21, { roles: roles.slice(0, 2), rider: id(53) }), unavailableMessage, 'unselected roster rider rejected');
  await db.exec(`update public.race_rosters set status='selected' where rider_id='${id(53)}'`);
  await rejects(() => save(21, { stage: id(46) }), /Cette étape est introuvable/, 'stage from another edition rejected');
  await db.exec(`update public.race_registrations set status='pending' where id='${id(21)}'`);
  await rejects(() => save(21), /Aucune inscription acceptée/, 'pending ordinary registration remains non-preparable');
  await db.exec(`update public.race_categories set code='elite' where id='${id(5)}'`);
  check((await save(21, { wrapper: true }))[0].updated_rider_count, 3, 'eligible pending Elite wildcard still accepts the same effective attack');
  await db.exec(`update public.race_registrations set entry_method='direct' where id='${id(21)}'`);
  await rejects(() => save(21), /Aucune inscription acceptée/, 'pending entry without a wildcard request remains forbidden');
  await db.exec(`update public.race_registrations set status='accepted', entry_method='requested' where id='${id(21)}';
    update public.race_categories set code='continental' where id='${id(5)}'`);
  await db.exec(`update public.stages set departure_at=clock_timestamp()-interval '1 minute' where id='${id(41)}'`);
  await rejects(() => save(21, { wrapper: true }), /Cette étape a déjà commencé/, 'departed stage remains immutable through sprint wrapper');
  await db.exec(`update public.stages set departure_at=clock_timestamp()+interval '1 day' where id='${id(41)}'; insert into public.official_stage_simulations values('${id(41)}')`);
  await rejects(() => save(21), /Cette étape a déjà commencé/, 'locked official simulation still blocks edits');
  await db.exec(`delete from public.official_stage_simulations; update public.stages set status='completed' where id='${id(41)}'`);
  await rejects(() => save(21), /Cette étape a déjà commencé/, 'completed stage still blocks edits');
  await db.exec(`update public.stages set status='planned' where id='${id(41)}'`);
  check((await query('select attack_orders, sprint_train_order from public.race_stage_strategies where stage_id=$1', [id(41)]))[0],
    { attack_orders: persisted[0].attack_orders, sprint_train_order: persisted[0].sprint_train_order }, 'all rejected saves leave original Montferrato attack and sprint intact');

  check(await scalar("select has_function_privilege('authenticated','private.is_effective_race_attack_segment_available(uuid,integer)','execute')"), false, 'helper not directly exposed to authenticated players');
  check(await scalar("select has_function_privilege('anon','public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)','execute')"), false, 'anonymous canonical writer still forbidden');
  check(await scalar("select has_function_privilege('authenticated','public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)','execute')"), true, 'authenticated writer grant retained');
  const beforeRetry = await snapshot();
  const canonicalHash = await scalar("select md5(pg_get_functiondef('public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)'::regprocedure))");
  await db.exec(migration);
  check(await snapshot(), beforeRetry, 'migration retry never rewrites preparation data');
  check(await scalar("select md5(pg_get_functiondef('public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)'::regprocedure))"), canonicalHash, 'migration retry leaves already-patched canonical function unchanged');
  console.log(JSON.stringify({ status: 'passed', checks, database: 'isolated PGlite', canonicalFunctions: 'real preparation writer, real availability patch, real sprint wrapper' }));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', message: error.message, code: error.code, where: error.where }));
  process.exitCode = 1;
} finally {
  await db.close();
}
