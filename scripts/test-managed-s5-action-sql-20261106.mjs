// Isolated SQL stubs only: never uses credentials, network or the live project.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {managedS5BatchSql,managedS5ActionBatches,nativeActionCall,MANAGED_S5_SEASON} from './lib/managed-s5-action-sql-20261106.mjs';
assert.ok(process.argv[2]?.replaceAll('\\','/').endsWith('/pglite/dist/index.js'));
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const team={bot_key:'antoine_morel_29',season_id:MANAGED_S5_SEASON,team_id:id(1),team_season_id:id(2),director_id:id(3),auth_user_id:id(4)};
const action=n=>({key:'recruit:'+id(n),bot_key:team.bot_key,rpc:'sign_current_team_free_agent',args:{p_rider_id:id(n)},min_cash:15000,min_projected:25000,max_cash_cost:0,max_salary:150});
let checks=0;
const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const value=async sql=>(await db.query(sql)).rows[0]?.value;
try{
  assert.throws(()=>nativeActionCall({...action(10),rpc:'rollover_game_season'}),/not authorized/);checks++;
  assert.throws(()=>nativeActionCall({...action(10),args:{p_rider_id:"';delete from teams;--"}}));checks++;
  assert.throws(()=>nativeActionCall({...action(10),args:{p_rider_id:id(10),team_id:id(99)}}),/mismatch/);checks++;
  assert.throws(()=>managedS5BatchSql([action(10),{...action(11),bot_key:'giulia_rinaldi'}],[team]));checks++;
  assert.throws(()=>managedS5BatchSql(Array.from({length:5},(_,n)=>action(n+10)),[team]));checks++;
  assert.throws(()=>managedS5BatchSql([{...action(10),bot_key:'human_account'}],[team]));checks++;
  check(managedS5BatchSql([{...action(10),key:'recruit:S5:'+id(10)}],[team]).includes('recruit:S5:'),true,'season labels in reviewed action keys are accepted');
  const mixed=[action(10),{...action(11),bot_key:'giulia_rinaldi'},action(12),{...action(13),bot_key:'giulia_rinaldi'}];
  check(managedS5ActionBatches(mixed).map(batch=>batch.map(a=>a.key)),[[action(10).key,action(12).key],[action(11).key,action(13).key]],'alternating teams are grouped without changing either team order');
  check(managedS5ActionBatches(Array.from({length:5},(_,n)=>action(n+10))).map(a=>a.length),[2,2,1],'recruitment remains limited to two native calls per transaction');
  const standard=Array.from({length:9},(_,n)=>({...action(n+10),rpc:'save_current_team_race_roster'}));
  check(managedS5ActionBatches(standard).map(a=>a.length),[4,4,1],'other native calls remain limited to four');
  await db.exec(`
    create function public.clock_timestamp() returns timestamptz language sql as $$select '2026-11-06T12:00:00Z'::timestamptz$$;
    set search_path=public,pg_catalog;
    create table seasons(id uuid primary key,game_year int,status text,current_day_number int);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table alpha_bot_managers(id uuid primary key,bot_key text,team_id uuid,sporting_director_id uuid,auth_user_id uuid,enabled bool,automation_season_id uuid,automation_end_day_number int);
    create table team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,cash_balance numeric);
    create table team_finance_transactions(id uuid default gen_random_uuid(),team_season_id uuid,amount numeric,status text);
    create table alpha_bot_cycles(id uuid primary key default gen_random_uuid(),manager_id uuid,cycle_key text,slot text,status text,attempt_count int,actions jsonb,started_at timestamptz,completed_at timestamptz,unique(manager_id,cycle_key));
    create table riders(id uuid primary key,status text);
    create table rider_contracts(id uuid default gen_random_uuid(),rider_id uuid,team_id uuid,status text,salary_per_season numeric,end_season_id uuid);
    create table transfer_market_listings(rider_id uuid,status text);
    create table season_draft_editions(id uuid primary key,status text,pool_reserved_at timestamptz);
    create table season_draft_riders(edition_id uuid,rider_id uuid);
    insert into seasons values('${MANAGED_S5_SEASON}',5,'active',1),('${id(6)}',6,'planned',1);
    insert into sporting_directors values('${team.director_id}','${team.auth_user_id}','active');
    insert into alpha_bot_managers values('${id(5)}','${team.bot_key}','${team.team_id}','${team.director_id}','${team.auth_user_id}',false,null,null);
    insert into team_manager_assignments values('${team.team_id}','${team.director_id}','general_manager','active');
    insert into team_seasons values('${team.team_season_id}','${team.team_id}','${MANAGED_S5_SEASON}',100000);
    insert into riders select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'free_agent' from generate_series(10,20)n;
    create function sign_current_team_free_agent(p_rider_id uuid) returns uuid language plpgsql as $$
      declare v_id uuid;
      begin
        if current_setting('request.jwt.claim.sub')<>'${team.auth_user_id}' then raise exception 'Wrong user';end if;
        insert into rider_contracts(rider_id,team_id,status,salary_per_season,end_season_id) values(p_rider_id,'${team.team_id}','active',100,'${id(6)}') returning id into v_id;
        update riders set status='active' where id=p_rider_id;
        insert into team_finance_transactions(team_season_id,amount,status) values('${team.team_season_id}',-100,'pending');
        return v_id;
      end;
    $$;
  `);
  await db.exec(managedS5BatchSql([action(10)],[team]));
  check(await value('select count(*)::int value from rider_contracts'),1,'real action creates one contract');
  check(await value('select count(*)::int value from alpha_bot_cycles'),1,'action and receipt commit together');
  await db.exec(managedS5BatchSql([action(10)],[team]));
  check(await value('select count(*)::int value from rider_contracts'),1,'replay never recruits twice');
  check(await value('select count(*)::int value from team_finance_transactions'),1,'replay never duplicates salaries');
  const fails=async(sql,pattern)=>{await assert.rejects(()=>db.exec(sql),pattern);await db.exec('rollback;');checks++;};
  await fails(managedS5BatchSql([action(11),{...action(12),max_salary:90}],[team]),/salary exceeded/);
  check(await value('select count(*)::int value from rider_contracts'),1,'failed second action rolls the first action back');
  check(await value('select count(*)::int value from alpha_bot_cycles'),1,'failed batch leaves no committed receipts');
  await db.exec(`insert into season_draft_editions values('${id(100)}','preparing',now());insert into season_draft_riders values('${id(100)}','${id(13)}');`);
  await fails(managedS5BatchSql([action(13)],[team]),/eligibility changed/);
  check(await value(`select status value from riders where id='${id(13)}'`),'free_agent','reserved rider stays untouched');
  await fails(managedS5BatchSql([{...action(14),min_projected:100000}],[team]),/projection\/cost limit/);
  check(await value(`select count(*)::int value from rider_contracts where rider_id='${id(14)}'`),0,'unaffordable action is atomic');
  await db.exec(`create function save_current_rider_training_plans_v2(p_plans jsonb) returns jsonb language sql as $$
    select jsonb_build_object('effective_day',2,'results',jsonb_build_array(jsonb_build_object('status',p_plans->0->>'test_status')))$$;`);
  const training={key:'training:all',bot_key:team.bot_key,rpc:'save_current_rider_training_plans_v2',args:{p_plans:[{rider_id:id(10),test_status:'saved'}]},max_cash_cost:0};
  await db.exec(managedS5BatchSql([training],[team]));checks++;
  await fails(managedS5BatchSql([{...training,args:{p_plans:[{rider_id:id(11),test_status:'saved'}]}}],[team]),/Receipt payload changed/);
  await fails(managedS5BatchSql([{...training,key:'training:error',args:{p_plans:[{test_status:'error'}]}}],[team]),/Training returned/);
  check(await value("select count(*)::int value from alpha_bot_cycles where cycle_key like '%training:error'"),0,'partial training errors never receive a completed receipt');
  await db.exec('update alpha_bot_managers set enabled=true');
  await fails(managedS5BatchSql([action(15)],[team]),/scope or season changed/);
  await db.exec('update alpha_bot_managers set enabled=false;update seasons set current_day_number=2 where status=\'active\'');
  await fails(managedS5BatchSql([action(16)],[team]),/scope or season changed/);
  check(await value('select count(*)::int value from rider_contracts'),1,'scope failures never mutate gameplay');
  console.log(JSON.stringify({checks,isolated:true,productionTouched:false}));
}catch(error){console.error(JSON.stringify({checks,message:error.message,where:error.where,detail:error.detail,stack:error.name==='AssertionError'?error.stack:undefined}));process.exitCode=1;}
finally{await db.close();}
