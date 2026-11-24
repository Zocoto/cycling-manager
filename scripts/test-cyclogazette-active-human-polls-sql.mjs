// Isolated PostgreSQL only: no credentials, HTTP or production connections.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]?.replaceAll('\\', '/').endsWith('/pglite/dist/index.js')) throw Error('Isolated PGlite module required');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const read = path => readFileSync(path, 'utf8');
const original = read('supabase/migrations/20260831113000_add_cyclogazette_daily_polls.sql');
const enrichment = read('supabase/migrations/20260919060000_make_gazette_polls_linked_and_race_aware.sql');
const migration = read('supabase/migrations/20261124113729_focus_gazette_polls_on_active_human_clubs.sql');
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const scalar = async (sql, args = []) => Object.values((await rows(sql, args))[0])[0];
let checks = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const denied = async (sql, args = [], pattern) => { await assert.rejects(() => db.query(sql, args), pattern); checks++; };
const activeTeams = new Set([10, 11, 34].map(id));
const recognizable = new Set([1001, 1002, 1003, 1101, 1102, 1103, 3401, 3404, 3405].map(id));
async function createClub(number, flags = {}) {
  const team = id(number), teamSeason = id(1000 + number), director = id(2000 + number), auth = id(3000 + number);
  await db.query('insert into teams values($1,$2)', [team, flags.teamStatus ?? 'active']);
  await db.query('insert into team_seasons values($1,$2,$3,$4,$5)', [teamSeason, team, id(5), flags.name ?? `Known ${number}`, flags.seasonStatus ?? 'active']);
  await db.query('insert into sporting_directors values($1,$2,$3)', [director, auth, flags.directorStatus ?? 'active']);
  if (flags.manager !== false) await db.query('insert into team_manager_assignments values($1,$2,$3,$4,$5,$6,$7)',
    [id(4000 + number), team, director, 'general_manager', flags.assignmentStatus ?? 'active', id(flags.managerStart ?? 5), null]);
  if (flags.presence !== null) await db.query("insert into player_daily_activity values($1,(now() at time zone 'Europe/Paris')::date-$2::integer,null)", [auth, flags.presence ?? 0]);
  for (let index = 1; index <= (flags.count ?? 5); index++) {
    const rider = id(number * 100 + index);
    const homonym = number === 10 && index === 1 || number === 34 && index === 4;
    await db.query('insert into riders values($1,$2,$3,$4)', [rider, homonym ? 'Sam' : `Rider ${number}`, homonym ? 'Identique' : String(index), flags.riderStatus ?? 'active']);
    await db.query('insert into rider_contracts values($1,$2,$3,$4,$5,$6)', [id(500000 + number * 100 + index), rider, team,
      flags.contractStatus ?? 'active', id(flags.start ?? 5), id(flags.end ?? 6)]);
    if (flags.rating !== false) {
      const mountain = flags.badRating ? 100.001 : number === 10 && index === 3 ? 100 : index <= 3 ? 86 - index : 103 - index;
      await db.query(`insert into rider_season_ratings values($1,$2,$3,70,70,70,70,70,70,70,70,$4,70,70,70)`, [rider, id(5), mountain, flags.zeroRating ? 0 : 70]);
      await db.query('insert into rider_season_summaries values($1,$2,$3)', [rider, id(5), number === 34 ? 0 : index <= 3 ? 400 - index * 100 : 0]);
    }
  }
}
async function register(race, team, { roster = true, status = 'confirmed', riderTeam = team, teamSeasonId = id(1000 + team) } = {}) {
  const registration = id(race * 1000 + team);
  await db.query('insert into race_registrations values($1,$2,$3,$4)', [registration, id(race), teamSeasonId, 'accepted']);
  if (roster) await db.query('insert into race_rosters values($1,$2,$3,$4)', [id(race * 10000 + team), registration, id(riderTeam * 100 + 1), status]);
}
async function makeEdition(issue) {
  const edition = id(800000 + issue);
  await db.query('insert into cyclogazette_editions values($1,$2,$3,$4,now())', [edition, id(5), id(101), issue]);
  return edition;
}
async function makePoll(issue) {
  const edition = await makeEdition(issue);
  const pollId = await scalar('select private.ensure_cyclogazette_poll($1)', [edition]);
  const poll = (await rows('select * from cyclogazette_polls where id=$1', [pollId]))[0];
  check(await scalar('select private.ensure_cyclogazette_poll($1)', [edition]), pollId);
  return poll;
}
function validateReferences(poll) {
  check(poll.options.length >= 2 && poll.options.length <= 4, true);
  check(poll.options.map(option => option.id), poll.options.map((_, index) => `option-${index + 1}`));
  for (const reference of [...poll.options, ...poll.subjects]) {
    if (!reference.href) continue;
    if (reference.href.startsWith('/jeu/equipes/')) check(activeTeams.has(reference.href.split('/').at(-1)), true, 'no inactive, empty or bot team can return through another path');
    else if (reference.href.startsWith('/jeu/coureurs/')) check(recognizable.has(reference.href.split('/').at(-1)), true, 'only recognizable members of active human clubs are proposed');
    else check(reference.href, '/jeu/courses/valid-classic');
  }
}

try {
  await db.exec(`
    create schema private;create role anon;create role authenticated;create role service_role;
    create table seasons(id uuid primary key,game_year integer,status text);
    create table season_days(id uuid primary key,day_number integer);
    create table cyclogazette_editions(id uuid primary key,season_id uuid,season_day_id uuid,issue_number integer,published_at timestamptz);
    create table teams(id uuid primary key,status text);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,display_name text,status text);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table team_manager_assignments(id uuid primary key,team_id uuid,sporting_director_id uuid,role text,status text,start_season_id uuid,end_season_id uuid);
    create table alpha_bot_managers(sporting_director_id uuid,auth_user_id uuid,team_id uuid,enabled boolean);
    create table player_daily_activity(auth_user_id uuid,activity_on date,last_seen_at timestamptz,primary key(auth_user_id,activity_on));
    create table riders(id uuid primary key,first_name text,last_name text,status text);
    create table rider_contracts(id uuid primary key,rider_id uuid,team_id uuid,status text,start_season_id uuid,end_season_id uuid);
    create table rider_season_ratings(rider_id uuid,season_id uuid,mountain numeric,hills numeric,flat numeric,time_trial numeric,cobbles numeric,sprint numeric,
      acceleration numeric,downhill numeric,endurance numeric,resistance numeric,recovery numeric,breakaway numeric,prologue numeric,primary key(rider_id,season_id));
    create table rider_season_summaries(rider_id uuid,season_id uuid,points integer,primary key(rider_id,season_id));
    create table youth_academy_riders(team_id uuid,first_name text);
    create table races(id uuid primary key,status text,competition_type text,slug text);
    create table race_editions(id uuid primary key,race_id uuid,season_id uuid,display_name text,status text);
    create table stages(id uuid primary key,race_edition_id uuid,season_day_id uuid);
    create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid,status text);
    create table race_rosters(id uuid primary key,race_registration_id uuid,rider_id uuid,status text);
    create table race_results(id uuid primary key,race_edition_id uuid,race_roster_id uuid,final_rank integer,status text);
    insert into seasons values('${id(4)}',4,'completed'),('${id(5)}',5,'active'),('${id(6)}',6,'planned');
    insert into season_days values('${id(101)}',1),('${id(102)}',2),('${id(103)}',3),('${id(104)}',4),('${id(105)}',5);
  `);
  await createClub(9, { name: 'Known 10', presence: 30 }); // an ineligible team-name homonym sorts before the real club.
  await createClub(10);
  await createClub(11, { presence: 13 }); // inclusive 14-calendar-day boundary with no timestamp fallback.
  await createClub(12, { presence: 30 });
  await createClub(13, { name: 'Tym Cycling', count: 0 });
  await createClub(14); await createClub(15, { manager: false });
  await createClub(16, { teamStatus: 'dissolved' }); await createClub(17, { directorStatus: 'inactive' });
  await createClub(18, { seasonStatus: 'completed' }); await createClub(19, { start: 6 });
  await createClub(20, { end: 4 }); await createClub(21, { riderStatus: 'free_agent' });
  await createClub(22, { riderStatus: 'retired' }); await createClub(23, { rating: false });
  await createClub(24, { zeroRating: true }); await createClub(25, { count: 0 });
  await db.query('insert into youth_academy_riders values($1,$2)', [id(25), 'Junior only']);
  await createClub(26, { presence: null }); await createClub(27);
  await createClub(28, { presence: -1 }); await createClub(29, { presence: 14 });
  await createClub(30, { assignmentStatus: 'completed' }); await createClub(31, { contractStatus: 'completed' });
  await createClub(32, { badRating: true }); await createClub(33, { managerStart: 6 });
  await createClub(34); await createClub(35);
  await db.query('insert into alpha_bot_managers values($1,$2,$3,false),($4,$5,$6,false),($7,$8,$9,false)',
    [id(2014), id(3014), id(14), id(9991), id(3027), id(9992), id(9993), id(9994), id(35)]);

  // Four future events: individual championships, empty startlists and a
  // one-human event must all lose to the valid two-human classic.
  for (const [race, type, slug, day] of [[201, 'national_road', 'national', 2], [202, 'standard', 'no-roster', 2], [203, 'standard', 'one-human', 2], [204, 'standard', 'valid-classic', 3]]) {
    await db.query('insert into races values($1,$2,$3,$4)', [id(race), 'active', type, slug]);
    await db.query('insert into race_editions values($1,$2,$3,$4,$5)', [id(race), id(race), id(5), slug, 'registration_open']);
    await db.query('insert into stages values($1,$2,$3)', [id(race + 1000), id(race), id(100 + day)]);
  }
  await register(201, 10); await register(201, 11);
  await register(202, 10, { status: 'withdrawn' }); await register(202, 11, { roster: false });
  await register(203, 10); await register(203, 13, { roster: false }); await register(203, 14);
  await register(204, 10); await register(204, 11); await register(204, 13, { roster: false }); await register(204, 14);
  await db.query('insert into race_editions values($1,$2,$3,$4,$5)', [id(304), id(204), id(4), 'Prior classic', 'completed']);
  for (const team of [10, 14]) {
    await db.query('insert into team_seasons values($1,$2,$3,$4,$5)', [id(9000 + team), id(team), id(4), `Prior club ${team}`, 'completed']);
    await register(304, team, { teamSeasonId: id(9000 + team) });
  }
  await db.query('insert into race_results values($1,$2,$3,1,$4)', [id(700001), id(304), id(304 * 10000 + 14), 'classified']);

  // Install the actual former generator and enrich trigger, without historical
  // one-off backfills. Reproduce the reported empty-team poll with real votes.
  await db.exec(original.slice(0, original.indexOf('create or replace function private.create_cyclogazette_poll_after_publication()')) + '\ncommit;');
  await db.exec(enrichment.slice(0, enrichment.indexOf('-- Add navigable references to the archive')));
  const oldEdition = await makeEdition(130);
  await db.query(`insert into cyclogazette_polls(edition_id,topic_type,question,options)
    values($1,'team_opinion','Que pensez-vous de Tym Cycling cette saison ?',
    '[{"id":"option-1","label":"Elle impressionne"},{"id":"option-2","label":"Elle progresse"}]')`, [oldEdition]);
  const oldPoll = await scalar('select id from cyclogazette_polls where edition_id=$1', [oldEdition]);
  await db.query('insert into cyclogazette_poll_votes(poll_id,sporting_director_id,option_id) values($1,$2,$3),($1,$4,$5)',
    [oldPoll, id(2010), 'option-1', id(2011), 'option-2']);
  const archiveBefore = await rows('select * from cyclogazette_polls order by id');
  const votesBefore = await rows('select * from cyclogazette_poll_votes order by id');
  const rostersBefore = await rows('select * from race_rosters order by id');
  const oldTrigger = await scalar("select pg_get_functiondef('private.enrich_cyclogazette_poll_entities()'::regprocedure)");
  await db.exec(migration);
  check(await rows('select * from cyclogazette_polls order by id'), archiveBefore);
  check(await rows('select * from cyclogazette_poll_votes order by id'), votesBefore);
  check(await scalar('select private.ensure_cyclogazette_poll($1)', [oldEdition]), oldPoll);
  const pool = await rows('select * from private.cyclogazette_poll_candidate_riders($1)', [id(5)]);
  check([...new Set(pool.map(candidate => candidate.team_id))].sort(), [...activeTeams].sort());
  check(pool.length, 15);
  check(pool.some(candidate => Number(candidate.primary_strength) === 100), true, '100 is a legitimate native rating');
  const newTrigger = await scalar("select pg_get_functiondef('private.enrich_cyclogazette_poll_entities()'::regprocedure)");
  check(newTrigger.replace("  -- Preserve authoritative future poll references.\n  if tg_op='INSERT' then return new; end if;\n", ''), oldTrigger, 'historical UPDATE enrichment stays byte-for-byte intact');

  const seenTeams = new Set(), seenRiders = new Set();
  for (let issue = 131; issue <= 170; issue++) {
    const poll = await makePoll(issue);
    check(poll.topic_type, ['team_opinion', 'rider_future', 'team_recruitment', 'race_prediction', 'rider_choice'][issue % 5]);
    validateReferences(poll);
    for (const reference of [...poll.options, ...poll.subjects]) {
      if (reference.href?.startsWith('/jeu/equipes/')) seenTeams.add(reference.href.split('/').at(-1));
      if (reference.href?.startsWith('/jeu/coureurs/')) seenRiders.add(reference.href.split('/').at(-1));
    }
    if (poll.topic_type === 'team_recruitment') check(poll.subjects[0].href !== poll.subjects[2].href, true, 'recruitment candidates belong to another real club');
    if (poll.topic_type === 'race_prediction') {
      check(poll.options.map(option => option.href).sort(), [id(10), id(11)].map(team => `/jeu/equipes/${team}`).sort());
      check(poll.question.includes('défend son titre'), false, 'inactive or bot former winner is not resurrected');
    }
  }
  check(seenTeams.size, 3);
  check(seenRiders.size >= 6, true, 'seeded rotation spreads questions beyond the same four stars');
  check(seenRiders.has(id(1001)) && seenRiders.has(id(3404)), true, 'homonyms keep distinct stable rider identities');

  // A genuine eligible defending champion can be highlighted, but only if its
  // current accepted startlist still has an active eligible professional.
  await db.query('update race_results set race_roster_id=$1 where id=$2', [id(304 * 10000 + 10), id(700001)]);
  const defenderPoll = await makePoll(173);
  check(defenderPoll.question.startsWith('Known 10 défend son titre'), true);
  check(defenderPoll.options[0].href, `/jeu/equipes/${id(10)}`);
  await db.query("update race_rosters set status='withdrawn' where race_registration_id=$1", [id(204 * 1000 + 11)]);
  const noRace = await makePoll(178);
  check(noRace.topic_type, 'team_opinion');
  check(noRace.question, 'Quelle est votre lecture du peloton actuel ?');
  check(noRace.subjects, []);
  check(noRace.options.some(option => option.href), false);

  // One remaining genuine club does not cause recruitment from a free-agent,
  // AI or vanished-team fallback; a complete absence gives generic polls for
  // every topic without rewriting previous polls or votes.
  await db.query("update player_daily_activity set activity_on=(now() at time zone 'Europe/Paris')::date-30 where auth_user_id=any($1)", [[id(3011), id(3034)]]);
  const noRecruit = await makePoll(182);
  check(noRecruit.question, 'Quelle est votre lecture du peloton actuel ?');
  check(noRecruit.subjects, []);
  await db.query("update player_daily_activity set activity_on=(now() at time zone 'Europe/Paris')::date-30 where auth_user_id=$1", [id(3010)]);
  for (let issue = 185; issue < 190; issue++) {
    const generic = await makePoll(issue);
    check(generic.question, 'Quelle est votre lecture du peloton actuel ?');
    check(generic.subjects, []);
    check(generic.options.some(option => option.href), false);
  }
  const archiveAfter = (await rows('select * from cyclogazette_polls where id=$1', [oldPoll]))[0];
  check(archiveAfter, archiveBefore[0]);
  check(await rows('select * from cyclogazette_poll_votes order by id'), votesBefore);
  await db.exec(migration);
  check((await rows('select * from cyclogazette_polls where id=$1', [oldPoll]))[0], archiveBefore[0]);
  for (const fn of ['private.cyclogazette_poll_candidate_riders(uuid)', 'private.ensure_cyclogazette_poll(uuid)']) {
    for (const role of ['anon', 'authenticated', 'service_role']) check(await scalar('select has_function_privilege($1,$2,$3)', [role, fn, 'execute']), false);
  }
  await db.exec('set role authenticated');
  await denied('select private.cyclogazette_poll_candidate_riders($1)', [id(5)], /permission denied/);
  await db.exec('reset role');
  check(await scalar('select private.ensure_cyclogazette_poll($1)', [id(999999)]), null);
  check((await rows('select * from race_rosters where id=$1', [id(201 * 10000 + 10)]))[0], rostersBefore.find(row => row.id === id(201 * 10000 + 10)), 'poll generation never changes sporting startlists');
  console.log(`${checks} isolated active-human Gazette poll checks passed: all topics, no ghost fallbacks, actual startlists, top-three rotation, homonyms, archive/vote preservation and private permissions.`);
} catch (error) {
  console.error({ message: error.message, code: error.code, query: error.query, where: error.where,
    actual: error.actual instanceof Error ? error.actual.message : error.actual, expected: error.expected });
  process.exitCode=1;
} finally { await db.close(); }
