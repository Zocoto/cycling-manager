// Real migrations on isolated PostgreSQL only. No network or live fixtures.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = label => { const s=createHash('md5').update(label).digest('hex'); return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`; };
let checks=0;
const rows=async(sql,args=[]) => (await db.query(sql,args)).rows;
const scalar=async(sql,args=[]) => Object.values((await rows(sql,args))[0])[0];
const eq=(a,b,label) => {assert.deepEqual(a,b,label);checks++;};
const settle=key=>db.query('select public.settle_quadrennial_games_cash_prizes($1)',[id(key)]);
const balance=club=>scalar('select cash_balance::int from team_seasons where id=$1',[id(`account-${club}`)]);
const migration=await readFile('supabase/migrations/20261103103000_fix_quadrennial_club_prize_ownership.sql','utf8');
const original=await readFile('supabase/migrations/20261022140000_quadrennial_games_cash_prizes.sql','utf8');
async function event(key,year=4) {
 await db.query('insert into races values($1,\'nations_cup\')',[id(`race-${key}`)]);
 await db.query('insert into race_editions values($1,$2,$3,$4,\'completed\')',[id(key),id(`race-${key}`),id(`season-${year}`),`Jeux · ${key}`]);
 await db.query('insert into stages values($1,$2,$3,1,\'completed\',\'2026-11-01T13:00:00Z\')',[id(`stage-${key}`),id(key),id(`day-${year}`)]);
}
async function rider(key,label,rank,owner=null,status='classified') {
 const riderId=id(label),rosterId=id(`${key}-${label}`),selection=id(`selection-${key}`),registration=id(`registration-${key}`);
 await db.query('insert into riders values($1,$2,$3,$4) on conflict do nothing',[riderId,id('country-b'),label,'Rider']);
 await db.query('insert into national_federation_selection_lists values($1,$2,$3) on conflict do nothing',[selection,id('country-a'),id('season-4')]);
 await db.query('insert into race_registrations values($1,$2,null) on conflict do nothing',[registration,id(key)]);
 await db.query('insert into national_federation_selection_race_links values($1,$2,$3) on conflict do nothing',[selection,id(key),registration]);
 await db.query('insert into national_federation_selection_members values($1,$2,$3,$4,$5)',[id(`member-${key}-${label}`),selection,riderId,owner?id(owner):null,owner?id(`director-${owner}`):null]);
 await db.query('insert into race_rosters values($1,$2,$3)',[rosterId,registration,riderId]);
 await db.query('insert into race_results values($1,$2,$3,$4)',[id(key),rosterId,status,rank]);
 await db.query('insert into stage_results values($1,$2)',[id(`stage-${key}`),rosterId]);
 return riderId;
}
async function contract(label,club,{start=4,end=5,joined=20,signed='2026-10-28T08:00:00Z',status='active',left=null,leftDay=null}={}) {
 await db.query('insert into rider_contracts values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$7)',[
 id(`contract-${label}-${club}-${start}-${signed}`),id(label),id(club),id(`season-${start}`),id(`season-${end}`),joined,signed,status,left?id(`season-${left}`):null,leftDay]);
}
try {
 await db.exec(`create schema private; create role anon; create role authenticated; create role service_role;
 create table countries(id uuid primary key);
 create table seasons(id uuid primary key,game_year int);
 create table season_days(id uuid primary key,season_id uuid,day_number smallint);
 create table riders(id uuid primary key,country_id uuid,first_name text,last_name text);
 create table races(id uuid primary key,competition_type text);
 create table race_editions(id uuid primary key,race_id uuid,season_id uuid,display_name text,status text);
 create table national_federation_olympic_events(season_id uuid primary key,race_edition_id uuid unique,time_trial_race_edition_id uuid unique);
 create table stages(id uuid primary key,race_edition_id uuid,season_day_id uuid,stage_number int,status text,departure_at timestamptz);
 create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid);
 create table national_federation_selection_lists(id uuid primary key,country_id uuid,season_id uuid);
 create table national_federation_selection_race_links(selection_list_id uuid primary key,race_edition_id uuid,race_registration_id uuid unique);
 create table national_federation_selection_members(id uuid primary key,selection_list_id uuid,professional_rider_id uuid,owner_team_id uuid,owner_director_id uuid,unique(selection_list_id,professional_rider_id));
 create table race_rosters(id uuid primary key,race_registration_id uuid,rider_id uuid);
 create table race_results(race_edition_id uuid,race_roster_id uuid,status text,final_rank smallint,primary key(race_edition_id,race_roster_id));
 create table stage_results(stage_id uuid,race_roster_id uuid);
 create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,cash_balance numeric,unique(team_id,season_id));
 create table team_manager_assignments(team_id uuid,sporting_director_id uuid,status text,role text);
 create table rider_contracts(id uuid primary key,rider_id uuid,team_id uuid,start_season_id uuid,end_season_id uuid,joined_day_number int,signed_at timestamptz,status text,left_season_id uuid,left_day_number int,created_at timestamptz);
 create index rider_contracts_rider_id_idx on rider_contracts(rider_id);
 create table reward_events(id uuid primary key default gen_random_uuid(),source_reference text unique,source_type text,sporting_director_id uuid,team_season_id uuid,rider_id uuid,country_id uuid,reputation_points int,experience_points int,cash_prize numeric,uci_points int,description text);
 create table team_finance_transactions(id uuid primary key default gen_random_uuid(),team_season_id uuid,season_day_id uuid,day_number smallint,amount numeric,category text,status text,description text,source_reference text,posted_at timestamptz,unique(team_season_id,source_reference));
 create table national_federation_accounts(id uuid primary key,country_id uuid,season_id uuid,balance numeric,updated_at timestamptz,unique(country_id,season_id));
 create table national_federation_transactions(id uuid primary key default gen_random_uuid(),account_id uuid,day_number smallint,amount numeric,category text,description text,source_reference text unique,metadata jsonb,constraint national_federation_transactions_category_allowed check(category in('opening_grant','equipment')));`);
 for(const year of [3,4,5,8]) {
  await db.query('insert into seasons values($1,$2)',[id(`season-${year}`),year]);
  await db.query('insert into season_days values($1,$2,24)',[id(`day-${year}`),id(`season-${year}`)]);
 }
 for(const club of ['a','b']) {
  await db.query('insert into countries values($1)',[id(`country-${club}`)]);
  await db.query('insert into team_seasons values($1,$2,$3,1000000)',[id(`account-${club}`),id(club),id('season-4')]);
  await db.query('insert into team_manager_assignments values($1,$2,\'active\',\'general_manager\')',[id(club),id(`director-${club}`)]);
  await db.query('insert into national_federation_accounts values($1,$2,$3,2000000,now())',[id(`federation-${club}`),id(`country-${club}`),id('season-4')]);
 }
 await event('road'); await event('tt');
 await db.query('insert into national_federation_olympic_events values($1,$2,$3)',[id('season-4'),id('road'),id('tt')]);
 await db.exec(original);
 await rider('road','winner',1,'a'); await contract('winner','a');
 await rider('tt','winner',1,'a');
 await rider('road','newly-signed',78); await contract('newly-signed','b');
 await rider('tt','newly-signed',36);
 await rider('road','sold-after-race',39,'a');
 await contract('sold-after-race','a',{start:3,end:4,joined:9,status:'terminated',left:4,leftDay:25,signed:'2026-09-19T00:00:00Z'});
 await contract('sold-after-race','b',{joined:25,signed:'2026-11-02T08:00:00Z'});
 await rider('road','bought-after-race',87); await contract('bought-after-race','b',{joined:25,signed:'2026-11-02T08:00:00Z'});
 await rider('road','same-day-before',144); await contract('same-day-before','b',{joined:24,signed:'2026-11-01T08:00:00Z'});
 await rider('road','same-day-after',145); await contract('same-day-after','b',{joined:24,signed:'2026-11-01T14:00:00Z'});
 await rider('road','free-agent',166);
 await rider('road','future-contract',167); await contract('future-contract','b',{start:5,joined:1});
 await rider('road','cancelled-contract',168); await contract('cancelled-contract','b',{status:'cancelled'});
 await rider('road','planned-contract',169); await contract('planned-contract','b',{status:'planned'});
 await rider('road','already-left',170); await contract('already-left','b',{status:'terminated',left:4,leftDay:23});
 await rider('road','left-after-race',171); await contract('left-after-race','b',{status:'terminated',left:4,leftDay:25});
 await rider('road','abandoned',null,null,'did_not_finish'); await contract('abandoned','b');
 await rider('road','disqualified',null,null,'disqualified'); await contract('disqualified','b');
 await rider('road','late',null,null,'outside_time_limit'); await contract('late','b');
 await rider('road','no-start',null,null,'did_not_start'); await contract('no-start','b');
 await settle('road'); await settle('tt');
 eq(await balance('b'),1000000,'Reproduces omission for free agents recruited after callup');
 eq(await balance('a'),2010000,'Original recipients paid before patch');
 const federationBefore=await scalar('select sum(balance)::int from national_federation_accounts');
 const aclBefore=await scalar("select proacl::text from pg_proc where oid='public.settle_quadrennial_games_cash_prizes(uuid)'::regprocedure");
 await db.exec(migration);
 eq(await balance('b'),1022000,'Recovery pays CLM 10k and road 4k+4k+4k');
 eq(await balance('a'),2010000,'Existing recipient balance unchanged');
 eq(await scalar('select sum(balance)::int from national_federation_accounts'),federationBefore,'Federation is not paid twice');
 eq(await scalar("select sum(amount)::int from team_finance_transactions where team_season_id=$1 and status='posted'",[id('account-b')]),22000,'Recovered cash is posted in budget');
 eq(await scalar('select count(*)::int from team_finance_transactions where team_season_id=$1',[id('account-b')]),4,'One line for each omitted result');
 eq(await scalar("select count(*)::int from team_finance_transactions where team_season_id=$1 and day_number=24 and category='race_prize'",[id('account-b')]),4,'Original race day and income category retained');
 eq(await scalar('select sum(club_prize_count)::int from quadrennial_games_cash_settlements'),7,'Settlement receipts include recovered riders');
 eq(await scalar('select sum(club_prize_total)::int from quadrennial_games_cash_settlements'),1032000,'Receipts reconcile with exact aggregate');
 eq(await scalar('select sum(reputation_points+experience_points+uci_points)::int from reward_events'),0,'Recovery does not grant unrelated progression');
 eq(await scalar('select count(*)::int from reward_events where team_season_id=$1 and country_id=$2',[id('account-b'),id('country-a')]),4,'Represented country remains selection country');
 eq(await scalar("select proacl::text from pg_proc where oid='public.settle_quadrennial_games_cash_prizes(uuid)'::regprocedure"),aclBefore,'Original execution ACL preserved');
 for(const role of ['anon','authenticated']) {
  eq(await scalar(`select has_function_privilege('${role}','private.get_quadrennial_games_club_beneficiaries(uuid)','execute')`),false,`${role} has no helper access`);
 }
 const recovered=await rows('select rider_id,cash_prize::int,description from reward_events where team_season_id=$1',[id('account-b')]);
 assert(recovered.every(row=>row.description.includes('Rider')));checks++;
 const recoverySql=migration.slice(migration.indexOf('-- One-time recovery'),migration.lastIndexOf('commit;'));
 for(let i=0;i<3;i++) {await settle('road');await settle('tt');await db.exec(recoverySql);}
 eq(await balance('b'),1022000,'Repeated settlement and recovery cannot repay');
 eq(await scalar('select count(*)::int from team_finance_transactions where team_season_id=$1',[id('account-b')]),4,'Repeated recovery creates no extra line');
 // Future official edition exercises the patched normal settlement, not recovery.
 await event('future-road');
 await db.query('update national_federation_olympic_events set race_edition_id=$1',[id('future-road')]);
 await rider('future-road','future-winner',1); await contract('future-winner','b');
 await rider('future-road','moved-before-race',2,'a');
 await contract('moved-before-race','a',{joined:1,status:'terminated',left:4,leftDay:20,signed:'2026-10-09T08:00:00Z'});
 await contract('moved-before-race','b',{joined:20});
 await rider('future-road','free-agent',41);
 await settle('future-road');
 eq(await balance('b'),1822000,'Normal settlement pays actual race-time clubs, including stale non-null callup');
 eq(await balance('a'),2010000,'Former callup club receives no new payment');
 await settle('future-road');
 eq(await balance('b'),1822000,'Normal retries remain idempotent');
 // Freeze the paid attribution against result edits and later recruitment.
 await contract('free-agent','b',{joined:25,signed:'2026-11-02T08:00:00Z'});
 await db.query('update race_results set final_rank=3 where race_roster_id=$1',[id('future-road-moved-before-race')]);
 await settle('future-road');
 eq(await balance('b'),1822000,'A paid race cannot be redistributed by retrying');
 // Missing club account must atomically roll back settlement.
 await event('missing-account'); await db.query('update national_federation_olympic_events set race_edition_id=$1',[id('missing-account')]);
 await rider('missing-account','missing-club',1); await contract('missing-club','c');
 await assert.rejects(settle('missing-account'),/compte saisonnier du club/);checks++;
 eq(await scalar('select count(*)::int from reward_events where source_reference like $1',[`quadrennial-games:${id('missing-account')}:%`]),0,'Missing account leaves no partial reward');
 console.log(`${checks} isolated ownership and recovery checks passed.`);
} catch(error) {
 console.error(JSON.stringify({message:error.message,detail:error.detail,where:error.where,actual:error.actual,expected:error.expected},null,2));
 process.exitCode=1;
} finally {await db.close();}
