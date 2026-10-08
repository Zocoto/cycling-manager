// Isolated PostgreSQL only. No credentials, network, or production fixtures.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]?.endsWith('/dist/index.js')) throw new Error('Pass a local PGlite module path.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let checks=0,nonce=1000;
const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
const scalar=async(sql,args=[]) => (await q(sql,args))[0]?.value;
const action=async(kind,payload={},user=id(1),request=id(nonce++)) => scalar('select public.halloween_action($1,$2,$3,$4::jsonb) as value',[user,request,kind,JSON.stringify(payload)]);
const check=(a,b)=>{assert.deepEqual(a,b);checks++;};
const fail=async(fn,match)=>{await assert.rejects(fn,match);checks++;};
const wallet=async(user=id(1)) => (await q('select * from halloween_wallets where user_id=$1',[user]))[0];
try {
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text,display_name text,avatar_key text,
      constraint sporting_directors_avatar_key_check check(avatar_key is null or avatar_key ~ '^director_[mf]_0[1-6]$'));
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,status text,role text);
    create table seasons(id uuid primary key,status text,game_year integer,current_day_number integer);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,scouting_reports_revealed_until timestamptz);
    create table season_days(id uuid primary key,season_id uuid,day_number integer,calendar_date date);
    create table riders(id uuid primary key,first_name text,last_name text,height_cm numeric,weight_kg numeric,baseline_weight_kg numeric,potential_steps integer,career_race_days integer default 0,status text default 'active');
    create table rider_contracts(rider_id uuid,team_id uuid,status text);
    create table rider_season_ratings(rider_id uuid,season_id uuid,age integer,updated_at timestamptz default now());
    create table rider_condition_states(rider_id uuid,season_day_id uuid,form numeric,fatigue integer,source text,updated_at timestamptz default now(),unique(rider_id,season_day_id));
    create table rider_injuries(id uuid primary key,rider_id uuid,status text,expected_recovery_at timestamptz,diagnosis_code text,recovered_at timestamptz,updated_at timestamptz default now());
    create table infrastructure_projects(id uuid primary key,team_id uuid,status text,infrastructure_code text,country_id uuid,target_level integer,starts_game_day_index integer,completes_game_day_index integer,final_duration_days integer,created_at timestamptz default now(),updated_at timestamptz default now(),check(final_duration_days>=1 and completes_game_day_index=starts_game_day_index+final_duration_days));
    create function settle_due_infrastructure_projects() returns integer language plpgsql as $$begin update infrastructure_projects set status='completed' where completes_game_day_index<=113;return 1;end$$;
    create table race_rosters(rider_id uuid,race_registration_id uuid);create table race_registrations(id uuid,race_edition_id uuid,status text);create table stages(race_edition_id uuid,status text,departure_at timestamptz,distance_km numeric);
    create table equipment_catalog_items(id uuid primary key default gen_random_uuid(),catalog_key text unique,name text,slot_type text,supplier_key text,supplier_name text,description text,price numeric,rarity text check(rarity in('common','performance','premium')),status text,image_path text,effect_summary text,effect_payload jsonb,acquisition_channel text check(acquisition_channel in('commercial','event_reward','research_prototype')));
    create table team_equipment_inventory(team_season_id uuid,equipment_item_id uuid,quantity integer,last_purchase_price numeric,updated_at timestamptz default now(),primary key(team_season_id,equipment_item_id));
    create table sporting_director_messages(sporting_director_id uuid,message_type text,sender_name text,subject text,preview text,body text,action_href text,action_label text,source_reference text,unique(sporting_director_id,source_reference));
    create function public.settle_due_training_sessions() returns integer language plpgsql as $$
    declare v_rider record;v_day record;v_season record;v_decline_milli integer:=5;v_balance integer;v_progress record;v_training_milli integer:=0;
    begin select * into v_rider from riders order by id limit 1;select * into v_day from season_days limit 1;select * into v_season from seasons limit 1;select 0 as balance_milli into v_progress;
        v_balance := v_progress.balance_milli + v_training_milli - v_decline_milli;
    return v_decline_milli;end$$;
  `);
  for(let n=1;n<=6;n++){
    await q('insert into auth.users values($1)',[id(n)]);
    await q("insert into sporting_directors values($1,$2,'active',$3,'director_m_01')",[id(100+n),id(n),'DS '+n]);
    await q("insert into team_manager_assignments values($1,$2,'active','general_manager')",[id(100+n),id(200+n)]);
    await q('insert into team_seasons values($1,$2,$3,null)',[id(300+n),id(200+n),id(400)]);
  }
  await q("insert into seasons values($1,'active',4,2)",[id(400)]);
  await q("insert into season_days values($1,$2,2,(now() at time zone 'Europe/Paris')::date)",[id(401),id(400)]);
  for(let n=1;n<=6;n++){
    await q("insert into riders(id,first_name,last_name,height_cm,weight_kg,baseline_weight_kg,potential_steps) values($1,'Test',$2,180,72,72,6)",[id(500+n),String(n)]);
    await q("insert into rider_contracts values($1,$2,'active')",[id(500+n),id(201)]);
    await q('insert into rider_season_ratings values($1,$2,35,now())',[id(500+n),id(400)]);
    await q("insert into rider_condition_states values($1,$2,80,9,'daily_reward',now())",[id(500+n),id(401)]);
  }
  for(const file of ['20261008210000_create_halloween_event.sql','20261008210100_halloween_items_and_state.sql','20261008210200_halloween_catalog.sql','20261008210300_halloween_settlement.sql','20261008210400_halloween_avatars_and_longevity.sql']) {
    try { await db.exec(await readFile('supabase/migrations/'+file,'utf8')); }
    catch(error) { error.message=file+': '+error.message; throw error; }
  }
  check(await scalar('select count(*)::integer as value from halloween_catalog'),24);
  await fail(()=>action('join'),/pas ouvert/);
  await db.exec("update halloween_editions set starts_at=now()-interval '1 hour',ends_at=now()+interval '1 day',shop_ends_at=now()+interval '8 days',enabled=true");
  await action('join');check((await wallet()).coins,24);
  await action('join');check((await wallet()).coins,24);
  await db.exec(`set role authenticated;select set_config('test.user','${id(1)}',false)`);
  await fail(()=>q("insert into halloween_wallets(edition_id,user_id) values('halloween-2026',$1)",[id(2)]),/permission denied/);
  await fail(()=>action('join'),/permission denied/);
  const state=await scalar('select get_current_halloween_state() as value');check(state.coins,24);check(state.riders.length,6);
  await db.exec('reset role');
  const buyId=id(nonce++);await action('buy',{item:'pocket-bat'},id(1),buyId);await action('buy',{item:'pocket-bat'},id(1),buyId);
  check((await wallet()).coins,18);check((await wallet()).inventory['pocket-bat'],1);
  await fail(()=>action('buy',{item:'pumpkin-cap'},id(1),buyId),/autrement/);
  await fail(()=>action('buy',{item:'pocket-bat'}),/Limite/);
  await action('equip',{item:'pocket-bat'});
  check(await scalar('select avatar_key as value from sporting_directors where auth_user_id=$1',[id(1)]),'director_m_01~halloween~bat');
  await q('update sporting_directors set avatar_key=$1 where auth_user_id=$2',['director_f_02~halloween~headless',id(1)]);
  check(await scalar('select avatar_key as value from sporting_directors where auth_user_id=$1',[id(1)]),'director_f_02~halloween~bat');
  await action('equip',{item:'none'});
  check(await scalar('select avatar_key as value from sporting_directors where auth_user_id=$1',[id(1)]),'director_f_02');
  const run=await action('start');check((await action('start')).id,run.id);
  await fail(()=>action('start',{},id(999)),/équipe active/);
  await action('finish',{runId:run.id,score:350,distance:100,coins:10,proof:{ticks:1,commands:[]}});check((await wallet()).coins,28);
  await action('finish',{runId:run.id,score:350,distance:100,coins:10,proof:{ticks:1,commands:[]}});check((await wallet()).coins,28);
  await fail(()=>action('start'),/ticket/);
  await q('update halloween_wallets set tickets=2 where user_id=$1',[id(1)]);
  const second=await action('start');check((await wallet()).tickets,1);
  await action('finish',{runId:second.id,score:225,distance:100,coins:5,proof:{}});
  await fail(()=>action('start'),/quotidien/);
  await action('draw');await fail(()=>action('draw'),/déjà choisi/);
  await fail(()=>action('buy',{item:'youth-fountain'}),/insuffisantes/);
  for(let n=2;n<=6;n++) await action('join',{},id(n));
  await q('update halloween_wallets set coins=10000 where user_id=$1',[id(1)]);
  await action('buy',{item:'vampire-kiss'});await action('curse',{item:'vampire-kiss',target:id(2)});
  const vampireRun=await action('start',{},id(2));
  await action('finish',{runId:vampireRun.id,score:650,distance:100,coins:22,proof:{}},id(2));check((await wallet(id(2))).coins,44);
  check(await scalar('select count(*)::integer as value from halloween_curses where user_id=$1',[id(2)]),0);
  await action('buy',{item:'mummy-curse'});await action('curse',{item:'mummy-curse',target:id(3)});
  await q("update halloween_curses set pending_gift='{"+'"coins":15'+"}' where user_id=$1",[id(3)]);
  await action('dispel',{},id(3));check((await wallet(id(3))).coins,39);
  await action('dispel',{},id(3));check((await wallet(id(3))).coins,39);
  for(const item of ['pumpkin-juice','midnight-chocolate','spectres-tea','giants-syrup','witches-star','youth-fountain','immortality-pact']){
    await action('buy',{item});await action('use',{item,target:id(501)});
  }
  check(Number(await scalar('select form as value from rider_condition_states where rider_id=$1',[id(501)])),85);
  check(await scalar('select fatigue as value from rider_condition_states where rider_id=$1',[id(501)]),9);
  check(await scalar('select potential_steps as value from riders where id=$1',[id(501)]),8);
  check(await scalar('select age as value from rider_season_ratings where rider_id=$1',[id(501)]),34);
  check(Number(await scalar('select weight_kg as value from riders where id=$1',[id(501)])),71);
  check(Number(await scalar('select baseline_weight_kg as value from riders where id=$1',[id(501)])),72);
  await action('buy',{item:'spectres-tea'});await fail(()=>action('use',{item:'spectres-tea',target:id(501)}),/carrière/);
  check((await wallet()).inventory['spectres-tea'],1);
  await fail(()=>action('use',{item:'spectres-tea',target:id(999)}),/équipe/);
  await action('buy',{item:'mummy-bandage'});
  await q("insert into rider_injuries values($1,$2,'active',now()+interval '3 days','fatigue_exhaustion',null,now())",[id(600),id(502)]);
  await fail(()=>action('use',{item:'mummy-bandage',target:id(502)}),/fatigue/);
  check((await wallet()).inventory['mummy-bandage'],1);
  await q("update rider_injuries set diagnosis_code='sprain' where id=$1",[id(600)]);
  await action('use',{item:'mummy-bandage',target:id(502)});check((await wallet()).inventory['mummy-bandage'],0);
  await action('buy',{item:'mummy-resurrection'});await action('use',{item:'mummy-resurrection',target:id(502)});
  check(await scalar('select status as value from rider_injuries where id=$1',[id(600)]),'recovered');
  await action('buy',{item:'scouts-candy'});await action('use',{item:'scouts-candy'});
  check(await scalar('select scouting_reports_revealed_until>now() as value from team_seasons where id=$1',[id(301)]),true);
  // Physical limits, retired riders and active races refuse without consuming.
  await action('buy',{item:'pumpkin-juice'});
  await q("update riders set status='retired' where id=$1",[id(503)]);
  await fail(()=>action('use',{item:'pumpkin-juice',target:id(503)}),/retraité/);
  await q("update riders set status='active' where id=$1",[id(503)]);
  await q("insert into race_registrations values($1,$2,'accepted')",[id(700),id(701)]);
  await q('insert into race_rosters values($1,$2)',[id(503),id(700)]);
  await q("insert into stages values($1,'in_progress',now()-interval '1 day',180)",[id(701)]);
  await fail(()=>action('use',{item:'pumpkin-juice',target:id(503)}),/course en cours/);
  await db.exec("update stages set status='completed',departure_at=now()-interval '1 minute'");
  await fail(()=>action('use',{item:'pumpkin-juice',target:id(503)}),/course en cours/);
  await db.exec("update stages set departure_at=now()-interval '1 day'");
  await action('use',{item:'pumpkin-juice',target:id(503)});
  await q('update riders set weight_kg=58.5 where id=$1',[id(504)]);
  await fail(()=>action('use',{item:'spectres-tea',target:id(504)}),/limites physiques/);
  check((await wallet()).inventory['spectres-tea'],1);
  await action('buy',{item:'giants-syrup'});await q('update riders set height_cm=209 where id=$1',[id(504)]);
  await fail(()=>action('use',{item:'giants-syrup',target:id(504)}),/limites physiques/);
  check((await wallet()).inventory['giants-syrup'],1);
  await action('buy',{item:'full-moon-elixir'});await action('use',{item:'full-moon-elixir',target:id(502)});
  check(Number(await scalar('select form as value from rider_condition_states where rider_id=$1',[id(502)])),100);
  check(await scalar('select fatigue as value from rider_condition_states where rider_id=$1',[id(502)]),9);
  await fail(()=>action('buy',{item:'headless-skin'}),/réservée au vainqueur/);
  // Longevity uses real dates, does not apply retroactively, and really expires.
  await db.exec("update season_days set calendar_date=(now() at time zone 'Europe/Paris')::date+1");
  check(await scalar('select settle_due_training_sessions() as value'),0);
  await db.exec("update season_days set calendar_date=(now() at time zone 'Europe/Paris')::date-1");
  check(await scalar('select settle_due_training_sessions() as value'),5);
  await db.exec("update season_days set calendar_date=(now() at time zone 'Europe/Paris')::date+86");
  check(await scalar('select settle_due_training_sessions() as value'),5);
  await db.exec("update season_days set calendar_date=(now() at time zone 'Europe/Paris')::date");
  // Existing paid construction settlement and invariant are reused.
  await q("insert into infrastructure_projects(id,team_id,status,infrastructure_code,target_level,starts_game_day_index,completes_game_day_index,final_duration_days) values($1,$2,'active','training_center',2,111,123,12)",[id(800),id(201)]);
  await action('buy',{item:'gravediggers-hourglass'});await action('use',{item:'gravediggers-hourglass',target:id(800)});
  check(await scalar('select completes_game_day_index as value from infrastructure_projects where id=$1',[id(800)]),121);
  await action('buy',{item:'cursed-builders-seal'});await action('use',{item:'cursed-builders-seal',target:id(800)});
  check(await scalar('select status as value from infrastructure_projects where id=$1',[id(800)]),'completed');
  // Five ordered bandages, no double reward, and expiry releases a pending gift.
  await action('buy',{item:'mummy-curse'});await action('curse',{item:'mummy-curse',target:id(3)});
  await q("update halloween_curses set pending_gift='{"+'"coins":15'+"}' where user_id=$1",[id(3)]);
  await fail(()=>action('unwrap',{bandage:4},id(3)),/du dessus/);
  for(let bandage=0;bandage<5;bandage++) await action('unwrap',{bandage},id(3));
  check((await wallet(id(3))).coins,54);
  await fail(()=>action('unwrap',{bandage:4},id(3)),/Aucun cadeau/);
  await action('buy',{item:'mummy-curse'});await action('curse',{item:'mummy-curse',target:id(3)});
  await q("update halloween_curses set pending_gift='{"+'"coins":15'+"}',expires_at=now()-interval '1 minute' where user_id=$1",[id(3)]);
  await action('dispel',{},id(3));check((await wallet(id(3))).coins,69);
  // A podium relic is additional to one purchase, not a substitute.
  await q("select halloween_gift('halloween-2026',$1,'fixture-podium','{\"item\":\"full-moon-elixir\"}')",[id(1)]);
  check((await wallet()).inventory['full-moon-elixir'],1);
  await fail(()=>action('buy',{item:'full-moon-elixir'}),/Limite/);
  // Final awards and duplicate cron calls; the main inventory receives one frame.
  for(let n=3;n<=6;n++){
    const session=await action('start',{},id(n));await action('finish',{runId:session.id,distance:n*200,coins:10,score:n*200+250,proof:{}},id(n));
  }
  await db.exec("update halloween_editions set starts_at=now()-interval '2 days',ends_at=now()-interval '10 minutes',shop_ends_at=now()+interval '7 days'");
  await scalar('select settle_halloween_event() as value');
  const after=await q('select user_id,coins from halloween_wallets order by user_id');
  await scalar('select settle_halloween_event() as value');check(await q('select user_id,coins from halloween_wallets order by user_id'),after);
  check(await scalar('select sum(quantity)::integer as value from team_equipment_inventory'),1);
  check((await wallet(id(6))).inventory['headless-skin'],1);
  check(await scalar("select count(*)::integer as value from halloween_ledger where source='final:coins'"),5);
  await fail(()=>action('start'),/terminés/);
  await db.exec('update halloween_editions set enabled=false');await fail(()=>action('buy',{item:'pumpkin-juice'}),/pas ouvert/);
  console.log(JSON.stringify({passed:checks,isolated:true,productionTouched:false}));
} catch(error) {console.error(JSON.stringify({message:error.message,detail:error.detail,where:error.where,checks}));process.exitCode=1;}
finally {await db.close();}
