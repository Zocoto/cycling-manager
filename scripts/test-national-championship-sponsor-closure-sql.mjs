// Isolated PostgreSQL only: no production connection or gameplay fixture.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2] ?? 'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js';
if (!isAbsolute(modulePath) || !modulePath.replaceAll('\\', '/').endsWith('/@electric-sql/pglite/dist/index.js')) throw Error('Use an isolated local PGlite module.');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const read = name => readFileSync(`supabase/migrations/${name}.sql`, 'utf8').replaceAll('\r', '');
const fix = read('20261123153000_close_national_championship_sponsor_objectives');
const query = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await query(sql, params))[0];
let assertions = 0;
const check = (actual, expected, reason) => { assert.deepEqual(actual, expected, reason); assertions++; };
const progress = () => one(`select p.status, p.current_value::integer value, o.status objective_status,
 p.details, p.settled_at, p.reputation_penalty, c.satisfaction_score, s.cash_balance,
 d.reputation_points from objective_progress p join sponsor_objectives o on o.id=p.sponsor_objective_id
 join team_sponsor_contracts c on c.id=p.team_sponsor_contract_id
 join team_seasons s on s.team_id=c.team_id and s.season_id=p.season_id
 cross join sporting_directors d where p.sponsor_objective_id='${id(30)}'`);
const refresh = finalize => db.query('select public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821($1,$2)', [id(1), finalize ?? false]);
const reset = async (type = 'road', required = 1) => db.exec(`
 delete from rider_national_championship_titles;
 update sponsor_objectives set status='active', target_details='{"countryCode":"KG","championshipType":"${type}","requiredTitleCount":${required}}' where id='${id(30)}';
 update objective_progress set status='in_progress',current_value=0,settled_at=null,reputation_penalty=0,details='{"retained":"yes"}' where sponsor_objective_id='${id(30)}';
 update race_editions set status='completed';
`);

try {
  await db.exec(`
    create schema private; create role anon; create role authenticated; create role service_role;
    create table seasons(id uuid primary key,game_year int,status text,starts_on date,ends_on date);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,status text,final_rank int,next_sponsor_budget_bonus_percent numeric default 0,cash_balance numeric default 30000);
    create table team_sponsor_contracts(id uuid primary key,team_id uuid,sponsor_offer_id uuid,start_season_id uuid,objective_season_id uuid,status text,role text,satisfaction_score int default 0,satisfaction_updated_at timestamptz,budget_per_season numeric default 50000);
    create table sporting_directors(id uuid primary key,reputation_points int default 100);
    create table team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text);
    create table sponsor_objectives(id uuid primary key default gen_random_uuid(),sponsor_offer_id uuid,season_id uuid,objective_type text,status text,satisfaction_points int,target_details jsonb,display_order int,renewal_bonus_percent numeric default 0,updated_at timestamptz);
    create table objective_progress(id uuid primary key default gen_random_uuid(),sponsor_objective_id uuid,team_sponsor_contract_id uuid,season_id uuid,current_value numeric,status text,details jsonb,settled_at timestamptz,updated_at timestamptz,last_evaluated_at timestamptz,achieved_at timestamptz,reputation_penalty int default 0,unique(sponsor_objective_id,team_sponsor_contract_id,season_id));
    create table countries(id uuid primary key,iso_alpha2 text);
    create table races(id uuid primary key,race_format text,competition_type text,country_id uuid);
    create table race_editions(id uuid primary key,race_id uuid,season_id uuid,status text);
    create table rider_contracts(rider_id uuid,team_id uuid,status text,start_season_id uuid,end_season_id uuid);
    create table rider_national_championship_titles(id uuid primary key default gen_random_uuid(),rider_id uuid,country_id uuid,season_id uuid,championship_type text);
    create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid);
    create table race_rosters(id uuid primary key,race_registration_id uuid);
    create table race_results(id uuid primary key default gen_random_uuid(),race_edition_id uuid,race_roster_id uuid,status text,final_rank int);
  `);
  // Reconstruct the committed annual evaluator; optionally run the exact
  // read-only production definition supplied as a local file by the operator.
  let base;
  if (process.argv[3]) {
    base = readFileSync(process.argv[3], 'utf8').replaceAll('\r', '') + ';';
  } else {
    const source = read('20260813110000_expand_sponsor_objectives_and_satisfaction');
    const start = source.indexOf('create or replace function public.evaluate_sponsor_objectives_for_contract(');
    base = source.slice(start, source.indexOf('$$;', start) + 3)
      .replace('public.evaluate_sponsor_objectives_for_contract(', 'public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821(')
      .replace('contract.start_season_id,', 'coalesce(contract.objective_season_id, contract.start_season_id) as objective_season_id,')
      .replace('team_season.season_id = contract.start_season_id', 'team_season.season_id = coalesce(contract.objective_season_id, contract.start_season_id)')
      .replace('join public.seasons as season on season.id = contract.start_season_id', 'join public.seasons as season on season.id = coalesce(contract.objective_season_id, contract.start_season_id)')
      .replaceAll('v_contract.start_season_id', 'v_contract.objective_season_id')
      .replaceAll('and objective.season_id = v_contract.objective_season_id', "and objective.season_id = v_contract.objective_season_id and objective.status <> 'cancelled'")
      .replace('if v_edition_id is null then', 'if v_edition_id is null or not exists (select 1 from public.race_editions as expected_edition where expected_edition.id = v_edition_id and expected_edition.season_id = v_contract.objective_season_id) then');
  }
  await db.exec(base);
  if (!process.argv[3]) await db.exec(read('20261102120000_refresh_unsettled_sponsor_race_results'));
  await db.exec(`
    insert into seasons values('${id(4)}',5,'active','2026-11-06','2026-12-03'),('${id(3)}',4,'completed','2026-10-09','2026-11-05');
    insert into team_seasons(id,team_id,season_id,status) values('${id(6)}','${id(7)}','${id(4)}','active');
    insert into team_sponsor_contracts(id,team_id,sponsor_offer_id,start_season_id,objective_season_id,status,role) values('${id(1)}','${id(7)}','${id(2)}','${id(3)}','${id(4)}','active','principal');
    insert into sporting_directors values('${id(50)}',100);
    insert into team_manager_assignments values('${id(7)}','${id(50)}','general_manager','active');
    insert into countries values('${id(20)}','KG'),('${id(21)}','FR');
    insert into races values('${id(11)}','one_day','national_road','${id(20)}'),('${id(12)}','one_day','national_time_trial','${id(20)}'),('${id(13)}','one_day','national_road','${id(21)}');
    insert into race_editions values('${id(10)}','${id(11)}','${id(4)}','completed'),('${id(14)}','${id(12)}','${id(4)}','completed'),('${id(15)}','${id(13)}','${id(4)}','completed'),('${id(16)}','${id(11)}','${id(3)}','completed');
    insert into rider_contracts values('${id(40)}','${id(7)}','active','${id(3)}','${id(4)}'),('${id(41)}','${id(99)}','active','${id(3)}','${id(4)}');
    insert into sponsor_objectives values('${id(30)}','${id(2)}','${id(4)}','national_championship','active',20,'{"countryCode":"KG","championshipType":"road","requiredTitleCount":1}',1,0,null);
    insert into objective_progress(sponsor_objective_id,team_sponsor_contract_id,season_id,status,current_value,details) values('${id(30)}','${id(1)}','${id(4)}','in_progress',0,'{"retained":"yes"}');
  `);
  await refresh(); check((await progress()).status, 'in_progress', 'Reproduce the stale national goal after both CNs');
  const aclBefore = (await one(`select proacl::text acl from pg_proc where oid='public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821(uuid,boolean)'::regprocedure`)).acl;
  // Raw CRLF stresses Windows delivery, including SQL multiline patch anchors.
  await db.exec(fix.replaceAll('\n', '\r\n'));
  let row = await progress();
  check(row.status, 'failed', 'Existing unsuccessful CN goal repaired without opening its page');
  check(row.objective_status, 'failed'); check(row.value, 0); check(row.settled_at, null);
  check(row.reputation_penalty, 0); check(row.reputation_points, 100); check(Number(row.cash_balance), 30000);
  check(row.details.retained, 'yes'); check(row.details.evaluatedStatus, 'failed');
  check((await one(`select proacl::text acl from pg_proc where oid='public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821(uuid,boolean)'::regprocedure`)).acl, aclBefore);
  check((await one(`select has_function_privilege('authenticated','private.evaluate_national_championship_sponsor_goal(uuid,uuid,jsonb,boolean)','execute') allowed`)).allowed, false);

  await reset('any'); await db.exec(`update race_editions set status='in_progress' where id='${id(14)}'`); await refresh();
  check((await progress()).status, 'in_progress', 'Any title waits for the other discipline');
  await db.exec(`update race_editions set status='completed' where id='${id(14)}'`); await refresh();
  check((await progress()).status, 'failed');
  await reset('road'); await db.exec(`update race_editions set status='planned' where id='${id(10)}'`); await refresh();
  check((await progress()).status, 'in_progress', 'An overdue but unhomologated road CN cannot fail');
  await reset('time_trial'); await db.exec(`update race_editions set status='in_progress' where id='${id(10)}'`); await refresh();
  check((await progress()).status, 'failed', 'TT-only target ignores unfinished road');
  await reset('any'); await db.exec(`delete from race_editions where id='${id(14)}'`); await refresh();
  check((await progress()).status, 'in_progress', 'Missing discipline is not a completed championship');
  await db.exec(`insert into race_editions values('${id(14)}','${id(12)}','${id(4)}','cancelled')`); await refresh();
  check((await progress()).status, 'failed', 'Cancelled discipline is terminal');
  await reset(); await db.exec(`update race_editions set status='cancelled' where id='${id(10)}'`); await refresh();
  check((await progress()).status, 'failed');

  await reset(); await db.exec(`insert into rider_national_championship_titles(rider_id,country_id,season_id,championship_type) values('${id(41)}','${id(20)}','${id(4)}','road'),('${id(40)}','${id(20)}','${id(3)}','road'),('${id(40)}','${id(21)}','${id(4)}','road'),('${id(40)}','${id(20)}','${id(4)}','time_trial')`); await refresh();
  check((await progress()).status, 'failed', 'Wrong team, season, country and discipline do not satisfy road');
  check((await progress()).value, 0);
  await db.exec(`insert into rider_national_championship_titles(rider_id,country_id,season_id,championship_type) values('${id(40)}','${id(20)}','${id(4)}','road')`); await refresh();
  check((await progress()).status, 'achieved', 'An unsealed failure can follow corrected title results');
  check((await progress()).satisfaction_score, 20);
  await db.exec('delete from rider_national_championship_titles'); await refresh();
  check((await progress()).status, 'achieved', 'Existing success remains preserved');
  await reset('any', 2); await db.exec(`insert into rider_national_championship_titles(rider_id,country_id,season_id,championship_type) values('${id(40)}','${id(20)}','${id(4)}','road')`); await refresh();
  check((await progress()).status, 'failed', 'One title does not satisfy a target of two');
  check((await progress()).value, 1);
  await db.exec(`insert into rider_national_championship_titles(rider_id,country_id,season_id,championship_type) values('${id(40)}','${id(20)}','${id(4)}','time_trial')`); await refresh();
  check((await progress()).status, 'achieved'); check((await progress()).value, 2);

  await reset(); await refresh(); await db.exec(`update objective_progress set settled_at=now();insert into rider_national_championship_titles(rider_id,country_id,season_id,championship_type) values('${id(40)}','${id(20)}','${id(4)}','road')`); await refresh();
  check((await progress()).status, 'failed', 'Sealed historical failure remains unchanged');
  await reset(); await refresh(); await db.exec(`update race_editions set status='in_progress' where id='${id(10)}'`); await refresh();
  check((await progress()).status, 'in_progress', 'Unsealed failure reopens for an official replay');
  await reset(); await db.exec(`update sponsor_objectives set status='cancelled' where id='${id(30)}'`); await refresh();
  check((await progress()).objective_status, 'cancelled'); check((await progress()).status, 'in_progress');
  await reset(); await db.exec(`update sponsor_objectives set objective_type='infrastructure',status='failed' where id='${id(30)}';update objective_progress set status='failed',current_value=9`); await refresh();
  check((await progress()).status, 'failed'); check((await progress()).value, 9, 'Other goal types preserve terminal behavior');

  // Re-run only the repair statement: no draft offer, previous season, archived
  // settlement or unrelated goal can be changed, and repeating is a no-op.
  await reset(); await db.exec(`update sponsor_objectives set objective_type='national_championship' where id='${id(30)}';
    insert into sponsor_objectives values('${id(31)}','${id(22)}','${id(4)}','national_championship','draft',20,'{"countryCode":"KG","championshipType":"road"}',1,0,null),
    ('${id(32)}','${id(2)}','${id(3)}','national_championship','active',20,'{"countryCode":"KG","championshipType":"road"}',2,0,null);`);
  const repair = fix.slice(fix.indexOf('with candidates as materialized'), fix.indexOf("notify pgrst"));
  await db.exec(repair); const snapshot = await progress(); await db.exec(repair);
  check((await progress()).status, 'failed'); check((await progress()).details, snapshot.details);
  check((await one(`select status from sponsor_objectives where id='${id(31)}'`)).status, 'draft');
  check((await one(`select status from sponsor_objectives where id='${id(32)}'`)).status, 'active');
  check((await progress()).settled_at, null); check((await progress()).reputation_points, 100); check(Number((await progress()).cash_balance), 30000);
  // Run the real production completion trigger in the very transaction that
  // homologates the edition. Its STABLE helper must see the new row status.
  await reset('any'); await db.exec(`update race_editions set status='planned' where season_id='${id(4)}';`);
  const triggerSource = read('20260908080000_add_annual_sponsor_objective_renegotiation');
  const triggerStart = triggerSource.indexOf('create or replace function public.evaluate_sponsor_objectives_after_race(');
  await db.exec(`create function public.evaluate_sponsor_objectives_for_contract(uuid,boolean) returns void language sql as $$
    select public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821($1,$2) $$;`);
  await db.exec(triggerSource.slice(triggerStart, triggerSource.indexOf('$$;', triggerStart) + 3));
  await db.exec(`create trigger test_real_race_completion after update of status on race_editions for each row execute function public.evaluate_sponsor_objectives_after_race();
    update race_editions set status='completed' where id='${id(10)}';`);
  check((await progress()).status, 'in_progress', 'Completion trigger still waits for TT on an any goal');
  await db.exec(`update race_editions set status='completed' where id='${id(14)}';`);
  check((await progress()).status, 'failed', 'Completion trigger sees the terminal edition without another page visit');
  check((await progress()).settled_at, null); check((await progress()).reputation_points, 100);
  console.log(`PASS ${assertions} isolated SQL assertions: road/TT/any, annual scope, replay, preserved successes, scoped backfill, drafts/history, unchanged finances and ACLs.`);
} finally { await db.close(); }
