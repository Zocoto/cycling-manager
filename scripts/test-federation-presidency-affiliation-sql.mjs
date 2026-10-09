// Isolated PostgreSQL-in-WASM only: no Supabase credentials or network access.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const uid = (name) => createHash('md5').update(name).digest('hex');
const id = (name) => `${uid(name).slice(0,8)}-${uid(name).slice(8,12)}-${uid(name).slice(12,16)}-${uid(name).slice(16,20)}-${uid(name).slice(20)}`;
const migration = await readFile('supabase/migrations/20261009170000_initialize_federation_presidents_on_affiliation.sql', 'utf8');
const base = await readFile('supabase/migrations/20260903230000_create_federation_elections.sql', 'utf8');
const nationality = await readFile('supabase/migrations/20260906130000_enforce_federation_president_nationality.sql', 'utf8');
const functionSql = (name) => {
  const start = nationality.indexOf(`create or replace function ${name}(`);
  assert.ok(start >= 0);
  return nationality.slice(start, nationality.indexOf('$$;', start) + 3);
};
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const country = async (code) => {
  const countryId = id(`country:${code}`);
  await db.query('insert into countries(id,iso_alpha2,name,is_active) values($1,$2,$2,true)', [countryId, code]);
  return countryId;
};
const addPlayer = async (name, countryId, seasonId = id('s4'), { human = true, reverseOrder = false } = {}) => {
  const teamId = id(`team:${name}`), directorId = id(`director:${name}`);
  await db.query("insert into teams values($1,'active')", [teamId]);
  await db.query("insert into sporting_directors values($1,$2,'active',$3)", [directorId, human ? id(`user:${name}`) : null, name]);
  const assignment = () => db.query("insert into team_manager_assignments(team_id,sporting_director_id,role,status) values($1,$2,'general_manager','active')", [teamId, directorId]);
  const affiliation = () => db.query("insert into team_seasons(id,team_id,season_id,registration_country_id,status,display_name) values($1,$2,$3,$4,'active',$5)", [id(`affiliation:${name}:${seasonId}`), teamId, seasonId, countryId, name]);
  if (reverseOrder) { await affiliation(); await assignment(); }
  else { await assignment(); await affiliation(); }
  return { teamId, directorId };
};
const term = (countryId) => one('select * from national_federation_terms where country_id=$1 order by start_game_year desc limit 1', [countryId]);
const electionCount = (countryId) => one('select count(*)::int n from national_federation_elections where country_id=$1', [countryId]).then(r => r.n);
const catchUp = () => one('select public.initialize_due_federation_presidencies() result').then(r => r.result);

try {
  await db.exec(`
    create schema private; create role anon; create role authenticated; create role service_role;
    create table countries(id uuid primary key, iso_alpha2 text unique, name text, is_active boolean default true);
    create table seasons(id uuid primary key, game_year int, status text, current_day_number int);
    create table teams(id uuid primary key,status text);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text,display_name text);
    create table team_manager_assignments(id uuid primary key default gen_random_uuid(),team_id uuid references teams,
      sporting_director_id uuid references sporting_directors,role text,status text,created_at timestamptz default now());
    create table team_seasons(id uuid primary key,team_id uuid references teams,season_id uuid references seasons,
      registration_country_id uuid references countries,status text,display_name text,points int default 0);
    create table sporting_director_messages(id uuid primary key default gen_random_uuid(),sporting_director_id uuid,
      season_id uuid,team_season_id uuid,message_type text,sender_name text,subject text,preview text,body text,
      action_href text,action_label text,source_reference text,is_important boolean,unique(sporting_director_id,source_reference));
    insert into seasons values('${id('s4')}',4,'active',7),('${id('s5')}',5,'planned',1);
    insert into countries values('3810ac68-ffbe-4d89-b2c5-615476ebc6f3','RW','Rwanda',true);
    insert into teams values('27948dd4-0dac-416d-8f6c-118771bcb6eb','active'),('${id('rwanda-other-team')}','active');
    insert into sporting_directors values('8406962e-41b9-4181-a372-3d57043de3a8','${id('sevri-user')}','active','sevrinovitch'),
      ('${id('rwanda-other-director')}','${id('other-user')}','active','Autre DS');
    insert into team_manager_assignments(team_id,sporting_director_id,role,status) values
      ('27948dd4-0dac-416d-8f6c-118771bcb6eb','8406962e-41b9-4181-a372-3d57043de3a8','general_manager','active'),
      ('${id('rwanda-other-team')}','${id('rwanda-other-director')}','general_manager','active');
    insert into team_seasons(id,team_id,season_id,registration_country_id,status,display_name) values
      ('${id('sevri-season')}','27948dd4-0dac-416d-8f6c-118771bcb6eb','${id('s4')}','3810ac68-ffbe-4d89-b2c5-615476ebc6f3','active','Kigali SafeRide'),
      ('${id('other-season')}','${id('rwanda-other-team')}','${id('s4')}','3810ac68-ffbe-4d89-b2c5-615476ebc6f3','active','Autre équipe');
  `);
  await db.exec(base.slice(base.indexOf('create table public.national_federation_elections'), base.indexOf('alter table public.national_federation_elections enable row level security')));
  await db.exec(nationality.slice(nationality.indexOf('alter table public.national_federation_elections'), nationality.indexOf('create or replace function public.get_projected_team_federation_country_id')));
  await db.exec(functionSql('public.open_exceptional_federation_election'));
  await db.exec(functionSql('public.enforce_federation_president_nationality'));
  await db.exec("insert into national_federation_terms(id,country_id,start_game_year,end_game_year) values('b61d9744-f51b-4125-a428-2c0bf599263d','3810ac68-ffbe-4d89-b2c5-615476ebc6f3',3,4)");
  await db.exec(migration);
  assert.equal((await term('3810ac68-ffbe-4d89-b2c5-615476ebc6f3')).president_director_id, '8406962e-41b9-4181-a372-3d57043de3a8');
  assert.equal(await electionCount('3810ac68-ffbe-4d89-b2c5-615476ebc6f3'), 0, 'Administrative exception does not invent a ballot');
  await db.exec(migration);
  assert.equal((await one('select count(*)::int n from sporting_director_messages')).n, 1, 'Rwanda repair is idempotent');

  const solo = await country('SO');
  await db.exec('begin'); const soloPlayer = await addPlayer('solo', solo); await db.exec('commit');
  assert.equal((await term(solo)).president_director_id, soloPlayer.directorId, 'Signup at S4 J7 nominates at commit');
  assert.equal((await term(solo)).start_game_year, 3); assert.equal((await term(solo)).end_game_year, 4);
  const messagesBefore = (await one('select count(*)::int n from sporting_director_messages')).n;
  assert.deepEqual(await catchUp(), { automatic: 0, exceptional: 0 });
  assert.equal((await one('select count(*)::int n from sporting_director_messages')).n, messagesBefore);
  await db.exec('begin'); await addPlayer('second-after-president', solo); await db.exec('commit');
  assert.equal((await term(solo)).president_director_id, soloPlayer.directorId, 'Later arrivals never replace a president');

  const reverse = await country('RV');
  await db.exec('begin'); const reversePlayer = await addPlayer('reverse-signup', reverse, id('s4'), { reverseOrder: true }); await db.exec('commit');
  assert.equal((await term(reverse)).president_director_id, reversePlayer.directorId, 'Assignment-last onboarding works');
  const botCountry = await country('BT');
  await db.exec('begin'); await addPlayer('bot-only', botCountry, id('s4'), { human: false }); await db.exec('commit');
  assert.equal(await term(botCountry), undefined, 'A bot does not receive the presidency');
  await db.exec('begin'); const human = await addPlayer('human-after-bot', botCountry); await db.exec('commit');
  assert.equal((await term(botCountry)).president_director_id, human.directorId, 'Bots do not inflate the player count');

  const multi = await country('MU');
  await db.exec('begin'); await addPlayer('multi-one', multi); await addPlayer('multi-two', multi); await db.exec('commit');
  assert.equal((await term(multi)).president_director_id, null, 'Atomic two-player arrival does not appoint the first inserted row');
  assert.equal(await electionCount(multi), 1);
  const multiElection = await one('select * from national_federation_elections where country_id=$1', [multi]);
  assert.equal(multiElection.status, 'applications'); assert.equal(multiElection.election_type, 'exceptional');
  assert.equal(new Date(multiElection.applications_close_at)-new Date(multiElection.applications_open_at), 48*3600*1000);
  assert.equal((await one('select count(*)::int n from national_federation_electorate where election_id=$1', [multiElection.id])).n, 2);
  await catchUp(); assert.equal(await electionCount(multi), 1, 'Active election is not duplicated');
  await db.query("update team_manager_assignments set status='inactive' where sporting_director_id=$1", [id('director:multi-two')]);
  assert.equal((await term(multi)).president_director_id, null, 'Even a now sole member cannot bypass an active ballot');
  await db.query("update national_federation_elections set status='automatic' where id=$1", [multiElection.id]);
  await db.query("update team_manager_assignments set status='active' where sporting_director_id=$1", [id('director:multi-two')]);
  await catchUp(); assert.equal(await electionCount(multi), 1, 'Unsuccessful ballot is not restarted every cron run');

  const sponsorDestination = await country('SP');
  await db.query('update team_seasons set registration_country_id=$1 where team_id=$2 and season_id=$3', [sponsorDestination, reversePlayer.teamId, id('s4')]);
  assert.equal((await term(sponsorDestination)).president_director_id, reversePlayer.directorId, 'Sponsor-country change appoints in a vacant solo destination');
  assert.equal((await one('select public.enforce_federation_president_nationality() n')).n, 1);
  assert.equal((await term(reverse)).president_director_id, null, 'Existing nationality guard vacates the former presidency');

  const nextBallotCountry = await country('NX');
  await db.query("insert into national_federation_elections(country_id,election_season_id,term_start_game_year,term_end_game_year,status) values($1,$2,5,6,'applications')", [nextBallotCountry, id('s4')]);
  await db.exec('begin'); const nextBallotPlayer = await addPlayer('next-ballot-player', nextBallotCountry); await db.exec('commit');
  assert.equal((await term(nextBallotCountry)).president_director_id, nextBallotPlayer.directorId, 'Next-mandate candidacies do not block the current sole-member appointment');
  assert.equal((await one('select status from national_federation_elections where country_id=$1', [nextBallotCountry])).status, 'applications', 'Future ballot is not rewritten');

  const future = await country('FU');
  await db.exec('begin'); const futurePlayer = await addPlayer('future-player', future, id('s5')); await db.exec('commit');
  assert.equal(await term(future), undefined, 'Planned season cannot grant an early presidency');
  await db.exec("update seasons set status='completed' where game_year=4");
  assert.deepEqual(await catchUp(), { automatic: 0, exceptional: 0 }, 'No-active-season rollover gap is safe');
  await db.exec("update seasons set status='active',current_day_number=9 where game_year=5");
  assert.deepEqual(await catchUp(), { automatic: 1, exceptional: 0 });
  assert.equal((await term(future)).president_director_id, futurePlayer.directorId);
  assert.equal((await term(future)).start_game_year, 5); assert.equal((await term(future)).end_game_year, 6);
  assert.equal((await one("select has_function_privilege('authenticated','public.initialize_due_federation_presidencies()','execute') allowed")).allowed, false);
  assert.equal((await one("select has_function_privilege('anon','private.ensure_federation_presidency(uuid,uuid)','execute') allowed")).allowed, false);
  assert.equal((await one("select has_function_privilege('service_role','public.initialize_due_federation_presidencies()','execute') allowed")).allowed, true);
  console.log('SQL isolé OK : Rwanda exceptionnel, S4 J7 et S5 J9, inscription dans les deux ordres, sponsor, bots exclus, président préservé, scrutin à plusieurs/48h+48h, aucun doublon, rollover sans saison active et droits RPC.');
} finally { await db.close(); }
