import { PGlite } from '../.tmp/season-rollover-tests/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read=n=>readFileSync(`supabase/migrations/${n}.sql`,'utf8').replaceAll('\r','');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const s3=id(3),s4=id(4),t3=id(13),t4=id(14),team=id(20),director=id(21),user=id(22),edition=id(30),d3=id(33),d4=id(34);
const db=new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table seasons(id uuid primary key,game_year int,status text,current_day_number int);
    insert into seasons values('${s3}',3,'completed',28),('${s4}',4,'active',1);
    create table season_days(id uuid primary key,season_id uuid,day_number int);
    insert into season_days values('${d3}','${s3}',28),('${d4}','${s4}',1);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,cash_balance numeric);
    insert into team_seasons values('${t3}','${team}','${s3}',100000),('${t4}','${team}','${s4}',100000);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text,experience_points int,reputation_points int);
    insert into sporting_directors values('${director}','${user}','active',0,0);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    insert into team_manager_assignments values('${director}','${team}','general_manager','active');
    create table alpha_bot_managers(sporting_director_id uuid);
    create table cyclogazette_editions(id uuid primary key,season_id uuid,issue_number int,season_day_id uuid,published_at timestamptz);
    insert into cyclogazette_editions values('${edition}','${s3}',84,'${d3}',now()-interval '1 day');
    create table cyclogazette_game_completions(id uuid primary key default gen_random_uuid(),edition_id uuid,sporting_director_id uuid,
      team_season_id uuid,game_type text,reward_cash numeric,completed_at timestamptz,unique(edition_id,sporting_director_id,game_type));
    create table team_finance_transactions(id uuid primary key default gen_random_uuid(),team_season_id uuid,season_day_id uuid,day_number int,
      amount numeric,category text,status text,description text,source_reference text,posted_at timestamptz,created_at timestamptz default now());
    create table reward_events(source_reference text,source_type text,sporting_director_id uuid,team_season_id uuid,cash_prize numeric,
      description text,reputation_points int,experience_points int);
    create table sporting_director_trophies(id uuid primary key default gen_random_uuid(),sporting_director_id uuid,trophy_key text,
      available_at timestamptz,claimed_at timestamptz,unique(sporting_director_id,trophy_key));
    create table season_rollover_settlements(source_season_id uuid,target_season_id uuid,settled_at timestamptz);
    insert into season_rollover_settlements values('${s3}','${s4}',now()-interval '1 hour');
  `);
  const old=read('20260831100000_add_cyclogazette_daily_games');
  const start=old.indexOf('create or replace function public.complete_cyclogazette_game_for_user(');
  await db.exec(old.slice(start,old.indexOf('$$;',start)+3));
  await db.exec(`select complete_cyclogazette_game_for_user('${user}','${edition}','sudoku');`);
  assert.equal(Number((await db.query(`select cash_balance from team_seasons where id='${t3}'`)).rows[0].cash_balance),101000);
  await db.exec(read('20261009100000_credit_late_gazette_games_to_active_season'));
  assert.equal(Number((await db.query(`select cash_balance from team_seasons where id='${t3}'`)).rows[0].cash_balance),100000);
  assert.equal(Number((await db.query(`select cash_balance from team_seasons where id='${t4}'`)).rows[0].cash_balance),101000);
  await db.exec(`select complete_cyclogazette_game_for_user('${user}','${edition}','crossword');`);
  assert.equal(Number((await db.query(`select cash_balance from team_seasons where id='${t4}'`)).rows[0].cash_balance),102000);
  assert((await db.query('select * from team_finance_transactions')).rows.every(x=>x.team_season_id===t4&&x.season_day_id===d4&&x.day_number===1));
  await db.exec(`select complete_cyclogazette_game_for_user('${user}','${edition}','sudoku');`);
  assert.equal(Number((await db.query(`select cash_balance from team_seasons where id='${t4}'`)).rows[0].cash_balance),102000);
  assert.equal((await db.query('select count(*) n from gazette_late_payment_season_repairs')).rows[0].n,1);
  console.log('PASS: reproduce lost post-rollover Gazette payment; existing reward moved without duplication; latest S3 games now credit S4/J1; replay unchanged');
} finally { await db.close(); }
