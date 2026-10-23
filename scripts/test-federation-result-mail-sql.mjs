// Disposable PostgreSQL/WASM only: no credentials, URL or production connection.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

if (!process.env.FINANCE_SQL_TEST_MODULE) throw Error('FINANCE_SQL_TEST_MODULE must point to an isolated PGlite module');
const { PGlite } = await import(pathToFileURL(process.env.FINANCE_SQL_TEST_MODULE).href);
const db = new PGlite();
const original = readFileSync('supabase/migrations/20260808165000_create_sporting_director_mailbox.sql', 'utf8');
const migration = readFileSync('supabase/migrations/20261023150000_fix_federation_result_mail_recipients.sql', 'utf8');
const keys = new Map();
let sequence = 0;
const id = key => {
  if (!keys.has(key)) keys.set(key, `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`);
  return keys.get(key);
};
let checks = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const query = (sql, args = []) => db.query(sql, args).then(result => result.rows);
const scalar = async (sql, args = []) => Object.values((await query(sql, args))[0])[0];
const publish = edition => scalar('select public.publish_director_race_result_messages($1)', [id(edition)]);
const messages = edition => query(`select sporting_director_id,team_season_id,message_type,sender_name,subject,preview,body,action_href,action_label,source_reference,is_important,sent_at,read_at,archived_at from sporting_director_messages where source_reference like $1 order by sporting_director_id,source_reference`, [`race-result:${id(edition)}:%`]);
const functionSource = name => {
  const start = original.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `Original SQL function ${name} exists`);
  return original.slice(start, original.indexOf('$$;', start) + 3);
};
const sqlInsert = async (table, row) => {
  const fields = Object.keys(row);
  await query(`insert into ${table} (${fields.join(',')}) values (${fields.map((_, index) => `$${index + 1}`).join(',')})`, Object.values(row));
};
async function edition(key, { category = 'elite', competition = 'standard', status = 'completed', format = 'one_day', stages = 1 } = {}) {
  await sqlInsert('races', { id: id(`race:${key}`), slug: `fixture-${key}`, race_format: format, competition_type: competition });
  await sqlInsert('race_editions', { id: id(key), race_id: id(`race:${key}`), season_id: id('season'), race_category_id: id(`category:${category}`), display_name: key, status });
  for (let stage = 1; stage <= stages; stage++) await sqlInsert('stages', { id: id(`stage:${key}:${stage}`), race_edition_id: id(key), stage_number: stage });
}
async function owner(key, { active = true, assigned = true, currentSeason = true } = {}) {
  await sqlInsert('sporting_directors', { id: id(`director:${key}`), auth_user_id: id(`user:${key}`), status: active ? 'active' : 'inactive' });
  await sqlInsert('teams', { id: id(`team:${key}`) });
  if (assigned) await sqlInsert('team_manager_assignments', { sporting_director_id: id(`director:${key}`), team_id: id(`team:${key}`), role: 'general_manager', status: 'active' });
  if (currentSeason) await sqlInsert('team_seasons', { id: id(`team-season:${key}`), team_id: id(`team:${key}`), season_id: id('season'), cash_balance: 123456 });
  await sqlInsert('team_seasons', { id: id(`old-team-season:${key}`), team_id: id(`team:${key}`), season_id: id('old-season'), cash_balance: 99999 });
}
const registrations = new Map();
async function registration(editionKey, group, teamSeason = null, { linked = true, selectionSeason = 'season' } = {}) {
  const key = `${editionKey}:${group}`;
  if (registrations.has(key)) return registrations.get(key);
  const registrationId = id(`registration:${key}`);
  await sqlInsert('race_registrations', { id: registrationId, race_edition_id: id(editionKey), team_season_id: teamSeason });
  if (!teamSeason && linked) {
    await sqlInsert('national_federation_selection_lists', { id: id(`selection:${key}`), season_id: id(selectionSeason), country_id: id(`country:${group}`), status: 'finalized', slot_key: 'cc-pro-itt' });
    await sqlInsert('national_federation_selection_race_links', { selection_list_id: id(`selection:${key}`), race_edition_id: id(editionKey), race_registration_id: registrationId });
  }
  registrations.set(key, registrationId);
  return registrationId;
}
async function result(editionKey, riderKey, { ownerKey = 'fra', group = 'rwanda', rank = 10, status = 'classified', club = false, response = 'confirmed', selected = true, roster = true, recorded = true, linked = true, selectionSeason = 'season', noDirector = false, noTeam = false } = {}) {
  const registrationId = await registration(editionKey, group, club ? id(`team-season:${ownerKey}`) : null, { linked, selectionSeason });
  await sqlInsert('riders', { id: id(`rider:${riderKey}`), first_name: riderKey, last_name: 'Fixture', reputation: 50 });
  // A transfer after selection must not reroute historical race mail.
  await sqlInsert('rider_contracts', { id: id(`contract:${riderKey}`), rider_id: id(`rider:${riderKey}`), team_id: id('team:buyer'), status: 'active' });
  if (!club && selected && linked) await sqlInsert('national_federation_selection_members', {
    id: id(`member:${editionKey}:${riderKey}`), selection_list_id: id(`selection:${editionKey}:${group}`), professional_rider_id: id(`rider:${riderKey}`),
    junior_rider_id: null, owner_director_id: noDirector ? null : id(`director:${ownerKey}`), owner_team_id: noTeam ? null : id(`team:${ownerKey}`), response_status: response,
  });
  if (!roster) return;
  await sqlInsert('race_rosters', { id: id(`roster:${editionKey}:${riderKey}`), race_registration_id: registrationId, rider_id: id(`rider:${riderKey}`) });
  if (recorded) await sqlInsert('race_results', { id: id(`result:${editionKey}:${riderKey}`), race_edition_id: id(editionKey), race_roster_id: id(`roster:${editionKey}:${riderKey}`), final_rank: rank, status, prize_money: rank === 1 ? 1500 : 0 });
}
const sportingSnapshot = () => scalar(`select jsonb_build_object('results',(select jsonb_agg(to_jsonb(r) order by id) from race_results r),'riders',(select jsonb_agg(to_jsonb(r) order by id) from riders r),'finances',(select jsonb_agg(to_jsonb(t) order by id) from team_seasons t),'contracts',(select jsonb_agg(to_jsonb(c) order by id) from rider_contracts c))::text`);
async function timings(key, calls = 5) {
  await publish(key); // Warm-up includes the same already-existing mail state.
  const values = [];
  for (let sample = 0; sample < calls; sample++) { const start = performance.now(); await publish(key); values.push(performance.now() - start); }
  values.sort((a, b) => a - b);
  return { medianMs: Number(values[Math.floor(values.length / 2)].toFixed(2)), maxMs: Number(values.at(-1).toFixed(2)), calls };
}

try {
  await db.exec(`
    create schema auth; create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.auth_uid',true),'')::uuid$$;
    create table seasons(id uuid primary key);
    create table teams(id uuid primary key);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,cash_balance numeric,unique(team_id,season_id));
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create index assignment_team_status_idx on team_manager_assignments(team_id,status);
    create table race_categories(id uuid primary key,code text);
    create table races(id uuid primary key,slug text,race_format text,competition_type text);
    create table race_editions(id uuid primary key,race_id uuid,season_id uuid,race_category_id uuid,display_name text,status text);
    create table stages(id uuid primary key,race_edition_id uuid,stage_number integer);
    create index stages_edition_idx on stages(race_edition_id);
    create table riders(id uuid primary key,first_name text,last_name text,reputation integer);
    create table rider_contracts(id uuid primary key,rider_id uuid,team_id uuid,status text);
    create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid);
    create index registrations_edition_idx on race_registrations(race_edition_id);
    create table race_rosters(id uuid primary key,race_registration_id uuid,rider_id uuid,unique(race_registration_id,rider_id));
    create index roster_registration_idx on race_rosters(race_registration_id);
    create table race_results(id uuid primary key,race_edition_id uuid,race_roster_id uuid,final_rank integer,status text,prize_money numeric);
    create index results_edition_idx on race_results(race_edition_id);
    create table national_federation_selection_lists(id uuid primary key,season_id uuid,country_id uuid,status text,slot_key text);
    create table national_federation_selection_race_links(selection_list_id uuid primary key,race_edition_id uuid,race_registration_id uuid unique);
    create index links_edition_idx on national_federation_selection_race_links(race_edition_id);
    create table national_federation_selection_members(id uuid primary key,selection_list_id uuid,professional_rider_id uuid,junior_rider_id uuid,owner_director_id uuid,owner_team_id uuid,response_status text,unique(selection_list_id,professional_rider_id));
    create index selection_members_owner_idx on national_federation_selection_members(owner_director_id);
  `);
  const tableStart = original.indexOf('create table public.sporting_director_messages (');
  await db.exec(original.slice(tableStart, original.indexOf('\n);', tableStart) + 4));
  await db.exec(functionSource('publish_director_race_result_messages'));
  await db.exec(functionSource('publish_director_race_result_messages_trigger'));
  await db.exec(`create trigger race_editions_publish_director_result_messages after update of status on race_editions for each row execute function public.publish_director_race_result_messages_trigger();
    revoke all on function public.publish_director_race_result_messages(uuid) from public,anon,authenticated;
    grant execute on function public.publish_director_race_result_messages(uuid) to service_role;`);
  await db.exec(readFileSync('supabase/migrations/20260904013000_preserve_deleted_director_messages.sql', 'utf8'));
  for (const key of ['season', 'old-season']) await sqlInsert('seasons', { id: id(key) });
  for (const code of ['elite', 'world', 'continental', 'national']) await sqlInsert('race_categories', { id: id(`category:${code}`), code });
  await owner('fra'); await owner('other'); await owner('buyer');
  await owner('inactive', { active: false }); await owner('frozen', { assigned: false }); await owner('old-only', { currentSeason: false });

  const clubCases = [
    ['elite-club', { category: 'elite', format: 'stage_race', stages: 3 }, 11, 1],
    ['world-club', { category: 'world', stages: 2 }, 15, 1],
    ['continental-podium', { category: 'continental' }, 3, 1],
    ['continental-no-podium', { category: 'continental' }, 4, 0],
    ['national-podium', { category: 'national' }, 2, 1],
    ['national-no-podium', { category: 'national' }, 9, 0],
    ['national-road', { competition: 'national_road' }, 1, 0],
    ['national-tt', { competition: 'national_time_trial' }, 1, 0],
    ['unfinished', { status: 'running' }, 1, 0],
  ];
  const baseline = new Map();
  for (const [key, options, rank, count] of clubCases) {
    await edition(key, options); await result(key, `rider-${key}`, { rank, club: true });
    check(await publish(key), count, `Original club rule: ${key}`);
    baseline.set(key, await messages(key));
  }
  await edition('cc', { competition: 'continental_championship', category: 'continental' });
  await result('cc', 'Alpha', { rank: 10 });
  await result('cc', 'Beta', { group: 'france', rank: 20 });
  await result('cc', 'Abandon', { rank: null, status: 'did_not_finish' });
  await result('cc', 'Frozen', { ownerKey: 'frozen', group: 'belgium', rank: 1 });
  await result('cc', 'Other', { ownerKey: 'other', group: 'rwanda', rank: 30 });
  await result('cc', 'Inactive', { ownerKey: 'inactive', rank: 7 });
  await result('cc', 'Declined', { response: 'declined', rank: 6 });
  await result('cc', 'Draft', { response: 'draft', rank: 5 });
  await result('cc', 'Pending', { response: 'pending', rank: 4 });
  await result('cc', 'No-roster', { roster: false });
  await result('cc', 'No-result', { recorded: false });
  await result('cc', 'Unselected', { selected: false });
  await result('cc', 'Unlinked', { linked: false, group: 'unlinked' });
  await result('cc', 'Wrong-season', { selectionSeason: 'old-season', group: 'old-list' });
  await result('cc', 'Old-team-only', { ownerKey: 'old-only' });
  await result('cc', 'No-owner', { noDirector: true });
  await result('cc', 'No-team', { noTeam: true });
  check(await publish('cc'), 0, 'Reproduces missing national-selection CC mail with the real previous publisher');
  const before = await sportingSnapshot();
  const oldClubTimings = await timings('elite-club');
  const oldCcTimings = await timings('cc');

  await db.exec(migration);
  for (const [key, , , count] of clubCases) {
    check(await publish(key), count, `Unchanged club affected-row behavior: ${key}`);
    check(await messages(key), baseline.get(key), `Full unchanged club mail, state and timestamp: ${key}`);
  }
  check((await messages('elite-club'))[0].action_href, '/jeu/resultats/fixture-elite-club', 'Stage race result link unchanged');
  check((await messages('world-club'))[0].action_href, '/jeu/resultats/fixture-world-club/2', 'Single-day final-stage link unchanged');
  check(await publish('cc'), 3, 'CC creates one mail per frozen owner/team, including non-podium');
  const ccMessages = await messages('cc');
  const fra = ccMessages.find(row => row.sporting_director_id === id('director:fra'));
  check(fra.team_season_id, id('team-season:fra'), 'Uses the race season, never another team season');
  check(fra.sender_name, 'Fédération internationale', 'International sender retained');
  check(fra.is_important, true, 'CC result important even outside podium');
  for (const name of ['Alpha', 'Beta', 'Abandon']) check(fra.body.includes(`${name} Fixture`), true, `Participant listed: ${name}`);
  for (const name of ['Inactive', 'Declined', 'Draft', 'Pending', 'No-roster', 'No-result', 'Unselected', 'Unlinked', 'Wrong-season', 'Old-team-only', 'No-owner', 'No-team', 'Other', 'Frozen']) check(fra.body.includes(`${name} Fixture`), name === 'Frozen', `Only this team's eligible race participants: ${name}`); // Frozen is the overall winner in every body.
  check(fra.subject, 'Résultats majeurs — cc', 'Best team result excludes draft/declined/pending riders');
  check(fra.body.match(/Alpha Fixture/g)?.length, 1, 'No duplicate rider summary');
  check(fra.body.match(/Beta Fixture/g)?.length, 1, 'Two national selections grouped in one club mail');
  check(ccMessages.some(row => row.sporting_director_id === id('director:buyer')), false, 'Transfer buyer/current contract never receives historical selection mail');
  check(ccMessages.some(row => row.sporting_director_id === id('director:frozen')), true, 'Frozen owner remains recipient without a current active-GM assignment');
  check(ccMessages.some(row => row.team_season_id === id('old-team-season:fra')), false, 'Old-season club never used');
  check(await sportingSnapshot(), before, 'Mail publishing changes no result, prize, reputation, contract or club balance');

  await query(`update sporting_director_messages set read_at='2026-10-01T12:00:00Z',archived_at='2026-10-02T12:00:00Z',sent_at='2026-09-30T12:00:00Z' where sporting_director_id=$1 and source_reference=$2`, [id('director:fra'), fra.source_reference]);
  const saved = await messages('cc');
  await publish('cc');
  check(await messages('cc'), saved, 'Retry preserves all mail content, sent_at, read_at, archived_at and recipient cardinality');
  await query("select set_config('test.auth_uid',$1,false)", [id('user:fra')]);
  check(await scalar('select delete_current_director_message(id) from sporting_director_messages where sporting_director_id=$1 and source_reference=$2', [id('director:fra'), fra.source_reference]), true, 'Real mailbox deletion RPC succeeds');
  await publish('cc');
  check((await messages('cc')).length, 2, 'Durable deletion trigger prevents recreation during catch-up');
  check(await scalar('select count(*)::int from sporting_director_message_deletions where sporting_director_id=$1', [id('director:fra')]), 1, 'Deletion tombstone remains');

  await edition('worlds', { competition: 'world_championship', category: 'national' });
  await result('worlds', 'Worlds', { rank: 42 });
  check(await publish('worlds'), 1, 'Same correction applies to professional world championships outside podium');
  await edition('mixed-cc', { competition: 'continental_championship', category: 'continental' });
  await result('mixed-cc', 'Mixed-club', { rank: 9, club: true, group: 'club-fra' });
  await result('mixed-cc', 'Mixed-selection', { rank: 10 });
  const mixedSnapshot = await sportingSnapshot();
  check(await publish('mixed-cc'), 1, 'Club and federation entries sharing an owner/team produce only one source-key insert');
  const mixedMessages = await messages('mixed-cc');
  check(mixedMessages.length, 1, 'Mixed registration cannot trigger ON CONFLICT cardinality violation');
  for (const name of ['Mixed-club', 'Mixed-selection']) check(mixedMessages[0].body.includes(`${name} Fixture`), true, `Mixed summary contains ${name}`);
  const mixedSaved = await messages('mixed-cc');
  await publish('mixed-cc');
  check(await messages('mixed-cc'), mixedSaved, 'Mixed-source retries remain stable');
  check(await sportingSnapshot(), mixedSnapshot, 'Mixed-source mail does not change sporting or financial state');
  await edition('federal-not-cc', { competition: 'nations_cup', category: 'world' });
  await result('federal-not-cc', 'Nations', { rank: 1 });
  check(await publish('federal-not-cc'), 0, 'Extension deliberately restricted to professional CC/CM');
  for (const competition of ['continental_championship_junior', 'world_championship_junior']) {
    await edition(competition, { competition });
    await result(competition, `${competition}-fixture`, { rank: 1 });
    check(await publish(competition), 0, `No unintended extension to ${competition}`);
  }
  await edition('future-cc', { competition: 'continental_championship', status: 'running' });
  await result('future-cc', 'Future', { rank: 2 });
  check(await publish('future-cc'), 0, 'Incomplete CC sends nothing');
  await query("update race_editions set status='completed' where id=$1", [id('future-cc')]);
  check((await messages('future-cc')).length, 1, 'Existing completion trigger automatically uses corrected publisher');
  const triggered = await messages('future-cc');
  await query("update race_editions set status='completed' where id=$1", [id('future-cc')]);
  check(await messages('future-cc'), triggered, 'Repeat completion does not create new mail');
  check(await scalar("select prosecdef and proconfig=array['search_path=\"\"'] from pg_proc where oid='publish_director_race_result_messages(uuid)'::regprocedure"), true, 'Security-definer and empty search_path preserved');
  check(await scalar("select has_function_privilege('authenticated','publish_director_race_result_messages(uuid)','execute')"), false, 'Player cannot call publisher directly');
  check(await scalar("select has_function_privilege('service_role','publish_director_race_result_messages(uuid)','execute')"), true, 'Service role permission preserved');
  console.log(JSON.stringify({ checks, club: { before: oldClubTimings, after: await timings('elite-club') }, cc: { previousMissingMail: oldCcTimings, corrected: await timings('cc') }, note: 'Isolated PGlite warm retries only, not production latency; CC now performs the missing mail writes. No production fixtures.' }, null, 2));
} finally {
  await db.close();
}
