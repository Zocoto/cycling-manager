// Isolated PostgreSQL only. No network and no connection to Supabase.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { tsImport } from 'tsx/esm/api';

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const { calculateQuadrennialGamesReward, QUADRENNIAL_GAMES_FEDERATION_PRIZE } = await tsImport('../lib/game/quadrennial-games-rewards.ts', import.meta.url);
const db = new PGlite();
const id = name => { const s = createHash('md5').update(name).digest('hex'); return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`; };
let checks = 0;
const eq = (a,b,label) => { assert.deepEqual(a,b,label); checks++; };
const query = async (sql,args=[]) => (await db.query(sql,args)).rows;
const scalar = async (sql,args=[]) => Object.values((await query(sql,args))[0])[0];
const balance = (team,year=4) => scalar('select cash_balance::int from team_seasons where id=$1',[id(`club-${team}-${year}`)]);
const federation = (country,year=4) => scalar('select balance::int from national_federation_accounts where id=$1',[id(`account-${country}-${year}`)]);
const settle = key => db.query('select settle_quadrennial_games_cash_prizes($1)',[id(key)]);
const rejects = async (key,message) => { await assert.rejects(settle(key),message); checks++; };

async function event(year,registered=true) {
  await db.query('insert into seasons values($1,$2)',[id(`season-${year}`),year]);
  await db.query('insert into season_days values($1,$2,24)',[id(`day-${year}`),id(`season-${year}`)]);
  for (const club of ['a','b']) await db.query('insert into team_seasons values($1,$2,$3,1000000,17)',[id(`club-${club}-${year}`),id(`team-${club}`),id(`season-${year}`)]);
  for (const country of ['a','b']) await db.query('insert into national_federation_accounts values($1,$2,$3,2000000,2000000,now())',[id(`account-${country}-${year}`),id(country),id(`season-${year}`)]);
  for (const kind of ['road','tt']) {
    const key = `${year}-${kind}`;
    await db.query("insert into races values($1,'nations_cup')",[id(`race-${key}`)]);
    await db.query("insert into race_editions values($1,$2,$3,$4,'in_progress')",[id(key),id(`race-${key}`),id(`season-${year}`),`Jeux quadriennaux · ${kind}`]);
    await db.query("insert into stages values($1,$2,$3,1,'completed')",[id(`stage-${key}`),id(key),id(`day-${year}`)]);
  }
  if (registered) await db.query('insert into national_federation_olympic_events values($1,$2,$3)',[id(`season-${year}`),id(`${year}-road`),id(`${year}-tt`)]);
}

async function result(key,rank,club='a',country='a',status='classified',label=String(rank)) {
  const year = Number(key.split('-')[0]);
  const rider = id(`rider-${key}-${label}`);
  const roster = id(`roster-${key}-${label}`);
  // Registration country is the selection's, deliberately unrelated to a club's nationality.
  const selection = id(`selection-${key}-${country}`);
  const registration = id(`registration-${key}-${country}`);
  await db.query('insert into riders values($1,$2) on conflict do nothing',[rider,id(country==='a'?'b':'a')]);
  await db.query('insert into national_federation_selection_lists values($1,$2,$3) on conflict do nothing',[selection,id(country),id(`season-${year}`)]);
  await db.query('insert into race_registrations values($1,$2,null) on conflict do nothing',[registration,id(key)]);
  await db.query('insert into national_federation_selection_race_links values($1,$2,$3) on conflict do nothing',[selection,id(key),registration]);
  await db.query('insert into national_federation_selection_members values($1,$2,$3,$4,null)',[id(`member-${key}-${label}`),selection,rider,club?id(`team-${club}`):null]);
  await db.query('insert into race_rosters values($1,$2,$3)',[roster,registration,rider]);
  await db.query('insert into race_results values($1,$2,$3,$4)',[id(key),roster,status,rank]);
  await db.query('insert into stage_results values($1,$2)',[id(`stage-${key}`),roster]);
  return roster;
}

try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table countries(id uuid primary key);
    create table seasons(id uuid primary key, game_year int);
    create table season_days(id uuid primary key,season_id uuid,day_number smallint);
    create table riders(id uuid primary key,country_id uuid);
    create table races(id uuid primary key,competition_type text);
    create table race_editions(id uuid primary key,race_id uuid,season_id uuid,display_name text,status text);
    create table national_federation_olympic_events(season_id uuid primary key,race_edition_id uuid unique,time_trial_race_edition_id uuid unique);
    create table stages(id uuid primary key,race_edition_id uuid,season_day_id uuid,stage_number int,status text);
    create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid);
    create table national_federation_selection_lists(id uuid primary key,country_id uuid,season_id uuid);
    create table national_federation_selection_race_links(selection_list_id uuid primary key,race_edition_id uuid,race_registration_id uuid unique);
    create table national_federation_selection_members(id uuid primary key,selection_list_id uuid,professional_rider_id uuid,owner_team_id uuid,owner_director_id uuid,unique(selection_list_id,professional_rider_id));
    create table race_rosters(id uuid primary key,race_registration_id uuid,rider_id uuid);
    create table race_results(race_edition_id uuid,race_roster_id uuid,status text,final_rank int,primary key(race_edition_id,race_roster_id));
    create table stage_results(stage_id uuid,race_roster_id uuid);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,cash_balance numeric,points int,unique(team_id,season_id));
    create table reward_events(id uuid primary key default gen_random_uuid(),source_reference text unique,source_type text,sporting_director_id uuid,team_season_id uuid,rider_id uuid,country_id uuid,reputation_points int,experience_points int,cash_prize numeric,uci_points int,description text);
    create table team_finance_transactions(id uuid primary key default gen_random_uuid(),team_season_id uuid,season_day_id uuid,day_number smallint,amount numeric,category text,status text,description text,source_reference text,posted_at timestamptz,unique(team_season_id,source_reference));
    create table national_federation_accounts(id uuid primary key,country_id uuid,season_id uuid,opening_balance numeric,balance numeric,updated_at timestamptz,unique(country_id,season_id));
    create table national_federation_transactions(id uuid primary key default gen_random_uuid(),account_id uuid,day_number smallint,amount numeric,category text,description text,source_reference text unique,metadata jsonb,
      constraint national_federation_transactions_category_allowed check(category in('opening_grant','equipment')));`);
  for (const name of ['a','b']) await db.query('insert into countries values($1)',[id(name)]);
  await event(4); await event(8); await event(5); await event(12,false); await event(16);
  await db.exec(await readFile('supabase/migrations/20261022140000_quadrennial_games_cash_prizes.sql','utf8'));

  for (const rank of [null,-1,0,...Array.from({length:300},(_,i)=>i+1)]) {
    const cash = await scalar('select get_quadrennial_games_club_prize($1)::int',[rank]);
    eq(cash,calculateQuadrennialGamesReward(rank).cashPrize,`UI and settlement agree for rank ${rank}`);
  }
  await result('4-road',1,'a','a'); await result('4-road',2,'a','a'); await result('4-road',3,'b','b');
  await result('4-road',4,null,'b');
  for (const status of ['did_not_start','did_not_finish','disqualified','outside_time_limit']) await result('4-road',null,'b','b',status,status);
  await settle('4-road');
  eq(await balance('a'),1800000,'Two riders pay their shared club, despite national registrations');
  eq(await balance('b'),1200000,'Other podium club paid');
  eq(await federation('a'),2500000,'Represented country, not rider current country or club country, wins 500k');
  eq(await federation('b'),2000000,'Non-winning federation receives no victory prime');
  eq(await scalar('select count(*)::int from reward_events'),3,'Free agent and unclassified riders have no club cash');
  eq(await scalar('select sum(amount)::int from team_finance_transactions where day_number=24 and category=\'race_prize\' and status=\'posted\''),1000000,'Exact club cash appears as posted race income');
  eq(await scalar('select sum(reputation_points+experience_points+uci_points)::int from reward_events'),0,'This cash change creates no other progression gains');
  eq(await scalar('select sum(points)::int from team_seasons where season_id=$1',[id('season-4')]),34,'Existing team UCI points untouched');
  eq(await scalar('select opening_balance::int from national_federation_accounts where id=$1',[id('account-a-4')]),2000000,'Prize does not alter annual grant or solidarity baseline');
  eq(await scalar('select count(*)::int from national_federation_transactions where (metadata->>\'oneShot\')::boolean'),1,'Federation journal records the one-shot payment');
  for (let i=0;i<5;i++) await settle('4-road');
  eq(await balance('a'),1800000,'Repeated settlement never repays clubs');
  eq(await federation('a'),2500000,'Repeated settlement never repays federation');
  eq(await scalar('select count(*)::int from national_federation_transactions'),1,'Repeated settlement creates no duplicate journal');
  await result('4-tt',1,null,'b'); await result('4-tt',2,'b','a');
  await settle('4-tt');
  eq(await federation('b'),2000000+QUADRENNIAL_GAMES_FEDERATION_PRIZE,'TT winner federation rewarded even for a free agent');
  eq(await balance('b'),1500000,'TT pays its own club classification');
  eq(await scalar('select count(*)::int from quadrennial_games_cash_settlements'),2,'Road and TT are independent one-shot settlements');
  await result('8-road',1,'b','a'); await settle('8-road');
  eq(await balance('b',8),1500000,'Next Games use their own season club');
  eq(await federation('a',8),2500000,'Next Games can earn a new federation prize');
  await settle('4-road');
  eq(await federation('a',8),2500000,'Replaying an earlier season cannot credit the new budget');
  await result('5-road',1); await rejects('5-road',/officiels/);
  await result('12-road',1); await rejects('12-road',/officiels/);
  await rejects('16-road',/unique/);
  await result('16-road',1); await db.query("update stages set status='in_progress' where id=$1",[id('stage-16-road')]);
  await rejects('16-road',/homologués/);
  await db.query("update stages set status='completed' where id=$1",[id('stage-16-road')]);
  await result('16-road',1,'b','b','classified','second-winner'); await rejects('16-road',/unique/);
  await db.query("update race_results set final_rank=2 where race_roster_id=$1",[id('roster-16-road-second-winner')]);
  await db.query('delete from race_results where race_roster_id=$1',[id('roster-16-road-second-winner')]); await rejects('16-road',/incomplet/);
  await db.query("insert into race_results values($1,$2,'classified',2)",[id('16-road'),id('roster-16-road-second-winner')]);
  await db.query('delete from national_federation_accounts where id=$1',[id('account-a-16')]);
  await rejects('16-road',/compte saisonnier de la fédération/);
  eq(await balance('a',16),1000000,'Missing federation account rolls back preceding club credit');
  eq(await scalar("select count(*)::int from reward_events where source_reference like $1",[`quadrennial-games:${id('16-road')}:%`]),0,'Failed settlement leaves no partial reward event');
  eq(await scalar('select count(*)::int from quadrennial_games_cash_settlements where race_edition_id=$1',[id('16-road')]),0,'Failed settlement remains retryable');
  await db.query('insert into national_federation_accounts values($1,$2,$3,2000000,2000000,now())',[id('account-a-16'),id('a'),id('season-16')]);
  await db.query('delete from team_seasons where id=$1',[id('club-a-16')]); await rejects('16-road',/compte saisonnier du club/);
  await db.query('insert into team_seasons values($1,$2,$3,1000000,17)',[id('club-a-16'),id('team-a'),id('season-16')]);
  await db.query("update race_editions set status='cancelled' where id=$1",[id('16-road')]); await rejects('16-road',/annulée/);
  await db.query("update race_editions set status='in_progress' where id=$1",[id('16-road')]); await settle('16-road');
  eq(await balance('a',16),1500000,'Retry after correcting missing account pays exactly once');
  eq(await federation('a',16),2500000,'Federation is paid on successful retry');
  await event(20);
  for (let rank=1;rank<=220;rank++) await result('20-road',rank,'a','a');
  const started=performance.now(); await settle('20-road');
  const elapsed=performance.now()-started;
  eq(await balance('a',20),3570000,'Full 220-rider field pays the exact aggregate scale');
  eq(await scalar('select club_prize_count from quadrennial_games_cash_settlements where race_edition_id=$1',[id('20-road')]),220,'Full field handled by one atomic settlement');
  eq(await federation('a',20),2500000,'Full field still pays only one federation prize');
  console.log(`Full 220-rider settlement: ${elapsed.toFixed(0)} ms on isolated PGlite (not a production benchmark).`);
  for (const role of ['anon','authenticated']) {
    eq(await scalar(`select has_function_privilege('${role}','public.settle_quadrennial_games_cash_prizes(uuid)','execute')`),false,`${role} cannot award money`);
    eq(await scalar(`select has_table_privilege('${role}','public.quadrennial_games_cash_settlements','insert')`),false,`${role} cannot forge a settlement`);
  }
  eq(await scalar("select has_function_privilege('service_role','public.settle_quadrennial_games_cash_prizes(uuid)','execute')"),true,'Only server service can settle');
  console.log(`${checks} isolated PostgreSQL checks passed.`);
} finally { await db.close(); }
