// Isolated PostgreSQL fixtures only. No HTTP, credentials or production data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const modulePath = process.argv[2]?.replaceAll('\\', '/');
if (!modulePath?.endsWith('/pglite/dist/index.js')) throw Error('Isolated PGlite module required');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = '58140add-54c6-40af-9528-f823d0051d0f';
const gouille = 'ee244935-5722-4626-a28f-dc3cf63aa6f4';
const ordinary = id(42);
const source = readFileSync('supabase/migrations/20261121121547_wire_season_five_gala_registrations.sql', 'utf8');
const catalog = JSON.parse(readFileSync('lib/game/season-five-gala-profiles.json', 'utf8'));
const courses = { 'pro-tour': ['pt-zoncolan', 'pt-liege', 'pt-flanders'], continental: ['ct-alpe', 'ct-fleche', 'ct-hamburg'] };
const own = Array.from({ length: 7 }, (_, i) => id(100 + i));
const selections = (program = 'pro-tour', riders = own, all = false) => Object.fromEntries(courses[program].map((course, i) => [course, i === 0 || all ? riders : []]));
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
let checks = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const denied = async (sql, args = [], pattern) => { await assert.rejects(() => db.query(sql, args), pattern); checks++; };
const login = uid => db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid ?? '']);
const save = (program, selection, previous = null) => scalar('select public.save_current_season_five_gala_registration($1,$2::jsonb,$3)', [program, JSON.stringify(selection), previous]);
const context = () => scalar('select public.get_current_season_five_gala_context()');
const entryCount = () => scalar('select count(*)::int from season_gala_entries');
const lineup = (entry, course) => scalar("select coalesce(jsonb_agg(rider_id order by position),'[]') from season_gala_entry_riders where entry_id=$1 and event_key=$2", [entry, course]);

try {
  await db.exec(`
    create schema auth; create schema private;
    create role anon; create role authenticated; create role service_role bypassrls;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table seasons(id uuid primary key,game_year int unique,status text);
    create table teams(id uuid primary key,status text);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,display_name text);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table team_manager_assignments(id uuid primary key,team_id uuid,sporting_director_id uuid,role text,status text,start_season_id uuid,end_season_id uuid);
    create table riders(id uuid primary key,first_name text,last_name text,status text);
    create table rider_season_ratings(rider_id uuid,season_id uuid,age smallint,mountain numeric,hills numeric,flat numeric,time_trial numeric,cobbles numeric,sprint numeric,
      acceleration numeric,downhill numeric,endurance numeric,resistance numeric,recovery numeric,breakaway numeric,prologue numeric,primary key(rider_id,season_id));
    create table rider_contracts(id uuid primary key,rider_id uuid,team_id uuid,start_season_id uuid,end_season_id uuid,left_season_id uuid,status text,joined_day_number int,signed_at timestamptz);
    create index fixture_contract_team on rider_contracts(team_id);
    create index fixture_contract_rider on rider_contracts(rider_id);
    create table sponsors(id uuid primary key,name text,catalog_key text);
    create table team_sponsor_contracts(id uuid primary key,team_id uuid,sponsor_id uuid,start_season_id uuid,contract_duration_seasons int,role text,status text,created_at timestamptz,
      selected_jersey_id text,selected_jersey_style text,pending_jersey_season_id uuid,pending_jersey_id text,pending_jersey_style text);
    create table secondary_sponsor_catalog(id uuid primary key,name text);
    create table secondary_sponsor_contracts(id uuid primary key,team_id uuid,season_id uuid,secondary_sponsor_id uuid,status text);
    -- Legacy edition and gameplay sentinels must remain byte-for-byte unchanged.
    create table season_gala_registrations(id uuid,season_id uuid,team_id uuid,program text);
    create table season_gala_registration_riders(registration_id uuid,profile text,rider_id uuid,position int);
    create table season_gala_result_imports(event_key text,season_id uuid,results jsonb);
    create function get_current_season_four_gala_context() returns jsonb language sql as $$select '{"legacy":true}'::jsonb$$;
    create table untouched_game(form int,morale int,cash int,points int); insert into untouched_game values(73,81,125000,150);
    insert into seasons values('${id(1)}',4,'completed'),('${id(2)}',5,'active'),('${id(3)}',6,'planned');
    insert into auth.users values('${owner}'),('${gouille}'),('${ordinary}');
    insert into season_gala_registrations values('${id(900)}','${id(1)}','${id(10)}','world-tour');
    insert into season_gala_registration_riders values('${id(900)}','mountain','${id(100)}',1);
    insert into season_gala_result_imports values('world-tour:mountain','${id(1)}','[{"rank":1}]');
  `);
  const legacy = (await db.query('select * from season_gala_result_imports')).rows;
  const legacyFunction = await scalar("select pg_get_functiondef('get_current_season_four_gala_context()'::regprocedure)");
  for (const [team, uid, riderStart] of [[10, owner, 100], [11, gouille, 120], [12, ordinary, 140]]) {
    await db.exec(`
      insert into teams values('${id(team)}','active');
      insert into team_seasons values('${id(team + 10)}','${id(team)}','${id(2)}','Club ${team}');
      insert into sporting_directors values('${id(team + 20)}','${uid}','active');
      insert into team_manager_assignments values('${id(team + 50)}','${id(team)}','${id(team + 20)}','general_manager','active','${id(2)}',null);
    `);
    for (let i = 0; i < 9; i++) {
      const rider = riderStart + i;
      await db.exec(`
        insert into riders values('${id(rider)}','Rider','${rider}','active');
        insert into rider_season_ratings values('${id(rider)}','${id(2)}',25,70,70,70,70,70,70,65,65,65,65,65,65,65);
        insert into rider_contracts values('${id(rider + 1000)}','${id(rider)}','${id(team)}','${id(2)}','${id(3)}',null,'active',1,now());
      `);
    }
  }
  await db.exec(`
    insert into sponsors values('${id(700)}','Old sponsor','old'),('${id(701)}','Future sponsor','future');
    insert into team_sponsor_contracts values
      ('${id(710)}','${id(10)}','${id(700)}','${id(2)}',1,'principal','active',now(),'old-kit','old',null,null,null),
      ('${id(711)}','${id(10)}','${id(701)}','${id(3)}',1,'principal','planned',now(),'base-kit','base','${id(3)}','future-kit','future-style');
    insert into secondary_sponsor_catalog values('${id(720)}','Future secondary');
    insert into secondary_sponsor_contracts values('${id(721)}','${id(10)}','${id(3)}','${id(720)}','planned');
  `);
  await db.exec(source);
  await db.exec(source); // Reapplication must never duplicate or reopen an edition.
  check(await scalar('select count(*)::int from season_gala_editions'), 1);
  check(await scalar("select registration_closes_at=timestamptz '2026-12-04 11:00Z' from season_gala_editions"), true);
  check(await scalar("select visibility from season_gala_editions"), 'private');
  check(await scalar('select count(*)::int from season_gala_events'), 6);
  const eventRows = (await db.query('select event_key,pcm_race_id,pcm_stage_id,stage_file,startlist_filename,native_capacity,native_min_riders,native_max_riders,min_riders,max_riders from season_gala_events order by event_key')).rows;
  for (const event of eventRows) {
    const expected = catalog.courses[event.event_key];
    check(event.pcm_race_id, expected.pcmRaceId);
    check(event.pcm_stage_id, expected.pcmStageId);
    check(event.stage_file, expected.stageFile);
    check(event.startlist_filename, expected.startlistFilename);
    check([event.native_capacity, event.native_min_riders, event.native_max_riders], [expected.nativeCapacity, expected.nativeMinRiders, expected.nativeMaxRiders]);
    check([event.min_riders, event.max_riders], [7, 8]);
  }
  for (const field of ['pcm_race_id', 'pcm_stage_id', 'startlist_filename', 'stage_file']) check(new Set(eventRows.map(event => event[field])).size, 6);
  for (const table of ['season_gala_editions', 'season_gala_events', 'season_gala_entries', 'season_gala_entry_admissions', 'season_gala_entry_riders']) {
    check(await scalar('select relrowsecurity from pg_class where oid=$1::regclass', [table]), true);
    for (const role of ['anon', 'authenticated']) {
      for (const privilege of ['select', 'insert', 'update', 'delete']) check(await scalar('select has_table_privilege($1,$2,$3)', [role, table, privilege]), false);
    }
  }
  for (const fn of ['get_current_season_five_gala_context()', 'save_current_season_five_gala_registration(text,jsonb,text)', 'withdraw_current_season_five_gala_registration()']) {
    check(await scalar('select has_function_privilege($1,$2,$3)', ['anon', fn, 'execute']), false);
    check(await scalar('select has_function_privilege($1,$2,$3)', ['authenticated', fn, 'execute']), true);
  }
  for (const fn of ['private.current_season_five_gala_team()', 'private.season_five_gala_roster(uuid,uuid)', 'private.season_five_gala_can_access(uuid)']) {
    check(await scalar('select has_function_privilege($1,$2,$3)', ['authenticated', fn, 'execute']), false);
  }
  // Isolated, relative clock so these checks remain executable in later years.
  await db.exec("update season_gala_editions set registration_opens_at=now()-interval '1 hour',registration_closes_at=now()+interval '1 day'");
  await login(null);
  await denied('select get_current_season_five_gala_context()', [], /Authentification/);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,null)', ['pro-tour', JSON.stringify(selections())], /Authentification/);
  await denied('select withdraw_current_season_five_gala_registration()', [], /Authentification/);
  await login(ordinary);
  await denied('select get_current_season_five_gala_context()', [], /réservé/);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,null)', ['pro-tour', JSON.stringify(selections('pro-tour', own.map((_, i) => id(140 + i))))], /réservé/);
  await denied('select withdraw_current_season_five_gala_registration()', [], /réservé/);
  await login(owner);
  const initial = await context();
  check(initial.isOpen, true);
  check(initial.program, null);
  check(initial.selections, {});
  check(initial.targetGameYear, 6);
  check(initial.sourceSeasonId, id(2));
  check(initial.team, { id: id(10), name: 'Club 10', futureName: 'Future sponsor - Future secondary', identityReady: true, jerseyId: 'future-kit', jerseyStyle: 'future-style', sponsorCatalogKey: 'future' });
  check(initial.riders.length, 9);
  check(initial.riders.some(rider => rider.rider_id === id(120)), false);
  check(initial.riders.every(rider => rider.continental_eligible && !rider.frozen_admission), true);
  check(initial.courseCounts, Object.fromEntries(Object.keys(catalog.courses).map(key => [key, 0])));
  for (const invalid of [null, [], '', { ...selections(), extra: [] }, { 'pt-zoncolan': own }, { ...selections(), 'pt-zoncolan': null }, { ...selections(), 'pt-zoncolan': own.slice(0, 6) }, { ...selections(), 'pt-zoncolan': Array(7).fill(own[0]) }, { ...selections(), 'pt-zoncolan': Array(7).fill('not-a-uuid') }, { ...selections(), 'pt-zoncolan': [...own.slice(1), null] }, { ...selections(), 'pt-zoncolan': [...own.slice(1), 123] }, { ...selections(), 'pt-zoncolan': [...own.slice(1), own] }, selections('pro-tour', []), selections('continental')]) {
    await denied('select save_current_season_five_gala_registration($1,$2::jsonb,null)', ['pro-tour', JSON.stringify(invalid)]);
  }
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,null)', ['world-tour', JSON.stringify(selections())], /Programme/);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,null)', ['pro-tour', JSON.stringify(selections('pro-tour', [...own.slice(1), id(120)]))], /hors effectif/);
  check(await entryCount(), 0);
  await db.exec('set role authenticated');
  const entry = await save('pro-tour', selections());
  await db.exec('reset role');
  check(await entryCount(), 1);
  check(await lineup(entry, 'pt-zoncolan'), own);
  check(await lineup(entry, 'pt-liege'), []);
  check((await context()).selections, selections());
  check((await context()).courseCounts['pt-zoncolan'], 1);
  check((await context()).courseCounts['pt-liege'], 0);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,null)', ['pro-tour', JSON.stringify(selections())], /catégorie/);
  check(await save('pro-tour', selections('pro-tour', own, true), 'pro-tour'), entry);
  check(await scalar('select count(*)::int from season_gala_entry_riders where entry_id=$1', [entry]), 21);
  check(await scalar('select count(*)::int from season_gala_entry_admissions where entry_id=$1', [entry]), 7);
  await db.exec(`update rider_season_ratings set hills=75.001 where rider_id='${own[0]}';`);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['continental', JSON.stringify(selections('continental')), 'pro-tour'], /75 maximum/);
  check((await context()).program, 'pro-tour');
  check(await scalar('select count(*)::int from season_gala_entry_riders where entry_id=$1', [entry]), 21);
  await db.exec(`update rider_season_ratings set hills=75 where rider_id='${own[0]}';`);
  check(await save('continental', selections('continental'), 'pro-tour'), entry);
  check(await lineup(entry, 'pt-zoncolan'), []);
  check(await lineup(entry, 'ct-alpe'), own);
  check((await context()).riders.filter(rider => rider.frozen_admission).length, 7);
  await db.exec(`update rider_season_ratings set hills=76 where rider_id='${own[0]}';`);
  const progressed = (await context()).riders.find(rider => rider.rider_id === own[0]);
  check([progressed.hills, progressed.continental_eligible, progressed.frozen_admission], [76, true, true]);
  check(await save('continental', selections('continental', own, true), 'continental'), entry);
  check(await scalar("select primary_snapshot->>'hills' from season_gala_entry_admissions where entry_id=$1 and rider_id=$2", [entry, own[0]]), '75');
  check(Number(await scalar('select hills from rider_season_ratings where rider_id=$1', [own[0]])), 76);
  await db.exec(`update rider_season_ratings set mountain=76 where rider_id='${id(107)}';`);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['continental', JSON.stringify(selections('continental', [...own, id(107)], true)), 'continental'], /75 maximum/);
  check(await scalar('select count(*)::int from season_gala_entry_riders where entry_id=$1', [entry]), 21);
  await db.exec(`update rider_season_ratings set mountain=75 where rider_id='${id(107)}';`);
  check(await save('continental', selections('continental', [...own, id(107)], true), 'continental'), entry);
  check(await scalar('select count(*)::int from season_gala_entry_riders where entry_id=$1', [entry]), 24);
  check(await scalar('select count(*)::int from season_gala_entry_admissions where entry_id=$1', [entry]), 8);
  // A later S5 club change still excludes an admitted rider; snapshots do not
  // bypass membership or allow a new over-cap rider.
  await db.exec(`insert into rider_contracts values('${id(9999)}','${own[0]}','${id(11)}','${id(2)}','${id(3)}',null,'active',15,now());`);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['continental', JSON.stringify(selections('continental')), 'continental'], /hors effectif/);
  check((await context()).riders.some(rider => rider.rider_id === own[0]), false);
  await db.exec(`delete from rider_contracts where id='${id(9999)}';`);
  await denied(`insert into season_gala_entries(edition_id,auth_user_id,team_id,program) select edition_id,auth_user_id,$1,'pro-tour' from season_gala_entries where id=$2`, [id(11), entry], /unique/i);
  await denied(`insert into season_gala_entries(edition_id,auth_user_id,team_id,program) select edition_id,$1,team_id,'pro-tour' from season_gala_entries where id=$2`, [gouille, entry], /unique/i);
  await denied(`insert into season_gala_entry_riders(entry_id,edition_id,event_key,program,rider_id,position) select id,edition_id,'pt-liege','continental',$1,1 from season_gala_entries where id=$2`, [own[0], entry], /foreign key/i);
  await denied(`insert into season_gala_entry_riders(entry_id,edition_id,event_key,program,rider_id,position) select id,edition_id,'pt-liege','pro-tour',$1,1 from season_gala_entries where id=$2`, [own[0], entry], /foreign key/i);
  await denied(`update season_gala_events set startlist_filename='top_giro.xml' where event_key='pt-liege'`, [], /unique/i);
  // A DS changing to another team cannot create a second entry, even if their
  // new assignment is otherwise valid.
  await db.exec(`
    insert into teams values('${id(13)}','active');
    insert into team_seasons values('${id(23)}','${id(13)}','${id(2)}','Other club');
    update team_manager_assignments set team_id='${id(13)}' where id='${id(60)}';
  `);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['pro-tour', JSON.stringify(selections()), 'continental'], /autre équipe/);
  await db.exec(`update team_manager_assignments set team_id='${id(10)}' where id='${id(60)}';`);
  // Same observed state from two tabs: one atomic change wins and the stale
  // second request is rejected, leaving a single category and entry.
  const raced = await Promise.allSettled([
    save('pro-tour', selections(), 'continental'),
    save('continental', selections('continental'), 'continental'),
  ]);
  check(raced.map(result => result.status), ['fulfilled', 'rejected']);
  check(await entryCount(), 1);
  check((await context()).program, 'pro-tour');
  check(await scalar('select count(distinct program)::int from season_gala_entry_riders where entry_id=$1', [entry]), 1);
  // Switching out of Continental removes its old frozen admissions.
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['continental', JSON.stringify(selections('continental')), 'pro-tour'], /75 maximum/);
  // Publication is an edition flag, not a way to bypass ownership.
  await db.exec("update season_gala_editions set visibility='public'");
  await login(ordinary);
  const outsider = own.map((_, i) => id(140 + i));
  const ordinaryEntry = await save('pro-tour', selections('pro-tour', outsider));
  check((await context()).team.id, id(12));
  check(await entryCount(), 2);
  check(await lineup(ordinaryEntry, 'pt-zoncolan'), outsider);
  await login(gouille);
  check((await context()).team.id, id(11));
  check((await context()).program, null);
  check((await context()).riders.some(rider => rider.rider_id === own[0]), false);
  await login(owner);
  // Source-season completion on S6 J1 must not close before 4 December noon.
  await db.exec(`update seasons set status='completed' where game_year=5; update seasons set status='active' where game_year=6;`);
  check((await context()).isOpen, true);
  check(await save('pro-tour', selections(), 'pro-tour'), entry);
  for (const closedUpdate of [
    "update season_gala_editions set status='draft'",
    "update season_gala_editions set status='closed'",
    "update season_gala_editions set status='open',registration_opens_at=now()+interval '1 hour',registration_closes_at=now()+interval '1 day'",
    "update season_gala_editions set registration_opens_at=now()-interval '2 hours',registration_closes_at=now()-interval '1 hour'",
  ]) {
    await db.exec(closedUpdate);
    check((await context()).isOpen, false);
    await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['pro-tour', JSON.stringify(selections()), 'pro-tour'], /closes/);
    await denied('select withdraw_current_season_five_gala_registration()', [], /closes/);
  }
  await db.exec("update season_gala_editions set status='open',registration_opens_at=now()-interval '1 hour',registration_closes_at=now()+interval '1 day'");
  await db.exec("update seasons set status='cancelled' where game_year=5");
  check((await context()).isOpen, false);
  await denied('select withdraw_current_season_five_gala_registration()', [], /closes/);
  await db.exec("update seasons set status='completed' where game_year=5");
  await db.query('select withdraw_current_season_five_gala_registration()');
  check(await entryCount(), 1);
  check(await scalar('select count(*)::int from season_gala_entry_riders where entry_id=$1', [entry]), 0);
  check(await scalar('select count(*)::int from season_gala_entry_admissions where entry_id=$1', [entry]), 0);
  check(await lineup(ordinaryEntry, 'pt-zoncolan'), outsider);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,null)', ['continental', JSON.stringify(selections('continental'))], /75 maximum/);
  check((await db.query('select * from untouched_game')).rows, [{ form: 73, morale: 81, cash: 125000, points: 150 }]);
  check((await db.query('select * from season_gala_result_imports')).rows, legacy);
  check(await scalar("select pg_get_functiondef('get_current_season_four_gala_context()'::regprocedure)"), legacyFunction);
  check(await scalar('select count(*)::int from season_gala_registrations'), 1);
  check(await scalar('select count(*)::int from season_gala_registration_riders'), 1);
  // Compile and execute the real deployment-receipt SELECT builders locally.
  // Only the three read-only builder functions enter this sandbox. Imports,
  // CLI execution and the live installer entrypoint are never evaluated.
  await db.exec(`create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);`);
  const applySource = readFileSync('scripts/apply-reviewed-season-five-gala-registration-migration.mjs', 'utf8');
  const applyAst = ts.createSourceFile('installer.mjs', applySource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const receiptQueries = [];
  const recipe = {};
  for (const statement of applyAst.statements) {
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (['version', 'featureTables', 'publicFunctions', 'oldFunctions', 'quote', 'rowsOf', 'bounded'].includes(declaration.name.getText(applyAst))) {
        recipe[declaration.name.getText(applyAst)] = `const ${declaration.getText(applyAst)};`;
      }
    }
    if (ts.isFunctionDeclaration(statement) && ['inspect', 'inspectFeature'].includes(statement.name?.text)) recipe[statement.name.text] = statement.getText(applyAst);
  }
  const safeContext = vm.createContext({ query: (statement, label) => { receiptQueries.push({ statement, label }); return [{}]; } });
  vm.runInContext(['version', 'featureTables', 'publicFunctions', 'oldFunctions', 'quote', 'rowsOf', 'bounded', 'inspect', 'inspectFeature'].map(key => recipe[key]).join('\n')
    + "\ninspect('local-before');inspectFeature('local-feature');", safeContext, { timeout: 1000 });
  check(receiptQueries.length, 2);
  for (const query of receiptQueries) {
    const results = await db.exec(query.statement);
    const row = results.flatMap(result => result.rows ?? [])[0];
    check(row.database_ok ?? row.correct_private_s5_editions, query.label === 'local-before' ? 1 : 0);
    if (query.label === 'local-before') {
      check(row.recorded, false);
      check(row.feature_table_count, 5);
      check(row.source_season_count, 1);
      check(row.s4_registration_count, 1);
    } else {
      check(row.matching_verified_events, 6);
      check(row.event_count, 6);
      check(row.rls_tables, 5);
      check(row.raw_access_denied, true);
      check(row.rpc_permissions_correct, true);
      check(row.helpers_private, true);
    }
  }
  console.log(`${checks} isolated S5 gala PostgreSQL checks passed; no production fixtures.`);
} finally { await db.close(); }
