// Isolated PostgreSQL fixtures only. No HTTP, credentials or production calls.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

if (!process.argv[2]?.replaceAll('\\', '/').endsWith('/pglite/dist/index.js')) throw Error('Isolated PGlite module required');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = '58140add-54c6-40af-9528-f823d0051d0f';
const gouille = 'ee244935-5722-4626-a28f-dc3cf63aa6f4';
const base = readFileSync('supabase/migrations/20261121121547_wire_season_five_gala_registrations.sql', 'utf8');
const swap = readFileSync('supabase/migrations/20261121124531_swap_private_s5_gala_sprint_and_cobbles.sql', 'utf8');
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
async function deniedMigration(pattern) {
  await assert.rejects(() => db.exec(swap), pattern);
  await db.exec('rollback');
  checks++;
}
const denied = async (sql, args, pattern) => { await assert.rejects(() => db.query(sql, args), pattern); checks++; };
const login = uid => db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid ?? '']);
const context = () => scalar('select get_current_season_five_gala_context()');
const ids = team => Array.from({ length: 7 }, (_, index) => id(team === 10 ? 100 + index : 120 + index));

try {
  await db.exec(`
    create schema auth; create schema private; create role anon; create role authenticated; create role service_role bypassrls;
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
    create table sponsors(id uuid primary key,name text,catalog_key text);
    create table team_sponsor_contracts(id uuid primary key,team_id uuid,sponsor_id uuid,start_season_id uuid,contract_duration_seasons int,role text,status text,created_at timestamptz,
      selected_jersey_id text,selected_jersey_style text,pending_jersey_season_id uuid,pending_jersey_id text,pending_jersey_style text);
    create table secondary_sponsor_catalog(id uuid primary key,name text);
    create table secondary_sponsor_contracts(id uuid primary key,team_id uuid,season_id uuid,secondary_sponsor_id uuid,status text);
    create table season_gala_registrations(id uuid,season_id uuid,team_id uuid,program text);
    create table untouched_game(form int,morale int,cash int,points int); insert into untouched_game values(73,81,125000,150);
    insert into seasons values('${id(1)}',4,'completed'),('${id(2)}',5,'active'),('${id(3)}',6,'planned');
    insert into auth.users values('${owner}'),('${gouille}');
    insert into season_gala_registrations values('${id(900)}','${id(1)}','${id(10)}','world-tour');
  `);
  for (const [team, uid, riderStart] of [[10, owner, 100], [11, gouille, 120]]) {
    await db.exec(`
      insert into teams values('${id(team)}','active');
      insert into team_seasons values('${id(team + 10)}','${id(team)}','${id(2)}','Club ${team}');
      insert into sporting_directors values('${id(team + 20)}','${uid}','active');
      insert into team_manager_assignments values('${id(team + 50)}','${id(team)}','${id(team + 20)}','general_manager','active','${id(2)}',null);
    `);
    for (let i = 0; i < 8; i++) {
      const rider = riderStart + i;
      await db.exec(`
        insert into riders values('${id(rider)}','Rider','${rider}','active');
        insert into rider_season_ratings values('${id(rider)}','${id(2)}',25,70,70,70,70,70,70,65,65,65,65,65,65,65);
        insert into rider_contracts values('${id(rider + 1000)}','${id(rider)}','${id(team)}','${id(2)}','${id(3)}',null,'active',1,now());
      `);
    }
  }
  await db.exec(base);
  const edition = await scalar('select id from season_gala_editions');
  const beforeEdition = await rows('select * from season_gala_editions');
  const functionsBefore = await rows(`select oid::regprocedure::text signature,md5(pg_get_functiondef(oid)) hash from pg_proc
    where oid in(to_regprocedure('get_current_season_five_gala_context()'),to_regprocedure('save_current_season_five_gala_registration(text,jsonb,text)'),
      to_regprocedure('withdraw_current_season_five_gala_registration()')) order by signature`);
  const originalManifest = await rows('select * from season_gala_events order by event_key');
  // A different edition is a real metadata sentinel, not a legacy-table alias.
  await db.query(`insert into season_gala_editions(source_season_id,target_game_year,status,visibility,registration_opens_at,registration_closes_at)
    values($1,5,'closed','private',timestamptz '2026-10-08Z',timestamptz '2026-11-05Z')`, [id(1)]);
  const s4Edition = await scalar('select id from season_gala_editions where source_season_id=$1', [id(1)]);
  await db.query(`insert into season_gala_events(edition_id,event_key,program,position,pcm_race_id,pcm_stage_id,stage_file,startlist_filename,native_capacity,native_min_riders,native_max_riders)
    values($1,'pt-flanders','pro-tour',3,11,1011,'topclas_rondevv_2024.cds','topclas_rondevv.xml',25,7,7)`, [s4Edition]);
  const s4Manifest = await rows('select * from season_gala_events where edition_id=$1', [s4Edition]);
  const entries = {};
  for (const [team, uid, program] of [[10, owner, 'pro-tour'], [11, gouille, 'continental']]) {
    const entry = await scalar('insert into season_gala_entries(edition_id,auth_user_id,team_id,program) values($1,$2,$3,$4) returning id', [edition, uid, id(team), program]);
    entries[team] = entry;
    for (const rider of ids(team)) await db.query(`insert into season_gala_entry_admissions(entry_id,rider_id,primary_snapshot)
      values($1,$2,'{"mountain":70,"hills":70,"flat":70,"time_trial":70,"cobbles":70,"sprint":70}')`, [entry, rider]);
    for (const event of team === 10 ? ['pt-zoncolan', 'pt-liege'] : ['ct-alpe', 'ct-fleche']) {
      await db.query(`insert into season_gala_entry_riders(entry_id,edition_id,event_key,program,rider_id,position)
        select $1,$2,$3,$4,rider,position from unnest($5::uuid[]) with ordinality chosen(rider,position)`, [entry, edition, event, program, ids(team)]);
    }
  }
  const snapshots = {
    entries: await rows('select * from season_gala_entries order by id'),
    admissions: await rows('select * from season_gala_entry_admissions order by entry_id,rider_id'),
    lineups: await rows('select * from season_gala_entry_riders order by entry_id,event_key,position'),
    otherCourses: await rows("select * from season_gala_events where edition_id=$1 and event_key not in('pt-flanders','ct-hamburg') order by event_key", [edition]),
  };
  for (const [team, event, program] of [[10, 'pt-flanders', 'pro-tour'], [11, 'ct-hamburg', 'continental']]) {
    await db.query(`insert into season_gala_entry_riders(entry_id,edition_id,event_key,program,rider_id,position)
      select $1,$2,$3,$4,rider,position from unnest($5::uuid[]) with ordinality chosen(rider,position)`, [entries[team], edition, event, program, ids(team)]);
    const protectedLineups = await rows('select * from season_gala_entry_riders order by entry_id,event_key,position');
    await deniedMigration(/compositions existent/);
    check(await rows('select * from season_gala_entry_riders order by entry_id,event_key,position'), protectedLineups);
    check(await rows('select * from season_gala_events where edition_id=$1 order by event_key', [edition]), originalManifest);
    await db.query('delete from season_gala_entry_riders where edition_id=$1 and event_key=$2', [edition, event]);
  }
  await db.query("update season_gala_editions set visibility='public' where id=$1", [edition]);
  await deniedMigration(/privé/);
  await db.query("update season_gala_editions set visibility='private' where id=$1", [edition]);
  await db.query("update season_gala_editions set target_game_year=7 where id=$1", [edition]);
  await deniedMigration(/privé/);
  await db.query("update season_gala_editions set target_game_year=6 where id=$1", [edition]);
  await db.query("update season_gala_events set stage_file='topclas_lbl_2018.cds' where edition_id=$1 and event_key='pt-liege'", [edition]);
  await deniedMigration(/manifeste S5 a changé/);
  await db.query("update season_gala_events set stage_file='topclas_lbl_2019.cds' where edition_id=$1 and event_key='pt-liege'", [edition]);

  await db.exec(swap);
  check(await rows('select * from season_gala_entries order by id'), snapshots.entries);
  check(await rows('select * from season_gala_entry_admissions order by entry_id,rider_id'), snapshots.admissions);
  check(await rows('select * from season_gala_entry_riders order by entry_id,event_key,position'), snapshots.lineups);
  check(await rows("select * from season_gala_events where edition_id=$1 and event_key not in('ct-flanders','pt-hamburg') order by event_key", [edition]), snapshots.otherCourses);
  check(await rows('select * from season_gala_editions where id=$1', [edition]), beforeEdition);
  check(await rows('select * from season_gala_events where edition_id=$1', [s4Edition]), s4Manifest);
  check(await scalar("select count(*)::int from season_gala_events where edition_id=$1 and event_key in('pt-flanders','ct-hamburg')", [edition]), 0);
  check(await rows('select event_key,program,position,pcm_race_id,pcm_stage_id,startlist_filename from season_gala_events where edition_id=$1 and position=3 order by program', [edition]), [
    { event_key: 'ct-flanders', program: 'continental', position: 3, pcm_race_id: 11, pcm_stage_id: 1011, startlist_filename: 'topclas_rondevv.xml' },
    { event_key: 'pt-hamburg', program: 'pro-tour', position: 3, pcm_race_id: 26, pcm_stage_id: 1026, startlist_filename: 'topclas_hamburg.xml' },
  ]);
  check(await scalar('select count(distinct startlist_filename)::int from season_gala_events where edition_id=$1', [edition]), 6);
  check(await scalar('select count(distinct pcm_race_id)::int from season_gala_events where edition_id=$1', [edition]), 6);
  check(await scalar('select count(*)::int from season_gala_events where edition_id=$1 and program=$2', [edition, 'pro-tour']), 3);
  check(await scalar('select count(*)::int from season_gala_events where edition_id=$1 and program=$2', [edition, 'continental']), 3);
  await db.exec(swap);
  for (const [team, event, program] of [[10, 'pt-hamburg', 'pro-tour'], [11, 'ct-flanders', 'continental']]) {
    await db.query(`insert into season_gala_entry_riders(entry_id,edition_id,event_key,program,rider_id,position)
      select $1,$2,$3,$4,rider,position from unnest($5::uuid[]) with ordinality chosen(rider,position)`, [entries[team], edition, event, program, ids(team)]);
  }
  const alreadySwappedLineups = await rows('select * from season_gala_entry_riders order by entry_id,event_key,position');
  await db.exec(swap); // Never clear valid lineups after the swap already happened.
  check(await rows('select * from season_gala_entry_riders order by entry_id,event_key,position'), alreadySwappedLineups);
  check(await rows(`select oid::regprocedure::text signature,md5(pg_get_functiondef(oid)) hash from pg_proc
    where oid in(to_regprocedure('get_current_season_five_gala_context()'),to_regprocedure('save_current_season_five_gala_registration(text,jsonb,text)'),
      to_regprocedure('withdraw_current_season_five_gala_registration()')) order by signature`), functionsBefore);

  // Execute the new deployment script's actual read-only receipt SELECT in
  // this isolated database, without evaluating imports, CLI or its entrypoint.
  await db.exec('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[])');
  await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3::text[])', ['20261121121547', 'wire_season_five_gala_registrations', [base.replaceAll('\r\n', '\n')]]);
  const installer = readFileSync('scripts/apply-reviewed-season-five-gala-profile-swap.mjs', 'utf8');
  const ast = ts.createSourceFile('installer.mjs', installer, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const recipe = {};
  for (const statement of ast.statements) {
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (['version', 'quote', 'rowsOf', 'protectedFunctions', 'bounded'].includes(declaration.name.getText(ast))) recipe[declaration.name.getText(ast)] = `const ${declaration.getText(ast)};`;
    }
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === 'inspect') recipe.inspect = statement.getText(ast);
  }
  const receiptQueries = [];
  const sandbox = vm.createContext({ query: (statement, label) => { receiptQueries.push({ statement, label }); return [{}]; } });
  vm.runInContext(['version', 'quote', 'rowsOf', 'protectedFunctions', 'bounded', 'inspect'].map(key => recipe[key]).join('\n') + "\ninspect('isolated-receipt');", sandbox, { timeout: 1000 });
  check(receiptQueries.length, 1);
  const receipts = await db.exec(receiptQueries[0].statement);
  const receipt = receipts.flatMap(result => result.rows ?? [])[0];
  check(receipt.database_ok, 1);
  check(receipt.installed_registration_hash, '178aa966ab403982795a7108c2f2d9b9');
  check(receipt.correct_private_editions, 1);
  check([receipt.old_keys, receipt.new_keys, receipt.old_target_lineups], [0, 2, 0]);
  check([receipt.registration_count, receipt.admission_count, receipt.lineup_count], [2, 14, 42]);
  check([receipt.distinct_pcm_races, receipt.distinct_startlists, receipt.s4_registration_count], [6, 6, 1]);
  check(/^[0-9a-f]{32}$/.test(receipt.untouched_course_hash) && /^[0-9a-f]{32}$/.test(receipt.moved_course_metadata_hash), true);

  // Separate isolated clock for normal RPC checks, after migration assertions.
  await db.query("update season_gala_editions set registration_opens_at=now()-interval '1 hour',registration_closes_at=now()+interval '1 day' where id=$1", [edition]);
  await login(owner);
  check(Object.keys((await context()).selections).sort(), ['pt-hamburg', 'pt-liege', 'pt-zoncolan']);
  check((await context()).courseCounts['pt-hamburg'], 1);
  check((await context()).courseCounts['pt-flanders'], undefined);
  const pt = { 'pt-zoncolan': ids(10), 'pt-liege': ids(10), 'pt-hamburg': ids(10) };
  check(await scalar('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['pro-tour', JSON.stringify(pt), 'pro-tour']), entries[10]);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['pro-tour', JSON.stringify({ 'pt-zoncolan': ids(10), 'pt-liege': ids(10), 'pt-flanders': ids(10) }), 'pro-tour'], /même programme/);
  await login(gouille);
  check(Object.keys((await context()).selections).sort(), ['ct-alpe', 'ct-flanders', 'ct-fleche']);
  check((await context()).courseCounts['ct-flanders'], 1);
  check((await context()).courseCounts['ct-hamburg'], undefined);
  const ct = { 'ct-alpe': ids(11), 'ct-fleche': ids(11), 'ct-flanders': ids(11) };
  check(await scalar('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['continental', JSON.stringify(ct), 'continental']), entries[11]);
  await db.exec(`update rider_season_ratings set cobbles=76 where rider_id='${id(127)}';`);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['continental', JSON.stringify({ ...ct, 'ct-flanders': [...ids(11), id(127)] }), 'continental'], /75 maximum/);
  check(await scalar('select count(*)::int from season_gala_entries'), 2);
  check(await scalar('select count(*)::int from season_gala_entry_riders where edition_id=$1 and program=$2', [edition, 'pro-tour']), 21);
  check(await scalar('select count(*)::int from season_gala_entry_riders where edition_id=$1 and program=$2', [edition, 'continental']), 21);
  check((await db.query('select * from untouched_game')).rows, [{ form: 73, morale: 81, cash: 125000, points: 150 }]);
  check(await scalar('select count(*)::int from season_gala_registrations'), 1);
  console.log(`${checks} isolated S5 gala profile-swap PostgreSQL checks passed; no production fixtures.`);
} finally { await db.close(); }
