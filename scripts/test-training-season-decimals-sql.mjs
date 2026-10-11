// Isolated PostgreSQL only. Reuse the existing training fixture schema, never
// credentials/remote clients; optionally verify the captured live engine shape.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const stats = ["mountain","hills","flat","time_trial","cobbles","sprint","acceleration","downhill","endurance","resistance","recovery","breakaway","prologue"];
const read = name => readFileSync(`supabase/migrations/${name}.sql`,"utf8").replaceAll("\r","");
const definition = (source,name) => {
  const start = source.search(new RegExp(`create (?:or replace )?function public\\.${name}\\(`,"i"));
  assert(start>=0,name);
  return source.slice(start,source.indexOf("$$;",start)+3);
};
const one = async (sql,args=[]) => (await db.query(sql,args)).rows[0];
const scalar = async (sql,args=[]) => (await one(sql,args)).value;
let checks=0;
const check = (actual,expected,message) => { assert.deepEqual(actual,expected,message); checks++; };
const migration = read("20261011170000_preserve_training_decimals_between_seasons");
try {
  const harness=readFileSync("scripts/test-training-potential-stat-caps-sql.mjs","utf8");
  const start=harness.indexOf("await db.exec(`")+"await db.exec(`".length;
  const end=harness.indexOf("`);",start);
  const schema=Function("id","stats",`return \`${harness.slice(start,end)}\``)(id,stats);
  await db.exec(schema);
  await db.exec("create schema private;");
  const base=read("20260726113000_add_exponential_rider_decline");
  for(const name of ["get_rider_season_decline_points","settle_due_training_sessions"]) await db.exec(definition(base,name));
  await db.exec(definition(read("20260721210000_create_training_management"),"get_rider_potential_overall_cap"));
  await db.exec(definition(read("20260727090000_add_first_in_class_special_ability"),"get_rider_training_progress_multiplier"));
  await db.exec(definition(read("20260918150000_add_intermediate_professional_training_rating_tiers"),"get_pro_training_rating_progress_factor"));
  await db.exec(definition(read("20261009150000_extend_free_agent_careers_and_training"),"settle_due_free_agent_training"));
  await db.exec(definition(read("20260824130000_recalibrate_youth_progression"),"complete_current_youth_training_attempt"));
  await db.exec(read("20261011133000_enforce_training_potential_stat_caps"));
  const rollover=definition(read("20260811130000_implement_atomic_season_rollover"),"rollover_game_season");
  // Compile the actual body to verify the guarded patch, without executing
  // unrelated economic/trophy workflows in these training-only fixtures.
  await db.exec("create table season_rollover_settlements(source_season_id uuid);");
  await db.exec(rollover);
  if(process.argv[3]) {
    const captured=JSON.parse(readFileSync(process.argv[3],"utf8"));
    // Neutral unrelated staff/infrastructure bonuses; execute the REAL live
    // club/free-agent routines, including their eligibility/uniqueness guards.
    await db.exec(`alter table rider_contracts add column id uuid default gen_random_uuid();
      create function is_rider_contract_training_eligible(uuid,uuid) returns boolean language sql as $$ select true $$;
      create function get_staff_contract_nationality_multiplier(uuid,uuid) returns numeric language sql as $$ select 1::numeric $$;
      create function apply_three_lungs_form_delta(uuid,numeric) returns numeric language sql as $$ select $2 $$;
      create function get_rider_physio_form_protection(uuid,uuid,text) returns integer language sql as $$ select 0 $$;
      create function get_daily_reward_training_multiplier_for_session(uuid,uuid) returns numeric language sql as $$ select 1::numeric $$;
      create function get_team_training_center_progress_multiplier(uuid) returns numeric language sql as $$ select 1::numeric $$;
      create function get_team_training_center_specialization_progress_multiplier(uuid,text,integer,boolean) returns numeric language sql as $$ select 1::numeric $$;
      create function get_team_national_performance_multiplier(uuid,text) returns numeric language sql as $$ select 1::numeric $$;
      create function get_trainer_talent_progress_multiplier(uuid,uuid,text) returns numeric language sql as $$ select 1::numeric $$;
      create function get_staff_contract_federal_institute_multiplier(uuid) returns numeric language sql as $$ select 1::numeric $$;`);
    const liveRollover=captured.find(row=>row.signature==="public.rollover_game_season(uuid,boolean)");
    await db.exec(liveRollover.definition);
    for(const live of captured.filter(row=>!row.signature.includes("rollover"))) {
      check(live.definition.includes("potential_stat_cap_v1"),true,`${live.signature}: live cap patch is present`);
      check(live.definition.includes("initial_rating)" ) || live.definition.includes("initial_rating\n"),true,`${live.signature}: lazy initial-rating insert covered by trigger`);
      await db.exec(live.definition);
    }
  }
  const beforeRollover=await scalar("select pg_get_functiondef('rollover_game_season(uuid,boolean)'::regprocedure) value");
  const beforeClub=await scalar("select md5(pg_get_functiondef('settle_due_training_sessions()'::regprocedure)) value");
  const beforeFree=await scalar("select md5(pg_get_functiondef('settle_due_free_agent_training(integer)'::regprocedure)) value");
  await db.exec(migration);
  await db.exec(migration);
  const afterRollover=await scalar("select pg_get_functiondef('rollover_game_season(uuid,boolean)'::regprocedure) value");
  check(afterRollover.replace("\n  -- training_season_fraction_carry_v1\n  perform private.seed_season_training_progress(v_target.id);",""),beforeRollover,"all unrelated rollover logic unchanged");
  check(await scalar("select md5(pg_get_functiondef('settle_due_training_sessions()'::regprocedure)) value"),beforeClub,"club engine unchanged");
  check(await scalar("select md5(pg_get_functiondef('settle_due_free_agent_training(integer)'::regprocedure)) value"),beforeFree,"free-agent engine unchanged");
  await db.exec(`insert into seasons values('${id(30)}',3,'completed',28),('${id(50)}',5,'planned',1),('${id(20)}',2,'completed',28);
    insert into season_days values('${id(38)}','${id(30)}',28,current_date-1);
    delete from season_days where season_id='${id(1)}' and day_number>1;`);
  const createRider = async(n,{age=22,potential=8,rating=72,status="active",previous=125,current=0,initial=rating,existing=false,source=id(30),gains=0,losses=0}={}) => {
    await db.query("insert into riders(id,potential_steps,status) values($1,$2,$3)",[id(n),potential,status]);
    await db.query(`insert into rider_season_ratings(rider_id,season_id,age,${stats.join(",")}) values($1,$2,$3,${stats.map(()=>"$4").join(",")})`,[id(n),id(1),age,rating]);
    // Temporarily remove the trigger to recreate real pre-fix S4 progress.
    if(existing) await db.exec("alter table rider_training_stat_progress disable trigger carry_training_fraction_after_insert;");
    for(const stat of stats) {
      if(previous!==null) await db.query("insert into rider_training_stat_progress(rider_id,season_id,stat_code,initial_rating,balance_milli,total_training_milli,rating_gain,rating_loss) values($1,$2,$3,$4,$5,9876,7,2)",[id(n),source,stat,rating,previous]);
      if(existing) await db.query("insert into rider_training_stat_progress(rider_id,season_id,stat_code,initial_rating,balance_milli,total_training_milli,rating_gain,rating_loss) values($1,$2,$3,$4,$5,456,$6,$7)",[id(n),id(1),stat,initial,current,gains,losses]);
    }
    if(existing) await db.exec("alter table rider_training_stat_progress enable trigger carry_training_fraction_after_insert;");
  };
  const progress = n => one("select initial_rating,balance_milli,total_training_milli,rating_gain,rating_loss from rider_training_stat_progress where rider_id=$1 and season_id=$2 and stat_code='sprint'",[id(n),id(1)]);
  const rating = n => scalar("select sprint value from rider_season_ratings where rider_id=$1 and season_id=$2",[id(n),id(1)]);
  const sourceSnapshot = () => scalar("select jsonb_agg(to_jsonb(p) order by rider_id,stat_code) value from rider_training_stat_progress p where season_id=$1",[id(30)]);
  await createRider(100);
  const original=await sourceSnapshot();
  await db.query("select private.seed_season_training_progress($1)",[id(1)]);
  check((await progress(100)).balance_milli,125,"72.125 is available BEFORE J1 08:00");
  check(await rating(100),72,"fraction does not alter an integer note prematurely");
  check((await progress(100)).total_training_milli,0,"seasonal training total resets");
  check((await progress(100)).rating_gain,0,"seasonal gain cap resets");
  check((await progress(100)).rating_loss,0,"seasonal loss total resets");
  check((await progress(100)).initial_rating,72,"new season baseline is the acquired integer note");
  check(await scalar("select count(*)::int value from rider_training_season_carryovers where rider_id=$1",[id(100)]),13,"all 13 stats receive carry receipts");
  await db.query("select private.seed_season_training_progress($1)",[id(1)]);
  check((await progress(100)).balance_milli,125,"repeated initializer cannot duplicate fractions");
  check(await sourceSnapshot(),original,"source season unchanged");
  // A real low-intensity skipped morning session must not erase carry-over.
  await db.query("insert into rider_contracts(rider_id,team_id,status,start_season_id,end_season_id) values($1,$2,'active',$3,$3)",[id(100),id(2),id(1)]);
  await db.query("select * from settle_due_training_sessions()");
  check((await progress(100)).balance_milli,125,"J1 skipped club session retains fraction");
  check(await scalar("select count(*)::int value from rider_training_sessions where rider_id=$1",[id(100)]),1,"one real morning ledger only");
  await db.query("select * from settle_due_training_sessions()");
  check((await progress(100)).balance_milli,125,"same-day retry retains fraction once");
  // Real free-agent engine shares this same lazy progress initializer.
  await createRider(101,{status:"free_agent",previous:875});
  await db.query("select settle_due_free_agent_training(250)");
  const freeBalance=(await progress(101)).balance_milli;
  const freeGain=await scalar("select (progress_milli->>'sprint')::int value from free_agent_training_sessions where rider_id=$1",[id(101)]);
  check((await rating(101))*1000+freeBalance,72000+875+freeGain,"free-agent J1 includes the previous fraction");
  await db.query("select settle_due_free_agent_training(250)");
  check((await progress(101)).balance_milli,freeBalance,"free-agent session retry is idempotent");
  // A signing later that day cannot credit the carry or session a second time.
  await db.query("update riders set status='active' where id=$1",[id(101)]);
  await db.query("insert into rider_contracts(rider_id,team_id,status,start_season_id,end_season_id) values($1,$2,'active',$3,$3)",[id(101),id(2),id(1)]);
  await db.query("insert into rider_training_stat_progress(rider_id,season_id,stat_code,initial_rating) values($1,$2,'sprint',72) on conflict do nothing",[id(101),id(1)]);
  check((await progress(101)).balance_milli,freeBalance,"transfer/repeated insert does not add carry again");
  await createRider(111,{previous:125});
  await db.query("insert into rider_contracts(rider_id,team_id,status,start_season_id,end_season_id) values($1,$2,'active',$3,$3)",[id(111),id(2),id(1)]);
  await db.query("insert into rider_training_plan_versions(rider_id,team_id,season_id,effective_from_day_number,intensity,domain) values($1,$2,$3,1,100,'sprinter')",[id(111),id(2),id(1)]);
  await db.query("select * from settle_due_training_sessions()");
  const clubGain=await scalar("select (progress_milli->>'sprint')::int value from rider_training_sessions where rider_id=$1",[id(111)]);
  check(clubGain>0,true,"real completed club training is executed");
  check((await rating(111))*1000+(await progress(111)).balance_milli,72000+125+clubGain,"completed J1 adds to .125 rather than resetting it");
  if(process.argv[3]) {
    check((await progress(101)).balance_milli,freeBalance,"real live signing guard prevents a second same-day session");
    check(await scalar("select count(*)::int value from rider_training_sessions where rider_id=$1",[id(101)]),0,"free-agent training is not duplicated by club training");
  }
  // Recover the remainder without changing any already-acquired training/item
  // gains. Integer crossings use current, not previous-season, ratings.
  await createRider(102,{previous:125,current:950,existing:true,rating:77,initial:72,gains:5});
  await createRider(103,{previous:-875,current:-200,existing:true,age:36,rating:72});
  await createRider(104,{previous:700,current:750,existing:true,potential:1,rating:82});
  await createRider(105,{previous:700,current:750,existing:true,rating:80,initial:72,gains:8});
  await createRider(106,{previous:700,current:750,existing:true,rating:100});
  await createRider(107,{previous:700,current:750,existing:true,age:36,rating:70,initial:72});
  await createRider(108,{previous:-1125,current:0,existing:true,age:36});
  await createRider(109,{previous:125,source:id(20)});
  await createRider(110,{previous:null});
  const sourceBeforeRepair=await sourceSnapshot();
  const repair=(await one("select private.repair_training_season_carryovers($1,2) value",[id(1)])).value;
  check(repair.repairedRiders,2,"catch-up is bounded to requested rider batch");
  for(let n=0;n<5;n++) await db.query("select private.repair_training_season_carryovers($1,2)",[id(1)]);
  check(await rating(102),78,"recovered .125 plus current .950 awards one earned point, preserving item gains");
  check((await progress(102)).balance_milli,75,"positive crossing keeps remaining .075");
  check((await progress(102)).rating_gain,6,"only recovered integer crossing increments seasonal gains");
  check((await progress(102)).total_training_milli,456,"already recorded J1 training total is not inflated");
  check(await rating(103),71,"negative decline fraction is preserved, too");
  check((await progress(103)).balance_milli,-75,"negative crossing keeps signed remainder");
  check((await progress(103)).rating_loss,1,"recovered decline is accounted once");
  check(await rating(104),82,"existing over-talent item note is not reduced");
  check((await progress(104)).balance_milli,999,"talent ceiling still blocks new integer gains");
  check(await rating(105),80,"current season gain ceiling preserved");
  check(await rating(106),100,"absolute 100 ceiling preserved");
  check(await rating(107),71,"veteran may recover toward initial note under existing rules");
  check((await progress(108)).balance_milli,-125,"only fractional remainder, not capped whole points, is carried");
  await db.query("select private.seed_season_training_progress($1)",[id(1)]);
  check((await progress(109)).balance_milli,0,"no jump over a missing previous season");
  check((await progress(110)).balance_milli,0,"new professional has no fictitious historic decimal");
  check(await sourceSnapshot(),sourceBeforeRepair,"catch-up never rewrites S3 balances/counters");
  const snapshot=await scalar("select jsonb_agg(to_jsonb(p) order by rider_id,season_id,stat_code) value from rider_training_stat_progress p");
  check((await one("select private.repair_training_season_carryovers($1,100) value",[id(1)])).value.repairedStats,0,"completed catch-up is a no-op");
  check(await scalar("select jsonb_agg(to_jsonb(p) order by rider_id,season_id,stat_code) value from rider_training_stat_progress p"),snapshot,"repeat catch-up changes no progress");
  await assert.rejects(db.query("select private.apply_training_season_carryover($1,$2,'malicious_column')",[id(100),id(1)]),/Unknown training stat/); checks++;
  await assert.rejects(db.query("select private.repair_training_season_carryovers($1,10)",[id(30)]),/Only the active season/); checks++;
  check(await scalar("select has_function_privilege('authenticated','private.repair_training_season_carryovers(uuid,integer)','execute') value"),false,"player cannot execute catch-up");
  check(await scalar("select has_table_privilege('authenticated','rider_training_season_carryovers','insert') value"),false,"player cannot forge carry receipt");
  // Multi-batch regression with 120 riders / 1,560 stats, still completely
  // isolated. Existing notes progress from 72.950 to 73.075 without replay.
  await db.exec(`insert into riders(id,potential_steps,status)
    select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,8,'active' from generate_series(1000,1119) n;
    insert into rider_season_ratings(rider_id,season_id,age,${stats.join(",")})
    select id,'${id(1)}',22,${stats.map(()=>"72").join(",")} from riders where id between '${id(1000)}' and '${id(1119)}';
    alter table rider_training_stat_progress disable trigger carry_training_fraction_after_insert;
    insert into rider_training_stat_progress(rider_id,season_id,stat_code,initial_rating,balance_milli)
    select rider.id,season.id,stat.code,72,case when season.id='${id(30)}' then 125 else 950 end
    from riders rider cross join (values('${id(30)}'::uuid),('${id(1)}'::uuid)) season(id)
      cross join (values ${stats.map(stat=>`('${stat}')`).join(",")}) stat(code)
    where rider.id between '${id(1000)}' and '${id(1119)}';
    alter table rider_training_stat_progress enable trigger carry_training_fraction_after_insert;`);
  for(const expectedRiders of [50,50,20]) {
    const result=(await one("select private.repair_training_season_carryovers($1,50) value",[id(1)])).value;
    check(result.repairedRiders,expectedRiders,"bulk repair uses bounded 50-rider batches");
    check(result.repairedStats,expectedRiders*13,"bulk repair covers all stats");
  }
  check(await scalar("select count(*)::int value from rider_training_stat_progress where season_id=$1 and rider_id between $2 and $3 and balance_milli=75 and rating_gain=1",[id(1),id(1000),id(1119)]),1560,"all bulk balances are correct");
  check(await scalar("select count(*)::int value from rider_season_ratings where season_id=$1 and rider_id between $2 and $3 and sprint=73 and mountain=73 and prologue=73",[id(1),id(1000),id(1119)]),120,"all bulk integer notes are correct");
  check((await one("select private.repair_training_season_carryovers($1,50) value",[id(1)])).value.repairedStats,0,"bulk retry cannot duplicate credits");
  // A planned-season initializer must wait for the source closure, then use
  // the final signed balance even if the draft row already exists.
  await db.query(`insert into rider_season_ratings(rider_id,season_id,age,${stats.join(",")}) select rider_id,$1,age+1,${stats.join(",")} from rider_season_ratings where rider_id=$2 and season_id=$3`,[id(50),id(100),id(1)]);
  await db.query("select private.seed_season_training_progress($1)",[id(50)]);
  check(await scalar("select balance_milli value from rider_training_stat_progress where rider_id=$1 and season_id=$2 and stat_code='sprint'",[id(100),id(50)]),0,"draft does not use unfinished source");
  await db.exec(`update seasons set status='completed' where id='${id(1)}'; update seasons set status='active' where id='${id(50)}';`);
  await db.query("select private.seed_season_training_progress($1)",[id(50)]);
  check(await scalar("select balance_milli value from rider_training_stat_progress where rider_id=$1 and season_id=$2 and stat_code='sprint'",[id(100),id(50)]),125,"next rollover carries S4 into S5 including preinitialized draft");
  check(await scalar("select total_training_milli value from rider_training_stat_progress where rider_id=$1 and season_id=$2 and stat_code='sprint'",[id(100),id(50)]),0,"next seasonal total resets again");
  console.log(JSON.stringify({passed:checks,isolatedPostgres:true,productionFixtures:false,all13Stats:true}));
} catch(error) {
  console.error("FAIL:",error.message,error.where ?? "",error.actual ?? "",error.expected ?? "");
  process.exitCode=1;
} finally { await db.close(); }
