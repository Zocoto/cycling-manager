// Isolated in-memory PostgreSQL only; no credentials or production requests.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]?.replaceAll('\\', '/').endsWith('/pglite/dist/index.js')) throw Error('Isolated PGlite module required');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = '58140add-54c6-40af-9528-f823d0051d0f';
const ordinary = id(42);
const noTeam = id(43);
const base = readFileSync('supabase/migrations/20261121121547_wire_season_five_gala_registrations.sql', 'utf8');
const swap = readFileSync('supabase/migrations/20261121124531_swap_private_s5_gala_sprint_and_cobbles.sql', 'utf8');
const launch = readFileSync('supabase/migrations/20261123101500_open_season_five_gala_registrations.sql', 'utf8');
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const scalar = async (sql, args = []) => Object.values((await rows(sql, args))[0])[0];
const login = uid => db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid ?? '']);
const riders = team => Array.from({ length: 7 }, (_, i) => id(team === 10 ? 100 + i : 140 + i));
const selections = (program, ids) => Object.fromEntries((program === 'pro-tour'
  ? ['pt-zoncolan', 'pt-liege', 'pt-hamburg'] : ['ct-alpe', 'ct-fleche', 'ct-flanders']).map(key => [key, ids]));
const save = (program, ids, previous = null) => scalar('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', [program, JSON.stringify(selections(program, ids)), previous]);
const context = () => scalar('select get_current_season_five_gala_context()');
let checks = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const denied = async (sql, args = [], pattern) => { await assert.rejects(() => db.query(sql, args), pattern); checks++; };
const stored = () => rows('select * from season_gala_entries order by id');
const selected = () => rows('select * from season_gala_entry_riders order by entry_id,event_key,position');
const admitted = () => rows('select * from season_gala_entry_admissions order by entry_id,rider_id');

try {
  await db.exec(`
    create schema auth; create schema private; create role anon; create role authenticated; create role service_role bypassrls;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table seasons(id uuid primary key,game_year int unique,status text);
    create table countries(id uuid primary key,iso_alpha2 text);
    create table teams(id uuid primary key,status text);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,display_name text,short_name text,registration_country_id uuid);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table team_manager_assignments(id uuid primary key,team_id uuid,sporting_director_id uuid,role text,status text,start_season_id uuid,end_season_id uuid);
    create table riders(id uuid primary key,first_name text,last_name text,status text);
    create table rider_season_ratings(rider_id uuid,season_id uuid,age smallint,mountain numeric,hills numeric,flat numeric,time_trial numeric,cobbles numeric,sprint numeric,
      acceleration numeric,downhill numeric,endurance numeric,resistance numeric,recovery numeric,breakaway numeric,prologue numeric,primary key(rider_id,season_id));
    create table rider_contracts(id uuid primary key,rider_id uuid,team_id uuid,start_season_id uuid,end_season_id uuid,left_season_id uuid,status text,joined_day_number int,signed_at timestamptz);
    create table sponsors(id uuid primary key,name text,catalog_key text,country_id uuid);
    create table team_sponsor_contracts(id uuid primary key,team_id uuid,sponsor_id uuid,start_season_id uuid,contract_duration_seasons int,role text,status text,created_at timestamptz,
      selected_jersey_id text,selected_jersey_style text,pending_jersey_season_id uuid,pending_jersey_id text,pending_jersey_style text);
    create table secondary_sponsor_catalog(id uuid primary key,name text);
    create table secondary_sponsor_contracts(id uuid primary key,team_id uuid,season_id uuid,secondary_sponsor_id uuid,status text);
    create table untouched_s4_results(event_key text,results jsonb);
    insert into untouched_s4_results values('world-tour:mountain','[{"rank":1}]');
    create table untouched_game(form int,morale int,cash int,points int); insert into untouched_game values(73,81,125000,150);
    insert into seasons values('${id(1)}',4,'completed'),('${id(2)}',5,'active'),('${id(3)}',6,'planned');
    insert into countries values('${id(5)}','BE'),('${id(6)}','FR'),('${id(7)}','CH');
    insert into auth.users values('${owner}'),('${ordinary}'),('${noTeam}');
  `);
  for (const [team, uid, firstRider] of [[10, owner, 100], [12, ordinary, 140]]) {
    await db.exec(`
      insert into teams values('${id(team)}','active');
      insert into team_seasons values('${id(team + 10)}','${id(team)}','${id(2)}','Club ${team}','C${team}','${id(5)}');
      insert into sporting_directors values('${id(team + 20)}','${uid}','active');
      insert into team_manager_assignments values('${id(team + 50)}','${id(team)}','${id(team + 20)}','general_manager','active','${id(2)}',null);
    `);
    for (let i = 0; i < 9; i++) {
      const rider = firstRider + i;
      await db.exec(`
        insert into riders values('${id(rider)}','Rider','${rider}','active');
        insert into rider_season_ratings values('${id(rider)}','${id(2)}',25,70,70,70,70,70,70,65,65,65,65,65,65,65);
        insert into rider_contracts values('${id(rider + 1000)}','${id(rider)}','${id(team)}','${id(2)}','${id(3)}',null,'active',1,now());
      `);
    }
  }
  await db.exec(`
    insert into sponsors values('${id(700)}','Future sponsor','future','${id(6)}');
    insert into team_sponsor_contracts values('${id(710)}','${id(10)}','${id(700)}','${id(3)}',1,'principal','planned',now(),'base-kit','base','${id(3)}','future-kit','future-style');
    insert into secondary_sponsor_catalog values('${id(720)}','Future secondary');
    insert into secondary_sponsor_contracts values('${id(721)}','${id(10)}','${id(3)}','${id(720)}','planned');
    insert into team_seasons values('${id(23)}','${id(10)}','${id(3)}','Future sponsor - Future secondary','S6 KIT','${id(7)}');
  `);
  await db.exec(base);
  await db.exec(swap);
  // Save a private reviewer lineup before publication; publication must not
  // erase or reinterpret it. These dates are local fixtures only.
  await db.exec("update season_gala_editions set registration_opens_at=now()-interval '1 day',registration_closes_at=now()+interval '1 day'");
  await login(owner);
  const ownerEntry = await save('pro-tour', riders(10));
  const entriesBefore = await stored(), selectionsBefore = await selected(), admissionsBefore = await admitted();
  const manifestBefore = await rows('select * from season_gala_events order by event_key');
  await db.exec("update season_gala_editions set registration_opens_at='2026-11-21 00:00 Europe/Paris',registration_closes_at='2026-12-04 12:00 Europe/Paris'");
  await db.exec(launch);
  check(await scalar("select visibility='public' and status='open' and registration_closes_at=timestamptz '2026-12-03 17:00Z' from season_gala_editions"), true);
  check(await stored(), entriesBefore);
  check(await selected(), selectionsBefore);
  check(await admitted(), admissionsBefore);
  check(await rows('select * from season_gala_events order by event_key'), manifestBefore);
  await db.exec(launch);
  check(await selected(), selectionsBefore, 'reapplying launch does not rewrite choices');
  await db.exec("update season_gala_editions set status='closed'");
  await db.exec(launch);
  check(await scalar('select status from season_gala_editions'), 'closed', 'replay never reopens later closure');
  await db.exec("update season_gala_events set native_capacity=22 where event_key='pt-zoncolan'");
  await assert.rejects(() => db.exec(launch), /six parcours/);
  await db.exec('rollback');
  checks++;
  check(await scalar('select status from season_gala_editions'), 'closed');
  await db.exec("update season_gala_events set native_capacity=23 where event_key='pt-zoncolan'");
  await db.exec("update season_gala_editions set status='open',registration_opens_at=now()-interval '1 hour',registration_closes_at=now()+interval '1 day'");

  for (const fn of ['get_current_season_five_gala_context()', 'save_current_season_five_gala_registration(text,jsonb,text)', 'withdraw_current_season_five_gala_registration()']) {
    check(await scalar('select has_function_privilege($1,$2,$3)', ['authenticated', fn, 'execute']), true);
    check(await scalar('select has_function_privilege($1,$2,$3)', ['anon', fn, 'execute']), false);
  }
  await login(null);
  await denied('select get_current_season_five_gala_context()', [], /Authentification/);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,null)', ['pro-tour', JSON.stringify(selections('pro-tour', riders(12)))], /Authentification/);
  await login(noTeam);
  check((await context()).team, null);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,null)', ['pro-tour', JSON.stringify(selections('pro-tour', riders(12)))], /Aucune équipe/);
  await login(ordinary);
  await db.exec('set role authenticated');
  check((await context()).isOpen, true, 'ordinary DS can access the public edition');
  const ordinaryEntry = await save('continental', riders(12));
  check((await context()).team.id, id(12));
  check((await context()).program, 'continental');
  await db.exec('reset role');
  check(await scalar('select count(*)::int from season_gala_entries'), 2);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['continental', JSON.stringify(selections('continental', riders(10))), 'continental'], /hors effectif/);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,null)', ['continental', JSON.stringify(selections('continental', riders(12)))], /catégorie/);
  for (const invalid of [riders(12).slice(0, 6), [...riders(12), id(147), id(148)], Array(7).fill(id(140))]) {
    await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['continental', JSON.stringify(selections('continental', invalid)), 'continental'], /7 à 8/);
  }
  // An admitted Continental rider may progress naturally; a new over-cap
  // candidate cannot borrow another rider's frozen admission.
  await db.exec(`update rider_season_ratings set mountain=76 where rider_id in ('${id(140)}','${id(147)}')`);
  check(await save('continental', riders(12), 'continental'), ordinaryEntry);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['continental', JSON.stringify(selections('continental', [...riders(12), id(147)])), 'continental'], /75 maximum/);
  check(await save('pro-tour', riders(12), 'continental'), ordinaryEntry);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['continental', JSON.stringify(selections('continental', riders(12))), 'pro-tour'], /75 maximum/);
  check(await scalar('select count(distinct program)::int from season_gala_entry_riders where entry_id=$1', [ordinaryEntry]), 1);
  check(await scalar('select count(*)::int from season_gala_entry_riders where entry_id=$1', [ownerEntry]), 21);

  // A mid-season transfer must not let the same exported rider acquire two
  // clubs through separate DS entries. Preserve the previous entry and reject
  // the new selection atomically until that previous lineup is corrected.
  await db.exec(`
    update rider_contracts set status='completed',left_season_id='${id(2)}' where rider_id='${id(100)}';
    insert into rider_contracts values('${id(9000)}','${id(100)}','${id(12)}','${id(2)}','${id(3)}',null,'active',15,now());
  `);
  const beforeTransferSave = await selected();
  const transferRoster = [id(100), ...riders(12).slice(1)];
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['pro-tour', JSON.stringify(selections('pro-tour', transferRoster)), 'pro-tour'], /coureur.*déjà inscrit.*autre équipe/i);
  check(await selected(), beforeTransferSave);
  await login(owner);
  check(await save('pro-tour', [id(107), ...riders(10).slice(1)], 'pro-tour'), ownerEntry);
  check(await scalar('select count(*)::int from season_gala_entry_admissions where entry_id=$1 and rider_id=$2', [ownerEntry, id(100)]), 1, 'unused admission history does not itself block a genuine new owner');
  await login(ordinary);
  check(await save('pro-tour', transferRoster, 'pro-tour'), ordinaryEntry);
  check(await scalar('select count(distinct entry_id)::int from season_gala_entry_riders where rider_id=$1', [id(100)]), 1);
  for (const status of ['free_agent', 'retired', 'suspended']) {
    await db.query('update riders set status=$1 where id=$2', [status, id(147)]);
    check((await context()).riders.some(rider => rider.rider_id === id(147)), false, 'while S5 is active, only active riders remain eligible');
    await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['pro-tour', JSON.stringify(selections('pro-tour', [...riders(12).slice(0, 6), id(147)])), 'pro-tour'], /hors effectif/);
  }
  await db.query("update riders set status='active' where id=$1", [id(147)]);

  // Source S5 may be completed on S6 J1 while the explicit gala window stays open.
  await db.exec("update seasons set status='completed' where game_year=5;update seasons set status='active' where game_year=6");
  await db.exec(`
    update riders set status='free_agent' where id='${id(140)}';
    update riders set status='retired' where id='${id(141)}';
    update rider_contracts set status='completed',end_season_id='${id(2)}' where rider_id in ('${id(140)}','${id(141)}');
  `);
  check((await context()).isOpen, true);
  check((await context()).riders.filter(rider => [id(140), id(141)].includes(rider.rider_id)).length, 2, 'S5 riders remain in the source roster after free agency or retirement on S6 J1');
  check(await save('pro-tour', riders(12), 'pro-tour'), ordinaryEntry);
  await db.query("update riders set status='suspended' where id=$1", [id(142)]);
  check((await context()).riders.some(rider => rider.rider_id === id(142)), false, 'suspended riders remain excluded after rollover too');
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['pro-tour', JSON.stringify(selections('pro-tour', riders(12))), 'pro-tour'], /hors effectif/);
  await db.query("update riders set status='active' where id=$1", [id(142)]);
  await db.exec("update season_gala_editions set registration_closes_at=clock_timestamp()");
  check((await context()).isOpen, false);
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['pro-tour', JSON.stringify(selections('pro-tour', riders(12))), 'pro-tour'], /closes/);
  await denied('select withdraw_current_season_five_gala_registration()', [], /closes/);
  check(await scalar('select count(*)::int from season_gala_entries'), 2);
  await db.exec("update season_gala_editions set registration_closes_at=now()+interval '1 day'");

  // Force a slow roster validation in this isolated fixture. A request that
  // entered before closure must be rejected if validation crosses the deadline.
  await db.exec(`
    alter function private.season_five_gala_roster(uuid,uuid) rename to fixture_original_gala_roster;
    create sequence fixture_validated_roster;
    create function private.season_five_gala_roster(uuid,uuid)
    returns table(rider_id uuid,first_name text,last_name text,age smallint,
      mountain numeric,hills numeric,flat numeric,time_trial numeric,cobbles numeric,sprint numeric,
      acceleration numeric,downhill numeric,endurance numeric,resistance numeric,recovery numeric,breakaway numeric,prologue numeric,
      continental_eligible boolean,frozen_admission boolean)
    language plpgsql as $$begin perform nextval('public.fixture_validated_roster');perform pg_sleep(0.2);
      return query select * from private.fixture_original_gala_roster($1,$2);end;$$;
  `);
  const beforeDelay = await selected();
  await db.exec("update season_gala_editions set registration_closes_at=clock_timestamp()+interval '100 milliseconds'");
  await denied('select save_current_season_five_gala_registration($1,$2::jsonb,$3)', ['pro-tour', JSON.stringify(selections('pro-tour', riders(12))), 'pro-tour'], /closes/);
  check(await scalar('select is_called from fixture_validated_roster'), true, 'rejected after entering the slow validation, not before it');
  check(await selected(), beforeDelay, 'late validation cannot replace the existing lineup');
  await db.exec('drop function private.season_five_gala_roster(uuid,uuid);alter function private.fixture_original_gala_roster(uuid,uuid) rename to season_five_gala_roster');
  await db.exec("update season_gala_editions set registration_closes_at=now()+interval '1 day'");

  // The future export uses only registered S5 teams and their projected S6
  // identity, even while another season is active. Public managers cannot call it.
  const exportFn = 'get_season_five_gala_export_identities(uuid[])';
  for (const role of ['anon', 'authenticated']) check(await scalar('select has_function_privilege($1,$2,$3)', [role, exportFn, 'execute']), false);
  check(await scalar('select has_function_privilege($1,$2,$3)', ['service_role', exportFn, 'execute']), true);
  await db.exec('set role authenticated');
  await denied('select * from get_season_five_gala_export_identities($1)', [[id(10)]], /permission denied/);
  await db.exec('reset role');
  const teamIdentitiesBefore = await rows('select * from team_seasons order by id');
  const sponsorContractsBefore = await rows('select * from team_sponsor_contracts order by id');
  await db.exec('set role service_role');
  const identities = await rows('select * from get_season_five_gala_export_identities($1)', [[id(10), id(12), id(999)]]);
  check(identities.length, 2);
  check(identities.find(row => row.team_id === id(10)), { team_id: id(10), identity_season: 6,
    team_name: 'Future sponsor - Future secondary', team_short_name: 'S6 KIT', team_country_code: 'CH',
    registration_country_id: id(7), sponsor_catalog_key: 'future', jersey_id: 'future-kit', jersey_style: 'future-style', identity_ready: true });
  check((await rows('select * from get_season_five_gala_export_identities($1)', [[]])).length, 0);
  await denied('select * from get_season_five_gala_export_identities($1)', [null], /100 équipes/);
  await denied('select * from get_season_five_gala_export_identities($1)', [Array(101).fill(id(10))], /100 équipes/);
  await denied('select * from get_season_five_gala_export_identities($1)', [[id(10), null]], /100 équipes/);
  check((await rows('select * from get_season_five_gala_export_identities($1)', [[id(10), id(10)]])).length, 1);
  await db.exec('reset role');
  check(await rows('select * from team_seasons order by id'), teamIdentitiesBefore);
  check(await rows('select * from team_sponsor_contracts order by id'), sponsorContractsBefore);
  await db.query('delete from team_seasons where id=$1', [id(23)]);
  const projected = (await rows('select * from get_season_five_gala_export_identities($1)', [[id(10)]]))[0];
  check(projected.team_country_code, 'FR', 'before S6 roster creation, use the future principal sponsor country');
  check(projected.team_short_name, 'Future sponsor - Future secondary'.slice(0, 30));
  await db.query('select withdraw_current_season_five_gala_registration()');
  check(await scalar('select count(*)::int from season_gala_entries'), 1);
  check(await scalar('select count(*)::int from season_gala_entry_riders where entry_id=$1', [ordinaryEntry]), 0);
  check(await scalar('select count(*)::int from season_gala_entry_riders where entry_id=$1', [ownerEntry]), 21);
  check(await rows('select * from untouched_game'), [{ form: 73, morale: 81, cash: 125000, points: 150 }]);
  check(await rows('select * from untouched_s4_results'), [{ event_key: 'world-tour:mountain', results: [{ rank: 1 }] }]);
  console.log(`${checks} isolated S5 public-launch PostgreSQL checks passed; public ownership, deadline, native eligibility, rollover, export identities and immutable prior choices verified.`);
} catch (error) {
  console.error({ message: error.message, code: error.code, query: error.query, where: error.where,
    actual: error.actual, expected: error.expected });
  process.exitCode = 1;
} finally { await db.close(); }
