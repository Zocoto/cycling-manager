// Isolated PostgreSQL/WASM only. No credentials, HTTP, live player or fixture.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]?.replaceAll('\\','/').endsWith('/pglite/dist/index.js')) throw Error('Absolute isolated PGlite module required');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let checks = 0;
const scalar = async (sql,args=[]) => Object.values((await db.query(sql,args)).rows[0])[0];
const check = (actual,expected) => { assert.deepEqual(actual,expected); checks++; };
const denied = async (sql,args=[]) => { await assert.rejects(()=>db.query(sql,args)); checks++; };
const settle = (key,rows) => scalar('select settle_season_four_gala_results($1,$2::jsonb)',[key,JSON.stringify(rows)]);
const top = program => Array.from({length:10},(_,index)=>({rank:index+1,rider_id:id(1000+(program==='world-tour'?0:20)+index),team_id:id((program==='world-tour'?10:12)+(index>=7?1:0))}));
try {
  await db.exec(`
    create role anon;create role authenticated;create role service_role bypassrls;
    create table seasons(id uuid primary key,game_year int unique,status text);
    create table season_days(id uuid primary key,season_id uuid references seasons(id),day_number int);
    create table teams(id uuid primary key);
    create table riders(id uuid primary key,first_name text,last_name text);
    create table team_seasons(id uuid primary key,team_id uuid references teams(id),season_id uuid references seasons(id),status text);
    create table sporting_directors(id uuid primary key,status text);
    create table team_manager_assignments(team_id uuid references teams(id),sporting_director_id uuid references sporting_directors(id),role text,status text);
    create table equipment_catalog_items(id uuid primary key default gen_random_uuid(),catalog_key text unique,name text,slot_type text,status text,supplier_key text,supplier_name text,description text,price numeric,rarity text,image_path text,effect_summary text,effect_payload jsonb,acquisition_channel text);
    create table daily_reward_catalog(reward_key text primary key,effect_kind text,effect_payload jsonb,is_active boolean);
    create table daily_reward_inventory(id uuid primary key default gen_random_uuid(),sporting_director_id uuid references sporting_directors(id),team_season_id uuid references team_seasons(id),source_claim_id uuid,source_referral_reward_id uuid,source_auction_compensation_id uuid,source_longevity_trophy_reward_id uuid,source_international_selection_compensation_id uuid,source_race_incident_compensation_id uuid,reward_key text references daily_reward_catalog(reward_key),expires_after_game_year int,status text default 'available',constraint daily_reward_inventory_exactly_one_source check(num_nonnulls(source_claim_id,source_referral_reward_id,source_auction_compensation_id,source_longevity_trophy_reward_id,source_international_selection_compensation_id,source_race_incident_compensation_id)=1));
    create table team_equipment_inventory(team_season_id uuid references team_seasons(id),equipment_item_id uuid references equipment_catalog_items(id),quantity int,last_purchase_price numeric,updated_at timestamptz,unique(team_season_id,equipment_item_id));
    create table sporting_director_messages(sporting_director_id uuid,season_id uuid,team_season_id uuid,message_type text,sender_name text,subject text,preview text,body text,action_href text,action_label text,source_reference text,is_important boolean,unique(sporting_director_id,source_reference));
    create table daily_reward_active_effects(id uuid primary key default gen_random_uuid(),source_inventory_id uuid,team_id uuid,season_id uuid,effect_kind text,effect_payload jsonb,starts_day_number int,ends_day_number int,consumed_day_number int,status text default 'active',activated_at timestamptz default now());
    create table official_guard(form int,cash int,points int);insert into official_guard values(73,120000,150);
    create table pcm_gala_events(id int);insert into pcm_gala_events values(7);
    insert into seasons values('${id(1)}',4,'completed'),('${id(2)}',5,'active');
    insert into season_days select ('00000000-0000-4000-8000-'||lpad((300+i)::text,12,'0'))::uuid,'${id(2)}',i from generate_series(1,4) i;
    insert into daily_reward_catalog values('secondary-technique','rating_boost','{"amount":1,"statScope":"secondary"}',true),('collective-training-200','training_multiplier','{"multiplier":2}',true),('energy-ration','form_boost','{"amount":5}',true),('injury-care-recovery-kit','injury_care','{"recoveryHours":12}',true);
  `);
  await db.exec(readFileSync('supabase/migrations/20261022220000_prepare_private_season_gala_startlists.sql','utf8'));
  for(let team=0;team<4;team++) {
    await db.exec(`insert into teams values('${id(10+team)}');insert into team_seasons values('${id(20+team)}','${id(10+team)}','${id(2)}','active');insert into sporting_directors values('${id(30+team)}','active');insert into team_manager_assignments values('${id(10+team)}','${id(30+team)}','general_manager','active');insert into season_gala_registrations values('${id(40+team)}','${id(1)}','${id(10+team)}','${team<2?'world-tour':'continental'}',now());`);
    for(let rider=0;rider<7;rider++) {
      const riderId=id(1000+(team<2?0:20)+(team%2)*7+rider);
      await db.exec(`insert into riders values('${riderId}','Coureur','${team}-${rider}');`);
      for(const profile of ['mountain','hills',team<2?'cobbles':'sprint']) await db.query('insert into season_gala_registration_riders values($1,$2,$3,$4)',[id(40+team),profile,riderId,rider+1]);
    }
  }
  await db.exec(`insert into daily_reward_inventory(sporting_director_id,team_season_id,source_claim_id,reward_key,expires_after_game_year) values('${id(30)}','${id(20)}','${id(999)}','energy-ration',6);`);
  await db.exec(readFileSync('supabase/migrations/20261023120000_prepare_season_four_gala_rewards.sql','utf8'));
  check(await scalar('select count(*)::int from season_gala_reward_grants'),0);
  check(await scalar('select count(*)::int from daily_reward_inventory'),1);
  check(await scalar("select count(*)::int from equipment_catalog_items where acquisition_channel='event_reward'"),12);
  check(await scalar("select count(*)::int from equipment_catalog_items where slot_type='front_wheel'"),0);
  for(const role of ['anon','authenticated']) {
    check(await scalar(`select has_function_privilege('${role}','settle_season_four_gala_results(text,jsonb)','execute')`),false);
    for(const table of ['season_gala_result_imports','season_gala_reward_grants']) check(await scalar(`select has_table_privilege('${role}','${table}','select') or has_table_privilege('${role}','${table}','insert')`),false);
  }
  check(await scalar("select has_function_privilege('service_role','settle_season_four_gala_results(text,jsonb)','execute')"),true);
  await db.exec(`insert into teams values('${id(50)}');insert into season_gala_registrations values('${id(60)}','${id(1)}','${id(50)}','continental',now());insert into season_gala_registration_riders values('${id(60)}','mountain','${id(1000)}',1);delete from season_gala_registrations where id='${id(60)}';`);
  check(await scalar(`select count(*)::int from season_gala_registration_riders where registration_id='${id(60)}'`),0);
  await denied(`insert into season_gala_registrations(season_id,team_id,program) values('${id(1)}','${id(10)}','continental')`);
  await denied(`update season_gala_registrations set program='continental' where id='${id(40)}'`);
  await denied(`update season_gala_registration_riders set profile='sprint' where registration_id='${id(40)}' and profile='cobbles'`);
  await denied(`update season_gala_registration_riders set profile='cobbles' where registration_id='${id(42)}' and profile='sprint'`);
  await denied(`update season_gala_registration_riders set registration_id='${id(41)}' where registration_id='${id(40)}' and profile='mountain'`);
  for(const [key,rows] of [
    ['continental:cobbles',top('continental')],['world-tour:mountain',top('world-tour').slice(0,9)],
    ['world-tour:mountain',top('continental')],
    ['world-tour:mountain',top('world-tour').map((r,i)=>i===9?{...r,rank:1}:r)],
    ['world-tour:mountain',top('world-tour').map((r,i)=>i===9?{...r,rider_id:top('world-tour')[0].rider_id}:r)],
  ]) {await assert.rejects(()=>settle(key,rows));checks++;}
  // Fail after earlier winners were processed: everything must roll back.
  await db.exec(`update sporting_directors set status='inactive' where id='${id(31)}'`);
  await assert.rejects(()=>settle('world-tour:mountain',top('world-tour')));checks++;
  for(const table of ['season_gala_result_imports','season_gala_reward_grants','team_equipment_inventory','sporting_director_messages']) check(await scalar(`select count(*)::int from ${table}`),0);
  check(await scalar('select count(*)::int from daily_reward_inventory'),1);
  await db.exec(`update sporting_directors set status='active' where id='${id(31)}'`);
  const receipt=await settle('world-tour:mountain',top('world-tour'));
  check(receipt,{eventKey:'world-tour:mountain',rewardedRiders:10,equipmentUnits:3,consumableUnits:25,alreadyImported:false});
  check(await scalar('select count(*)::int from season_gala_reward_grants'),28);
  check(await scalar('select count(*)::int from daily_reward_inventory where source_season_gala_reward_id is not null'),25);
  check(await scalar("select count(*)::int from daily_reward_inventory where source_season_gala_reward_id is not null and expires_after_game_year=6"),25);
  check(await scalar('select count(*)::int from sporting_director_messages'),10);
  check(await scalar("select effect_payload from equipment_catalog_items where catalog_key='gala-s4-mountain-bib_shorts'"),{ratingBonuses:{mountain:3}});
  await db.exec("update daily_reward_inventory set status='used' where reward_key='secondary-technique'");
  check((await settle('world-tour:mountain',top('world-tour').reverse())).alreadyImported,true);
  check(await scalar('select count(*)::int from season_gala_reward_grants'),28);
  check(await scalar("select count(*)::int from daily_reward_inventory where reward_key='secondary-technique' and status='used'"),1);
  await assert.rejects(()=>settle('world-tour:mountain',top('world-tour').map((r,i)=>({...r,rank:10-i}))));checks++;
  await denied(`delete from season_gala_registrations where id='${id(40)}'`);
  await denied(`insert into season_gala_registrations values('${id(60)}','${id(1)}','${id(50)}','world-tour',now())`);
  await denied(`delete from season_gala_registration_riders where registration_id='${id(40)}'`);
  await denied(`insert into daily_reward_inventory(sporting_director_id,team_season_id,reward_key,expires_after_game_year) values('${id(30)}','${id(20)}','energy-ration',6)`);
  await denied(`insert into daily_reward_inventory(sporting_director_id,team_season_id,source_season_gala_reward_id,reward_key,expires_after_game_year) values('${id(30)}','${id(20)}','${id(9999)}','energy-ration',6)`);
  await db.exec(`insert into daily_reward_active_effects(source_inventory_id,team_id,season_id,effect_kind,effect_payload,starts_day_number,ends_day_number) select inventory.id,'${id(10)}','${id(2)}','training_multiplier',catalog.effect_payload,1,28 from daily_reward_inventory inventory join daily_reward_catalog catalog using(reward_key) where inventory.reward_key='collective-training-200';`);
  for(let day=1;day<=3;day++) {
    check(await scalar('select get_daily_reward_training_multiplier_for_session($1,$2)',[id(10),id(300+day)]),'2');
    check(await scalar('select get_daily_reward_training_multiplier_for_session($1,$2)',[id(10),id(300+day)]),'2');
    check(await scalar("select count(*)::int from daily_reward_active_effects where status='consumed'"),day);
  }
  check(await scalar('select get_daily_reward_training_multiplier_for_session($1,$2)',[id(10),id(304)]),'1');
  await db.exec(`insert into daily_reward_active_effects(team_id,season_id,effect_kind,effect_payload,starts_day_number,ends_day_number) values('${id(10)}','${id(2)}','training_multiplier','{"multiplier":3}',3,28);`);
  check(await scalar('select get_daily_reward_training_multiplier_for_session($1,$2)',[id(10),id(303)]),'2');
  check(await scalar('select get_daily_reward_training_multiplier_for_session($1,$2)',[id(10),id(304)]),'3');
  check(await scalar('select get_daily_reward_training_multiplier_for_session($1,$2)',[id(11),id(304)]),'1');
  for(const key of ['world-tour:hills','world-tour:cobbles','continental:mountain','continental:hills','continental:sprint']) {
    check((await settle(key,top(key.startsWith('world-tour')?'world-tour':'continental'))).consumableUnits,25);
  }
  check(await scalar('select count(*)::int from season_gala_result_imports'),6);
  check(await scalar('select count(*)::int from season_gala_reward_grants'),168);
  check(await scalar('select count(*)::int from daily_reward_inventory where source_season_gala_reward_id is not null'),150);
  check(await scalar('select row_to_json(official_guard) from official_guard'),{form:73,cash:120000,points:150});
  check(await scalar('select count(*)::int from pcm_gala_events'),1);
  console.log(`${checks} isolated PostgreSQL gala checks passed; no production fixtures or gameplay writes.`);
} finally {await db.close();}
