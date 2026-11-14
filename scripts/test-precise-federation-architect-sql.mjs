import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2];
if (!modulePath || !isAbsolute(modulePath) || !modulePath.replaceAll('\\', '/').endsWith('/@electric-sql/pglite/dist/index.js')) {
  throw new Error('Pass the absolute path to a local PGlite installation.');
}

const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const migration = (file) => readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');

function getFunction(sql, name) {
  const definition = sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]+?\\n\\$\\$;`, 'i'));
  assert.ok(definition, `Missing SQL function ${name}`);
  return definition[0];
}

const country = '00000000-0000-0000-0000-000000000001';
const season = '00000000-0000-0000-0000-000000000002';
const architect = '00000000-0000-0000-0000-000000000003';
const historicalArchitect = '00000000-0000-0000-0000-000000000004';
const director = '00000000-0000-0000-0000-000000000005';
const team = '00000000-0000-0000-0000-000000000006';
const activeProject = '00000000-0000-0000-0000-000000000007';
const repairedProject = '00000000-0000-0000-0000-000000000008';
const historicalProject = '00000000-0000-0000-0000-000000000009';
const secondCountry = '00000000-0000-0000-0000-000000000010';
const thirdCountry = '00000000-0000-0000-0000-000000000011';

const first = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const value = async (sql, params = []) => Object.values(await first(sql, params))[0];

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select '${director}'::uuid
    $$;
    create table public.countries(id uuid primary key, iso_alpha2 text not null);
    create table public.seasons(
      id uuid primary key, game_year integer, current_day_number integer,
      status text, starts_on date, ends_on date
    );
    create table public.teams(id uuid primary key);
    create table public.sporting_directors(id uuid primary key);
    create table public.staff_members(id uuid primary key, role text);
    create table public.staff_contracts(id uuid primary key, staff_member_id uuid, team_id uuid, status text);
    create table public.infrastructure_projects(architect_contract_id uuid, status text);
    create table public.national_federation_terms(
      country_id uuid, start_game_year integer, end_game_year integer,
      president_director_id uuid, governance_mode text
    );
    create table public.national_federation_accounts(
      id uuid primary key default gen_random_uuid(), country_id uuid, season_id uuid,
      balance numeric(14, 2), updated_at timestamptz default now()
    );
    create table public.national_federation_transactions(
      account_id uuid, team_id uuid, day_number integer, amount numeric(14, 2),
      category text, description text, source_reference text unique, metadata jsonb
    );
    create table public.national_federation_journal_entries(
      country_id uuid, season_id uuid, day_number integer, category text,
      title text, detail text, source_reference text unique
    );
    create function public.get_current_federation_identity(p_country_code text)
    returns table(country_id uuid, sporting_director_id uuid, team_id uuid, team_name text)
    language sql stable as $$
      select id, '${director}'::uuid, '${team}'::uuid, 'Équipe de test'::text
      from public.countries where iso_alpha2 = upper(p_country_code)
    $$;
  `);

  const original = await migration('20260903235500_create_federation_infrastructure_projects.sql');
  const expanded = await migration('20260904130000_expand_federation_program.sql');
  const assignments = await migration('20260926110000_fix_federation_architect_assignments.sql');
  await db.exec(original.slice(0, original.indexOf('create or replace function')) + 'commit;');
  for (const [source, name] of [
    [original, 'start_national_federation_infrastructure_project'],
    [original, 'settle_due_national_federation_infrastructure_projects'],
    [expanded, 'recalculate_national_federation_project'],
    [expanded, 'update_national_federation_project_priority'],
    [assignments, 'contribute_architect_to_federation_project'],
  ]) await db.exec(getFunction(source, name));

  await db.exec(`
    insert into public.countries values ('${country}', 'BE'), ('${secondCountry}', 'FR'), ('${thirdCountry}', 'CH');
    insert into public.teams values ('${team}');
    insert into public.sporting_directors values ('${director}');
    insert into public.staff_members values ('${architect}', 'architect'), ('${historicalArchitect}', 'architect');
    insert into public.staff_contracts values ('${architect}', '${architect}', '${team}', 'active'),
      ('${historicalArchitect}', '${historicalArchitect}', '${team}', 'active');
    insert into public.seasons values ('${season}', 5, 1, 'active',
      (now() at time zone 'Europe/Paris')::date, (now() at time zone 'Europe/Paris')::date + 27);
    insert into public.national_federation_accounts(country_id, season_id, balance)
    select id, '${season}', 10000 from public.countries;
    insert into public.national_federation_terms values ('${country}', 5, 5, '${director}', 'elected');
    insert into public.national_federation_infrastructure_projects
      (id, country_id, started_season_id, infrastructure_code, target_level, priority,
       base_cost, final_cost, base_duration_days, final_duration_days,
       starts_game_day_index, completes_game_day_index, started_by_director_id, status)
    values
      ('${activeProject}', '${country}', '${season}', 'home_advantage_program', 1, 'balanced',
        5000, 5000, 2, 2, 140, 142, '${director}', 'active'),
      ('${repairedProject}', '${secondCountry}', '${season}', 'home_advantage_program', 1, 'balanced',
        5000, 5000, 2, 2, 140, 142, '${director}', 'active'),
      ('${historicalProject}', '${thirdCountry}', '${season}', 'home_advantage_program', 1, 'balanced',
        5000, 5000, 2, 2, 137, 139, '${director}', 'completed');
    insert into public.national_federation_project_architects
      (project_id, staff_contract_id, team_id, added_by_director_id)
    values ('${repairedProject}', '${historicalArchitect}', '${team}', '${director}'),
      ('${historicalProject}', '${historicalArchitect}', '${team}', '${director}');
  `);

  await db.exec(await migration('20261114120000_apply_precise_federation_architect_savings.sql'));

  const project = (id) => first(`select final_cost, final_duration_minutes, completes_at, status
    from public.national_federation_infrastructure_projects where id = $1`, [id]);
  const balance = (id) => value('select balance from public.national_federation_accounts where country_id = $1', [id]);
  const attribution = (id) => first(`select cost_refund, saved_minutes
    from public.national_federation_project_architects where project_id = $1`, [id]);
  const repair = await project(repairedProject);
  assert.equal(Number(repair.final_cost), 4900, 'Existing active projects receive their formerly rounded-away refund');
  assert.equal(repair.final_duration_minutes, 2794);
  assert.equal(Number(await balance(secondCountry)), 10100);
  assert.equal((await attribution(repairedProject)).saved_minutes, 86);

  const past = await project(historicalProject);
  assert.equal(Number(past.final_cost), 5000, 'Delivered project accounting stays intact');
  assert.equal(Number(await balance(thirdCountry)), 10000);

  const previousDeadline = await value(`select (starts_on + 2)::timestamp at time zone 'Europe/Paris'
    from public.seasons where id = $1`, [season]);
  const applied = await value('select public.contribute_architect_to_federation_project($1, $2)', [activeProject, architect]);
  assert.equal(applied.refund, 100);
  assert.equal(applied.savedMinutes, 86);
  assert.equal(applied.finalDurationMinutes, 2794);
  const discounted = await project(activeProject);
  assert.equal((previousDeadline - discounted.completes_at) / 60000, 86,
    'The architect bonus advances the real timestamp, even without crossing a full duration day');
  assert.equal(Number(await balance(country)), 10100);
  assert.equal((await attribution(activeProject)).saved_minutes, 86);
  await assert.rejects(() => value('select public.contribute_architect_to_federation_project($1, $2)', [activeProject, architect]));
  assert.equal(Number(await balance(country)), 10100, 'A retry cannot duplicate the refund');

  await value("select public.update_national_federation_project_priority('BE', $1, 'time')", [activeProject]);
  assert.equal(Number(await balance(country)), 10000);
  assert.equal((await project(activeProject)).final_duration_minutes, 2708);
  assert.equal((await attribution(activeProject)).saved_minutes, 172);
  await value("select public.update_national_federation_project_priority('BE', $1, 'cost')", [activeProject]);
  assert.equal(Number(await balance(country)), 10200);
  assert.equal((await project(activeProject)).final_duration_minutes, 2880);
  assert.equal((await attribution(activeProject)).saved_minutes, 0);

  await db.query(`update public.national_federation_infrastructure_projects
    set completes_at = now() + interval '1 minute', completes_game_day_index = 141 where id = $1`, [activeProject]);
  assert.equal(await value('select public.settle_due_national_federation_infrastructure_projects()'), 0);
  assert.equal((await project(activeProject)).status, 'active');
  await db.query(`update public.national_federation_infrastructure_projects
    set completes_at = now() - interval '1 minute' where id = $1`, [activeProject]);
  await assert.rejects(() => value("select public.update_national_federation_project_priority('BE', $1, 'time')", [activeProject]));
  assert.equal(await value('select priority from public.national_federation_infrastructure_projects where id = $1', [activeProject]), 'cost');
  assert.equal(await value('select public.settle_due_national_federation_infrastructure_projects()'), 1,
    'Settlement uses the timestamp while the legacy index is still in the future');
  assert.equal((await project(activeProject)).status, 'completed');
  assert.equal(await value('select public.settle_due_national_federation_infrastructure_projects()'), 0);
  assert.equal(await value('select level from public.national_federation_infrastructures where country_id = $1', [country]), 1);

  console.log('Federal architect SQL regression passed in isolated PGlite.');
} finally {
  await db.close();
}
