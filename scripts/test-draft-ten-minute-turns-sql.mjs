// Isolated PostgreSQL only: real draft migrations, no credentials or production calls.
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

  const migration=await readFile('supabase/migrations/20261105220000_draft_ten_minute_turns.sql','utf8');
  const signatures=['public.initialize_season_draft(uuid)','public.advance_season_draft(uuid)',
    'public.reserve_season_draft_pool(uuid,integer)','public.reserve_season_draft_on_rollover()',
    'public.process_season_draft()','public.try_season_draft_pick(uuid,uuid,uuid)',
    'public.save_current_season_draft_preferences(uuid,uuid[],boolean)',
    'public.select_current_season_draft_rider(uuid,uuid,boolean)','public.get_season_draft_view(boolean)',
    'public.guard_season_draft_reservation()','public.guard_season_draft_resale()',
    'public.calculate_season_draft_score(jsonb,integer,integer)'];
  const functions=()=>q('select oid::text,oid::regprocedure::text signature,pg_get_functiondef(oid) definition,proacl::text acl,proconfig::text config,proowner::text owner from pg_proc where oid=any($1::regprocedure[]) order by oid',[signatures]);
  const beforeFunctions=await functions();
  const beforeSettings=await value('select to_jsonb(s) value from season_draft_settings s');
  // Installation must not grant time retroactively or rewrite a running turn.
  await db.exec("insert into season_draft_editions(game_year,previous_season_id,announcement_at,opens_at,starts_at,status,current_position,pick_deadline) values(99,'"+id(4)+"',now()+interval '20 days',now()+interval '21 days',now()+interval '22 days','running',1,now()+interval '2 minutes');");
  const beforeEdition=await value('select to_jsonb(e) value from season_draft_editions e');
  await db.exec(migration);
  check(await value('select pick_seconds value from season_draft_settings'),600,'Existing setting is ten minutes');
  check(await value("select pg_get_expr(adbin,adrelid) value from pg_attrdef where adrelid='season_draft_settings'::regclass and adnum=(select attnum from pg_attribute where attrelid='season_draft_settings'::regclass and attname='pick_seconds')"),'600','Default is ten minutes');
  await fails('update season_draft_settings set pick_seconds=300',[],'Old five-minute setting is rejected');
  const afterSettings=await value('select to_jsonb(s) value from season_draft_settings s');
  check({...afterSettings,pick_seconds:300},beforeSettings,'All other settings remain unchanged');
  check(await value('select to_jsonb(e) value from season_draft_editions e'),beforeEdition,'Existing deadline/edition/version is untouched');
  check(await value('select count(*)::int value from sporting_director_messages'),0,'Installation sends no retrospective mail');
  const afterFunctions=await functions();
  for(const before of beforeFunctions){
    const after=afterFunctions.find(f=>f.oid===before.oid);
    check([after.oid,after.acl,after.config,after.owner],[before.oid,before.acl,before.config,before.owner],before.signature+': OID, ACL, owner and runtime bounds preserved');
    const expected=before.definition.replaceAll("interval '5 minutes'","interval '10 minutes'")
      .replaceAll('vous aurez 5 minutes','vous aurez 10 minutes')
      .replaceAll('Vous avez 5 minutes','Vous avez 10 minutes')
      .replaceAll('Le délai de 5 minutes','Le délai de 10 minutes');
    check(after.definition,expected,before.signature+': no unrelated rule changed');
  }
  check(await value("select has_function_privilege('authenticated','public.advance_season_draft(uuid)','execute') value"),false,'Worker stays service-only');
  check(await value("select has_function_privilege('authenticated','public.save_current_season_draft_preferences(uuid,uuid[],boolean)','execute') value"),true,'Existing preference RPC remains available');
  check(await value("select has_table_privilege('authenticated','public.season_draft_settings','update') value"),false,'Players cannot change the duration');
  await db.exec("update seasons set starts_on=(clock_timestamp() at time zone 'Europe/Paris')::date-27 where game_year=4; update seasons set starts_on=(clock_timestamp() at time zone 'Europe/Paris')::date+1 where game_year=5; select process_season_draft();");
  const edition=await value('select id value from season_draft_editions where game_year=5');
  check(await value("select (opens_at at time zone 'Europe/Paris')::time::text value from season_draft_editions where id=$1",[edition]),'08:00:00','Preferences still open at 08h Paris');
  check(await value("select (starts_at at time zone 'Europe/Paris')::time::text value from season_draft_editions where id=$1",[edition]),'14:00:00','Draft still starts at 14h Paris');
  check(await value('select pool_reserved_at value from season_draft_editions where id=$1',[edition]),null,'No pool before season rollover');
  await db.query("update season_draft_editions set announcement_at=now()-interval '1 day',opens_at=now()-interval '1 hour',starts_at=now()+interval '1 hour' where id=$1",[edition]);
  for(let n=1;n<=6;n++)await db.exec("insert into teams values('"+id(100+n)+"','active',35); insert into sporting_directors values('"+id(200+n)+"','"+id(1000+n)+"','active',true,now()-interval '30 days','DS "+n+"'); insert into team_manager_assignments values('"+id(100+n)+"','"+id(200+n)+"','general_manager','active'); insert into team_seasons values('"+id(300+n)+"','"+id(100+n)+"','"+id(5)+"','active','Team "+n+"',0,2000000),('"+id(400+n)+"','"+id(100+n)+"','"+id(4)+"','completed','Old "+n+"',"+n*10+",2000000); insert into player_daily_activity values('"+id(1000+n)+"',current_date,now()-interval '2 hours');");
  for(let n=1;n<=8;n++)await db.exec("insert into riders values('"+id(2000+n)+"','"+id(99)+"','Rider','"+n+"','free_agent',8,'classic',"+n+"); insert into rider_season_ratings values('"+id(2000+n)+"','"+id(5)+"',21,"+stats.map(()=>70+n).join(',')+");");
  await db.exec("update seasons set status='completed' where game_year=4;update seasons set status='active',starts_on=(clock_timestamp() at time zone 'Europe/Paris')::date where game_year=5;insert into season_rollover_settlements values('"+id(5)+"');");
  check(await value('select pool_reserved_at is not null value from season_draft_editions where id=$1',[edition]),true,'Midnight receipt still reserves before preferences');
  check(await value('select initialized_at value from season_draft_editions where id=$1',[edition]),null,'Reservation does not initialize participants');
  await db.query('select initialize_season_draft($1)',[edition]);
  check((await q('select position,team_id from season_draft_participants where edition_id=$1 order by position',[edition])).map(p=>p.team_id),Array.from({length:6},(_,i)=>id(101+i)),'Ranking and eligible humans are preserved');
  check(await value("select count(*)::int value from sporting_director_messages where source_reference like '%:opening' and body like '%vous aurez 10 minutes%'"),6,'Opening mail announces ten minutes');
  const pool=(await q('select rider_id from season_draft_riders where edition_id=$1 order by pool_rank',[edition])).map(r=>r.rider_id);
  const auth=async n=>db.query("select set_config('test.auth_uid',$1,false)",[id(1000+n)]);
  for(let n=1;n<=4;n++){await auth(n);await db.query('select save_current_season_draft_preferences($1,$2,true)',[edition,pool.slice(0,4)]);}
  await auth(4);
  const saved=await value('select get_season_draft_view(false) value');
  check(saved.mine.preferences,pool.slice(0,4),'Confirmed server list preserves priorities 1 to 4');
  check(saved.mine.autoEnabled,true,'Automatic selection was actually saved');
  check(await value('select count(*)::int value from rider_contracts'),0,'No draft pick before 14h');
  await db.query("update season_draft_editions set starts_at=now()-interval '1 minute' where id=$1",[edition]);
  await db.query('select advance_season_draft($1)',[edition]);
  check((await q("select selected_rider_id from season_draft_participants where edition_id=$1 and position<=4 order by position",[edition])).map(p=>p.selected_rider_id),pool.slice(0,4),'When preferences 1, 2 and 3 are taken, priority 4 is selected');
  check(await value('select current_position value from season_draft_editions where id=$1',[edition]),5,'Next manual DS receives their turn');
  const seconds=Number(await value('select extract(epoch from pick_deadline-now()) value from season_draft_editions where id=$1',[edition]));
  check(seconds>598&&seconds<=600,true,'Manual slot lasts a full ten minutes');
  const deadline=await value('select pick_deadline::text value from season_draft_editions where id=$1',[edition]);
  await db.query('select advance_season_draft($1)',[edition]);
  check(await value('select pick_deadline::text value from season_draft_editions where id=$1',[edition]),deadline,'Repeated worker does not reset the countdown');
  await auth(5);
  // Simulate elapsed time just beyond the former five-minute cutoff.
  await db.query("update season_draft_editions set pick_deadline=now()+interval '4 minutes 59 seconds' where id=$1",[edition]);
  await db.query('select select_current_season_draft_rider($1,$2,false)',[edition,pool[4]]);
  check(await value('select selected_rider_id value from season_draft_participants where edition_id=$1 and position=5',[edition]),pool[4],'Manual pick still succeeds after the former five-minute cutoff');
  check(await value('select current_position value from season_draft_editions where id=$1',[edition]),6,'Manual pick advances normally');
  const nextSeconds=Number(await value('select extract(epoch from pick_deadline-now()) value from season_draft_editions where id=$1',[edition]));
  check(nextSeconds>598&&nextSeconds<=600,true,'Every next DS also receives ten minutes');
  check(await value("select count(*)::int value from sporting_director_messages where source_reference like '%:turn' and body like 'Vous avez 10 minutes%'"),6,'Turn mail consistently announces ten minutes');
  await auth(6);
  await db.query('begin');await db.query('update season_draft_editions set pick_deadline=now() where id=$1',[edition]);
  await db.query('select advance_season_draft($1)',[edition]);await db.query('commit');
  check(await value('select resolution_reason value from season_draft_participants where edition_id=$1 and position=6',[edition]),'timeout','Exact ten-minute deadline still passes an unresolved turn');
  check(await value('select status value from season_draft_editions where id=$1',[edition]),'completed','The draft closes after the final timeout');
  check(await value("select count(*)::int value from sporting_director_messages where source_reference like '%:result' and body like 'Le délai de 10 minutes%'"),1,'Expiration mail matches ten minutes');
  check(await value("select count(*)::int value from sporting_director_messages where body like '%5 minutes%'"),0,'No newly emitted draft mail claims five minutes');
  check(await value("select count(*)::int value from rider_contracts where acquisition_type='season_draft' and start_season_id=end_season_id and transfer_fee=0 and transfer_locked_season_id=start_season_id"),5,'Recruitment, one-season duration and resale locks are unchanged');
  const snapshot=await value('select jsonb_agg(to_jsonb(e) order by game_year) value from season_draft_editions e');
  const mailCount=await value('select count(*)::int value from sporting_director_messages');
  await db.exec(migration);
  check(await value('select jsonb_agg(to_jsonb(e) order by game_year) value from season_draft_editions e'),snapshot,'Reviewed migration retry leaves all editions untouched');
  check(await value('select count(*)::int value from sporting_director_messages'),mailCount,'Reviewed retry emits no duplicate notification');
  console.log(JSON.stringify({checks,isolated:true,productionTouched:false}));
} catch(error) {
  console.error(JSON.stringify({checks,message:error.message,where:error.where,detail:error.detail,stack:error.name==='AssertionError'?error.stack:undefined},null,2));
  process.exitCode=1;
} finally { await db.close(); }
