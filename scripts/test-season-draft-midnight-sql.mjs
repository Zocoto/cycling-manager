// Isolated PostgreSQL only. This script never reads credentials or contacts production.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]?.replaceAll('\\','/').endsWith('/pglite/dist/index.js')) throw Error('Pass an existing local PGlite module.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const stats=['mountain','hills','flat','time_trial','cobbles','sprint','acceleration','downhill','endurance','resistance','recovery','breakaway','prologue'];
let checks=0;
const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
const value=async(sql,args=[]) => (await q(sql,args))[0]?.value;
const check=(actual,expected,label) => {assert.deepEqual(actual,expected,label);checks++;};
const fails=async(sql,args,label) => {await assert.rejects(()=>db.query(sql,args),label);checks++;};
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.auth_uid',true),'')::uuid$$;
    create schema cron; create table cron.jobs(name text primary key,schedule text,command text);
    create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin insert into cron.jobs values($1,$2,$3) on conflict(name) do update set schedule=$2,command=$3; return 1; end$$;
    create table seasons(id uuid primary key,game_year int unique,name text,status text,starts_on date,current_day_number int);
    create table teams(id uuid primary key,status text,roster_limit int default 35);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text,onboarding_completed bool,created_at timestamptz,display_name text);
    create table team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,status text,display_name text,points int,cash_balance numeric,unique(team_id,season_id));
    create table alpha_bot_managers(sporting_director_id uuid,auth_user_id uuid);
    create table player_daily_activity(auth_user_id uuid,activity_on date,last_seen_at timestamptz);
    create table countries(id uuid primary key,name text,iso_alpha2 text);
    create table riders(id uuid primary key,country_id uuid,first_name text,last_name text,status text,potential_steps int,avatar_profile_key text,avatar_seed bigint);
    create table rider_season_ratings(rider_id uuid,season_id uuid,age int,${stats.map(s=>s+' int').join(',')},primary key(rider_id,season_id));
    create table rider_special_abilities(rider_id uuid,ability_code text);
    create table rider_injuries(rider_id uuid,status text,expected_recovery_at timestamptz);
    create table rider_contracts(id uuid primary key default gen_random_uuid(),rider_id uuid,team_id uuid,start_season_id uuid,end_season_id uuid,
      salary_per_season numeric,currency text,currency_code text,status text,signed_at timestamptz,acquisition_type text,
      transfer_locked_season_id uuid,transfer_fee numeric, constraint rider_contracts_acquisition_type_allowed check(acquisition_type in('initial','free_agent','renewal','daily_auction')));
    create unique index rider_one_active on rider_contracts(rider_id) where status='active';
    create table transfer_market_listings(id uuid default gen_random_uuid(),rider_id uuid,status text);
    create table sporting_director_messages(sporting_director_id uuid,season_id uuid,team_season_id uuid,message_type text,sender_name text,
      subject text,preview text,body text,action_href text,action_label text,source_reference text,is_important bool,unique(sporting_director_id,source_reference));
    create table season_rollover_settlements(target_season_id uuid);
    create table salary_quote_calls(total int); insert into salary_quote_calls values(0);
    create table test_transfer_reservations(team_id uuid primary key,reserved numeric);
    create function get_team_transfer_reserved_budget(uuid,uuid,uuid) returns numeric language sql stable as $$select coalesce((select reserved from test_transfer_reservations where team_id=$1),0)$$;
    create function calculate_rider_season_salary_quotes(uuid[],uuid) returns table(rider_id uuid,salary_per_season numeric) language plpgsql as $$
      begin update salary_quote_calls set total=total+1; return query select r,10000::numeric from unnest($1) r; end$$;
    create function get_team_specialization_power(uuid,text,text) returns numeric language sql stable as $$select 0::numeric$$;
    create function is_team_homegrown_rider(uuid,uuid) returns boolean language sql stable as $$select false$$;
    create function get_team_roster_limit(uuid) returns int language sql stable as $$select roster_limit from teams where id=$1$$;
    create function get_team_roster_base_limit(uuid) returns int language sql stable as $$select get_team_roster_limit($1)$$;
    create function get_team_roster_commitment_count(uuid,int) returns int language sql stable as $$select count(*)::int from rider_contracts where team_id=$1 and status in('active','planned')$$;
    create function get_team_non_homegrown_roster_commitment_count(uuid,int) returns int language sql stable as $$select get_team_roster_commitment_count($1,$2)$$;
    create function can_team_reserve_roster_rider(uuid,int,uuid) returns bool language sql stable as $$select get_team_roster_commitment_count($1,$2)<get_team_roster_limit($1)$$;
    create function get_projected_transfer_budget(uuid) returns numeric language sql stable as $$select cash_balance-coalesce((select sum(salary_per_season) from rider_contracts where team_id=ts.team_id and status in('active','planned')),0) from team_seasons ts where ts.id=$1$$;
    insert into seasons values('${id(4)}',4,'S4','active',current_date-13,14),('${id(5)}',5,'S5','planned',current_date+15,1);
    insert into countries values('${id(99)}','France','FR');
    do $$ declare f regprocedure; begin for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace loop
      execute format('alter function %s set search_path=public',f); end loop; end$$;
  `);
  await db.exec(await readFile('supabase/migrations/20261022160000_create_recurring_season_draft.sql','utf8'));

  await db.exec(await readFile('supabase/migrations/20261105210000_reserve_season_draft_from_midnight.sql','utf8'));
  check(await value('select count(*)::int value from season_draft_editions'),0,'migration creates no current-season pool');
  check(await value("select has_function_privilege('authenticated','public.reserve_season_draft_pool(uuid,integer)','execute') value"),false,'reservation helper remains private');
  await db.exec(`update seasons set starts_on=(clock_timestamp() at time zone 'Europe/Paris')::date-27 where id='${id(4)}';
    update seasons set starts_on=(clock_timestamp() at time zone 'Europe/Paris')::date+1 where id='${id(5)}'; select process_season_draft();`);
  const edition=await value('select id value from season_draft_editions where game_year=5');
  check(Boolean(edition),true,'next draft scheduled before rollover');
  const player=async n=>db.exec(`insert into teams values('${id(100+n)}','active',35);
    insert into sporting_directors values('${id(500+n)}','${id(1000+n)}','active',true,now()-interval '${n<3?'20 days':'30 minutes'}','DS ${n}');
    insert into team_manager_assignments values('${id(100+n)}','${id(500+n)}','general_manager','active');
    insert into team_seasons values('${id(4000+n)}','${id(100+n)}','${id(5)}','active','Team ${n}',0,2000000);
    insert into player_daily_activity values('${id(1000+n)}',(clock_timestamp() at time zone 'Europe/Paris')::date,now());`);
  await player(1);await player(2);
  for(let n=1;n<=128;n++) await db.exec(`insert into riders values('${id(2000+n)}','${id(99)}','Rider','${n}','free_agent',${n%8+1},'classic',${n});
    insert into rider_season_ratings values('${id(2000+n)}','${id(5)}',${20+n%15},${stats.map((_,i)=>50+(n+i)%30).join(',')});`);
  await db.exec(`insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type,salary_per_season)
    values('${id(2127)}','${id(101)}','${id(5)}','${id(5)}','planned','initial',0);
    insert into transfer_market_listings(rider_id,status) values('${id(2128)}','open');`);
  await db.query('select reserve_season_draft_pool($1,100)',[edition]);
  check(await value('select count(*)::int value from season_draft_riders'),0,'no reservation of next-season agents before rollover midnight');
  // The planned season is now due at midnight, while the old season is still
  // visible. Both signatures and fresh auctions must wait for the atomic pool.
  await db.exec(`update seasons set starts_on=(clock_timestamp() at time zone 'Europe/Paris')::date where id='${id(5)}';
    update season_draft_editions set announcement_at=now()-interval '1 day',opens_at=now()+interval '1 hour',starts_at=now()+interval '2 hours';`);
  await fails(`insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type)
    values($1,'${id(101)}','${id(4)}','${id(4)}','active','free_agent')`,[id(2001)],'old-season RPC cannot snipe while rollover is pending');
  await fails("insert into transfer_market_listings(rider_id,status) values($1,'open')",[id(2001)],'new auction cannot snipe while rollover is pending');
  await db.exec(`update rider_contracts set status='active' where rider_id='${id(2127)}';`);
  check(await value(`select status value from rider_contracts where rider_id='${id(2127)}'`),'active','planned contract activation is preserved');
  await db.exec(`insert into riders values('${id(2990)}','${id(99)}','Initial','Promotion','free_agent',1,'classic',1);
    insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type)
      values('${id(2990)}','${id(101)}','${id(5)}','${id(5)}','active','initial');`);
  check(await value(`select count(*)::int value from rider_contracts where rider_id='${id(2990)}'`),1,'internal initial roster creation is preserved');
  // Mirror the production acquisition type absent from the minimal old fixture.
  await db.exec(`alter table rider_contracts drop constraint rider_contracts_acquisition_type_allowed;
    alter table rider_contracts add constraint rider_contracts_acquisition_type_allowed check(acquisition_type in('initial','free_agent','renewal','daily_auction','season_draft','academy'));
    insert into riders values('${id(2994)}','${id(99)}','Internal','Academy','free_agent',1,'classic',1);
    insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type)
    values('${id(2994)}','${id(101)}','${id(5)}','${id(5)}','active','academy');`);
  check(await value(`select count(*)::int value from rider_contracts where rider_id='${id(2994)}'`),1,'internal academy promotion is preserved');
  await db.exec(`update seasons set status='completed' where id='${id(4)}';update seasons set status='active' where id='${id(5)}';
    begin; insert into season_rollover_settlements values('${id(5)}');`);
  check(await value('select pool_reserved_at is not null value from season_draft_editions'),true,'pool reserved inside the receipt transaction');
  check(await value('select count(*)::int value from season_draft_riders'),100,'100 actual free riders reserved before receipt commit');
  await db.exec('commit');
  check(await value('select status value from season_draft_editions'),'scheduled','midnight does not open preferences');
  check(await value('select initialized_at is null value from season_draft_editions'),true,'participant initialization remains at opening');
  check(await value('select count(*)::int value from season_draft_participants'),0,'no midnight participant freeze');
  check(await value('select total value from salary_quote_calls'),0,'no early salary batch');
  check(await value(`select count(*)::int value from season_draft_riders where rider_id in('${id(2127)}','${id(2128)}')`),0,'existing engagements and auctions excluded');
  const frozen=(await q('select rider_id,pool_rank,score from season_draft_riders order by pool_rank'));
  const pool=frozen.map(r=>r.rider_id);
  await fails(`insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type)
    values($1,'${id(102)}','${id(5)}','${id(5)}','active','free_agent')`,[pool[0]],'reserved rider denied to direct human/bot inserts during night');
  await fails(`insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type)
    values($1,'${id(102)}','${id(5)}','${id(5)}','planned','free_agent')`,[pool[1]],'reserved rider denied to planned acquisition during night');
  await fails("insert into transfer_market_listings(rider_id,status) values($1,'open')",[pool[0]],'reserved rider denied to auction during night');
  await fails(`update rider_contracts set rider_id=$1 where rider_id='${id(2990)}'`,[pool[0]],'rider-id-only reassignment cannot bypass reservation');
  await db.exec(`insert into riders values('${id(2991)}','${id(99)}','Outside','Night','free_agent',1,'classic',1);
    insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type)
      values('${id(2991)}','${id(102)}','${id(5)}','${id(5)}','active','free_agent');
    insert into riders values('${id(2992)}','${id(99)}','Outside','Auction','free_agent',1,'classic',1);
    insert into transfer_market_listings(rider_id,status) values('${id(2992)}','open');`);
  check(await value(`select count(*)::int value from rider_contracts where rider_id='${id(2991)}'`),1,'ordinary non-pool recruitment resumes immediately after reservation');
  await db.query('select reserve_season_draft_pool($1,100)',[edition]);
  check((await q('select rider_id,pool_rank,score from season_draft_riders order by pool_rank')),frozen,'repeat reservation is idempotent');
  // Autonomous training changes values, not membership/rank in the frozen pool.
  await db.query('update rider_season_ratings set hills=99 where rider_id=$1',[pool[0]]);
  const outsider=await value('select rider_id value from rider_season_ratings where rider_id not in(select rider_id from season_draft_riders) and rider_id not in($1,$2) order by rider_id limit 1',[id(2127),id(2128)]);
  await db.query(`update rider_season_ratings set ${stats.map(k=>k+'=100').join(',')} where rider_id=$1`,[outsider]);
  for(let n=3;n<=105;n++) await player(n);
  await db.exec('update season_draft_settings set enabled=false; select process_season_draft();');
  check(await value('select initialized_at is null value from season_draft_editions'),true,'suspension after reservation does not open before 08h');
  await db.exec("update season_draft_editions set opens_at=now()-interval '1 minute'; select process_season_draft();");
  check(await value('select status value from season_draft_editions'),'preparing','already reserved draft continues even if recurrence disabled');
  check(await value('select participant_count value from season_draft_editions'),105,'participants including night signups are frozen only at opening');
  check(await value('select pool_count value from season_draft_editions'),105,'pool expands for more than100 participants');
  check((await q('select rider_id,pool_rank,score from season_draft_riders order by pool_rank limit 100')),frozen,'extension never replaces or reranks midnight100');
  check(Number(await value("select (snapshot->'ratings'->>'hills')::numeric value from season_draft_riders where rider_id=$1",[pool[0]])),99,'08h reveals refreshed ratings');
  check(await value('select total value from salary_quote_calls'),1,'one salary batch at 08h only');
  await db.exec('select process_season_draft();');
  check(await value('select total value from salary_quote_calls'),1,'retry does not re-quote initialized pool');
  check(await value('select count(*)::int value from rider_contracts where acquisition_type=\'season_draft\''),0,'no picks before14h');
  // Completing the draft preserves the existing release policy for non-picks.
  await db.exec("update season_draft_editions set status='completed',closed_at=now();");
  await db.query("insert into transfer_market_listings(rider_id,status) values($1,'open')",[pool[0]]);
  check(await value('select count(*)::int value from transfer_market_listings where rider_id=$1',[pool[0]]),1,'completion releases unselected riders without all-day freeze');
  // Disabled recurrence before reservation must not block a later season.
  await db.exec(`update seasons set status='completed' where id='${id(5)}'; insert into seasons values('${id(6)}',6,'S6','active',(clock_timestamp() at time zone 'Europe/Paris')::date,1);
    insert into season_rollover_settlements values('${id(6)}');`);
  check(await value('select count(*)::int value from season_draft_editions where game_year=6'),0,'disabled recurrence creates no midnight edition');
  await db.exec(`insert into riders values('${id(2993)}','${id(99)}','Outside','Disabled','free_agent',1,'classic',1);
    insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type)
    values('${id(2993)}','${id(102)}','${id(6)}','${id(6)}','active','free_agent');`);
  check(await value(`select count(*)::int value from rider_contracts where rider_id='${id(2993)}'`),1,'disabled future draft does not freeze ordinary recruitment');
  // No humans at opening: release an already frozen pool, without salary work.
  await db.exec(`update season_draft_settings set enabled=true;
    insert into season_draft_editions(game_year,season_id,previous_season_id,announcement_at,opens_at,starts_at)
    values(6,'${id(6)}','${id(5)}',now()-interval '1 day',now()+interval '1 hour',now()+interval '2 hours');
    insert into rider_season_ratings select rider_id,'${id(6)}',age,${stats.join(',')} from rider_season_ratings where season_id='${id(5)}'; select process_season_draft();`);
  check(await value('select pool_reserved_at is not null value from season_draft_editions where game_year=6'),true,'worker catches up missing midnight receipt hook');
  await db.exec("update season_draft_editions set opens_at=now()-interval '1 minute' where game_year=6; select process_season_draft();");
  check(await value('select status value from season_draft_editions where game_year=6'),'completed','zero eligible humans releases reserved edition at opening');
  check(await value('select total value from salary_quote_calls'),1,'zero-human edition does not request salary quotes');
  check(await value("select extract(hour from ((date '2027-03-28')::timestamp at time zone 'Europe/Paris') at time zone 'Europe/Paris')::int value"),0,'Paris midnight uses calendar dates across summer time transition');
  console.log(JSON.stringify({checks,isolated:true,productionTouched:false}));
} catch(error) {
  console.error(JSON.stringify({checks,message:error.message,where:error.where,detail:error.detail,stack:error.name==='AssertionError'?error.stack:undefined},null,2));
  process.exitCode=1;
} finally { await db.close(); }
