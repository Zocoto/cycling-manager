// Local PostgreSQL only; no credentials, network, or production fixtures.
// npm install --prefix .tmp/season-rollover-tests --no-save --package-lock=false @electric-sql/pglite@0.3.14
import { PGlite } from '../.tmp/season-rollover-tests/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read = name => readFileSync(`supabase/migrations/${name}.sql`, 'utf8').replaceAll('\r', '');
const def = (source, name) => {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert(start >= 0, name);
  return source.slice(start, source.indexOf('$$;', start) + 3);
};
const db = new PGlite();
const s3 = '00000000-0000-4000-8000-000000000003';
const s4 = '00000000-0000-4000-8000-000000000004';
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema cron;
    create table cron.job(jobname text primary key, schedule text, command text, active boolean);
    create function cron.schedule(text,text,text) returns bigint language plpgsql as $$ begin
      insert into cron.job values($1,$2,$3,true) on conflict(jobname) do update
        set schedule=excluded.schedule,command=excluded.command,active=true; return 1; end $$;
    create table seasons(id uuid primary key,game_year int,status text,ends_on date,current_day_number int default 28);
    create table season_rollover_settlements(source_season_id uuid primary key,target_season_id uuid,
      copied_rider_count int,promoted_youth_count int,released_youth_count int,carried_team_count int,settled_at timestamptz);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,status text,points int,display_name text,final_rank int,
      opening_cash_balance numeric default 1000000,cash_balance numeric,finance_start_day_number int default 1);
    create table riders(id uuid primary key,first_name text,last_name text,status text);
    create table rider_season_ratings(rider_id uuid,season_id uuid,age int);
    create table rider_season_summaries(id uuid primary key,rider_id uuid,season_id uuid,points int,uci_rank int,updated_at timestamptz);
    create table rider_contracts(rider_id uuid,start_season_id uuid,end_season_id uuid,status text);
    create table staff_contracts(end_season_id uuid,status text);
    create table youth_academy_riders(status text,promotion_game_year int,birth_game_year int);
    create table rider_condition_states(rider_id uuid,season_day_id uuid);
    create table season_days(id uuid primary key,season_id uuid,day_number int);
    create table race_editions(season_id uuid);
    create schema auth; create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create table sporting_directors(id uuid primary key,auth_user_id uuid,reputation_points int);
    create table team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text);
    create table team_finance_transactions(team_season_id uuid,status text,day_number int,amount numeric,posted_at timestamptz);
    create table team_finance_alerts(team_season_id uuid,checkpoint_day_number int,balance numeric,severity text,reputation_penalty int,message text,
      resolved_at timestamptz,resolved_checkpoint_day_number int);
    create function initialize_due_national_federation_accounts() returns void language sql as $$ select $$;
    create function ensure_due_professional_nations_cup() returns void language sql as $$ select $$;
    create table ranking_writes(kind text);
    create function record_rank_write() returns trigger language plpgsql as $$ begin
      insert into ranking_writes values(tg_table_name); return new; end $$;
    create trigger rank_team after update of final_rank on team_seasons for each row execute function record_rank_write();
    create trigger rank_rider after update of uci_rank on rider_season_summaries for each row execute function record_rank_write();
    create function close_team_financial_season(uuid) returns void language plpgsql as $$ declare v_team_season record;
      begin select * into v_team_season from team_seasons where id=$1;
      perform public.refresh_uci_rankings(v_team_season.season_id); end $$;
    create function evaluate_team_sponsor_objectives(uuid,boolean) returns void language plpgsql as $$ declare v_team_season record;
      begin select * into v_team_season from team_seasons where id=$1;
      if $2 then perform public.refresh_uci_rankings(v_team_season.season_id); end if; end $$;
  `);
  await db.exec(def(read('20260807103000_fix_finance_debt_onboarding'), 'settle_current_team_finances'));
  await db.exec(def(read('20260814150000_add_roster_aid_and_cash_based_recruitment'), 'grant_understaffed_team_starting_aid'));
  // Compile and patch the real rollover body; unrelated economic functions
  // are not invoked by these narrowly scoped regression tests.
  await db.exec(def(read('20260811130000_implement_atomic_season_rollover'), 'rollover_game_season'));
  await db.exec('create function settle_due_season_rollovers() returns jsonb language sql as $$ select \'[]\'::jsonb $$;');
  await db.exec(read('20261009070000_harden_automatic_season_rollover'));
  const definition = (await db.query("select pg_get_functiondef('rollover_game_season(uuid,boolean)'::regprocedure) body")).rows[0].body;
  assert(definition.includes('pg_try_advisory_xact_lock'));
  assert(definition.includes('get_season_rollover_integrity'));
  assert(definition.indexOf('get_season_rollover_integrity') < definition.indexOf('insert into public.season_rollover_settlements'));
  assert(definition.includes("coalesce(v_previous_ranked_season, '')"));
  assert(definition.indexOf('settle_team_season_finances') < definition.indexOf("set status = 'completed'"));
  assert(definition.includes('initialize_due_national_federation_accounts'));
  assert(definition.indexOf('grant_understaffed_team_aid_for_season') > definition.indexOf('v_promoted_youth := v_promoted_youth + 1'));
  assert(definition.indexOf("'idempotentReplay', true") < definition.indexOf('set_config'));
  await db.exec(`
    insert into seasons(id,game_year,status,ends_on) values('${s3}',3,'completed',current_date-1),('${s4}',4,'active',current_date+27);
    insert into team_seasons(id,team_id,season_id,status,points,display_name,final_rank) values('${s3}','${s3}','${s3}','completed',100,'A',null),('${s4}','${s4}','${s3}','completed',10,'B',null);
    insert into riders values('${s3}','Alpha','Rider','active'),('${s4}','Beta','Rider','active');
    insert into rider_season_summaries values('${s3}','${s3}','${s3}',10,null,null),('${s4}','${s4}','${s3}',20,null,null);
    select refresh_uci_rankings('${s3}');
  `);
  assert.equal((await db.query('select count(*) n from ranking_writes')).rows[0].n, 4);
  await db.exec(`select refresh_uci_rankings('${s3}');`);
  assert.equal((await db.query('select count(*) n from ranking_writes')).rows[0].n, 4, 'unchanged ranks must not fire notifications');
  await db.exec(`update team_seasons set points=200 where id='${s4}'; select close_team_financial_season('${s4}');`);
  assert.equal((await db.query(`select final_rank from team_seasons where id='${s4}'`)).rows[0].final_rank, 1, 'standalone closure still refreshes ranks');
  await db.exec(`begin; select set_config('cycling_manager.rollover_ranked_season','${s3}',true);
    update team_seasons set points=300 where id='${s3}'; select close_team_financial_season('${s3}');
    select evaluate_team_sponsor_objectives('${s3}',true); commit;`);
  assert.equal((await db.query(`select final_rank from team_seasons where id='${s4}'`)).rows[0].final_rank, 1, 'batch closure reuses the frozen ranks');
  await db.exec(`select close_team_financial_season('${s3}');`);
  assert.equal((await db.query(`select final_rank from team_seasons where id='${s3}'`)).rows[0].final_rank, 1, 'transaction-local guard does not leak');
  await db.exec(`insert into team_finance_transactions values('${s3}','pending',28,-20000,null),('${s3}','posted',14,30000,now());
    select settle_team_season_finances('${s3}',28);`);
  assert.equal((await db.query(`select cash_balance from team_seasons where id='${s3}'`)).rows[0].cash_balance, '1010000');
  assert.equal((await db.query("select count(*) n from team_finance_transactions where status='pending'")).rows[0].n, 0);
  await db.exec(`select settle_team_season_finances('${s3}',28);`);
  assert.equal((await db.query(`select cash_balance from team_seasons where id='${s3}'`)).rows[0].cash_balance, '1010000', 'settlement replay must not debit twice');
  const job = (await db.query('select * from cron.job')).rows[0];
  assert.equal(job.schedule, '*/10 * * * *');
  assert(job.command.indexOf('statement_timeout') < job.command.indexOf('select public.settle_due'));
  assert(job.command.includes('lock_timeout'));
  assert.equal((await db.query('select get_season_rollover_health() h')).rows[0].h.healthy, false, 'missing receipt is unhealthy');
  await db.exec(`insert into season_rollover_settlements(source_season_id,target_season_id) values('${s3}','${s4}');`);
  assert.equal((await db.query('select get_season_rollover_health() h')).rows[0].h.healthy, true);
  await db.exec(`update seasons set status='active',ends_on=current_date-2 where id='${s3}'; update seasons set status='planned' where id='${s4}';`);
  assert.equal((await db.query('select get_season_rollover_health() h')).rows[0].h.overdueSeasonCount, 1);
  await db.exec(`insert into rider_season_ratings values('${s3}','${s3}',20),('${s3}','${s4}',20);`);
  const invalid = (await db.query(`select get_season_rollover_integrity('${s3}','${s4}') checks`)).rows[0].checks;
  assert.equal(invalid.incorrectAges, 1);
  assert.equal(invalid.missingCopiedRatings, 0);
  assert.equal(invalid.invalidSeasonPair, 1);
  assert.equal(invalid.missingOpeningConditions, 1);
  await db.exec(`
    create table race_rosters(id uuid primary key,race_registration_id uuid,rider_id uuid,unique(race_registration_id,rider_id));
    create table race_roster_stage_roles(race_registration_id uuid,rider_id uuid,role text,
      constraint race_roster_stage_roles_roster_fkey foreign key(race_registration_id,rider_id) references race_rosters(race_registration_id,rider_id) on delete cascade);
    create table race_time_trial_rider_plans(race_registration_id uuid,rider_id uuid,effort int,
      constraint race_time_trial_rider_plans_roster_fkey foreign key(race_registration_id,rider_id) references race_rosters(race_registration_id,rider_id) on delete cascade);
    create table race_stage_strategies(race_registration_id uuid,lieutenant_rider_id uuid,danger_pacer_rider_id uuid,protector_rider_id uuid,breakaway_rider_id uuid,
      constraint race_stage_strategies_lieutenant_roster_fkey foreign key(race_registration_id,lieutenant_rider_id) references race_rosters(race_registration_id,rider_id) on delete cascade,
      constraint race_stage_strategies_danger_pacer_roster_fkey foreign key(race_registration_id,danger_pacer_rider_id) references race_rosters(race_registration_id,rider_id) on delete cascade,
      constraint race_stage_strategies_protector_roster_fkey foreign key(race_registration_id,protector_rider_id) references race_rosters(race_registration_id,rider_id) on delete cascade,
      constraint race_stage_strategies_breakaway_rider_roster_fkey foreign key(race_registration_id,breakaway_rider_id) references race_rosters(race_registration_id,rider_id) on delete cascade);
    create table stage_results(race_roster_id uuid references race_rosters(id) on delete restrict,finish_rank int);
    insert into race_rosters values('${s3}','${s3}','${s3}');
    insert into race_roster_stage_roles values('${s3}','${s3}','leader');
    insert into race_time_trial_rider_plans values('${s3}','${s3}',90);
    insert into race_stage_strategies values('${s3}','${s3}','${s3}','${s3}','${s3}');
    insert into stage_results values('${s3}',1);
  `);
  await assert.rejects(db.exec(`update race_rosters set rider_id='${s4}' where id='${s3}'`), /foreign key/);
  await db.exec(read('20261009080000_preserve_roster_tactics_on_academy_promotion'));
  await db.exec(`update race_rosters set rider_id='${s4}' where id='${s3}';`);
  assert.equal((await db.query('select rider_id,role from race_roster_stage_roles')).rows[0].rider_id, s4);
  assert.equal((await db.query('select effort from race_time_trial_rider_plans')).rows[0].effort, 90);
  const tactics = (await db.query('select * from race_stage_strategies')).rows[0];
  for (const key of ['lieutenant_rider_id','danger_pacer_rider_id','protector_rider_id','breakaway_rider_id']) assert.equal(tactics[key], s4);
  assert.equal((await db.query('select finish_rank from stage_results')).rows[0].finish_rank, 1);
  console.log('PASS: real rollover patch compilation, unchanged-rank writes, batch rank reuse, guard isolation, retry clock, health failures, integrity age/profile checks');
  console.log('PASS: academy identity merge keeps stage roles, TT plans, all four tactics and historical stage results');
} finally { await db.close(); }
