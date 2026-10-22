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
const auth=async n => db.query("select set_config('test.auth_uid',$1,false)",[id(1000+n)]);
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
  check(await value('select first_game_year value from season_draft_settings'),5,'only next season');
  check(await value('select count(*)::int value from season_draft_editions'),0,'no current-season event');
  check(await value("select schedule value from cron.jobs where name='season-opening-draft'"),'* * * * *','independent recurring worker');
  await db.exec('select process_season_draft()');
  check(await value('select count(*)::int value from season_draft_editions'),0,'worker no-op mid-season');
  await db.exec(`update seasons set starts_on=current_date-27,current_day_number=28 where id='${id(4)}'; select process_season_draft();`);
  check(await value('select count(*)::int value from season_draft_editions'),1,'announcement created on J28');
  check(await value("select (starts_at at time zone 'Europe/Paris')::time::text value from season_draft_editions"),'14:00:00','14h Paris');
  check(await value("select (opens_at at time zone 'Europe/Paris')::time::text value from season_draft_editions"),'08:00:00','8h Paris');
  await db.exec('select process_season_draft()');
  check(await value('select count(*)::int value from season_draft_editions'),1,'announcement idempotent');
  const edition=await value('select id value from season_draft_editions');
  await db.exec(`update seasons set status='completed' where id='${id(4)}'; update seasons set status='active',starts_on=current_date where id='${id(5)}';
    update season_draft_editions set announcement_at=now()-interval '1 day',opens_at=now()-interval '1 hour',starts_at=now()+interval '1 hour';
    insert into season_rollover_settlements values('${id(5)}');`);
  // Players 1/2 have zero points; 2 registered earlier. 3 has no previous season.
  // Players 6/7/8/9/10 are excluded: inactive, exact 7d boundary, bot, suspended, created after opening.
  for(let n=1;n<=10;n++) {
    const created=n===10?"now()-interval '30 minutes'":`now()-interval '${n===2?500:100-n} days'`;
    await db.exec(`insert into teams values('${id(100+n)}','active',35);
      insert into sporting_directors values('${id(200+n)}','${id(1000+n)}','${n===9?'suspended':'active'}',true,${created},'DS ${n}');
      insert into team_manager_assignments values('${id(100+n)}','${id(200+n)}','general_manager','active');
      insert into team_seasons values('${id(300+n)}','${id(100+n)}','${id(5)}','active','Team ${n}',0,2000000);
      ${n!==3?`insert into team_seasons values('${id(400+n)}','${id(100+n)}','${id(4)}','completed','Former ${n}',${n===1||n===2?0:n*10},2000000);`:''}
      insert into player_daily_activity values('${id(1000+n)}',current_date,
        ${n===6?"now()-interval '8 days'":n===7?"(select opens_at-interval '7 days' from season_draft_editions)":"now()-interval '2 hours'"});`);
  }
  await db.exec(`insert into alpha_bot_managers values('${id(208)}','${id(1008)}');`);
  for(let n=1;n<=108;n++) {
    const state=n===108?'retired':'free_agent';
    await db.exec(`insert into riders values('${id(2000+n)}','${id(99)}','Rider','${n}','${state}',${n%8+1},'classic',${n});
      insert into rider_season_ratings values('${id(2000+n)}','${id(5)}',${20+n%15},${stats.map((_,i)=>50+(n+i)%30).join(',')});`);
  }
  await db.exec(`insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type,salary_per_season) values
    ('${id(2107)}','${id(110)}','${id(5)}','${id(5)}','planned','initial',0);
    insert into transfer_market_listings(rider_id,status) values('${id(2106)}','open');`);
  await db.query('select initialize_season_draft($1)',[edition]);
  check((await q('select team_name from season_draft_participants order by position')).map(r=>r.team_name),['Team 2','Team 1','Team 3','Team 4','Team 5'],'zero points, account tie-break, no-history, exclusions');
  check(await value('select count(*)::int value from season_draft_riders'),100,'top100 actual riders');
  check(await value('select total value from salary_quote_calls'),1,'one batched quote');
  check(await value(`select count(*)::int value from season_draft_riders where rider_id in('${id(2106)}','${id(2107)}','${id(2108)}')`),0,'auction, planned contract, retired excluded');
  await db.query('select initialize_season_draft($1)',[edition]);
  check(await value('select total value from salary_quote_calls'),1,'no duplicate initialization');
  const pool=(await q('select rider_id from season_draft_riders order by pool_rank')).map(r=>r.rider_id);
  await fails("select get_season_draft_view(true)",[],'unauthenticated read denied');
  await auth(2);
  let view=await value('select get_season_draft_view(true) value');
  check(view.mine.position,1,'authenticated own position');
  check(view.riders.length,100,'full revealed pool');
  check(Object.keys(view.riders[0].ratings).length,13,'13 exact stats');
  check(view.participants.some(p=>'preferences' in p),false,'other preferences stay private');
  check((await value('select get_season_draft_view(false) value')).riders,null,'lightweight status excludes pool');
  await fails('select save_current_season_draft_preferences($1,$2,true)',[edition,[pool[0],pool[0]]],'duplicate preferences rejected');
  await fails('select save_current_season_draft_preferences($1,$2,true)',[edition,[id(9999)]],'nonpool rejected');
  await fails('select save_current_season_draft_preferences($1,$2,true)',[edition,[]],'empty automatic rejected');
  await db.query('select save_current_season_draft_preferences($1,$2,true)',[edition,[pool[0],pool[1]]]);
  await auth(1);
  await db.query('select save_current_season_draft_preferences($1,$2,true)',[edition,[pool[0],pool[1],pool[2]]]);
  await auth(6);
  await fails('select save_current_season_draft_preferences($1,$2,true)',[edition,[pool[0]]],'excluded director cannot save');
  await fails("insert into transfer_market_listings(rider_id,status) values($1,'open')",[pool[0]],'auction reservation');
  await fails(`insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type) values($1,'${id(110)}','${id(5)}','${id(5)}','active','free_agent')`,[pool[0]],'other recruitment reservation');
  await db.exec("update season_draft_editions set starts_at=now()-interval '1 minute'");
  await db.query('select advance_season_draft($1)',[edition]);
  check((await q('select selected_rider_id from season_draft_participants where status=\'picked\' order by position')).map(r=>r.selected_rider_id),pool.slice(0,2),'ordered picks and fallback');
  check(await value('select current_position value from season_draft_editions'),3,'next manual team');
  check(await value("select pick_deadline>now()+interval '4 minutes 55 seconds' value from season_draft_editions"),true,'full five-minute slot');
  check(await value("select count(*)::int value from rider_contracts where acquisition_type='season_draft' and start_season_id=end_season_id and transfer_fee=0 and transfer_locked_season_id=start_season_id"),2,'one-season zero-fee locked contracts');
  await auth(2);
  await db.query('select select_current_season_draft_rider($1,$2,false)',[edition,pool[0]]);
  check(await value("select count(*)::int value from rider_contracts where acquisition_type='season_draft'"),2,'replayed pick idempotent');
  await fails("insert into transfer_market_listings(rider_id,status) values($1,'open')",[pool[0]],'resale denied');
  await fails(`insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type) values($1,'${id(110)}','${id(5)}','${id(5)}','planned','renewal')`,[pool[0]],'different-team future contract denied during draft season');
  await auth(4);
  await fails('select select_current_season_draft_rider($1,$2,false)',[edition,pool[2]],'out-of-turn pick denied');
  await auth(3);
  await db.exec(`update teams set roster_limit=0 where id='${id(103)}';`);
  await fails('select select_current_season_draft_rider($1,$2,false)',[edition,pool[2]],'capacity enforced');
  await db.exec(`update teams set roster_limit=35 where id='${id(103)}'; update team_seasons set cash_balance=0 where id='${id(303)}';`);
  await fails('select select_current_season_draft_rider($1,$2,false)',[edition,pool[2]],'budget enforced');
  await db.exec(`update team_seasons set cash_balance=2000000 where id='${id(303)}'; update season_draft_editions set pick_deadline=now()-interval '1 second';`);
  await fails('select select_current_season_draft_rider($1,$2,false)',[edition,pool[2]],'expired manual pick denied');
  await db.query('select advance_season_draft($1)',[edition]);
  check(await value("select resolution_reason value from season_draft_participants where position=3"),'timeout','expired team passed');
  check(await value('select current_position value from season_draft_editions'),4,'worker advances without visits');
  await auth(4);
  await db.query('select select_current_season_draft_rider($1,$2,false)',[edition,pool[2]]);
  check(await value('select current_position value from season_draft_editions'),5,'manual signing advances');
  await auth(5);
  await db.query('select select_current_season_draft_rider($1,null,true)',[edition]);
  check(await value('select status value from season_draft_editions'),'completed','closed automatically');
  check(await value('select count(*)::int value from season_draft_participants where status=\'picked\''),3,'one rider per team');
  await db.query('select advance_season_draft($1)',[edition]);
  check(await value("select count(*)::int value from sporting_director_messages where source_reference like '%:result'"),5,'one result message per participant');
  await db.query("insert into transfer_market_listings(rider_id,status) values($1,'open')",[pool[3]]);
  check(await value('select count(*)::int value from transfer_market_listings where rider_id=$1',[pool[3]]),1,'unpicked pool released');
  await fails("insert into transfer_market_listings(rider_id,status) values($1,'open')",[pool[0]],'resale still locked after closing');
  check(await value("select has_function_privilege('authenticated','public.process_season_draft()','execute') value"),false,'worker not callable by players');
  check(await value("select has_function_privilege('anon','public.get_season_draft_view(boolean)','execute') value"),false,'anonymous pool denied');
  check(await value("select has_table_privilege('authenticated','public.season_draft_participants','select') value"),false,'raw private preferences denied');
  await db.exec(`update seasons set status='completed' where id='${id(5)}'; insert into seasons values('${id(6)}',6,'S6','active',current_date-27,28); select process_season_draft();`);
  check(await value('select count(*)::int value from season_draft_editions'),2,'next season recurring automatically');
  check((await value('select get_season_draft_view(false) value')).edition.gameYear,7,'J28 shows the NEXT draft, not last season results');
  const nextEdition=await value('select id value from season_draft_editions where game_year=7');
  await db.exec(`update season_draft_settings set enabled=false; update seasons set status='completed' where id='${id(6)}';
    insert into seasons values('${id(7)}',7,'S7','active',current_date,1);
    update season_draft_editions set season_id='${id(7)}',announcement_at=now()-interval '1 day',opens_at=now()-interval '1 hour',starts_at=now()+interval '1 hour' where id='${nextEdition}';
    select process_season_draft();`);
  check(await value('select initialized_at is null value from season_draft_editions where id=$1',[nextEdition]),true,'suspended scheduled draft not initialized');
  await db.exec('update season_draft_settings set enabled=true; select process_season_draft();');
  check(await value('select initialized_at is null value from season_draft_editions where id=$1',[nextEdition]),true,'waits for committed rollover receipt');
  for(let n=21;n<=125;n++) await db.exec(`
    insert into teams values('${id(100+n)}','active',35);
    insert into sporting_directors values('${id(200+n)}','${id(1000+n)}','active',true,now()-interval '${200-n} days','Next ${n}');
    insert into team_manager_assignments values('${id(100+n)}','${id(200+n)}','general_manager','active');
    insert into team_seasons values('${id(4000+n)}','${id(100+n)}','${id(7)}','active','Next team ${n}',0,${n===21?9000:2000000});
    insert into player_daily_activity values('${id(1000+n)}',current_date,now()-interval '2 hours');`);
  // More than 100 eligible teams must not silently lose their draft slot.
  for(let n=109;n<=140;n++) await db.exec(`insert into riders values('${id(2000+n)}','${id(99)}','Extra','${n}','free_agent',8,'classic',${n});
    insert into rider_season_ratings values('${id(2000+n)}','${id(5)}',21,${stats.map(()=>70).join(',')});`);
  await db.exec(`insert into rider_season_ratings select rider_id,'${id(7)}',age,${stats.join(',')} from rider_season_ratings where season_id='${id(5)}';
    insert into season_rollover_settlements values('${id(7)}'); select process_season_draft();`);
  check(await value('select participant_count value from season_draft_editions where id=$1',[nextEdition]),105,'all 105 active humans included');
  check(await value('select pool_count value from season_draft_editions where id=$1',[nextEdition]),105,'pool expands beyond 100');
  check(await value('select total value from salary_quote_calls'),2,'still one salary batch per edition');
  const nextPool=(await q('select rider_id from season_draft_riders where edition_id=$1 order by pool_rank',[nextEdition])).map(r=>r.rider_id);
  await db.query('update season_draft_riders set salary_per_season=case when rider_id=$2 then 15000 else 9500 end where edition_id=$1 and rider_id in($2,$3)',[nextEdition,nextPool[0],nextPool[1]]);
  await db.exec(`create or replace function get_team_specialization_power(uuid,text,text) returns numeric language sql stable set search_path=public as $$select case when $1='${id(121)}'::uuid then 2 else 0 end::numeric$$;
    create function test_salary_discount() returns trigger language plpgsql set search_path=public as $$begin new.salary_per_season=round(new.salary_per_season*(1-.03*get_team_specialization_power(new.team_id,'recruitment_data_room','deal_room')),2);return new;end$$;
    create trigger test_salary_discount before insert on rider_contracts for each row execute function test_salary_discount();`);
  await auth(21);
  await db.query('select save_current_season_draft_preferences($1,$2,true)',[nextEdition,[nextPool[0],nextPool[1]]]);
  await auth(22);
  await db.query('select save_current_season_draft_preferences($1,$2,true)',[nextEdition,[nextPool[1]]]);
  await db.query("update season_draft_editions set starts_at=now()-interval '1 minute' where id=$1",[nextEdition]);
  await db.exec(`insert into test_transfer_reservations values('${id(121)}',2000);`);
  await db.query('select advance_season_draft($1)',[nextEdition]);
  check(await value('select status value from season_draft_participants where edition_id=$1 and position=1',[nextEdition]),'pending','respects money reserved for other transfers');
  await db.exec('delete from test_transfer_reservations');
  await db.query('select advance_season_draft($1)',[nextEdition]);
  check(await value('select selected_rider_id value from season_draft_participants where edition_id=$1 and position=1',[nextEdition]),nextPool[1],'skips unaffordable preference, picks next affordable');
  check(Number(await value(`select salary_per_season value from rider_contracts where rider_id=$1 and team_id='${id(121)}'`,[nextPool[1]])),8930,'normal salary discount matches accepted quote and budget');
  check(await value('select current_position value from season_draft_editions where id=$1',[nextEdition]),2,'exhausted automatic list gets manual slot');
  check(await value('select status value from season_draft_participants where edition_id=$1 and position=2',[nextEdition]),'pending','does not invent a replacement signing');
  await db.query("update season_draft_editions set pick_deadline=now()-interval '1 second' where id=$1",[nextEdition]);
  await db.query('select advance_season_draft($1)',[nextEdition]);
  check(await value('select status value from season_draft_participants where edition_id=$1 and position=2',[nextEdition]),'passed','exhausted list times out safely');
  await db.exec('set role authenticated');
  check((await value('select get_season_draft_view(false) value')).mine.position,2,'read RPC executes under actual authenticated role');
  await fails('select preferences from public.season_draft_participants',[],'actual authenticated role cannot read private rows');
  await db.exec('reset role');
  // Normal, non-draft transfers remain available while the draft is running.
  await db.exec(`insert into riders values('${id(2999)}','${id(99)}','Outside','Pool','free_agent',1,'classic',999);`);
  await db.query("insert into transfer_market_listings(rider_id,status) values($1,'open')",[id(2999)]);
  check(await value('select count(*)::int value from transfer_market_listings where rider_id=$1',[id(2999)]),1,'unrelated normal transfers untouched');
  console.log(JSON.stringify({checks,isolated:true,productionTouched:false}));
} catch(error) {
  console.error(JSON.stringify({checks,message:error.message,where:error.where,detail:error.detail,stack:error.name==='AssertionError'?error.stack:undefined},null,2));
  process.exitCode=1;
} finally { await db.close(); }
