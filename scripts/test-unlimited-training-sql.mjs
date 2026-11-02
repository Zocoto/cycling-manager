// Isolated PostgreSQL only. Never imports credentials or connects to production.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const stats=['mountain','hills','flat','time_trial','cobbles','sprint','acceleration','downhill','endurance','resistance','recovery','breakaway','prologue'];
const season='c0c5824c-43a4-442e-907c-265c479efa0a',rider='4e44a1c8-c33d-49b1-9cf2-b5e809e20762';
const session='994b87f3-c297-4588-9142-1040c5cbe968',day='45e7c287-7866-4858-8eae-201edd82ea5c';
const read=name=>readFileSync(`supabase/migrations/${name}.sql`,'utf8').replaceAll('\r','');
const definition=(source,name)=>{const start=source.search(new RegExp(`create (?:or replace )?function public\\.${name}\\(`,'i'));assert(start>=0,name);return source.slice(start,source.indexOf('$$;',start)+3);};
const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
const scalar=async(sql,args=[])=>(await one(sql,args)).value;
let checks=0; const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const migration=read('20261102141537_remove_seasonal_training_gain_limits');
const signatures=['public.settle_due_training_sessions()','public.settle_due_free_agent_training(integer)','private.apply_training_season_carryover(uuid,uuid,text)'];
const attributes=()=>db.query(`select oid::regprocedure::text signature,proacl::text,prosecdef,proconfig from pg_proc where oid=any($1::regprocedure[]) order by signature`,[signatures]);
try {
  const harness=readFileSync('scripts/test-training-potential-stat-caps-sql.mjs','utf8');
  const start=harness.indexOf('await db.exec(`')+'await db.exec(`'.length;
  const end=harness.indexOf('`);',start);
  await db.exec(Function('id','stats',`return \`${harness.slice(start,end)}\``)(id,stats));
  await db.exec(`create schema private;
    alter table rider_training_sessions add column is_contract_eligible boolean not null default true;
    alter table rider_training_sessions add column processed_at timestamptz not null default now();
    alter table rider_contracts add column id uuid default gen_random_uuid();
    create function is_rider_contract_training_eligible(uuid,uuid) returns boolean language sql as $$ select $1<>'${id(99999)}'::uuid $$;
    create function get_staff_contract_nationality_multiplier(uuid,uuid) returns numeric language sql as $$ select 1::numeric $$;
    create function apply_three_lungs_form_delta(uuid,numeric) returns numeric language sql as $$ select $2 $$;
    create function get_rider_physio_form_protection(uuid,uuid,text) returns integer language sql as $$ select 0 $$;
    create function get_daily_reward_training_multiplier_for_session(uuid,uuid) returns numeric language sql as $$ select 1::numeric $$;
    create function get_team_training_center_progress_multiplier(uuid) returns numeric language sql as $$ select 1::numeric $$;
    create function get_team_training_center_specialization_progress_multiplier(uuid,text,integer,boolean) returns numeric language sql as $$ select 1::numeric $$;
    create function get_team_national_performance_multiplier(uuid,text) returns numeric language sql as $$ select 1::numeric $$;
    create function get_trainer_talent_progress_multiplier(uuid,uuid,text) returns numeric language sql as $$ select 1::numeric $$;
    create function get_staff_contract_federal_institute_multiplier(uuid) returns numeric language sql as $$ select 1::numeric $$;
    create table season_rollover_settlements(source_season_id uuid);`);
  const base=read('20260726113000_add_exponential_rider_decline');
  for(const name of ['get_rider_season_decline_points','settle_due_training_sessions'])await db.exec(definition(base,name));
  for(const [file,name] of [
    ['20260721210000_create_training_management','get_rider_potential_overall_cap'],
    ['20260727090000_add_first_in_class_special_ability','get_rider_training_progress_multiplier'],
    ['20260918150000_add_intermediate_professional_training_rating_tiers','get_pro_training_rating_progress_factor'],
    ['20261009150000_extend_free_agent_careers_and_training','settle_due_free_agent_training'],
    ['20260824130000_recalibrate_youth_progression','complete_current_youth_training_attempt'],
    ['20260811130000_implement_atomic_season_rollover','rollover_game_season'],
  ])await db.exec(definition(read(file),name));
  await db.exec(read('20261011133000_enforce_training_potential_stat_caps'));
  await db.exec(read('20261011170000_preserve_training_decimals_between_seasons'));
  if(process.argv[3]){
    const captured=JSON.parse(readFileSync(process.argv[3],'utf8'));
    for(const row of captured.rows??captured)await db.exec(row.definition);
  }
  await db.exec(`create table career_achievement_epoch(activated_at timestamptz);
    insert into career_achievement_epoch values(now()-interval '20 days');
    create table career_achievement_receipts(source_key text primary key);
    create table career_achievement_progress(sporting_director_id uuid,metric_key text,subject_key text,value numeric,peak numeric,updated_at timestamptz,primary key(sporting_director_id,metric_key,subject_key));`);
  const career=read('20261015130000_prospective_career_achievements');
  for(const name of ['record_career_achievement','capture_career_training']){
    const start=career.indexOf('create function private.'+name+'(');
    await db.exec(career.slice(start,career.indexOf('$$;',start)+3));
  }
  if(process.argv[4]){
    const captured=JSON.parse(readFileSync(process.argv[4],'utf8'));
    for(const row of captured.rows??captured)await db.exec(row.definition);
  }
  await db.exec(`create trigger capture_prospective_training after insert or update of rating_changes on rider_training_sessions for each row execute function private.capture_career_training();`);
  const attrsBefore=(await attributes()).rows;
  const untouchedSignatures=['public.rollover_game_season(uuid,boolean)','public.complete_current_youth_training_attempt(uuid,integer)','public.get_rider_potential_stat_cap(integer)'];
  const untouched=await db.query('select signature,pg_get_functiondef(signature::regprocedure) definition from unnest($1::text[]) signature',[untouchedSignatures]);
  const functionsBefore=await db.query('select signature,pg_get_functiondef(signature::regprocedure) definition from unnest($1::text[]) signature',[signatures]);
  await db.exec(`update seasons set status='planned';
    insert into seasons values('${season}',4,'active',25),('${id(30)}',3,'completed',28);
    insert into season_days values('${day}','${season}',25,current_date-1);
    insert into riders(id,potential_steps,status) values('${rider}',8,'active');
    insert into rider_season_ratings(rider_id,season_id,age,${stats.join(',')}) values('${rider}','${season}',18,${stats.map(s=>s==='hills'?73:55).join(',')});
    insert into rider_training_stat_progress(rider_id,season_id,stat_code,initial_rating,balance_milli,total_training_milli,rating_gain,rating_loss)
      values('${rider}','${season}','hills',61,999,14410,12,0);
    insert into rider_training_sessions(id,rider_id,team_id,season_id,season_day_id,status,rating_changes,progress_milli,decline_milli)
      values('${session}','${rider}','${id(2)}','${season}','${day}','completed','{"acceleration":1,"sprint":1}','{"hills":398}','{}');`);
  // A changed audit baseline must abort BOTH the recovery and engine patches.
  await assert.rejects(db.exec(migration),/progression changed/);checks++;
  await db.exec('rollback;');
  for(const row of functionsBefore.rows)check(await scalar('select pg_get_functiondef($1::regprocedure) value',[row.signature]),row.definition,'failed recovery rolls back engine patch');
  await db.query('update rider_training_stat_progress set total_training_milli=14409 where rider_id=$1',[rider]);
  const otherStatsBefore=await one('select to_jsonb(r)-\'hills\'-\'updated_at\' other from rider_season_ratings r where rider_id=$1',[rider]);
  await db.exec(migration);
  check((await attributes()).rows,attrsBefore,'function privileges, security and settings unchanged');
  for(const row of untouched.rows)check(await scalar('select pg_get_functiondef($1::regprocedure) value',[row.signature]),row.definition,'unrelated routine unchanged: '+row.signature);
  check(await scalar('select hills value from rider_season_ratings where rider_id=$1',[rider]),75,'Iguchi recovers +2 VAL');
  check(await one('select balance_milli,rating_gain,total_training_milli from rider_training_stat_progress where rider_id=$1',[rider]),{balance_milli:409,rating_gain:14,total_training_milli:14409},'earned work preserved exactly');
  check(await one('select to_jsonb(r)-\'hills\'-\'updated_at\' other from rider_season_ratings r where rider_id=$1',[rider]),otherStatsBefore,'other twelve stats and age unchanged');
  check(await scalar('select rating_changes value from rider_training_sessions where id=$1',[session]),{acceleration:1,sprint:1,hills:2},'today report books recovery without losing existing changes');
  check(await scalar(`select value::integer from career_achievement_progress where subject_key=$1 and metric_key='future_natural_progress'`,[rider+':hills']),2,'career progress receives only recovered VAL delta');
  check(await scalar(`select value::integer from career_achievement_progress where subject_key=$1 and metric_key='future_natural_progress'`,[rider+':sprint']),1,'other career progress is not replayed');
  check(await scalar('select recovered_milli value from private.training_season_limit_recoveries'),1410,'receipt records discarded work');
  await db.exec(migration);
  check(await scalar('select count(*)::int value from private.training_season_limit_recoveries'),1,'repeat migration creates no duplicate');
  check(await scalar('select hills value from rider_season_ratings where rider_id=$1',[rider]),75,'repeat migration cannot replenish recovery');
  check(await scalar(`select value::integer from career_achievement_progress where subject_key=$1 and metric_key='future_natural_progress'`,[rider+':hills']),2,'career recovery is idempotent');
  check(await scalar(`select has_table_privilege('authenticated','private.training_season_limit_recoveries','select') value`),false,'recovery receipt is private');
  for(const signature of signatures){
    const body=await scalar('select pg_get_functiondef($1::regprocedure) value',[signature]);
    check(body.includes('v_gain_cap'),false,signature+': no annual guard remains');
    check(body.includes('unlimited_season_training_v1'),true,signature+': version marker');
  }
  const create=async(n,{status='active',age=20,potential=8,initial=61,current=73,gains=12,balance=1000,contract=id(n+1000)}={})=>{
    await db.query('insert into riders(id,potential_steps,status) values($1,$2,$3)',[id(n),potential,status]);
    await db.query(`insert into rider_season_ratings(rider_id,season_id,age,${stats.join(',')}) values($1,$2,$3,$4,${stats.slice(1).map(()=>40).join(',')})`,[id(n),season,age,current]);
    await db.query(`insert into rider_training_stat_progress(rider_id,season_id,stat_code,initial_rating,balance_milli,rating_gain) values($1,$2,'mountain',$3,$4,$5)`,[id(n),season,initial,balance,gains]);
    if(status==='active'){
      await db.query(`insert into rider_contracts(id,rider_id,team_id,status,start_season_id,end_season_id) values($1,$2,$3,'active',$4,$4)`,[contract,id(n),id(2),season]);
      await db.query(`insert into rider_training_plan_versions(rider_id,team_id,season_id,effective_from_day_number,intensity,domain) values($1,$2,$3,1,100,'climber')`,[id(n),id(2),season]);
    }
  };
  const cases=[{initial:59,current:77,gains:18},{initial:61,current:73,gains:12},
    {initial:70,current:78,gains:8},{initial:80,current:84,gains:4},{initial:90,current:92,gains:2}];
  for(let n=0;n<cases.length;n++){await create(100+n,cases[n]);await create(200+n,{...cases[n],status:'free_agent'});}
  for(const [n,options] of [[110,{potential:1,initial:60,current:69,gains:12,balance:5000}],
    [111,{potential:1,current:82}], [112,{current:99}],
    [113,{age:36,initial:73,current:72,gains:12,balance:5000}],
    [114,{age:40,initial:82,current:82,balance:-3000}],
    [115,{contract:id(99999)}]])await create(n,options);
  for(const [n,options] of [[210,{potential:1,initial:60,current:69,gains:12,balance:5000}],
    [211,{potential:1,current:82}],[212,{current:99}],
    [213,{age:36,initial:73,current:72,gains:12,balance:5000}],
    [214,{age:40,initial:82,current:82,balance:-3000}]])await create(n,{...options,status:'free_agent'});
  await db.query('select * from settle_due_training_sessions()');
  await db.query('select settle_due_free_agent_training(250)');
  for(let n=0;n<cases.length;n++)for(const k of [100,200])check(await scalar('select mountain value from rider_season_ratings where rider_id=$1',[id(k+n)]),cases[n].current+1,`rider ${k+n} passes former seasonal allowance`);
  check(await scalar('select mountain value from rider_season_ratings where rider_id=$1',[id(110)]),70,'potential cap preserved');
  check(await scalar('select mountain value from rider_season_ratings where rider_id=$1',[id(111)]),82,'existing item gains above potential preserved');
  check(await scalar('select mountain value from rider_season_ratings where rider_id=$1',[id(112)]),100,'absolute maximum preserved');
  check(await scalar('select mountain value from rider_season_ratings where rider_id=$1',[id(113)]),73,'veteran maintenance does not become unlimited growth');
  check((await scalar('select mountain value from rider_season_ratings where rider_id=$1',[id(114)]))<82,true,'natural decline remains');
  check(await scalar('select count(*)::int value from rider_training_sessions where rider_id=$1',[id(115)]),0,'contract eligibility guard preserved');
  for(const n of [210,211,212,213])check(await scalar('select mountain value from rider_season_ratings where rider_id=$1',[id(n)]),({210:70,211:82,212:100,213:73})[n],'free-agent potential, maximum or maintenance remains: '+n);
  check((await scalar('select mountain value from rider_season_ratings where rider_id=$1',[id(214)]))<82,true,'free-agent natural decline remains');
  const beforeRetry=await scalar('select jsonb_agg(to_jsonb(r) order by rider_id) value from rider_season_ratings r');
  await db.query('select * from settle_due_training_sessions()');await db.query('select settle_due_free_agent_training(250)');
  check(await scalar('select jsonb_agg(to_jsonb(r) order by rider_id) value from rider_season_ratings r'),beforeRetry,'same-day retries give no duplicate gains');
  // The real carry routine must convert a remainder even after +12.
  await create(300,{balance:600});
  await db.query(`insert into rider_training_stat_progress(rider_id,season_id,stat_code,initial_rating,balance_milli) values($1,$2,'mountain',61,700)`,[id(300),id(30)]);
  await db.query(`select private.apply_training_season_carryover($1,$2,'mountain')`,[id(300),season]);
  check(await scalar('select mountain value from rider_season_ratings where rider_id=$1',[id(300)]),74,'season carry progresses beyond +12');
  check(await scalar(`select balance_milli value from rider_training_stat_progress where rider_id=$1 and season_id=$2 and stat_code='mountain'`,[id(300),season]),300,'carry remainder retained');
  await db.query(`select private.apply_training_season_carryover($1,$2,'mountain')`,[id(300),season]);
  check(await scalar('select mountain value from rider_season_ratings where rider_id=$1',[id(300)]),74,'carry retry cannot duplicate points');
  console.log(JSON.stringify({isolatedPostgres:true,checks,liveDefinitions:Boolean(process.argv[3]),productionWrites:0}));
}finally{await db.close();}
