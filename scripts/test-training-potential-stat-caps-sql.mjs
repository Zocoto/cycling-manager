// Fully isolated PostgreSQL. Real club, free-agent, manual and item routines;
// no credentials, remote clients or production fixtures.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const stats = ["mountain","hills","flat","time_trial","cobbles","sprint","acceleration","downhill","endurance","resistance","recovery","breakaway","prologue"];
const read = name => readFileSync(`supabase/migrations/${name}.sql`, "utf8").replaceAll("\r", "");
const definition = (source, name) => {
  const start = source.search(new RegExp(`create (?:or replace )?function public\\.${name}\\(`));
  assert(start >= 0, name);
  return source.slice(start, source.indexOf("$$;", start) + 3);
};
const one = async (sql, args=[]) => (await db.query(sql,args)).rows[0];
const scalar = async (sql,args=[]) => (await one(sql,args)).value;
let checks=0;
const check = (actual,expected,message) => { assert.deepEqual(actual,expected,message); checks++; };
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select '${id(900)}'::uuid $$;
    create function sync_active_season_day() returns void language sql as $$ select $$;
    create function get_active_rider_physiotherapist_level(uuid,uuid) returns int language sql as $$ select 0 $$;
    create function current_user_manages_team(uuid) returns boolean language sql as $$ select true $$;
    create table seasons(id uuid primary key,game_year int,status text,current_day_number int);
    create table season_days(id uuid primary key,season_id uuid,day_number int,calendar_date date);
    create table riders(id uuid primary key,country_id uuid,potential_steps int,status text,created_at timestamptz default now()-interval '10 days',decline_resistance_multiplier numeric default 1);
    create table rider_contracts(rider_id uuid,team_id uuid,status text,start_season_id uuid,end_season_id uuid,left_season_id uuid,left_day_number int,signed_at timestamptz default now()-interval '10 days',created_at timestamptz default now()-interval '10 days');
    create table rider_season_ratings(rider_id uuid,season_id uuid,age int,${stats.map(s=>`${s} int check (${s} between 0 and 100)`).join(",")},updated_at timestamptz,primary key(rider_id,season_id));
    create table rider_training_sessions(id uuid primary key default gen_random_uuid(),rider_id uuid,team_id uuid,season_id uuid,season_day_id uuid,status text,intensity int,domain text,minimum_form int,trainer_contract_id uuid,trainer_level int,trainer_specialty text,trainer_country_match boolean,physiotherapist_level int,form_before int,form_delta int,form_after int,progress_milli jsonb,decline_milli jsonb,rating_changes jsonb,unique(rider_id,season_day_id));
    create table rider_training_stat_progress(rider_id uuid,season_id uuid,stat_code text,initial_rating int,balance_milli int default 0,total_training_milli int default 0,rating_gain int default 0,rating_loss int default 0,updated_at timestamptz,primary key(rider_id,season_id,stat_code));
    create table rider_training_plan_versions(rider_id uuid,team_id uuid,season_id uuid,effective_from_day_number int,intensity int,domain text,trainer_contract_id uuid,created_at timestamptz default now());
    create table team_training_setting_versions(team_id uuid,season_id uuid,effective_from_day_number int,minimum_form int,created_at timestamptz);
    create table staff_members(id uuid,level int,trainer_specialty text,country_id uuid,role text);
    create table staff_contracts(id uuid,staff_member_id uuid,team_id uuid,status text);
    create table rider_special_abilities(rider_id uuid,ability_code text,source_type text,source_reference text);
    create table rider_condition_states(rider_id uuid,season_day_id uuid,form int,fatigue int,source text,updated_at timestamptz default now(),primary key(rider_id,season_day_id));
    create table rider_daily_condition_effects(rider_id uuid,season_day_id uuid,effect_type text,form_delta int,form_before int,form_after int,primary key(rider_id,season_day_id));
    create table rider_injuries(rider_id uuid,status text,started_at timestamptz,expected_recovery_at timestamptz);
    create table rider_form_camps(rider_id uuid,season_id uuid,status text,start_day_number int,end_day_number int);
    create table halloween_rider_effects(rider_id uuid,item_id text,used_at timestamptz,protection_expires_at timestamptz);
    create table free_agent_training_state(singleton boolean primary key,activated_at timestamptz,last_completed_cutoff timestamptz);
    create table free_agent_training_sessions(rider_id uuid,season_id uuid,season_day_id uuid,status text,progress_milli jsonb,decline_milli jsonb,rating_changes jsonb,primary key(rider_id,season_day_id));
    create table youth_academy_riders(id uuid primary key,team_id uuid,status text,training_mode text,potential_steps int,${stats.map(s=>`${s} numeric`).join(",")},updated_at timestamptz);
    create table youth_academy_training_attempts(id uuid primary key,academy_rider_id uuid,season_id uuid,season_day_id uuid,day_number int,slot text,training_priority text,game_type text,status text,started_at timestamptz,expires_at timestamptz,score int,completed_at timestamptz);
    create table youth_academy_training_sessions(academy_rider_id uuid,season_id uuid,season_day_id uuid,day_number int,training_priority text,training_mode text,slot text,game_type text,score int,rating_changes jsonb,ratings_after jsonb,unique(academy_rider_id,season_day_id,slot));
    -- Oversized final gain stresses the clamp independently of the progression curve.
    create function calculate_youth_training_projected_gain(text,int,int,numeric,numeric,numeric,numeric,numeric) returns numeric language sql as $$ select 20::numeric $$;
    create function get_youth_training_domain_weight(text,text) returns numeric language sql as $$ select 1::numeric $$;
    create function get_youth_training_session_variance(text) returns numeric language sql as $$ select 1::numeric $$;
    create table sporting_directors(id uuid,auth_user_id uuid,status text);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table team_seasons(id uuid,team_id uuid,season_id uuid,status text);
    create table inventory_catalog_items(id uuid,name text,category text,effect_summary text,effect_payload jsonb,status text,is_consumable boolean);
    create table team_item_inventory(id uuid,team_season_id uuid,inventory_item_id uuid,quantity int,updated_at timestamptz);
    create table rider_consumable_item_applications(id uuid,rider_id uuid,inventory_item_id uuid,team_season_id uuid,category text,item_name text,effect_summary text,ability_code text,potential_bonus int,rating_key text,rating_bonus int);
    create table special_ability_catalog(code text,is_active boolean);
    insert into seasons values('${id(1)}',4,'active',1);
    insert into season_days select ('00000000-0000-4000-8000-'||lpad((10+n)::text,12,'0'))::uuid,'${id(1)}',n,current_date-4+n from generate_series(1,3) n;
    insert into free_agent_training_state values(true,now()-interval '10 days',null);
    insert into sporting_directors values('${id(901)}','${id(900)}','active');
    insert into team_manager_assignments values('${id(901)}','${id(2)}','general_manager','active');
    insert into team_seasons values('${id(3)}','${id(2)}','${id(1)}','active');
  `);
  const base = read("20260726113000_add_exponential_rider_decline");
  await db.exec(definition(base,"get_rider_season_decline_points"));
  await db.exec(definition(base,"settle_due_training_sessions"));
  await db.exec(definition(read("20260721210000_create_training_management"),"get_rider_potential_overall_cap"));
  await db.exec(definition(read("20260727090000_add_first_in_class_special_ability"),"get_rider_training_progress_multiplier"));
  await db.exec(definition(read("20260918150000_add_intermediate_professional_training_rating_tiers"),"get_pro_training_rating_progress_factor"));
  await db.exec(definition(read("20261009150000_extend_free_agent_careers_and_training"),"settle_due_free_agent_training"));
  await db.exec(definition(read("20260824130000_recalibrate_youth_progression"),"complete_current_youth_training_attempt"));
  await db.exec(definition(read("20260726064000_fix_fractional_potential_boosts"),"use_current_team_inventory_item"));
  await db.exec("revoke all on function settle_due_free_agent_training(integer) from public,authenticated; grant execute on function settle_due_free_agent_training(integer) to service_role; grant execute on function settle_due_training_sessions() to authenticated,service_role;");
  const itemBefore = await scalar("select md5(pg_get_functiondef('use_current_team_inventory_item(uuid,uuid)'::regprocedure)) value");
  const createRider = async (n,{status="active",age=20,potential=1,mountain=70,other=40,balance=5000,initial=mountain,gains=0}={}) => {
    await db.query("insert into riders(id,potential_steps,status) values($1,$2,$3)",[id(n),potential,status]);
    await db.query(`insert into rider_season_ratings(rider_id,season_id,age,${stats.join(",")}) values($1,$2,$3,$4,${stats.slice(1).map(()=>"$5").join(",")})`,[id(n),id(1),age,mountain,other]);
    await db.query("insert into rider_training_stat_progress(rider_id,season_id,stat_code,initial_rating,balance_milli,rating_gain) values($1,$2,'mountain',$3,$4,$5)",[id(n),id(1),initial,balance,gains]);
    if(status==="active") {
      await db.query("insert into rider_contracts(rider_id,team_id,status,start_season_id,end_season_id) values($1,$2,'active',$3,$3)",[id(n),id(2),id(1)]);
      await db.query("insert into rider_training_plan_versions(rider_id,team_id,season_id,effective_from_day_number,intensity,domain) values($1,$2,$3,1,100,'climber')",[id(n),id(2),id(1)]);
    }
  };
  const ratings = n => one("select mountain,hills from rider_season_ratings where rider_id=$1",[id(n)]);
  await createRider(100);
  await db.query("select * from settle_due_training_sessions()");
  check((await ratings(100)).mountain,75,"reproduces old above-70 training despite a low average");
  const snapshot = await scalar("select jsonb_agg(to_jsonb(r)) value from rider_season_ratings r");
  const fix = read("20261011133000_enforce_training_potential_stat_caps");
  await db.exec(fix);
  await db.exec(fix);
  check(await scalar("select jsonb_agg(to_jsonb(r)) value from rider_season_ratings r"),snapshot,"migration leaves all acquired notes untouched");
  check(await scalar("select md5(pg_get_functiondef('use_current_team_inventory_item(uuid,uuid)'::regprocedure)) value"),itemBefore,"item routine unchanged");
  check(await scalar("select array_agg(get_rider_potential_stat_cap(n) order by n) value from generate_series(1,8) n"),[70,75,80,85,90,95,100,100],"all potential tiers");
  check(await scalar("select has_function_privilege('authenticated','settle_due_free_agent_training(integer)','execute') value"),false,"no new permission to run training");

  for (const [n,options] of [[101,{mountain:69}],[102,{mountain:70}],[103,{mountain:82}],
    [104,{potential:2,mountain:74}],[105,{potential:8,mountain:99}],
    [106,{mountain:68,initial:60,gains:12}],[107,{age:36,mountain:82,initial:83}],
    [108,{age:36,mountain:69,initial:69}],[109,{age:36,mountain:69,initial:72}],
    [110,{age:40,mountain:82,initial:82,balance:-3000}],
    [111,{mountain:69,other:90}]]) await createRider(n,options);
  for (const [n,options] of [[201,{mountain:69}],[202,{mountain:70}],[203,{mountain:82}],
    [204,{potential:2,mountain:74}],[205,{potential:8,mountain:99}],
    [206,{age:36,mountain:82,initial:83}],[207,{age:36,mountain:69,initial:72}],
    [208,{age:40,mountain:82,initial:82,balance:-3000}],
    [209,{mountain:69,other:90}]]) await createRider(n,{...options,status:"free_agent"});
  await db.query("select * from settle_due_training_sessions()");
  await db.query("select settle_due_free_agent_training(250)");
  for (const [n,expected] of [[101,70],[102,70],[103,82],[104,75],[105,100],[106,68],
    [107,82],[108,69],[109,70],[201,70],[202,70],[203,82],[204,75],[205,100],[206,82],[207,70],[111,70],[209,70]]) {
    check((await ratings(n)).mountain,expected,`rider ${n}: individual, seasonal and veteran ceilings`);
  }
  check((await ratings(110)).mountain<82,true,"natural decline remains enabled");
  check((await ratings(208)).mountain<82,true,"free-agent decline remains enabled");
  check(await scalar("select (progress_milli->>'mountain')::int value from rider_training_sessions where rider_id=$1",[id(103)]),0,"no phantom young training gain above cap");
  check(await scalar("select (progress_milli->>'mountain')::int value from free_agent_training_sessions where rider_id=$1",[id(203)]),0,"same report for unattached rider");

  // Real item RPC can still exceed talent and is consumed exactly once.
  await db.exec(`insert into inventory_catalog_items values('${id(950)}','Module','rating_boost','+2 MON','{"ratingKey":"mountain","ratingBonus":2}','active',true);
    insert into team_item_inventory values('${id(951)}','${id(3)}','${id(950)}',1,null);`);
  const item = await one("select use_current_team_inventory_item($1,$2) result",[id(102),id(950)]);
  check(item.result.ratingBonus,2,"module grants a real bonus above talent");
  check((await ratings(102)).mountain,72,"70 plus item becomes 72");
  check(await scalar("select count(*)::int value from team_item_inventory where id=$1",[id(951)]),0,"item consumed");
  await db.exec(`insert into team_item_inventory values('${id(952)}','${id(3)}','${id(950)}',1,null);`);
  await assert.rejects(db.query("select use_current_team_inventory_item($1,$2)",[id(105),id(950)]),/déjà au maximum/); checks++;
  check(await scalar("select quantity value from team_item_inventory where id=$1",[id(952)]),1,"absolute-100 rejection consumes no item");
  await db.exec("update seasons set current_day_number=2;");
  await db.query("select * from settle_due_training_sessions()");
  await db.query("select settle_due_free_agent_training(250)");
  check((await ratings(102)).mountain,72,"next training preserves item bonus but cannot increase it");
  check((await ratings(103)).mountain,82,"future training never retroactively clamps an old note");
  check((await ratings(203)).mountain,82,"same for unattached rider");

  await db.exec(`insert into inventory_catalog_items values('${id(953)}','Talent','potential_boost','+0.5 étoile','{"potentialBonus":0.5}','active',true);
    insert into team_item_inventory values('${id(954)}','${id(3)}','${id(953)}',1,null);`);
  await db.query("select use_current_team_inventory_item($1,$2)",[id(102),id(953)]);
  check(await scalar("select potential_steps value from riders where id=$1",[id(102)]),2,"real potential item raises the half-star tier");
  await db.query("update rider_training_stat_progress set balance_milli=5000 where rider_id=$1 and stat_code='mountain'",[id(102)]);
  await db.query("update rider_condition_states set form=100 where rider_id=$1 and season_day_id=$2",[id(102),id(12)]);

  // Full manual routine, with an intentionally oversized final gain.
  for (const [n,raw] of [[301,4.499],[302,5],[303,4.5]]) {
    await db.query(`insert into youth_academy_riders(id,team_id,status,training_mode,potential_steps,${stats.join(",")}) values($1,$2,'active','manual',1,$3,${stats.slice(1).map(()=>"2").join(",")})`,[id(n),id(2),raw]);
    await db.query(`insert into youth_academy_training_attempts(id,academy_rider_id,season_id,season_day_id,day_number,slot,training_priority,game_type,status,started_at,expires_at)
      values($1,$2,$3,$4,2,case when extract(hour from now() at time zone 'Europe/Paris')<12 then 'manual_am' else 'manual_pm' end,'climber','rhythm','started',now()-interval '1 minute',now()+interval '1 hour')`,[id(n+100),id(n),id(1),id(12)]);
    await db.query("select complete_current_youth_training_attempt($1,1000)",[id(n+100)]);
    check(Number(await scalar("select mountain value from youth_academy_riders where id=$1",[id(n)])),Math.max(raw,4.5),`manual youth ${n} final rounding and over-cap preservation`);
  }
  await assert.rejects(db.query("select complete_current_youth_training_attempt($1,1000)",[id(401)]),/déjà terminée/); checks++;
  check(Number(await scalar("select get_youth_training_next_raw_rating(4.499,20,1) value")),4.5,"final helper stops fractional overshoot");
  const beforeRetry = await scalar("select jsonb_agg(to_jsonb(r) order by rider_id) value from rider_season_ratings r");
  await db.query("select * from settle_due_training_sessions()");
  await db.query("select settle_due_free_agent_training(250)");
  check(await scalar("select jsonb_agg(to_jsonb(r) order by rider_id) value from rider_season_ratings r"),beforeRetry,"same-day retry changes no notes");
  check(await scalar("select get_rider_potential_stat_cap(0) value"),70,"malformed lower step is safe");
  check(await scalar("select get_rider_potential_stat_cap(99) value"),100,"malformed upper step is safe");
  await db.exec("update seasons set current_day_number=3;");
  await db.query("select * from settle_due_training_sessions()");
  check((await ratings(102)).mountain,75,"potential item unlocks future training up to the new ceiling");
  console.log(JSON.stringify({passed:checks,isolatedPostgres:true,productionFixtures:false,realItemBypass:true}));
} finally { await db.close(); }
