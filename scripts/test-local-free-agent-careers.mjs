// Isolated PostgreSQL only. No credentials, remote client or production fixture.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]?.endsWith('/dist/index.js')) throw new Error('Pass the existing local PGlite module path.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const stats = ['mountain','hills','flat','time_trial','cobbles','sprint','acceleration','downhill','endurance','resistance','recovery','breakaway','prologue'];
const read = async name => (await readFile(`supabase/migrations/${name}.sql`, 'utf8')).replaceAll('\r', '');
const definition = (source, name) => {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert(start >= 0, name);
  return source.slice(start, source.indexOf('$$;', start) + 3);
};
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const scalar = async (sql, args = []) => (await q(sql, args))[0]?.value;
let checks = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table seasons(id uuid primary key,name text,game_year int,status text,starts_on date,current_day_number int);
    create table countries(id uuid primary key,name text,iso_alpha2 text);
    create table riders(id uuid primary key,country_id uuid,first_name text,last_name text,status text,
      potential_steps int,decline_resistance_multiplier numeric default 1,avatar_profile_key text default 'classic',
      avatar_seed bigint default 1,career_race_days int default 0,created_at timestamptz default now());
    create table rider_contracts(id uuid primary key,rider_id uuid,team_id uuid,status text,
      start_season_id uuid,end_season_id uuid,left_season_id uuid,left_day_number int,signed_at timestamptz,created_at timestamptz default now());
    create table season_days(id uuid primary key,season_id uuid,day_number int,calendar_date date);
    create table rider_season_ratings(id uuid primary key default gen_random_uuid(),rider_id uuid,season_id uuid,age int,
      ${stats.map(s => `${s} int not null check(${s} between 0 and 100)`).join(',')},updated_at timestamptz default now(),unique(rider_id,season_id));
    create table rider_training_sessions(id uuid primary key default gen_random_uuid(),rider_id uuid,season_id uuid,season_day_id uuid);
    create table rider_training_stat_progress(rider_id uuid,season_id uuid,stat_code text,initial_rating int,balance_milli int default 0,
      total_training_milli int default 0,rating_gain int default 0,rating_loss int default 0,updated_at timestamptz default now(),
      primary key(rider_id,season_id,stat_code));
    create table rider_injuries(rider_id uuid,status text,started_at timestamptz,expected_recovery_at timestamptz);
    create table rider_condition_states(rider_id uuid,season_day_id uuid,form numeric,updated_at timestamptz default now());
    create table rider_special_abilities(rider_id uuid,ability_code text);
    create table halloween_rider_effects(rider_id uuid,item_id text,used_at timestamptz,protection_expires_at timestamptz);
    create table rider_season_summaries(rider_id uuid,season_id uuid,victories int,points int,uci_rank int);
    create table reward_events(rider_id uuid,team_season_id uuid,source_type text,uci_points int,source_reference text,description text,created_at timestamptz);
    create table teams(id uuid primary key,amateur_name text,internal_name text);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,display_name text);
    create table rider_national_championship_titles(rider_id uuid,season_id uuid,country_id uuid,championship_type text,relinquished_at timestamptz);
    create table transfer_market_listings(rider_id uuid,status text,settled_at timestamptz);
    create table race_rosters(rider_id uuid,race_registration_id uuid,status text);
    create table race_registrations(id uuid primary key,race_edition_id uuid,status text);
    create table race_editions(id uuid primary key,season_id uuid,status text);
    create function sync_active_season_day() returns void language sql as $$ select $$;
    create function settle_due_training_sessions_throttled() returns table(processed_sessions int,completed_sessions int,current_day_number int)
      language sql as $$ select 0,0,1 $$;
    create function run_game_maintenance_task(p_task_key text) returns jsonb language plpgsql as $$ declare v_result jsonb;
      begin case p_task_key when 'training' then
        select to_jsonb(settlement) into v_result from public.settle_due_training_sessions_throttled() as settlement;
        else v_result := '{}'::jsonb; end case; return v_result; end $$;
    insert into countries values('${id(99)}','France','FR');
    insert into seasons values('${id(1)}','S1',1,'completed',current_date-100,28),
      ('${id(2)}','S2',2,'completed',current_date-72,28),('${id(3)}','S3',3,'completed',current_date-44,28),
      ('${id(4)}','S4',4,'active',current_date-27,28),('${id(5)}','S5',5,'planned',current_date+1,1);
  `);
  const baseTraining = await read('20260726113000_add_exponential_rider_decline');
  await db.exec(definition(baseTraining, 'get_rider_season_decline_points'));
  await db.exec(definition(baseTraining, 'settle_due_training_sessions'));
  await db.exec(definition(await read('20260721210000_create_training_management'), 'get_rider_potential_overall_cap'));
  await db.exec(definition(await read('20260727090000_add_first_in_class_special_ability'), 'get_rider_training_progress_multiplier'));
  await db.exec(definition(await read('20260918150000_add_intermediate_professional_training_rating_tiers'), 'get_pro_training_rating_progress_factor'));
  await db.exec(await read('20260727223000_archive_inactive_rider_careers'));
  await db.exec('commit');
  await db.exec(await read('20260814090000_repair_expired_rider_free_agents'));
  await db.exec(await read('20260829210000_preserve_scoring_free_agents'));
  const beforeClub = await scalar("select pg_get_functiondef('settle_due_training_sessions()'::regprocedure) as value");
  await db.exec(await read('20261009150000_extend_free_agent_careers_and_training'));
  const afterClub = await scalar("select pg_get_functiondef('settle_due_training_sessions()'::regprocedure) as value");
  check(afterClub.replace("\n        and not exists (select 1 from public.free_agent_training_sessions autonomous_session where autonomous_session.rider_id = rider.id and autonomous_session.season_day_id = v_day.id)", ''), beforeClub, 'club training formula and bonuses are preserved verbatim');
  const createRider = async (n, {status='free_agent',age=20,potential=8,rating=60,createdDaysAgo=120} = {}) => {
    await db.query(`insert into riders(id,country_id,first_name,last_name,status,potential_steps,created_at)
      values($1,$2,'Coureur',$3,$4,$5,now()-$6*interval '1 day')`, [id(n),id(99),String(n),status,potential,createdDaysAgo]);
    await db.query(`insert into rider_season_ratings(rider_id,season_id,age,${stats.join(',')})
      values($1,$2,$3,${stats.map(() => '$4').join(',')})`,[id(n),id(4),age,rating]);
  };
  const contract = async (rider, start, end, left=null, leftDay=null, status='terminated') => {
    await db.query(`insert into rider_contracts(id,rider_id,team_id,start_season_id,end_season_id,left_season_id,left_day_number,status,signed_at,created_at)
      values(gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,now()-interval '100 days',now()-interval '100 days')`,
      [id(rider),id(900),id(start),id(end),left ? id(left) : null,leftDay,status]);
  };
  // Retirement eligibility and actual archival, not just string assertions.
  for(let n=100;n<=106;n++) await createRider(n);
  await contract(100,2,2,2,28); // only S3 was completely unattached
  await contract(101,1,5,1,14); // left in S1 despite an original S5 end
  await contract(102,2,3,2,15); // partial S2, then full S3: only one full season
  await contract(104,4,5,null,null,'planned'); // preserve a secured future contract
  await db.query('update riders set created_at=(select starts_on::timestamp from seasons where id=$1)+interval \'1 day\' where id=$2',[id(2),id(105)]);
  await db.query("insert into reward_events(rider_id,source_type,uci_points) values($1,'race_result',1)",[id(106)]);
  check(await scalar('select has_rider_two_full_unattached_seasons($1,$2) as value',[id(100),id(3)]),false,'one full season does not retire');
  check(await scalar('select has_rider_two_full_unattached_seasons($1,$2) as value',[id(101),id(3)]),true,'actual departure overrides a long original contract');
  check(await scalar('select has_rider_two_full_unattached_seasons($1,$2) as value',[id(102),id(3)]),false,'a partial contracted season never counts');
  check(await scalar('select has_rider_two_full_unattached_seasons($1,$2) as value',[id(104),id(3)]),false,'planned successor is protected');
  check(await scalar('select has_rider_two_full_unattached_seasons($1,$2) as value',[id(105),id(3)]),false,'rider created mid-season needs two later full seasons');
  check(await scalar('select archive_inactive_riders_for_season($1) as value',[id(3)]),2);
  check((await q('select rider_id,retirement_reason from rider_history_archives order by rider_id')).map(r=>[r.rider_id,r.retirement_reason]),
    [[id(101),'two_seasons_without_team'],[id(103),'two_seasons_without_team']]);
  check(await scalar('select archive_inactive_riders_for_season($1) as value',[id(3)]),0,'retirement is idempotent');
  check(await scalar('select status as value from riders where id=$1',[id(106)]),'free_agent','scoring free agent remains available');
  await db.exec("update riders set status='retired' where id not in (select rider_id from rider_history_archives)");
  await db.exec(`insert into season_days select gen_random_uuid(),'${id(4)}',day,current_date-28+day from generate_series(1,28) day`);
  // Initially there are no gains, including on an already-passed cutoff.
  check(await scalar('select settle_due_free_agent_training() as value'),{processed_sessions:0,completed_sessions:0,more_due:false});
  check(await scalar('select count(*)::int as value from free_agent_training_sessions'),0,'no retroactive training at installation');
  for (let n=200;n<=208;n++) await createRider(n,{status:n===208?'active':'free_agent',potential:n===201||n===204?1:8,age:n===202||n===203?40:20,rating:n===204?65:60});
  await createRider(209,{rating:72});
  await db.query(`insert into rider_training_stat_progress(rider_id,season_id,stat_code,initial_rating,rating_gain)
    values($1,$2,'mountain',60,12)`,[id(209),id(4)]);
  await createRider(210,{rating:100});
  await createRider(211);
  await db.query("update rider_season_ratings set mountain=70 where rider_id=$1",[id(211)]);
  await createRider(212);
  await db.query("insert into rider_special_abilities values($1,'first_in_class')",[id(212)]);
  await db.exec(`
    update free_agent_training_state set activated_at=((current_date-27)::timestamp at time zone 'Europe/Paris'),last_completed_cutoff=null;
    insert into rider_injuries values('${id(205)}','active',now()-interval '29 days',now()+interval '1 day');
    insert into rider_condition_states select '${id(206)}',id,10,now() from season_days where day_number=1;
    insert into halloween_rider_effects values('${id(203)}','immortality-pact',now()-interval '29 days',now()+interval '1 day');
    insert into rider_training_sessions(rider_id,season_id,season_day_id) select '${id(207)}','${id(4)}',id from season_days;
  `);
  const first = await scalar('select settle_due_free_agent_training(2) as value');
  check(first.processed_sessions,2,'batch is bounded'); check(first.more_due,true);
  for(let i=0;i<200;i++) { const receipt=await scalar('select settle_due_free_agent_training(5) as value'); if(!receipt.more_due) break; if(i===199) throw new Error('catch-up did not finish'); }
  const ratings = async n => (await q(`select ${stats.join(',')} from rider_season_ratings where rider_id=$1 and season_id=$2`,[id(n),id(4)]))[0];
  const high = await ratings(200), low = await ratings(201);
  check(high.mountain > low.mountain,true,'higher potential progresses faster');
  check(high.mountain >= 63 && high.mountain <= 64,true,'moderate progression stays below intensive club training');
  check((await ratings(204)).mountain,65,'overall potential cap is enforced');
  check((await ratings(205)).mountain,60,'injury prevents gains');
  check((await ratings(206)).mountain,60,'low form prevents gains');
  check((await ratings(202)).mountain < 60,true,'older unattached riders still decline');
  check((await ratings(203)).mountain,60,'existing longevity protection remains effective');
  check((await ratings(207)).mountain,60,'no autonomous session on a club-training day');
  check((await ratings(208)).mountain,60,'active rider is untouched');
  check((await ratings(209)).mountain,72,'existing club gains consume the same seasonal cap');
  check((await ratings(210)).mountain,100,'individual stats never exceed 100');
  const specialty = await scalar('select progress_milli as value from free_agent_training_sessions session join season_days day on day.id=session.season_day_id where session.rider_id=$1 and day.day_number=1',[id(211)]);
  check(specialty.mountain > specialty.flat,true,'autonomous work targets natural strengths');
  const ability = await scalar('select progress_milli as value from free_agent_training_sessions session join season_days day on day.id=session.season_day_id where session.rider_id=$1 and day.day_number=1',[id(212)]);
  const ordinary = await scalar('select progress_milli as value from free_agent_training_sessions session join season_days day on day.id=session.season_day_id where session.rider_id=$1 and day.day_number=1',[id(200)]);
  check(ability.mountain > ordinary.mountain,true,'native learning ability remains effective');
  check(await scalar('select form::int as value from rider_condition_states where rider_id=$1',[id(206)]),10,'autonomous work does not alter form');
  const beforeRetry = await scalar('select sum(total_training_milli)::int as value from rider_training_stat_progress');
  check(await scalar('select settle_due_free_agent_training() as value'),{processed_sessions:0,completed_sessions:0,more_due:false});
  check(await scalar('select sum(total_training_milli)::int as value from rider_training_stat_progress'),beforeRetry,'retry produces no extra gain');
  await assert.rejects(()=>scalar('select settle_due_free_agent_training(501) as value'),/entre 1 et 500/); checks++;
  // Availability resumes the day AFTER an effective departure, not earlier.
  await createRider(220);
  await contract(220,4,5,4,14);
  await db.exec('update free_agent_training_state set last_completed_cutoff=null');
  await scalar('select settle_due_free_agent_training() as value');
  check(await scalar('select min(day.day_number)::int as value from free_agent_training_sessions session join season_days day on day.id=session.season_day_id where session.rider_id=$1',[id(220)]),15,'no retroactive gains for previously contracted days');
  check(await scalar("select has_function_privilege('authenticated','public.settle_due_free_agent_training(integer)','execute') as value"),false,'players cannot trigger autonomous training');
  check(await scalar("select has_table_privilege('authenticated','public.free_agent_training_sessions','insert') as value"),false,'players cannot forge a session');
  check(await scalar("select position('free_agent_training' in pg_get_functiondef('run_game_maintenance_task(text)'::regprocedure))>0 as value"),true,'scheduled maintenance includes autonomous training');
  check(await scalar("select position('autonomous_session' in pg_get_functiondef('settle_due_training_sessions()'::regprocedure))>0 as value"),true,'club training contains the reciprocal guard');
  console.log(JSON.stringify({passed:checks,isolatedPostgres:true,productionFixtures:false}));
} finally { await db.close(); }
