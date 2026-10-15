// Every fixture below runs in isolated, in-memory PostgreSQL, never Supabase.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const one=async(sql,args=[]) => (await db.query(sql,args)).rows[0];
const scalar=async(sql,args=[]) => (await one(sql,args)).value;
const captured=JSON.parse(readFileSync(".tmp-prospective-achievements/live-schema.json","utf8"));
const q = name => `"${name.replaceAll('"','""')}"`;
try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema private; create schema auth;
    create table teams(id uuid primary key);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text,avatar_key text,experience_points integer default 0,reputation_points numeric default 0);
    create function auth.uid() returns uuid language sql stable as $$ select '${id(1)}'::uuid $$;
    create table seasons(id uuid primary key,status text,game_year integer,current_day_number integer);
    create table season_days(id uuid primary key,season_id uuid,day_number integer,calendar_date date);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,cash_balance numeric default 0);
    create table team_manager_assignments(id uuid primary key default gen_random_uuid(),team_id uuid,sporting_director_id uuid,status text,role text,created_at timestamptz default now());`);
  const schemas=new Map();
  for(const row of captured.filter(r=>r.kind==="column")) {
    const [table,column]=row.signature.split(".");
    const columns=schemas.get(table)??[];
    columns.push(`${q(column)} ${row.definition==="ARRAY"?"text[]":row.definition}${column==="id"?" primary key default gen_random_uuid()":""}`);
    schemas.set(table,columns);
  }
  for(const [table,columns] of schemas) await db.exec(`create table ${q(table)}(${columns.join(",")});`);
  await db.exec(`alter table sporting_director_trophies add unique(sporting_director_id,trophy_key);
    create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid,status text);
    create table race_rosters(id uuid primary key,race_registration_id uuid,rider_id uuid,status text);
    create table youth_scouting_missions(id uuid primary key,team_id uuid);
    create table youth_academy_riders(id uuid primary key,candidate_id uuid,promoted_rider_id uuid,team_id uuid);
    create table youth_academy_training_sessions(id uuid primary key,academy_rider_id uuid);
    create table youth_academy_training_attempts(id uuid primary key,academy_rider_id uuid,status text);
    create table race_combativity_awards(award_key text primary key,race_edition_id uuid,stage_id uuid,race_roster_id uuid);
    create table equipment_catalog_items(id uuid primary key,status text,owner_team_id uuid,acquisition_channel text,effect_payload jsonb,supplier_key text,name text);
    create table rider_equipment_assignments(rider_id uuid,slot_type text,equipment_item_id uuid);
    create table race_stage_equipment_assignments(id uuid,stage_id uuid,team_season_id uuid,rider_id uuid,slot_type text,equipment_item_id uuid);
    create table equipment_partner_contracts(id uuid,team_id uuid,supplier_key text,status text,start_season_id uuid,end_season_id uuid);
    create table equipment_partner_item_effects(contract_id uuid,equipment_item_id uuid,effect_payload jsonb);
    create table fan_club_shop_inventory(team_id uuid,product_code text,quantity integer,average_unit_cost numeric,primary key(team_id,product_code));
    create table fan_club_shop_sales(id uuid primary key default gen_random_uuid(),team_id uuid,season_id uuid,day_number integer,product_code text,units_sold integer,revenue numeric,created_at timestamptz default now());
    create table team_infrastructures(team_id uuid,infrastructure_code text,level integer);
    create table game_objective_claims(id uuid primary key default gen_random_uuid(),sporting_director_id uuid,objective_key text,team_season_id uuid,claimed_at timestamptz default now(),unique(sporting_director_id,objective_key));
    create table game_objective_definitions(objective_key text primary key,objective_type text,objective_group text,title text,description text,metric_key text,target_value integer,reward_cash numeric,reward_experience integer,reward_reputation numeric,display_order integer,is_active boolean);
    alter table game_objective_definitions add reward_random_special_ability boolean default false, add reward_inventory_item_key text, add reward_equipment_catalog_key text;
    alter table game_objective_claims add reward_inventory_item_id uuid, add reward_equipment_item_id uuid, add reward_event_id uuid;
    alter table equipment_catalog_items add catalog_key text;
    create table inventory_catalog_items(id uuid,name text,category text,status text,item_key text);
    create table reward_events(id uuid primary key default gen_random_uuid(),source_reference text unique,source_type text,sporting_director_id uuid,team_season_id uuid,reputation_points numeric,experience_points integer,cash_prize numeric,description text);
    create table team_finance_transactions(id uuid default gen_random_uuid(),team_season_id uuid,season_day_id uuid,day_number integer,amount numeric,category text,status text,description text,source_reference text unique,posted_at timestamptz);
    create table fixture_notifications(title text);
    create function private.create_trophy_notification(uuid,text,text,text,text,timestamptz,uuid,uuid,text) returns void language sql as $$ insert into public.fixture_notifications values($4) $$;
    create function calculate_game_objective_progress(text,uuid,uuid,numeric) returns integer language sql stable as $$ select 17 $$;
    create function get_current_game_objectives() returns table(objective_key text,objective_type text,objective_group text,title text,description text,current_value integer,target_value integer,reward_cash numeric,reward_experience integer,reward_reputation numeric,reward_item_name text,reward_item_kind text,display_order integer,claimed_at timestamptz,is_completed boolean)
    language sql stable set search_path=public as $$ select d.objective_key,d.objective_type,d.objective_group,d.title,d.description,p.value,d.target_value,d.reward_cash,d.reward_experience,d.reward_reputation,null::text,null::text,d.display_order,c.claimed_at,p.value>=d.target_value
      from game_objective_definitions d cross join lateral (select calculate_game_objective_progress(d.metric_key,'${id(1)}'::uuid,'${id(2)}'::uuid,0) value) p
      left join game_objective_claims c on c.objective_key=d.objective_key and c.sporting_director_id='${id(1)}'::uuid $$;
    grant execute on function get_current_game_objectives() to authenticated;`);
  for(const name of ["get_active_calendar_stage_equipment_effects", "settle_due_fan_club_shop_sales", "claim_current_game_objective", "private.notify_sporting_director_trophy"])
    await db.exec(captured.find(r=>r.kind==="function"&&r.signature.startsWith(name+"(")).definition);
  await db.exec("create trigger fixture_notify_trophy after insert on sporting_director_trophies for each row execute function private.notify_sporting_director_trophy()");
  const originalShop=await scalar("select prosrc value from pg_proc where oid='settle_due_fan_club_shop_sales()'::regprocedure");
  await db.exec(readFileSync("supabase/migrations/20261015130000_prospective_career_achievements.sql","utf8"));
  check(await scalar("select count(*)::int value from game_objective_definitions"),29,"nine three-tier families and two secrets");
  check(await scalar("select count(*)::int value from game_objective_claims"),0,"no retrospective grants");
  check(await scalar("select count(*)::int value from career_achievement_progress"),0,"no historical progress scan");
  check(await scalar("select count(*)::int value from get_current_game_objectives()"),27,"secrets hidden before earned");
  check(await scalar("select calculate_game_objective_progress('legacy',null,null,0) value"),17,"old objectives untouched");
  const patchedShop=await scalar("select prosrc value from pg_proc where oid='settle_due_fan_club_shop_sales()'::regprocedure");
  check(patchedShop.replace("perform private.capture_career_shop_day(v_target.team_season_id, v_target.current_day_number);\n      ",""),originalShop,"sales behavior unchanged except pre-refill receipt");
  await db.exec(`insert into teams values('${id(2)}'),('${id(4)}');
    insert into sporting_directors(id,auth_user_id,status) values('${id(1)}','${id(1)}','active'),('${id(3)}','${id(3)}','active');
    insert into seasons values('${id(10)}','active',4,15);
    insert into team_seasons values('${id(20)}','${id(2)}','${id(10)}',0),('${id(40)}','${id(4)}','${id(10)}',0);
    insert into team_manager_assignments(team_id,sporting_director_id,status,role) values('${id(2)}','${id(1)}','active','general_manager'),('${id(4)}','${id(3)}','active','general_manager');
    insert into season_days values('${id(11)}','${id(10)}',1,current_date);
    update career_achievement_epoch set activated_at=now()-interval '2 hours';`);
  const progress = metric => scalar("select calculate_game_objective_progress($1,$2,$3,0) value",["future_"+metric,id(1),id(2)]);
  await assert.rejects(db.query("select claim_current_game_objective('journey_shopkeeper_bronze')"),/pas encore terminé/); checks++;
  check(await scalar("select cash_balance::int value from team_seasons where id=$1",[id(20)]),0,"no grant before any new accomplishment");
  await db.exec(`insert into rider_training_sessions(id,rider_id,team_id,season_day_id,status,rating_changes,processed_at)
    values('${id(101)}','${id(100)}','${id(2)}','${id(11)}','completed','{"sprint":5}',now()-interval '3 hours');`);
  check(await progress("natural_progress"),0,"old training ignored even when inserted late");
  for(const [n,delta] of [[102,1],[103,-1],[104,1],[105,3]]) await db.query(`insert into rider_training_sessions(id,rider_id,team_id,season_day_id,status,rating_changes,processed_at) values($1,$2,$3,$4,'completed',$5,now())`,[id(n),id(100),id(2),id(11),JSON.stringify({sprint:delta})]);
  check(await progress("natural_progress"),4,"net actual primary-note growth, not sum of positive recoveries");
  await db.exec(`insert into rider_training_sessions(id,rider_id,team_id,season_day_id,status,rating_changes,processed_at) values('${id(106)}','${id(100)}','${id(2)}','${id(11)}','completed','{"recovery":99}',now());`);
  check(await progress("natural_progress"),4,"secondary notes excluded");
  await db.exec(`insert into rider_training_sessions(id,rider_id,team_id,season_day_id,status,rating_changes,processed_at)
    values('${id(107)}','${id(100)}','${id(2)}','${id(11)}','completed','{}',now());`);
  check(await progress("natural_progress"),4,"actual training lifecycle does not consume an empty session");
  await db.query("update rider_training_sessions set rating_changes='{\"sprint\":1}' where id=$1",[id(107)]);
  check(await progress("natural_progress"),5,"actual daily-engine post-calculation UPDATE records the gain");
  await db.query("update rider_training_sessions set rating_changes='{\"sprint\":1}' where id=$1",[id(107)]);
  check(await progress("natural_progress"),5,"replayed training UPDATE never counts twice");
  const train = async(n,member,previous) => db.query(`insert into staff_academy_trainings(id,team_id,staff_member_id,improvement_type,previous_level,status,completed_at) values($1,$2,$3,'level',$4,'completed',now())`,[id(n),id(2),id(member),previous]);
  await train(201,200,3);
  check(await progress("mentor"),0,"buying an already advanced specialist does not count");
  await train(202,210,1); await train(203,210,2);
  check(await progress("mentor"),3,"same staff member trained from one to three");
  await db.exec(`update staff_academy_trainings set status='completed' where id='${id(203)}'`);
  check(await progress("mentor"),3,"retries idempotent");
  await train(204,210,3); await train(205,210,4);
  check(await progress("mentor"),5,"gold mentor reachable");
  await db.exec(`update career_achievement_epoch set activated_at=now()-interval '20 days';
    insert into team_infrastructures values('${id(2)}','club_shop',1);
    insert into fan_club_shop_inventory values('${id(2)}','team-jersey',10,30);
    update season_days set calendar_date=current_date-14 where id='${id(11)}';`);
  for(let day=1;day<=14;day++) {
    if(day>1) await db.query("insert into season_days values($1,$2,$3,current_date-14+$3::integer-1)",[id(11+day),id(10),day]);
    await db.query("insert into fan_club_shop_sales(team_id,season_id,day_number,product_code,units_sold,revenue) values($1,$2,$3,'team-jersey',1,80)",[id(2),id(10),day]);
    await db.query("select private.capture_career_shop_day($1,$2)",[id(20),day]);
  }
  check(await progress("shopkeeper"),14,"fourteen positive stocked days, no mandatory login");
  await db.exec(`insert into season_days values('${id(30)}','${id(10)}',15,current_date);
    update fan_club_shop_inventory set quantity=0 where team_id='${id(2)}';
    insert into fan_club_shop_sales(team_id,season_id,day_number,product_code,units_sold,revenue) values('${id(2)}','${id(10)}',15,'team-jersey',1,80);`);
  await db.query("select private.capture_career_shop_day($1,15)",[id(20)]);
  await db.exec(`update fan_club_shop_inventory set quantity=10 where team_id='${id(2)}'`);
  await db.query("select private.capture_career_shop_day($1,15)",[id(20)]);
  check(await scalar("select streak value from career_achievement_shop_days where team_id=$1 and game_day=126",[id(2)]),0,"automatic refill cannot conceal stockout");
  await db.exec(`update career_achievement_epoch set activated_at=now()-interval '2 hours'`);
  const race=async(n,{old=false,grand=false,monument=false,country=700,format="one_day",slug="fixture-race",podiumSame=true,type="road",competition="standard",field=11}={})=>{
    await db.query("insert into races(id,country_id,race_format,competition_type,is_monument,is_grand_tour,slug) values($1,$2,$3,$7,$4,$5,$6)",[id(n),id(country),format,monument,grand,slug,competition]);
    await db.query("insert into race_editions(id,race_id,status,season_id) values($1,$2,'completed',$3)",[id(n+1),id(n),id(10)]);
    await db.query(`insert into stages(id,race_edition_id,status,stage_type,departure_at) values($1,$2,'completed',$3,now()-interval '${old?3:1} hours')`,[id(n+2),id(n+1),type]);
    await db.query("insert into race_registrations values($1,$2,$3,'accepted'),($4,$2,$5,'accepted')",[id(n+3),id(n+1),id(20),id(n+4),id(40)]);
    for(let rank=1;rank<=field;rank++) {
      await db.query("insert into race_rosters values($1,$2,$3,'selected')",[id(n+10+rank),id(rank<=3&&podiumSame?n+3:rank===1?n+3:n+4),id(100+rank)]);
      await db.query("insert into race_results(id,race_edition_id,race_roster_id,status,final_rank) values($1,$2,$3,'classified',$4)",[id(n+30+rank),id(n+1),id(n+10+rank),rank]);
    }
    await db.query("insert into stage_results(id,stage_id,race_roster_id,status,rank,equipment_snapshot) values($1,$2,$3,'finished',1,$4)",[id(n+50),id(n+2),id(n+11),JSON.stringify({items:[{slot:"frame",equipmentItemId:id(800)}]})]);
    await db.query("insert into race_combativity_awards values($1,$2,$3,$4)",["award:"+n,id(n+1),id(n+2),id(n+11)]);
    return n+1;
  };
  const record = n => db.query("select record_prospective_career_race($1,$2,$3)",[id(n),JSON.stringify(Array.from({length:10},(_,i)=>id(102+i))),[id(101)]]);
  const oldRace=await race(1000,{old:true}); await record(oldRace);
  check(await progress("world_traveler"),0,"historic results cannot earn new achievements");
  const currentRace=await race(1100); await record(currentRace); await record(currentRace);
  check(await progress("world_traveler"),1,"country counted once, even on retry");
  check(await progress("tailored_setup"),1,"classified rider with frozen specific setup");
  check(await progress("panache"),1,"official combativity");
  check(await progress("family_photo"),1,"official one-two-three podium");
  check(await progress("upset"),1,"winner not in pre-race top ten");
  check(await progress("research_podium"),2,"winning own effective prototype");
  check(await scalar("select count(*)::int value from get_current_game_objectives()"),29,"secrets appear only after earned");
  const nonHomegrown=await progress("homegrown"); check(nonHomegrown,0,"a transfer is not a homegrown rider");
  await db.exec(`insert into youth_scouting_missions values('${id(900)}','${id(2)}');
    insert into youth_scouting_candidates(id,mission_id) values('${id(901)}','${id(900)}');
    insert into youth_academy_riders values('${id(902)}','${id(901)}','${id(101)}','${id(2)}');
    insert into youth_academy_training_sessions values('${id(903)}','${id(902)}');`);
  for(let n=0;n<3;n++) await record(await race(1200+n*100,{grand:true,format:"stage_race",country:701+n}));
  check(await progress("homegrown"),3,"same academy discovery, training and promotion, then new major victory");
  check(await progress("three_tours"),3,"three distinct grand tours with same rider");
  check(await progress("world_traveler"),4,"different host countries");
  for(const [n,options] of [[1500,{slug:"criterium-de-la-decouverte"}],[1600,{competition:"gala"}],[1700,{competition:"national_championship"}]]) {
    const edition=await race(n,options); await record(edition);
    check(await scalar("select count(*)::int value from career_achievement_receipts where source_key=$1",["race:"+id(edition)]),0,"initiation/gala/national teams excluded");
  }
  const ttt=await race(1800,{type:"team_time_trial"}); await record(ttt);
  check(await scalar("select count(*)::int value from career_achievement_progress where subject_key=$1 and metric_key in ('future_family_photo','future_upset')",[id(ttt)]),0,"team time trial does not fake a sweep or upset");
  const small=await race(1900,{field:3}); await record(small);
  check(await scalar("select count(*)::int value from career_achievement_progress where subject_key=$1 and metric_key='future_upset'",[id(small)]),0,"small field cannot earn upset even with ten invented favorites");
  const noFreeze=await race(2000);
  await db.query("select record_prospective_career_race($1,null,'{}')",[id(noFreeze)]);
  check(await scalar("select count(*)::int value from career_achievement_progress where subject_key=$1 and metric_key='future_upset'",[id(noFreeze)]),0,"no hindsight reconstruction when pre-race favorites absent");
  const unfinished=await race(2100);
  await db.query("update stages set status='scheduled' where race_edition_id=$1",[id(unfinished)]); await record(unfinished);
  check(await scalar("select count(*)::int value from career_achievement_receipts where source_key=$1",["race:"+id(unfinished)]),0,"unhomologated stages ignored");
  const repeatTour=await race(2200,{grand:true,format:"stage_race"});
  await db.query("update race_editions set race_id=$1 where id=$2",[id(1200),id(repeatTour)]); await record(repeatTour);
  check(await progress("three_tours"),3,"a second edition of the same tour is not a fourth distinct tour");
  const otherWinner=await race(2300,{grand:true,format:"stage_race"});
  await db.query("update race_rosters set rider_id=$1 where id=$2",[id(999),id(2311)]); await record(otherWinner);
  check(await progress("three_tours"),3,"another rider's tour never adds to the trilogy");

  // Execute the actual deployed resolver, patched by the real migration.
  await db.exec(`insert into equipment_catalog_items(id,status,owner_team_id,acquisition_channel,effect_payload,name)
    values('${id(800)}','active','${id(2)}','research_prototype','{"ratingBonuses":{"mountain":3}}','Own prototype'),
      ('${id(801)}','active','${id(4)}','research_prototype','{"ratingBonuses":{"mountain":9}}','Foreign prototype');
    insert into equipment_rnd_projects(id,team_id,prototype_equipment_item_id,status,rating_key,rating_delta,completed_at)
      values('${id(802)}','${id(2)}','${id(800)}','completed','mountain',1,now()),('${id(803)}','${id(4)}','${id(801)}','completed','mountain',1,now());
    insert into rider_equipment_assignments values('${id(101)}','frame','${id(800)}');`);
  const effects=async()=> (await one("select equipment_effects from get_active_calendar_stage_equipment_effects($1) where stage_id=$2 and rider_id=$3",[[id(currentRace)],id(1102),id(101)])).equipment_effects;
  check((await effects())[0]._careerResearch,{ratingKey:"mountain",delta:1},"own lab's positive provenance frozen in actual resolver");
  check((await effects())[0].ratingBonuses,{mountain:3},"prototype existing effect applies once");
  await db.query("update rider_equipment_assignments set equipment_item_id=$1 where rider_id=$2",[id(801),id(101)]);
  check(await effects(),[],"foreign lab cannot pass own-ownership check");
  await db.query("update rider_equipment_assignments set equipment_item_id=$1 where rider_id=$2",[id(800),id(101)]);
  await db.query("update equipment_rnd_projects set rating_delta=-1 where id=$1",[id(802)]);
  check((await effects())[0]._careerResearch,null,"setback never receives positive provenance");

  await assert.rejects(db.query(`update sporting_directors set avatar_key='director_custom_v1:a.b.c.d.e.f.g.h.i.j.k.l.m.career-mentor' where id=$1`,[id(1)]),/palier Or/);checks++;
  await assert.rejects(db.query(`update sporting_directors set avatar_key='director_custom_v1:a.b.c.d.e.f.g.h.i.j.k.l.m.career-mentor~halloween~pumpkin' where id=$1`,[id(1)]),/palier Or/);checks++;
  await db.query("select claim_current_game_objective('journey_mentor_gold')");
  check(await scalar("select count(*)::int value from sporting_director_trophies where trophy_key='journey_mentor'"),1,"one trophy after normal gold claim, never at activation");
  check(await scalar("select cash_balance::int value from team_seasons where id=$1",[id(20)]),35000,"normal atomic claim grants the announced gold cash");
  check(await scalar("select experience_points value from sporting_directors where id=$1",[id(1)]),300,"normal atomic claim grants gold XP");
  check(await scalar("select title value from fixture_notifications limit 1"),"Le maître d’apprentissage","existing trophy notification receives French title");
  await assert.rejects(db.query("select claim_current_game_objective('journey_mentor_gold')"),/déjà été récupérée/);checks++;
  check(await scalar("select count(*)::int value from reward_events"),1,"a repeated claim never duplicates a reward event");
  check(await scalar("select count(*)::int value from team_finance_transactions"),1,"no duplicate money movement");
  await db.query(`update sporting_directors set avatar_key='director_custom_v1:a.b.c.d.e.f.g.h.i.j.k.l.m.career-mentor' where id=$1`,[id(1)]);
  for(const name of ["record_prospective_career_race(uuid,jsonb,uuid[])","get_current_game_objectives_pre_prospective()"])
    check(await scalar("select has_function_privilege('authenticated',$1,'execute') value",[name]),false,"player cannot forge/peek "+name);
  check(await scalar("select has_table_privilege('authenticated','career_achievement_progress','insert') value"),false,"progress cannot be forged");
  console.log(JSON.stringify({isolatedPostgres:true,checks,allPassed:true}));
} catch(error) {
  console.error(JSON.stringify({checks,error:error.message,detail:error.detail,where:error.where,query:error.query?.slice(0,500)}));
  process.exitCode=1;
} finally { await db.close(); }
