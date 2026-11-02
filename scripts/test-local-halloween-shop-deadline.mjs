// Disposable in-memory PostgreSQL only. No credentials or production access.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]?.endsWith('/dist/index.js')) throw Error('Pass an isolated PGlite module path.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const source=name=>readFileSync(`supabase/migrations/${name}`,'utf8');
const migration=source('20261030130000_close_halloween_shop_with_season_four.sql');
let checks=0,request=1000;
const check=(a,b)=>{assert.deepEqual(a,b);checks++;};
const reject=async(fn,pattern)=>{await assert.rejects(fn,pattern);checks++;};
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const clock=async date=>db.query("select set_config('halloween_test.now',$1,false)",[date]);
const action=async(kind,payload={})=>scalar('select public.halloween_action($1,$2,$3,$4::jsonb)',[id(1),id(request++),kind,JSON.stringify(payload)]);
const state=async()=>scalar('select public.get_current_halloween_state()');
const wallet=async()=> (await db.query('select * from halloween_wallets where user_id=$1',[id(1)])).rows[0];
const actionMeta=async()=>scalar(`select jsonb_build_object('acl',proacl::text,'config',proconfig,'definer',prosecdef)
  from pg_proc where oid='public.halloween_action(uuid,uuid,text,jsonb)'::regprocedure`);
try {
  await db.exec(`
    create role anon;create role authenticated;create role service_role;create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select '${id(1)}'::uuid$$;
    create function public.halloween_test_now() returns timestamptz language sql stable as
      $$select current_setting('halloween_test.now')::timestamptz$$;
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text,display_name text,avatar_key text);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,status text,role text);
    create table seasons(id uuid primary key,status text,game_year integer,current_day_number integer);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,scouting_reports_revealed_until timestamptz);
    create table season_days(id uuid primary key,season_id uuid,day_number integer,calendar_date date);
    create table riders(id uuid primary key,first_name text,last_name text,height_cm numeric,weight_kg numeric,
      baseline_weight_kg numeric,potential_steps integer,career_race_days integer,status text);
    create table rider_contracts(rider_id uuid,team_id uuid,status text);
    create table rider_season_ratings(rider_id uuid,season_id uuid,age integer,updated_at timestamptz);
    create table rider_condition_states(rider_id uuid,season_day_id uuid,form numeric,fatigue integer,
      source text,updated_at timestamptz default now(),unique(rider_id,season_day_id));
    create table rider_injuries(id uuid primary key,rider_id uuid,status text,expected_recovery_at timestamptz,
      diagnosis_code text,recovered_at timestamptz,updated_at timestamptz);
    create table infrastructure_projects(id uuid primary key,team_id uuid,status text,infrastructure_code text,
      country_id uuid,target_level integer,starts_game_day_index integer,completes_game_day_index integer,
      final_duration_days integer,created_at timestamptz,updated_at timestamptz);
    create table race_rosters(rider_id uuid,race_registration_id uuid);
    create table race_registrations(id uuid,race_edition_id uuid,status text);
    create table stages(race_edition_id uuid,status text,departure_at timestamptz,distance_km numeric);
    insert into auth.users values('${id(1)}');
    insert into sporting_directors values('${id(11)}','${id(1)}','active','Test DS','director_m_01');
    insert into team_manager_assignments values('${id(11)}','${id(21)}','active','general_manager');
    insert into seasons values('${id(31)}','active',4,28);
    insert into team_seasons values('${id(41)}','${id(21)}','${id(31)}',null);
    insert into season_days values('${id(51)}','${id(31)}',28,'2026-11-05');
  `);
  // These real functions supply the purchase guards, inventory use and state;
  // fixtures are deliberately minimal and do not reproduce unrelated triggers.
  await db.exec(source('20261008210000_create_halloween_event.sql'));
  await db.exec(source('20261008210100_halloween_items_and_state.sql'));
  await db.exec(`update halloween_editions set enabled=true;
    insert into halloween_catalog(id,name,kind,price,max_obtained,effect) values
      ('pocket-bat','Bat','cosmetic',6,1,'{"slot":"accessory"}'),
      ('scouts-candy','Candy','consumable',8,30,'{}');
    insert into halloween_wallets(edition_id,user_id,coins,inventory,obtained,purchases)
      values('halloween-2026','${id(1)}',100,'{"scouts-candy":1}','{"scouts-candy":1}','{}');`);
  const originalWallet=await wallet();
  const originalEdition=(await db.query('select * from halloween_editions')).rows[0];
  const originalAction=await scalar("select pg_get_functiondef('public.halloween_action(uuid,uuid,text,jsonb)'::regprocedure)");
  const originalMeta=await actionMeta();
  await db.exec(migration);
  const changedEdition=(await db.query('select * from halloween_editions')).rows[0];
  check(changedEdition,{...originalEdition,shop_ends_at:new Date('2026-11-05T23:00:00Z')});
  check(await wallet(),originalWallet);
  check(await actionMeta(),originalMeta);
  const changedAction=await scalar("select pg_get_functiondef('public.halloween_action(uuid,uuid,text,jsonb)'::regprocedure)");
  check(changedAction,originalAction.replace(
    'Les jeux sont terminés. La boutique reste ouverte jusqu’au 9 novembre inclus.',
    'Les jeux sont terminés. La boutique reste ouverte jusqu’à la date indiquée dans l’événement.'));
  await db.exec(migration);check(await wallet(),originalWallet);check(await actionMeta(),originalMeta);
  check(await scalar("select to_char(shop_ends_at at time zone 'Europe/Paris','YYYY-MM-DD HH24:MI') from halloween_editions"),'2026-11-06 00:00');
  // A changed function cancels the entire migration, including its earlier
  // date update. This is distinct from the pre-update configuration guard.
  await db.exec("update halloween_editions set shop_ends_at='2026-11-09T23:00Z'");
  await db.exec(changedAction.replace(
    'Les jeux sont terminés. La boutique reste ouverte jusqu’à la date indiquée dans l’événement.',
    'Unexpected isolated fixture message.'));
  await reject(()=>db.exec(migration),/Unexpected Halloween action function/);await db.exec('rollback');
  check(await scalar('select shop_ends_at from halloween_editions'),new Date('2026-11-09T23:00:00Z'));
  check(await wallet(),originalWallet);
  await db.exec(changedAction);await db.exec(migration);
  // Freeze business time only in this isolated database; no date helper or
  // test clock is added to production by the migration.
  for(const signature of ['public.halloween_action(uuid,uuid,text,jsonb)','public.get_current_halloween_state()','public.halloween_use_item(uuid,text,uuid)']) {
    const definition=await scalar(`select pg_get_functiondef('${signature}'::regprocedure)`);
    await db.exec(definition.replaceAll('now()','public.halloween_test_now()'));
  }
  await clock('2026-11-02T22:59:59Z');check((await state()).state,'open');
  await clock('2026-11-02T23:00:00Z');check((await state()).state,'shop');
  await reject(()=>action('start'),/Les jeux sont terminés.*date indiquée/);
  await reject(()=>action('draw'),/Les jeux sont terminés/);
  await reject(()=>action('curse'),/Les jeux sont terminés/);
  await clock('2026-11-05T22:59:59Z');check((await state()).state,'shop');
  await action('buy',{item:'pocket-bat'});check((await wallet()).coins,94);
  check((await wallet()).inventory['pocket-bat'],1);
  const purchased=await wallet();
  await clock('2026-11-05T23:00:00Z');check((await state()).state,'archived');
  await reject(()=>action('buy',{item:'scouts-candy'}),/L’édition est terminée/);
  await reject(()=>action('join'),/L’édition est terminée/);
  check(await wallet(),purchased);
  await action('equip',{item:'pocket-bat'});check((await wallet()).cosmetics,{accessory:'pocket-bat'});
  await action('use',{item:'scouts-candy'});check((await wallet()).inventory['scouts-candy'],0);
  check(await scalar('select scouting_reports_revealed_until from team_seasons'),new Date('2026-11-06T23:00:00Z'));
  await action('dispel');checks++;
  await db.exec(`insert into halloween_curses(edition_id,user_id,sender_id,kind,expires_at,pending_gift,bandages)
    values('halloween-2026','${id(1)}','${id(1)}','mummy','2026-11-08T23:00Z','{"coins":8}',4)`);
  await action('unwrap',{bandage:4});check((await wallet()).coins,102);
  for(const date of ['2026-11-06T12:00Z','2026-11-09T22:59:59Z','2026-11-09T23:00Z']) {
    await clock(date);check((await state()).state,'archived');
    await reject(()=>action('buy',{item:'scouts-candy'}),/L’édition est terminée/);
  }
  // Unexpected configuration cancels the migration transaction, without
  // changing its deadline or dropping any of the already-installed guards.
  await db.exec("update halloween_editions set shop_ends_at='2026-11-07T23:00Z'");
  await reject(()=>db.exec(migration),/Unexpected Halloween dates/);await db.exec('rollback');
  check(await scalar('select shop_ends_at from halloween_editions'),new Date('2026-11-07T23:00:00Z'));
  console.log(JSON.stringify({checks,isolated:true,productionFixtures:false,realActionAndStateFunctions:true}));
}finally { await db.close(); }
