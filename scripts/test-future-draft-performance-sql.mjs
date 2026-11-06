// Isolated PostgreSQL only: no credentials, HTTP, CLI or production connection.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]?.replaceAll('\\','/').endsWith('/pglite/dist/index.js')) throw Error('Pass an existing local PGlite module.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const stats = ['mountain','hills','flat','time_trial','cobbles','sprint','acceleration','downhill','endurance','resistance','recovery','breakaway','prologue'];
const primary = ['mountain','hills','time_trial','cobbles','sprint'];
const rating = (base, overrides={}) => Object.fromEntries(stats.map(key=>[key,overrides[key]??base]));
let checks=0;
const rows = async (sql,args=[]) => (await db.query(sql,args)).rows;
const value = async (sql,args=[]) => (await rows(sql,args))[0]?.value;
const check = (actual,expected,label) => {assert.deepEqual(actual,expected,label);checks++;};
const score = async (r,potential,age,year) => Number(await value('select public.calculate_season_draft_score_for_edition($1::jsonb,$2,$3,$4) value',[JSON.stringify(r),potential,age,year]));
const legacy = async (r,potential,age) => Number(await value('select public.calculate_season_draft_score($1::jsonb,$2,$3) value',[JSON.stringify(r),potential,age]));
const pool = async edition => rows('select * from season_draft_riders where edition_id=$1 order by pool_rank',[edition]);
const coreFunctions = ['calculate_season_draft_score(jsonb,integer,integer)','guard_season_draft_reservation()','reserve_season_draft_on_rollover()',
  'initialize_season_draft(uuid)','advance_season_draft(uuid)','process_season_draft()',
  'get_season_draft_view(boolean)','save_current_season_draft_preferences(uuid,uuid[],boolean)'];

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
    create table rider_season_ratings(rider_id uuid,season_id uuid,age int,${stats.map(key=>key+' int').join(',')},primary key(rider_id,season_id));
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
    create function calculate_rider_season_salary_quotes(uuid[],uuid) returns table(rider_id uuid,salary_per_season numeric) language plpgsql as $$
      begin update salary_quote_calls set total=total+1; return query select r,10000::numeric from unnest($1) r; end$$;
    create function get_team_specialization_power(uuid,text,text) returns numeric language sql stable as $$select 0::numeric$$;
    create function is_team_homegrown_rider(uuid,uuid) returns boolean language sql stable as $$select false$$;
    create function get_team_roster_limit(uuid) returns int language sql stable as $$select roster_limit from teams where id=$1$$;
    create function get_team_roster_base_limit(uuid) returns int language sql stable as $$select get_team_roster_limit($1)$$;
    create function get_team_roster_commitment_count(uuid,int) returns int language sql stable as $$select count(*)::int from rider_contracts where team_id=$1 and status in('active','planned')$$;
    create function get_team_non_homegrown_roster_commitment_count(uuid,int) returns int language sql stable as $$select get_team_roster_commitment_count($1,$2)$$;
    create function can_team_reserve_roster_rider(uuid,int,uuid) returns bool language sql stable as $$select get_team_roster_commitment_count($1,$2)<get_team_roster_limit($1)$$;
    create function get_projected_transfer_budget(uuid) returns numeric language sql stable as $$select cash_balance from team_seasons where id=$1$$;
    create function get_team_transfer_reserved_budget(uuid,uuid,uuid) returns numeric language sql stable as $$select 0::numeric$$;
    insert into seasons values('${id(4)}',4,'S4','active',(clock_timestamp() at time zone 'Europe/Paris')::date-1,28),
      ('${id(5)}',5,'S5','planned',(clock_timestamp() at time zone 'Europe/Paris')::date,1);
    insert into countries values('${id(99)}','France','FR');
    do $$ declare f regprocedure; begin for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace loop
      execute format('alter function %s set search_path=public',f); end loop; end$$;
  `);
  for(const file of [
    '20261022160000_create_recurring_season_draft.sql','20261105210000_reserve_season_draft_from_midnight.sql',
    '20261105220000_draft_ten_minute_turns.sql','20261106100000_draft_preparation_indicator.sql','20261106103000_draft_auto_enabled_by_default.sql'
  ]) await db.exec(await readFile('supabase/migrations/'+file,'utf8'));

  // Freeze a real S5 pool using its actual rollover receipt hook before install.
  for(let n=1;n<=120;n++) await db.exec(`
    insert into riders values('${id(2000+n)}','${id(99)}','S5','Rider ${n}','free_agent',${n%8+1},'classic',${n});
    insert into rider_season_ratings values('${id(2000+n)}','${id(5)}',${20+n%20},${stats.map((_,i)=>50+(n+i)%30).join(',')});`);
  await db.exec(`update seasons set status='completed' where id='${id(4)}'; update seasons set status='active' where id='${id(5)}';
    insert into season_rollover_settlements values('${id(5)}');`);
  const edition5=await value('select id value from season_draft_editions where game_year=5');
  const frozen5=await pool(edition5);
  check(frozen5.length,100,'S5 actually reserves 100 riders before the future-rule installation');
  await db.exec(`insert into teams values('${id(101)}','active',35);
    insert into sporting_directors values('${id(501)}','${id(1001)}','active',true,now()-interval '100 days','Prepared DS');
    insert into team_manager_assignments values('${id(101)}','${id(501)}','general_manager','active');
    insert into team_seasons values('${id(4001)}','${id(101)}','${id(5)}','active','Prepared Team',0,1000000);`);
  await db.query(`insert into season_draft_participants(edition_id,team_id,sporting_director_id,position,team_name,director_name,previous_points,registered_at,preferences,auto_enabled)
    values($1,$2,$3,1,'Prepared Team','Prepared DS',0,now()-interval '100 days',$4,true)`,[edition5,id(101),id(501),frozen5.slice(0,8).map(r=>r.rider_id)]);
  const state=async()=>({
    editions:await rows('select * from season_draft_editions order by game_year'),
    pool:await rows('select * from season_draft_riders order by edition_id,pool_rank'),
    participants:await rows('select * from season_draft_participants order by edition_id,position'),
    settings:await rows('select * from season_draft_settings'),
    contracts:await rows('select * from rider_contracts order by id'),
    crons:await rows('select * from cron.jobs order by name'),
    salaryCalls:await rows('select * from salary_quote_calls'),
    messages:await rows('select * from sporting_director_messages order by source_reference'),
    triggers:await rows('select tgname,tgenabled,pg_get_triggerdef(oid) definition from pg_trigger where not tgisinternal order by tgname')
  });
  const before=await state();
  const coreBefore=await rows('select signature,pg_get_functiondef(signature::regprocedure) definition from unnest($1::text[]) signature order by signature',[coreFunctions]);
  const sample=rating(50,{mountain:75,hills:65,flat:46,time_trial:48,cobbles:64,sprint:45,acceleration:70,downhill:54,endurance:59,resistance:57,recovery:54,breakaway:54,prologue:51});
  const scenarios=[{r:sample,p:2,a:30},{r:sample,p:8,a:18},{r:rating(60),p:1,a:40},{r:rating(70,{flat:99}),p:8,a:22}];
  const legacyBefore=await Promise.all(scenarios.map(x=>legacy(x.r,x.p,x.a)));
  await db.exec(await readFile('supabase/migrations/20261106153017_prioritize_performance_in_future_drafts.sql','utf8'));

  check(await state(),before,'install changes no edition, pool, preferences, settings, salaries, contracts, messages, cron or trigger');
  check(await rows('select signature,pg_get_functiondef(signature::regprocedure) definition from unnest($1::text[]) signature order by signature',[coreFunctions]),coreBefore,'historical scorer, workers, view, save and reservation guards remain byte-for-byte unchanged');
  for(let i=0;i<scenarios.length;i++) {
    const x=scenarios[i];
    check(await score(x.r,x.p,x.a,5),legacyBefore[i],'S5 helper preserves historical scoring case '+i);
    check(await score(x.r,x.p,x.a,4),legacyBefore[i],'pre-S5 helper also preserves historical scoring case '+i);
  }
  check(await value("select has_function_privilege('authenticated','public.calculate_season_draft_score_for_edition(jsonb,integer,integer,integer)','execute') value"),false,'new helper not callable by authenticated clients');
  check(await value("select has_function_privilege('anon','public.calculate_season_draft_score_for_edition(jsonb,integer,integer,integer)','execute') value"),false,'new helper not callable anonymously');
  check(await value("select has_function_privilege('service_role','public.calculate_season_draft_score_for_edition(jsonb,integer,integer,integer)','execute') value"),true,'service role retains the helper');
  check(await value("select has_function_privilege('authenticated','public.reserve_season_draft_pool(uuid,integer)','execute') value"),false,'reservation remains private');
  check(await value("select provolatile='i' and not prosecdef value from pg_proc where oid='public.calculate_season_draft_score_for_edition(jsonb,integer,integer,integer)'::regprocedure"),true,'pure immutable score has no elevated execution rights');

  // S5 can still append without using future scoring or changing prior choices.
  const expectedAppend=await rows(`select r.id rider_id,calculate_season_draft_score(to_jsonb(rt),r.potential_steps,rt.age) score
    from riders r join rider_season_ratings rt on rt.rider_id=r.id and rt.season_id=$1
    where not exists(select 1 from season_draft_riders p where p.edition_id=$2 and p.rider_id=r.id)
    order by score desc,r.potential_steps desc,rt.age,r.id limit 2`,[id(5),edition5]);
  await db.query('select reserve_season_draft_pool($1,102)',[edition5]);
  const extended5=await pool(edition5);
  check(extended5.slice(0,100),frozen5,'S5 extension preserves every frozen snapshot, rank, score and selection');
  check(extended5.slice(100).map(r=>({rider_id:r.rider_id,score:r.score})),expectedAppend,'S5 appended riders use the exact legacy score and ordering');
  check(await rows('select * from season_draft_participants order by edition_id,position'),before.participants,'S5 prepared preferences are unchanged after append');

  // Age and potential do not enter the performance score from S6 onwards.
  for(const year of [6,7,20]) {
    check(await score(sample,1,18,year),await score(sample,8,45,year),'future score independent of age and potential in S'+year);
    check(await score({...sample,flat:1},2,30,year),await score({...sample,flat:99},2,30,year),'PLA excluded even from the supporting average in S'+year);
  }
  check(await score(rating(50,{mountain:75}),1,38,6)>await score(rating(60,{mountain:70}),8,19,6),true,'older 75 specialist with one half-star outranks younger 70 specialist with four stars');
  check(await score(rating(40,{breakaway:99}),8,18,6),40.492,'BAR improves only the supporting average');
  for(const key of primary) check(await score(rating(40,{[key]:99}),1,40,6),93.592,key+' is a full primary equally weighted with the other four');
  check(await score(rating(40,{flat:99}),8,18,6),40,'PLA alone never promotes a false primary specialist');

  // Actual future reservation, including equal-performance age/potential ties.
  await db.exec(`update season_draft_editions set status='completed',closed_at=now() where id='${edition5}';
    update seasons set status='completed' where id='${id(5)}';
    insert into seasons values('${id(6)}',6,'S6','active',(clock_timestamp() at time zone 'Europe/Paris')::date,1);`);
  const futureRider=async(n,age,potential,r)=>{
    await db.query('insert into riders values($1,$2,$3,$4,\'free_agent\',$5,\'classic\',$6)',[id(n),id(99),'S6','Rider '+n,potential,n]);
    await db.query(`insert into rider_season_ratings values($1,$2,$3,${stats.map((_,i)=>'$'+(i+4)).join(',')})`,[id(n),id(6),age,...stats.map(k=>r[k])]);
  };
  for(let n=1;n<=99;n++) await futureRider(10000+n,28,4,rating(40));
  await futureRider(11001,38,1,rating(50,{mountain:75}));
  await futureRider(11002,19,8,rating(60,{mountain:70}));
  await futureRider(11101,42,4,rating(66));
  await futureRider(11102,18,4,rating(66));
  await futureRider(11103,42,8,rating(66));
  await db.exec(`insert into season_rollover_settlements values('${id(6)}');`);
  const edition6=await value('select id value from season_draft_editions where game_year=6');
  const frozen6=await pool(edition6);
  check(frozen6.length,100,'S6 rollover hook reserves a real 100-rider pool');
  check(frozen6[0].rider_id,id(11001),'S6 actually ranks the old 75 specialist first');
  check(frozen6[1].rider_id,id(11002),'younger 70 specialist follows despite four-star potential');
  check(frozen6.filter(r=>[id(11101),id(11102),id(11103)].includes(r.rider_id)).map(r=>r.rider_id),[id(11103),id(11101),id(11102)],'potential breaks equal performance, then stable ID beats the former age tie-breaker');
  check(await value(`select bool_and(p.score=calculate_season_draft_score_for_edition(to_jsonb(rt),r.potential_steps,rt.age,6)) value
    from season_draft_riders p join riders r on r.id=p.rider_id join rider_season_ratings rt on rt.rider_id=r.id and rt.season_id=$2 where p.edition_id=$1`,[edition6,id(6)]),true,'all S6 frozen scores use the new scorer');
  check(await value('select initialized_at is null and status=\'scheduled\' and pool_reserved_at is not null value from season_draft_editions where id=$1',[edition6]),true,'reservation still waits for opening before initializing participants');
  check(await value('select total value from salary_quote_calls'),0,'no premature salary quote or pick is triggered');
  await assert.rejects(()=>db.query(`insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type)
    values($1,$2,$3,$3,'active','free_agent')`,[id(11001),id(101),id(6)]),/réservé à la draft/);checks++;
  await assert.rejects(()=>db.query("insert into transfer_market_listings(rider_id,status) values($1,'open')",[id(11001)]),/réservé à la draft/);checks++;
  await db.query('update rider_season_ratings set mountain=99,flat=99 where rider_id=$1 and season_id=$2',[id(11002),id(6)]);
  await db.query('select reserve_season_draft_pool($1,100)',[edition6]);
  check(await pool(edition6),frozen6,'S6 frozen pool remains unchanged after training and repeated reservation');
  check(await pool(edition5),extended5,'future reservations never rewrite the S5 historical pool');
  check(await rows('select * from season_draft_participants where edition_id=$1 order by position',[edition5]),before.participants,'future reservation never rewrites the saved S5 preferences');
  const functionHashes=(await rows(`select
    md5(replace(pg_get_functiondef('public.calculate_season_draft_score_for_edition(jsonb,integer,integer,integer)'::regprocedure),chr(13),'')) helper,
    md5(replace(pg_get_functiondef('public.reserve_season_draft_pool(uuid,integer)'::regprocedure),chr(13),'')) reservation`))[0];
  console.log(JSON.stringify({checks,functionHashes,isolated:true,productionTouched:false}));
} catch(error) {
  console.error(JSON.stringify({checks,message:error.message,where:error.where,detail:error.detail,stack:error.name==='AssertionError'?error.stack:undefined},null,2));
  process.exitCode=1;
} finally {await db.close();}
