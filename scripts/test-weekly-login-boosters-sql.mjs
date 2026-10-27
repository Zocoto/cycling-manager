// PostgreSQL isolated in WASM. No live credentials, connections, or game data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.LOCAL_CALENDAR_SQL_TEST_MODULE || 'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js').href);
const db=new PGlite();
const read=name=>readFileSync(`supabase/migrations/${name}.sql`,'utf8').replaceAll('\r\n','\n');
const fn=(source,name)=>{const start=source.indexOf(`create or replace function ${name}(`);assert.ok(start>=0,name);return source.slice(start,source.indexOf('$$;',start)+3);};
const table=(source,name)=>{const start=source.indexOf(`create table public.${name} (`);assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n);',start)+4);};
const source=read('20261027170000_weekly_login_cyclo_stickers_boosters');
const presenceHook=read('20261027171000_weekly_login_boosters_game_presence');
const unifiedInventory=read('20261027181000_expose_unified_cyclo_sticker_booster_inventory');
const attendanceSource=read('20260814030000_expose_player_daily_activity');
const overviewSource=read('20260829100000_preserve_daily_reward_cycle_after_absence');
const cycleSource=read('20260809141000_extend_daily_reward_cycle');
const dailySource=read('20260801110000_create_daily_rewards');
await db.exec(`
  create schema auth;create schema private;create role anon;create role authenticated;create role service_role bypassrls;
  create table auth.users(id uuid primary key default gen_random_uuid(),email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.auth_user_id',true),'')::uuid$$;
  grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
  create table sporting_directors(id uuid primary key default gen_random_uuid(),auth_user_id uuid references auth.users,status text);
  grant select on sporting_directors to authenticated;
  create table alpha_bot_managers(sporting_director_id uuid primary key references sporting_directors);
  create table seasons(id uuid primary key default gen_random_uuid(),name text,game_year integer unique,status text,current_day_number integer);
  alter table seasons add column starts_on date;alter table seasons add column ends_on date;
  create table sporting_director_referrals(id uuid primary key default gen_random_uuid(),referrer_director_id uuid references sporting_directors,referred_director_id uuid references sporting_directors,status text,qualified_at timestamptz);
  grant select on seasons to authenticated;
  create table season_days(id uuid primary key default gen_random_uuid(),season_id uuid references seasons,day_number integer,calendar_date date,unique(season_id,day_number));
  create table team_manager_assignments(sporting_director_id uuid references sporting_directors,team_id uuid,role text,status text);
  create table team_seasons(id uuid primary key default gen_random_uuid(),team_id uuid,season_id uuid references seasons,status text);
  create table countries(id uuid primary key,name text);
  create table riders(id uuid primary key,first_name text,last_name text,country_id uuid,status text);
  create table rider_contracts(rider_id uuid,team_id uuid,start_season_id uuid,end_season_id uuid,status text);
  create table race_categories(id uuid primary key,code text);
  create table races(id uuid primary key,is_grand_tour boolean);
  create table race_editions(id uuid primary key,race_category_id uuid,race_id uuid,season_id uuid,status text,display_name text);
  create table stages(id uuid primary key,race_edition_id uuid,season_day_id uuid);
  create table special_ability_catalog(code text,name text,effect_description text,is_active boolean);
  create function sync_active_season_day() returns void language sql as $$select$$;
  insert into seasons(name,game_year,status,current_day_number) values('Saison 4',4,'active',28),('Saison 5',5,'planned',1),('Saison 6',6,'planned',1);
  insert into season_days(season_id,day_number,calendar_date)select id,n,(now() at time zone 'Europe/Paris')::date+n-1 from seasons cross join generate_series(1,28)n;
`);
await db.exec(table(read('20260809102000_create_assidu_attendance_trophy'),'sporting_director_daily_attendance'));
await db.exec(table(attendanceSource,'player_daily_activity'));
await db.exec('alter table player_daily_activity add column last_seen_at timestamptz;');
await db.exec(table(dailySource,'daily_reward_catalog'));
await db.exec(table(dailySource,'daily_reward_claims'));
await db.exec(table(dailySource,'daily_reward_inventory'));
await db.exec(table(cycleSource,'daily_reward_streak_states'));
await db.exec(fn(cycleSource,'public.get_daily_reward_importance'));
await db.exec(fn(cycleSource,'public.get_next_daily_reward_cycle_day'));
await db.exec(fn(overviewSource,'public.get_current_daily_reward_overview'));
await db.exec(fn(overviewSource,'public.claim_current_daily_reward'));
await db.exec(fn(attendanceSource,'public.record_current_sporting_director_attendance'));
await db.exec(fn(read('20260814180000_track_recent_game_presence'),'public.record_current_game_presence'));
await db.exec(`grant execute on function public.record_current_sporting_director_attendance(),public.get_current_daily_reward_overview() to authenticated;
  insert into daily_reward_catalog(reward_key,name,description,effect_summary,importance,effect_kind) values('gift','Cadeau quotidien','Description','Effet',1,'form_boost');`);
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const s4=await scalar('select id from seasons where game_year=4'),s5=await scalar('select id from seasons where game_year=5'),s6=await scalar('select id from seasons where game_year=6');
const player=async(status='active',bot=false)=>{
  const user=await scalar('insert into auth.users default values returning id');
  const director=await scalar('insert into sporting_directors(auth_user_id,status) values($1,$2) returning id',[user,status]);
  if(bot)await db.query('insert into alpha_bot_managers values($1)',[director]);
  const team=await scalar('select gen_random_uuid()');
  await db.query("insert into team_manager_assignments values($1,$2,'general_manager','active')",[director,team]);
  await db.query("insert into team_seasons(team_id,season_id,status) select $1,id,'active' from seasons",[team]);
  return {user,director};
};
const original=await player();
await db.query("select set_config('test.auth_user_id',$1,false)",[original.user]);
const before=(await db.query('select public.get_current_daily_reward_overview() value')).rows[0].value;
const claimHash=await scalar("select md5(pg_get_functiondef('public.claim_current_daily_reward(text)'::regprocedure))");
await db.exec(source);
await db.exec(presenceHook);
await db.exec(read('20261027180000_add_s5_referral_sticker_boosters'));
await db.exec(unifiedInventory);
const after=(await db.query('select public.get_current_daily_reward_overview() value')).rows[0].value;
assert.deepEqual(after,{...before,weeklyLogin:null},'S4 gifts and cycle are unchanged');
assert.equal(await scalar("select md5(pg_get_functiondef('public.claim_current_daily_reward(text)'::regprocedure))"),claimHash,'Claim logic unchanged');
await db.query('select public.record_current_sporting_director_attendance()');
await db.query('select public.record_current_sporting_director_attendance()');
assert.equal(await scalar('select count(*)::int from player_daily_activity'),1);
assert.equal(await scalar('select count(*)::int from sporting_director_daily_attendance'),1);
assert.equal(await scalar('select count(*)::int from weekly_login_booster_states'),0);
const date=n=>{const d=new Date('2026-11-06T12:00:00Z');d.setUTCDate(d.getUTCDate()+n-1);return d.toISOString().slice(0,10);};
const connect=(p,day,season=s5)=>db.query('select private.record_weekly_login_booster_connection($1,$2,$3)',[p.director,season,date(day)]);
const state=p=>db.query('select * from weekly_login_booster_states where sporting_director_id=$1',[p.director]).then(r=>r.rows[0]);
const packs=p=>db.query('select * from cyclo_stickers_boosters where sporting_director_id=$1 order by awarded_on',[p.director]).then(r=>r.rows);
for(let n=1;n<=14;n++)await connect(original,n,s4);
for(let n=1;n<=14;n++)await connect(original,n,s5);
assert.equal(await scalar('select count(*)::int from weekly_login_booster_states'),0,'No S4 backfill');
await db.exec("update seasons set status=case when game_year=5 then 'active' else 'completed' end where game_year<=5");
// Same real date as S4 attendance: the new S5 attendance still starts at one.
await db.query('select public.record_current_sporting_director_attendance()');
assert.equal((await state(original)).consecutive_days,1);
assert.equal(await scalar('select count(*)::int from cyclo_stickers_boosters'),0);
const a=await player(),b=await player(),bot=await player('active',true),inactive=await player('inactive');
for(let n=1;n<=6;n++){await connect(a,n);await connect(a,n);assert.equal((await packs(a)).length,0);}
assert.equal((await state(a)).consecutive_days,6);
await Promise.all(Array.from({length:12},()=>connect(a,7)));
assert.equal((await packs(a)).length,1,'Repeated seventh-day visits award once');
assert.equal((await state(a)).boosters_awarded,1);
for(let n=8;n<=28;n++){await connect(a,n);assert.equal((await packs(a)).length,Math.floor(n/7));}
assert.equal((await state(a)).consecutive_days,28);
assert.equal((await packs(a)).filter(p=>p.collection_season_id===s5&&p.opened_at===null).length,4);
await connect(a,10);assert.equal((await state(a)).consecutive_days,28,'An older request cannot reset the streak');
for(let n=1;n<=14;n++){await connect(bot,n);await connect(inactive,n);}
assert.equal(await state(bot),undefined);assert.equal(await state(inactive),undefined);
// The next season keeps the connection streak and assigns its own edition.
await db.exec("update seasons set status=case when game_year=6 then 'active' else 'completed' end");
for(let n=29;n<=35;n++)await connect(a,n,s6);
assert.equal((await state(a)).consecutive_days,35);
assert.equal((await packs(a)).length,5);assert.equal((await packs(a))[4].collection_season_id,s6);
assert.equal((await packs(a)).filter(p=>p.collection_season_id===s5).length,4,'Older packs remain owned');
// Missing day 36 restarts at one; a fresh complete week gives one new pack.
for(let n=37;n<=43;n++){await connect(a,n,s6);assert.equal((await state(a)).consecutive_days,n-36);}
assert.equal((await packs(a)).length,6);assert.equal((await state(a)).boosters_awarded,6);
assert.equal(new Set((await packs(a)).map(p=>p.source_reference)).size,6);
await connect(b,1,s6);await connect(b,30,s6);assert.equal((await state(b)).consecutive_days,1);
assert.equal((await packs(b)).length,0,'Missing a month gives no catch-up');
// Overview records today's authenticated connection synchronously (before
// background attendance), without claiming any regular daily gift.
const overviewPlayer=await player();
await db.query("select set_config('test.auth_user_id',$1,false)",[overviewPlayer.user]);
const today=await scalar("select (now() at time zone 'Europe/Paris')::date::text");
await db.query(`insert into weekly_login_booster_states(sporting_director_id,last_connection_on,streak_started_on,consecutive_days)
  values($1,$2::date-1,$2::date-6,6)`,[overviewPlayer.director,today]);
const overview=(await db.query('select public.get_current_daily_reward_overview() value')).rows[0].value;
assert.deepEqual(overview.weeklyLogin,{consecutiveDays:7,totalBoostersAwarded:1,boosterAwardedToday:true});
assert.equal(overview.availableToday,true);assert.equal(overview.prospectiveStreakDay,1);
assert.equal(await scalar('select count(*)::int from daily_reward_claims'),0);
await db.query('select public.record_current_sporting_director_attendance()');
await db.query('select public.get_current_daily_reward_overview()');
assert.equal((await packs(overviewPlayer)).length,1,'Overview/background overlap is idempotent');
// A tab kept open uses the existing heartbeat. No full page/layout reload is
// required, and subsequent heartbeat UPDATEs do not trigger new awards.
const tabPlayer=await player();
await db.query("select set_config('test.auth_user_id',$1,false)",[tabPlayer.user]);
await db.query(`insert into weekly_login_booster_states(sporting_director_id,last_connection_on,streak_started_on,consecutive_days)
  values($1,$2::date-1,$2::date-6,6)`,[tabPlayer.director,today]);
await db.query('select public.record_current_game_presence()');
assert.equal((await state(tabPlayer)).consecutive_days,7);
assert.equal((await packs(tabPlayer)).length,1);
for(let n=0;n<20;n++)await db.query('select public.record_current_game_presence()');
assert.equal((await state(tabPlayer)).consecutive_days,7);
assert.equal((await packs(tabPlayer)).length,1);
const importedPlayer=await player();
await db.query('insert into player_daily_activity(auth_user_id,activity_on) values($1,$2::date-1)',[importedPlayer.user,today]);
assert.equal(await state(importedPlayer),undefined,'Importing yesterday activity does not backfill rewards');
// Read the two independent, persistent grant sources together, with stable IDs
// and no copying of packs or leakage of another player's inventory.
const referralId=await scalar("insert into sporting_director_referrals(referrer_director_id,referred_director_id,status) values($1,$2,'registered') returning id",[tabPlayer.director,a.director]);
await db.query(`insert into cyclo_sticker_boosters(sporting_director_id,source_referral_id,copy_number,collection_season_id,source_season_id)
  select $1,$2,n,$3,$4 from generate_series(1,2)n`,[tabPlayer.director,referralId,s5,s4]);
const tabPack=(await packs(tabPlayer))[0];
assert.equal(await scalar("select source_season_id from cyclo_stickers_booster_inventory where inventory_source='login' and id=$1",[tabPack.id]),s5,'Login S6 pack contains S5 cards');
// RLS ownership and grants: players can inspect their packs, never mint/open
// them directly or set the clock by calling private helpers.
await db.exec('set role authenticated');
assert.equal(await scalar('select count(*)::int from cyclo_stickers_boosters'),1);
assert.equal(await scalar('select count(*)::int from weekly_login_booster_states'),1);
assert.equal(await scalar('select count(*)::int from cyclo_stickers_booster_inventory'),3);
assert.deepEqual((await db.query('select inventory_source,count(*)::int n from cyclo_stickers_booster_inventory group by inventory_source order by inventory_source')).rows,[{inventory_source:'login',n:1},{inventory_source:'referral',n:2}]);
await assert.rejects(()=>db.query('update cyclo_stickers_booster_inventory set opened_at=now()'),/permission denied|cannot update view/);
await assert.rejects(()=>db.query("update cyclo_stickers_boosters set opened_at=now()"),/permission denied/);
await assert.rejects(()=>db.query('insert into cyclo_stickers_boosters(sporting_director_id,collection_season_id,acquisition_source,source_reference,awarded_on) values($1,$2,\'weekly_login\',\'forged\',current_date)',[overviewPlayer.director,s6]),/permission denied/);
await assert.rejects(()=>connect(overviewPlayer,7,s6),/permission denied/);
await db.exec('reset role');
// Reapplying the migration retains all inventory and progress; no backfill.
const beforeRetry=JSON.stringify((await db.query('select * from cyclo_stickers_boosters order by id')).rows);
const beforeFunctions=await scalar("select md5(pg_get_functiondef('public.record_current_sporting_director_attendance()'::regprocedure)||pg_get_functiondef('public.get_current_daily_reward_overview()'::regprocedure))");
await db.exec(source);
await db.exec(presenceHook);
await db.exec(unifiedInventory);
assert.equal(JSON.stringify((await db.query('select * from cyclo_stickers_boosters order by id')).rows),beforeRetry);
assert.equal(await scalar("select md5(pg_get_functiondef('public.record_current_sporting_director_attendance()'::regprocedure)||pg_get_functiondef('public.get_current_daily_reward_overview()'::regprocedure))"),beforeFunctions);
console.log('Isolated SQL passed: S4 untouched, no backfill, Paris dates, real attendance/overview integration, 7/14/21/28/35-day grants, absence/reset, inter-season continuity, edition ownership, repeat/overlapping visits, bots/inactive exclusions, unchanged gifts, RLS/write isolation, migration idempotence.');
await db.close();
