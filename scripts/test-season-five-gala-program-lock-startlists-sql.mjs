// Isolated in-memory PostgreSQL only; never loads credentials or contacts Supabase.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

if (!process.argv[2]?.replaceAll('\\', '/').endsWith('/pglite/dist/index.js')) throw Error('Isolated PGlite module required');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = '58140add-54c6-40af-9528-f823d0051d0f';
const ordinary = id(42), noTeam = id(43);
const read = path => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20261123184527_lock_gala_programs_and_publish_startlists.sql');
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const scalar = async (sql, args = []) => Object.values((await rows(sql, args))[0])[0];
const login = uid => db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid ?? '']);
const riderIds = team => Array.from({ length: 7 }, (_, index) => id((team === 10 ? 100 : 140) + index));
const selections = (program, riders) => Object.fromEntries((program === 'pro-tour'
  ? ['pt-zoncolan', 'pt-liege', 'pt-hamburg'] : ['ct-alpe', 'ct-fleche', 'ct-flanders']).map(key => [key, riders]));
const save = (program, riders, previous = null) => scalar('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', [program, JSON.stringify(selections(program, riders)), previous]);
const startlists = () => scalar('select get_season_five_gala_startlists()');
const storedEntries = () => rows('select * from season_gala_entries order by id');
const storedLineups = () => rows('select * from season_gala_entry_riders order by entry_id,event_key,position');
const storedAdmissions = () => rows('select * from season_gala_entry_admissions order by entry_id,rider_id');
let checks = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const denied = async (sql, args = [], pattern) => { await assert.rejects(() => db.query(sql, args), pattern); checks++; };
const keys = value => Object.keys(value).sort();

try {
  // Reuse the source-season schema and two independent DS clubs from the
  // public-launch fixture, without executing its mutations or assertions.
  const fixture = read('scripts/test-season-five-gala-public-launch-sql.mjs').replaceAll('\r\n', '\n');
  const begin = fixture.indexOf('\ntry {\n'), end = fixture.indexOf('\n  await db.exec(base);');
  assert.ok(begin >= 0 && end > begin, 'public-launch fixture markers must remain explicit');
  const setup = fixture.slice(begin + '\ntry {\n'.length, end);
  await vm.runInNewContext(`(async()=>{${setup}})()`, { db, id, owner, ordinary, noTeam });
  await db.exec(`
    create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('role',true),'none'),'authenticated')$$;
    alter table teams add column amateur_jersey_pattern text default 'classic',
      add column amateur_jersey_primary_color text default '#176951',
      add column amateur_jersey_secondary_color text default '#FFFDF4',
      add column amateur_jersey_accent_color text default '#F2C94C';
  `);
  for (const path of [
    'supabase/migrations/20261121121547_wire_season_five_gala_registrations.sql',
    'supabase/migrations/20261121124531_swap_private_s5_gala_sprint_and_cobbles.sql',
    'supabase/migrations/20261123101500_open_season_five_gala_registrations.sql',
  ]) await db.exec(read(path));
  await db.exec("update season_gala_editions set registration_opens_at=now()-interval '1 hour',registration_closes_at=now()+interval '1 day'");
  await login(owner);
  const ownerEntry = await save('pro-tour', riderIds(10));
  await login(ordinary);
  const ordinaryEntry = await save('continental', riderIds(12));
  const initialEntries = await storedEntries(), initialLineups = await storedLineups(), initialAdmissions = await storedAdmissions();
  const originalDeadline = await scalar('select registration_closes_at from season_gala_editions');
  await db.exec(migration);
  await db.exec(migration);
  check(await storedEntries(), initialEntries);
  check(await storedLineups(), initialLineups);
  check(await storedAdmissions(), initialAdmissions);
  check(await scalar('select registration_closes_at from season_gala_editions'), originalDeadline);

  const fn = 'get_season_five_gala_startlists()';
  check(await scalar('select has_function_privilege($1,$2,$3)', ['anon', fn, 'execute']), false);
  for (const role of ['authenticated', 'service_role']) check(await scalar('select has_function_privilege($1,$2,$3)', [role, fn, 'execute']), true);
  check(await scalar("select has_table_privilege('authenticated','season_gala_entries','select')"), false);
  await db.exec('set role authenticated');
  await denied('select * from season_gala_entries', [], /permission denied/);
  const first = await startlists();
  await db.exec('reset role');
  check(keys(first), ['closesAt', 'courses', 'editionId', 'sourceSeason', 'targetGameYear']);
  check([first.sourceSeason, first.targetGameYear], [5, 6]);
  check(first.courses.map(course => course.eventKey), ['pt-zoncolan', 'pt-liege', 'pt-hamburg', 'ct-alpe', 'ct-fleche', 'ct-flanders']);
  check(first.courses.map(course => course.teams.length), [1, 1, 1, 1, 1, 1]);
  const publicTeam = first.courses[0].teams[0];
  check(keys(publicTeam), ['amateurJersey', 'futureName', 'identityReady', 'jerseyId', 'jerseyStyle', 'name', 'riders', 'sponsorCatalogKey', 'teamId']);
  check(publicTeam.teamId, id(10));
  check(publicTeam.name, 'Club 10');
  check(publicTeam.futureName, 'Future sponsor - Future secondary');
  check([publicTeam.sponsorCatalogKey, publicTeam.jerseyId, publicTeam.jerseyStyle, publicTeam.identityReady], ['future', 'future-kit', 'future-style', true]);
  check(publicTeam.amateurJersey, { pattern: 'classic', primaryColor: '#176951', secondaryColor: '#FFFDF4', accentColor: '#F2C94C' });
  for (const course of first.courses) {
    check(keys(course), ['eventKey', 'program', 'teams']);
    const team = course.teams[0];
    check(team.riders.map(rider => rider.position), [1, 2, 3, 4, 5, 6, 7]);
    check(team.riders.every(rider => keys(rider).join() === 'firstName,lastName,position,riderId'), true);
  }
  check(JSON.stringify(first).includes(id(107)), false, 'do not disclose an unselected rider');
  check(JSON.stringify(first).includes(owner), false, 'do not publish authentication IDs');
  check(await storedEntries(), initialEntries, 'public reads do not modify registration data');

  // Instrument only the isolated fixture: the materialized identity CTE must
  // call the canonical S6 projection once per entry, not once per course.
  await db.exec(`
    alter function private.season_five_gala_team_identity(uuid) rename to fixture_original_team_identity;
    create sequence public.fixture_identity_calls;
    create function private.season_five_gala_team_identity(uuid) returns jsonb language plpgsql as $$
      begin perform nextval('public.fixture_identity_calls');return private.fixture_original_team_identity($1);end;$$;
  `);
  await startlists();
  check(Number(await scalar('select last_value from fixture_identity_calls')), 2);
  await db.exec('drop function private.season_five_gala_team_identity(uuid);alter function private.fixture_original_team_identity(uuid) rename to season_five_gala_team_identity');

  // Matching, forged and absent previous-program values cannot unlock a saved
  // category. The old lineups and admissions must survive every rejected call.
  for (const previous of ['continental', 'pro-tour', null]) {
    await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['pro-tour', JSON.stringify(selections('pro-tour', riderIds(12))), previous], /Retirez d’abord.*changer de programme/);
  }
  check(await storedEntries(), initialEntries);
  check(await storedLineups(), initialLineups);
  check(await storedAdmissions(), initialAdmissions);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['continental', JSON.stringify(selections('continental', riderIds(12))), null], /catégorie a changé/);
  check(await save('continental', riderIds(12), 'continental'), ordinaryEntry);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['continental', JSON.stringify(selections('continental', riderIds(10))), 'continental'], /hors effectif/);
  check(await scalar('select count(*)::int from season_gala_entry_riders where entry_id=$1', [ownerEntry]), 21);
  await login(owner);
  check(await save('pro-tour', [...riderIds(10), id(107)], 'pro-tour'), ownerEntry);
  check((await startlists()).courses[0].teams[0].riders.length, 8);

  // Partial or noncontiguous manual-fixture rows cannot become public SLs.
  await db.query("update season_gala_entry_riders set position=8 where entry_id=$1 and event_key='ct-alpe' and position=1", [ordinaryEntry]);
  check((await startlists()).courses.find(course => course.eventKey === 'ct-alpe').teams, []);
  await db.query("update season_gala_entry_riders set position=1 where entry_id=$1 and event_key='ct-alpe' and position=8", [ordinaryEntry]);

  await login(ordinary);
  await db.query("update rider_season_ratings set mountain=76 where rider_id=$1", [id(140)]);
  check(await save('continental', riderIds(12), 'continental'), ordinaryEntry, 'same-category edit retains legitimate Continental admission');
  await db.query('select withdraw_current_season_five_gala_registration()');
  check((await startlists()).courses.filter(course => course.program === 'continental').every(course => course.teams.length === 0), true);
  check(await scalar('select count(*)::int from season_gala_entry_admissions where entry_id=$1', [ordinaryEntry]), 0);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,null)', ['continental', JSON.stringify(selections('continental', riderIds(12)))], /75 maximum/);
  const newEntry = await save('pro-tour', riderIds(12));
  check(typeof newEntry, 'string');
  check(newEntry !== ordinaryEntry, true, 'only explicit withdrawal creates a new programme choice');
  check((await startlists()).courses.slice(0, 3).every(course => course.teams.length === 2), true);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['continental', JSON.stringify(selections('continental', riderIds(12))), 'pro-tour'], /Retirez d’abord/);

  // Read access does not imply editing somebody else's entry; the existing
  // cross-entry rider and rollover protections also remain in the save RPC.
  await db.exec(`
    update rider_contracts set status='completed',left_season_id='${id(2)}' where rider_id='${id(100)}';
    insert into rider_contracts values('${id(9000)}','${id(100)}','${id(12)}','${id(2)}','${id(3)}',null,'active',15,now());
  `);
  const beforeDuplicate = await storedLineups();
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['pro-tour', JSON.stringify(selections('pro-tour', [id(100), ...riderIds(12).slice(1)])), 'pro-tour'], /déjà inscrit.*autre équipe/);
  check(await storedLineups(), beforeDuplicate);
  await db.exec(`update seasons set status='completed' where game_year=5;update seasons set status='active' where game_year=6;
    update riders set status='retired' where id='${id(140)}';`);
  check(await save('pro-tour', riderIds(12), 'pro-tour'), newEntry);

  // Publication and authentication gates remain separate from the date. All
  // six lists stay visible after closure while mutations remain forbidden.
  await db.exec("update season_gala_editions set registration_closes_at=clock_timestamp()");
  const closedLists = await startlists();
  check(closedLists.courses.length, 6);
  check(closedLists.courses.slice(0, 3).every(course => course.teams.length === 2), true);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['pro-tour', JSON.stringify(selections('pro-tour', riderIds(12))), 'pro-tour'], /closes/);
  await denied('select withdraw_current_season_five_gala_registration()', [], /closes/);
  await login(noTeam);
  check((await startlists()).courses.length, 6, 'authenticated new DS can read lists without S5 editing rights');
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,null)', ['pro-tour', JSON.stringify(selections('pro-tour', riderIds(12)))], /Aucune équipe/);
  await login(null);
  await denied('select get_season_five_gala_startlists()', [], /Authentification/);
  await db.exec('set role anon');
  await denied('select get_season_five_gala_startlists()', [], /permission denied/);
  await db.exec('reset role');
  await login(ordinary);
  await db.exec("update season_gala_editions set visibility='private'");
  await denied('select get_season_five_gala_startlists()', [], /pas encore publié/);
  await login(null);
  await db.exec('set role service_role');
  check((await startlists()).courses.length, 6, 'service role can inspect a private edition without a user ID');
  await db.exec('reset role');
  await db.exec("update season_gala_editions set visibility='public'");
  await login(ordinary);
  const finalEntries = await storedEntries(), finalLineups = await storedLineups();
  await db.exec(migration);
  check(await storedEntries(), finalEntries);
  check(await storedLineups(), finalLineups);
  await db.exec('begin;delete from season_gala_entry_riders;delete from season_gala_entries;');
  const emptyLists = await startlists();
  check(emptyLists.courses.length, 6, 'the zero-registration state still publishes all six course headings');
  check(emptyLists.courses.every(course => course.teams.length === 0), true);
  await db.exec('rollback');
  check(await rows('select * from untouched_game'), [{ form: 73, morale: 81, cash: 125000, points: 150 }]);
  check(await rows('select * from untouched_s4_results'), [{ event_key: 'world-tour:mountain', results: [{ rank: 1 }] }]);
  console.log(`${checks} isolated gala programme-lock/startlist checks passed: explicit withdrawal, same-programme edits, shared read-only lists, kits, permissions, privacy, deadline and prior guards.`);
} catch (error) {
  console.error({ message: error.message, code: error.code, query: error.query, where: error.where,
    actual: error.actual instanceof Error ? error.actual.message : error.actual, expected: error.expected });
  process.exitCode = 1;
} finally { await db.close(); }
