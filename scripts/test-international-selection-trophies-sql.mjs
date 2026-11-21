import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2];
if (!modulePath) throw Error('Supply an isolated PGlite module path.');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const keys = new Map();
const id = key => {
  if (!keys.has(key)) keys.set(key, `00000000-0000-4000-8000-${String(keys.size + 1).padStart(12, '0')}`);
  return keys.get(key);
};
const query = (sql, args = []) => db.query(sql, args).then(result => result.rows);
const scalar = async (sql, args = []) => Object.values((await query(sql, args))[0])[0];
const insert = async (table, row) => {
  const fields = Object.keys(row);
  await query(`insert into ${table} (${fields.join(',')}) values (${fields.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(row));
};
const original = readFileSync('supabase/migrations/20260827100000_notify_new_trophies.sql', 'utf8');
const beneficiarySource = readFileSync('supabase/migrations/20261103103000_fix_quadrennial_club_prize_ownership.sql', 'utf8');
const functionDefinition = (source, name) => {
  const start = source.indexOf(`create ${name.includes('quadrennial') ? '' : 'or replace '}function ${name}(`);
  assert.ok(start >= 0, `Function ${name} exists`);
  return source.slice(start, source.indexOf('$$;', start) + 3);
};

await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema private;
create table seasons(id uuid primary key, game_year int, name text);
create table season_days(id uuid primary key,season_id uuid,day_number int);
create table races(id uuid primary key,slug text,is_grand_tour bool default false,is_monument bool default false,competition_type text);
create table race_editions(id uuid primary key,race_id uuid,season_id uuid,display_name text,status text);
create table stages(id uuid primary key,race_edition_id uuid,season_day_id uuid,stage_number int,departure_at timestamptz);
create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
create table alpha_bot_managers(sporting_director_id uuid);
create table team_seasons(id uuid primary key,team_id uuid,season_id uuid);
create table team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text);
create table riders(id uuid primary key,first_name text,last_name text);
create table rider_contracts(id uuid primary key,rider_id uuid,team_id uuid,start_season_id uuid,end_season_id uuid,left_season_id uuid,signed_at timestamptz,created_at timestamptz,joined_day_number int,left_day_number int,status text);
create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid);
create table race_rosters(id uuid primary key,race_registration_id uuid,rider_id uuid);
create table race_results(id uuid primary key,race_edition_id uuid,race_roster_id uuid,final_rank int,status text,created_at timestamptz);
create table national_federation_selection_lists(id uuid primary key,season_id uuid,country_id uuid);
create table national_federation_selection_race_links(selection_list_id uuid primary key,race_registration_id uuid,race_edition_id uuid);
create table national_federation_selection_members(id uuid primary key,selection_list_id uuid,professional_rider_id uuid,owner_team_id uuid,owner_director_id uuid,response_status text);
create table sporting_director_trophy_notifications(id uuid primary key default gen_random_uuid(),sporting_director_id uuid,season_id uuid,team_season_id uuid,trophy_kind text,trophy_key text,trophy_title text,source_reference text,awarded_at timestamptz,unique(sporting_director_id,source_reference));
create table sporting_director_messages(id uuid primary key default gen_random_uuid(),sporting_director_id uuid,season_id uuid,team_season_id uuid,message_type text,sender_name text,subject text,preview text,body text,action_href text,action_label text,source_reference text,is_important bool,sent_at timestamptz,unique(sporting_director_id,source_reference));
create function private.managed_directors_for_team_season(uuid,uuid) returns table(sporting_director_id uuid) language sql as $$ select sporting_director_id from public.team_manager_assignments where team_id=$1 and role='general_manager' and status='active' $$;
`);
await db.exec(functionDefinition(original, 'private.create_trophy_notification'));
await db.exec(functionDefinition(beneficiarySource, 'private.get_quadrennial_games_club_beneficiaries'));
await db.exec(readFileSync('supabase/migrations/20261121130000_restore_international_selection_trophies.sql', 'utf8'));

for (const year of [3, 5]) {
  await insert('seasons', { id: id(`s${year}`), game_year: year, name: `Saison ${year}` });
  await insert('season_days', { id: id(`day${year}`), season_id: id(`s${year}`), day_number: 15 });
}
for (const owner of ['old', 'new', 'president']) {
  await insert('sporting_directors', { id: id(`director:${owner}`), auth_user_id: id(`auth:${owner}`), status: 'active' });
  await insert('team_manager_assignments', { team_id: id(`team:${owner}`), sporting_director_id: id(`director:${owner}`), role: 'general_manager', status: 'active' });
  for (const year of [3, 5]) await insert('team_seasons', { id: id(`ts:${owner}:${year}`), team_id: id(`team:${owner}`), season_id: id(`s${year}`) });
}

async function race(key, { competition = 'continental_championship', year = 5, status = 'completed', rank = 1, resultStatus = 'classified', club = false, contractOwner = 'old', transfer = null, callupOwner = 'old', monument = false, linked = true } = {}) {
  await insert('races', { id: id(`race:${key}`), slug: key, competition_type: competition, is_monument: monument });
  await insert('race_editions', { id: id(`edition:${key}`), race_id: id(`race:${key}`), season_id: id(`s${year}`), display_name: key, status });
  await insert('stages', { id: id(`stage:${key}`), race_edition_id: id(`edition:${key}`), season_day_id: id(`day${year}`), stage_number: 1, departure_at: '2026-11-20T13:00:00Z' });
  await insert('race_registrations', { id: id(`reg:${key}`), race_edition_id: id(`edition:${key}`), team_season_id: club ? id(`ts:old:${year}`) : null });
  await insert('riders', { id: id(`rider:${key}`), first_name: key, last_name: 'Winner' });
  await insert('race_rosters', { id: id(`roster:${key}`), race_registration_id: id(`reg:${key}`), rider_id: id(`rider:${key}`) });
  await insert('race_results', { id: id(`result:${key}`), race_edition_id: id(`edition:${key}`), race_roster_id: id(`roster:${key}`), final_rank: rank, status: resultStatus, created_at: '2026-11-20T15:00:00Z' });
  if (!club && linked) {
    await insert('national_federation_selection_lists', { id: id(`selection:${key}`), season_id: id(`s${year}`), country_id: id('nation') });
    await insert('national_federation_selection_race_links', { selection_list_id: id(`selection:${key}`), race_registration_id: id(`reg:${key}`), race_edition_id: id(`edition:${key}`) });
    await insert('national_federation_selection_members', { id: id(`member:${key}`), selection_list_id: id(`selection:${key}`), professional_rider_id: id(`rider:${key}`), owner_team_id: callupOwner ? id(`team:${callupOwner}`) : null, owner_director_id: callupOwner ? id(`director:${callupOwner}`) : null, response_status: 'confirmed' });
  }
  if (contractOwner) await insert('rider_contracts', { id: id(`contract:${key}`), rider_id: id(`rider:${key}`), team_id: id(`team:${contractOwner}`), start_season_id: id(`s${year}`), end_season_id: id(`s${year}`), signed_at: '2026-11-01T12:00:00Z', created_at: '2026-11-01T12:00:00Z', joined_day_number: 1, left_day_number: transfer ? 15 : 28, status: transfer ? 'terminated' : 'active' });
  if (transfer) await insert('rider_contracts', { id: id(`transfer:${key}`), rider_id: id(`rider:${key}`), team_id: id('team:new'), start_season_id: id(`s${year}`), end_season_id: id(`s${year}`), signed_at: transfer === 'before' ? '2026-11-20T12:00:00Z' : '2026-11-20T14:00:00Z', created_at: '2026-11-20T10:00:00Z', joined_day_number: 15, left_day_number: 28, status: 'active' });
}
await race('historic-s3', { year: 3 });
await race('normal-cc');
await race('normal-cm', { competition: 'world_championship' });
await race('before-transfer', { transfer: 'before' });
await race('after-transfer', { transfer: 'after' });
await race('free-agent-signing', { contractOwner: 'new', callupOwner: null });
await race('still-free-agent', { contractOwner: null, callupOwner: null });
await race('nonwinner', { rank: 2 });
await race('unclassified', { resultStatus: 'dnf' });
await race('scheduled', { status: 'scheduled' });
await race('games', { competition: 'nations_cup' });
await race('national', { competition: 'national_championship' });
await race('ordinary', { competition: 'standard' });
await race('monument', { competition: 'standard', club: true, monument: true });
const wins = owner => query('select race_slug from public.get_sporting_director_selection_trophy_wins($1) order by race_slug', [id(`director:${owner}`)]).then(rows => rows.map(row => row.race_slug));
assert.deepEqual(await wins('old'), ['after-transfer', 'historic-s3', 'normal-cc', 'normal-cm']);
assert.deepEqual(await wins('new'), ['before-transfer', 'free-agent-signing']);
assert.deepEqual(await wins('president'), []);
const before = await scalar(`select jsonb_agg(to_jsonb(result) order by id)::text from race_results result`);
let notified = 0;
for (const key of ['historic-s3', 'normal-cc', 'normal-cm', 'before-transfer', 'after-transfer', 'free-agent-signing', 'still-free-agent', 'nonwinner', 'unclassified', 'scheduled', 'games', 'national', 'ordinary', 'monument']) {
  notified += await scalar('select private.notify_major_race_trophies($1)', [id(`edition:${key}`)]);
  assert.equal(await scalar('select private.notify_major_race_trophies($1)', [id(`edition:${key}`)]), 0, `Repeated ${key} notification is idempotent`);
}
assert.equal(notified, 7);
assert.equal(await scalar('select count(*)::int from sporting_director_messages'), 7);
assert.deepEqual(await query('select sporting_director_id, team_season_id from sporting_director_trophy_notifications where source_reference=$1', [`race:${id('result:before-transfer')}`]), [{ sporting_director_id: id('director:new'), team_season_id: id('ts:new:5') }]);
assert.equal(await scalar('select count(*)::int from sporting_director_trophy_notifications where sporting_director_id=$1', [id('director:president')]), 0);
assert.equal(await scalar(`select jsonb_agg(to_jsonb(result) order by id)::text from race_results result`), before);
assert.equal(await scalar("select has_function_privilege('authenticated','public.get_sporting_director_selection_trophy_wins(uuid)','EXECUTE')"), false);
assert.equal(await scalar("select has_function_privilege('anon','public.get_sporting_director_selection_trophy_wins(uuid)','EXECUTE')"), false);
assert.equal(await scalar("select has_function_privilege('service_role','public.get_sporting_director_selection_trophy_wins(uuid)','EXECUTE')"), true);
console.log('Selection trophies passed: S3/CC/CM, start-time owners, free-agent signing, gallery scope, club trophy, idempotence and service-only permissions.');
await db.close();
