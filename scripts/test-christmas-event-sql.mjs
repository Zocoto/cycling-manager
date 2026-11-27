import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]??'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js').href);
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let checks=0,request=10000;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const scalar=async(sql,params=[])=>Object.values((await db.query(sql,params)).rows[0])[0];
const number=async(sql,params=[])=>Number(await scalar(sql,params));
async function rejects(fn,pattern){await assert.rejects(fn,pattern);checks++;}
async function clock(at){await db.query('update private.test_time set at=$1::timestamptz',[at]);}
async function action(user,kind,payload={},req=id(request++)){return scalar('select christmas_action($1,$2,$3,$4::jsonb)',[id(user),req,kind,JSON.stringify(payload)]);}
async function state(user){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(user)]);return scalar('select get_current_christmas_state()');}
const balance=user=>number("select coins from christmas_wallets where user_id=$1",[id(user)]);
const stock=(user,item)=>number("select coalesce((inventory->>$2)::int,0) from christmas_wallets where user_id=$1",[id(user),item]);
const proof={verified:true,version:1};
const finish=(user,run,score=1100,qualities={successful:3,super:1,perfect:1})=>action(user,'finish',{runId:run.id,score,deliveries:Object.values(qualities).reduce((a,b)=>a+b,0),qualities,proof});
try{
await db.exec(`set timezone='UTC';create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
create table auth.users(id uuid primary key);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table private.test_time(at timestamptz);insert into private.test_time values('2026-11-27 12:00Z');create function private.test_now()returns timestamptz language sql stable as $$select at from private.test_time$$;
create table sporting_directors(id uuid primary key,auth_user_id uuid,status text,display_name text,username text);
create table teams(id uuid primary key,status text);create table team_manager_assignments(team_id uuid,sporting_director_id uuid,status text,role text);
create table riders(id uuid primary key,first_name text,last_name text,status text);create table rider_contracts(team_id uuid,rider_id uuid,status text);
`);
for(let n=1;n<=65;n++){
 await db.query('insert into auth.users values($1)',[id(n)]);
 await db.query("insert into sporting_directors values($1,$2,'active',$3,$3)",[id(100+n),id(n),'DS'+n]);
 await db.query("insert into teams values($1,'active')",[id(200+n)]);
 await db.query("insert into team_manager_assignments values($1,$2,'active','general_manager')",[id(200+n),id(100+n)]);
}
const source=readFileSync(new URL('../supabase/migrations/20261127190000_create_christmas_event.sql',import.meta.url),'utf8');
await db.exec(source.replaceAll('clock_timestamp()','private.test_now()'));
await db.exec(`create table private.deliveries(user_id uuid,source text,item_id text,quantity int,unique(user_id,source));
create function private.christmas_deliver_reward(p_user uuid,p_source text,p_item text,p_quantity int)returns void language plpgsql as $$begin
 insert into private.deliveries values(p_user,p_source,p_item,p_quantity)on conflict do nothing;
 update public.christmas_wallets set inventory=jsonb_set(inventory,array[p_item],to_jsonb(coalesce((inventory->>p_item)::int,0)+p_quantity))where edition_id='christmas-2026'and user_id=p_user;
end$$;
create function private.christmas_use_item(p_user uuid,p_item text,p_payload jsonb)returns jsonb language plpgsql as $$begin return jsonb_build_object('message','used');end$$;`);
const catalogue=JSON.parse(readFileSync(new URL('../data/christmas-2026-catalog.json',import.meta.url),'utf8'));
for(const item of catalogue.items)await db.query('insert into christmas_catalog(id,name,category,slot,price,max_obtained,source,effect)values($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',[item.id,item.name,item.category,item.slot??null,item.price??null,item.category==='portrait'?1:null,item.source??null,JSON.stringify(item.delivery??{})]);
for(let n=0;n<catalogue.advent.length;n++){const gift=catalogue.advent[n];await db.query('insert into christmas_advent(day,title,description,coins,item_id)values($1,$2,$3,$4,$5)',[n+1,gift.title,gift.description,gift.kind==='grelots'?gift.amount:0,gift.itemId??null]);}
for(const tier of catalogue.milestones)await db.query('insert into christmas_milestones values($1,$2,$3,$4::jsonb)',[tier.goal,tier.name,tier.grelots,JSON.stringify(tier.items)]);
for(const prize of [{from:1,to:1,item:'cuissard-quatre-saisons'},{from:2,to:3,item:'cadre-traineau-renne'},{from:4,to:6,item:'bonnet-course-noel'},{from:7,to:10,item:'gants-dernier-relais'}]){
 await db.query("insert into christmas_catalog(id,name,category,source)values($1,$1,'equipment','contribution')on conflict do nothing",[prize.item]);await db.query('insert into christmas_contributor_prizes values($1,$2,$3)',[prize.from,prize.to,prize.item]);
}
check((await db.query("select starts_at::text,ends_at::text,enabled from christmas_editions")).rows,[{starts_at:'2026-11-30 23:00:00+00',ends_at:'2026-12-31 23:00:00+00',enabled:true}],'Edition armed on Paris midnight boundaries');
check(await number("select count(*)from pg_class where relname like 'christmas_%'and relkind='r'and relrowsecurity"),13,'All event tables have RLS');
check(await scalar("select has_function_privilege('authenticated','public.christmas_action(uuid,uuid,text,jsonb)','execute')"),false,'Clients cannot choose trusted results');
check(await scalar("select has_function_privilege('service_role','public.christmas_action(uuid,uuid,text,jsonb)','execute')"),true,'Trusted authenticated endpoint can act');
check(await scalar("select has_function_privilege('authenticated','public.claim_christmas_run_validation(uuid,uuid)','execute')"),false,'Clients cannot reserve trusted physics validation');
check(await scalar("select has_function_privilege('service_role','public.claim_christmas_run_validation(uuid,uuid)','execute')"),true,'Endpoint can reserve a validation attempt');
await db.exec('set role authenticated');
await rejects(()=>db.query('select christmas_action($1,$2,$3,$4::jsonb)',[id(1),id(9900),'join','{}']),/permission denied/);
await rejects(()=>db.query('select coins from public.christmas_wallets'),/permission denied/);
await db.exec('reset role');
await clock('2026-11-30 22:59:59Z');await rejects(()=>action(1,'join'),/pas encore ouvert/);check((await state(1)).state,'scheduled','Pre-open state');check(await number('select count(*)from christmas_wallets'),0,'Read-only pre-open state creates no wallet');
await clock('2026-11-30 23:00:00Z');check((await state(1)).state,'open','Opens at exactly midnight in Paris');check(await number('select count(*)from christmas_wallets'),0,'Reading open state still does not enroll');
const joinId=id(request++);await action(1,'join',{},joinId);await action(1,'join',{},joinId);check(await balance(1),0,'No pilot/demo starting currency');await rejects(()=>action(1,'join',{different:true},joinId),/autrement/);
await action(1,'advent',{day:1});check(await balance(1),35,'First Advent gift has real 35-coin reward');await action(1,'advent',{day:1});check(await balance(1),35,'Advent retries cannot duplicate reward');await rejects(()=>action(1,'advent',{day:2}),/pas encore disponible/);
await rejects(()=>action(1,'buy',{item:'lueurs-velodrome'}),/Grelots insuffisants/);check(await balance(1),35,'Failed purchase is atomic');
await db.query("select private.christmas_credit($1,'fixture-funds',1000)",[id(1)]);
const buyId=id(request++);await action(1,'buy',{item:'lueurs-velodrome'},buyId);await action(1,'buy',{item:'lueurs-velodrome'},buyId);check(await balance(1),965,'Idempotent purchase debits once');check(await stock(1,'lueurs-velodrome'),1,'Cosmetic delivered once');await rejects(()=>action(1,'buy',{item:'lueurs-velodrome'}),/déjà obtenu/);
await action(1,'equip',{slot:'fond',item:'lueurs-velodrome'});check((await state(1)).equipped.fond,'lueurs-velodrome','Owned cosmetic is equipped');await rejects(()=>action(1,'equip',{slot:'chapeau',item:'bonnet-relais'}),/possédez/);
await action(1,'buy',{item:'lunette-sniper-cadeaux'});await action(1,'prepare',{item:'lunette-sniper-cadeaux',prepared:true});check(await stock(1,'lunette-sniper-cadeaux'),1,'Preparing scope does not consume it');
const startId=id(request++);let run=(await action(1,'start',{},startId)).run;check(run.sniper,true,'Owned preparation enables scope');check(await stock(1,'lunette-sniper-cadeaux'),0,'Scope is consumed at start');check((await action(1,'start',{},startId)).run.id,run.id,'Repeated request preserves run');check((await action(1,'start')).run.id,run.id,'Parallel start reuses running session without spending another item');
await action(1,'abandon',{runId:run.id});check(await stock(1,'lunette-sniper-cadeaux'),0,'Abandon does not refund consumed scope');await rejects(()=>finish(1,run),/expirée/);
run=(await action(1,'start')).run;const beforeFree=await balance(1);
for(const invalid of [
 {runId:run.id,deliveries:0,qualities:{successful:0,super:0,perfect:0},proof},
 {runId:run.id,score:null,deliveries:0,qualities:{successful:0,super:0,perfect:0},proof},
 {runId:run.id,score:0,deliveries:0,qualities:{successful:0,super:0,perfect:0},proof:null},
 {runId:run.id,score:0,deliveries:1,qualities:{successful:0,super:0,perfect:0},proof},
 {runId:run.id,score:0,deliveries:0,qualities:{successful:0,super:0,perfect:0,forged:1},proof},
])await rejects(()=>action(1,'finish',invalid),/incomplet|invalide/);
check(await balance(1),beforeFree,'Malformed trusted results cannot credit currency');
check(await scalar('select status from christmas_runs where id=$1',[run.id]),'running','Malformed finish never consumes the live run');
const free=await finish(1,run);check(free.grelots,18,'Validated score yields fixed grelots formula');check(free.lights,8,'Lights derive only from throw quality');check(await balance(1),beforeFree+18,'Free run credited');await finish(1,run);check(await balance(1),beforeFree+18,'Run settlement remains idempotent with a new request ID');check(await number('select total_lights from christmas_editions'),8,'Community total atomically increments');check(await number('select participants from christmas_editions'),1,'Positive contributor counted once');
run=(await action(1,'start')).run;check(run.practice,true,'Further un-ticketed runs are practice');const practiceBefore=await balance(1);check((await finish(1,run)).grelots,0,'Practice has no currency reward');check(await balance(1),practiceBefore,'Practice balance unchanged');check(await number('select total_lights from christmas_editions'),8,'Practice cannot farm tree lights');
await action(1,'buy',{item:'grelot-repechage'});await action(1,'prepare',{item:'grelot-repechage',prepared:true});check(await stock(1,'grelot-repechage'),1,'Second tour reserved without consuming');run=(await action(1,'start')).run;check(run.retry,true,'Ticket produces rewarded extra run');check(run.practice,false,'Extra run is not practice');check(await stock(1,'grelot-repechage'),0,'One ticket consumed once');const beforeRetry=await balance(1);const retry=await finish(1,run,0,{successful:1,super:0,perfect:0});check(retry.grelots,8,'Worse paid run still earns its whole reward');check(await balance(1),beforeRetry+8,'Paid rewards add rather than replace daily best');check(await number('select total_lights from christmas_editions'),9,'Paid run lights add to community');
await action(2,'join');await rejects(()=>action(2,'tree',{goal:500}),/Contribuez/);await db.exec('update christmas_editions set total_lights=500');await action(1,'tree',{goal:500});const treeCoins=await balance(1);await action(1,'tree',{goal:500});check(await balance(1),treeCoins,'Tree claims cannot duplicate coins');
await clock('2026-12-09 23:00:00Z');await action(1,'advent',{day:2});check((await state(1)).opened,[1,2],'Past Advent windows can be recovered');await rejects(()=>action(1,'advent',{day:11}),/pas encore disponible/);
await action(64,'join');const validationRun=(await action(64,'start')).run;
await rejects(()=>db.query('select claim_christmas_run_validation($1,$2)',[validationRun.id,id(63)]),/indisponible/);
await db.query('select claim_christmas_run_validation($1,$2)',[validationRun.id,id(64)]);
await rejects(()=>db.query('select claim_christmas_run_validation($1,$2)',[validationRun.id,id(64)]),/deux secondes/);
check(await number('select validation_attempts from christmas_runs where id=$1',[validationRun.id]),1,'Rejected cooldown attempt does not increment or duplicate reservation');
for(let n=1;n<20;n++){await clock(`2026-12-09 23:00:${String(n*2).padStart(2,'0')}Z`);await db.query('select claim_christmas_run_validation($1,$2)',[validationRun.id,id(64)]);}
await clock('2026-12-09 23:00:40Z');await rejects(()=>db.query('select claim_christmas_run_validation($1,$2)',[validationRun.id,id(64)]),/Trop de tentatives/);
check(await number('select validation_attempts from christmas_runs where id=$1',[validationRun.id]),20,'Failed proofs cannot trigger an unbounded number of VM replays');
await action(64,'abandon',{runId:validationRun.id});await rejects(()=>db.query('select claim_christmas_run_validation($1,$2)',[validationRun.id,id(64)]),/indisponible/);
await clock('2026-12-24 23:00:00Z');await action(1,'advent',{day:24});check(await stock(1,'avent-cadre-givre'),1,'Advent final exclusive cosmetic is real');await rejects(()=>action(1,'advent',{day:25}),/pas encore disponible/);
await clock('2026-12-31 22:59:40Z');run=(await action(2,'start')).run;await clock('2026-12-31 23:00:10Z');await rejects(()=>action(2,'buy',{item:'grelot-repechage'}),/terminées/);await rejects(()=>action(2,'start'),/terminées/);await finish(2,run,1100,{successful:3,super:1,perfect:1});check((await state(2)).personalLights,8,'Started run can finish during short post-close grace');await action(1,'equip',{slot:'fond',item:'none'});check((await state(1)).equipped.fond,undefined,'Owned cosmetics remain editable after closing');
check((await scalar('select settle_christmas_event()')).closed,true,'No premature final settlement before grace expires');
await clock('2026-12-31 23:05:01Z');await rejects(()=>finish(2,run),/expirée/);
for(let user=3;user<=60;user++)await db.query("insert into christmas_wallets(edition_id,user_id,personal_lights)values('christmas-2026',$1,8)",[id(user)]);
await db.exec("update christmas_editions set total_lights=28000,participants=60");
check((await scalar('select settle_christmas_event()')).snapshotFrozen,true,'Cron freezes final ranks after grace');
const batch1=await scalar('select settle_christmas_event()');check(batch1.processed,50,'Settlement is bounded to fifty participants');check(batch1.finalSettled,false,'Remaining participants retained for recovery');const batch2=await scalar('select settle_christmas_event()');check(batch2.processed,10,'Recovery handles only remaining participants');check(batch2.finalSettled,true,'Final settlement marks edition complete');
check(await number("select count(*)from christmas_tree_claims"),60*9,'All earned community tiers delivered even when not claimed before close');check(await stock(1,'cuissard-quatre-saisons'),1,'First contributor earns its exclusive equipment');check(await stock(2,'cadre-traineau-renne'),1,'Equal scores receive equal contributor rank and reward');check(await stock(60,'cadre-traineau-renne'),1,'Prize ties are not silently truncated at ten rows');
const deliveries=await number('select count(*)from private.deliveries');check((await scalar('select settle_christmas_event()')).processed,0,'Repeated cron is complete no-op');check(await number('select count(*)from private.deliveries'),deliveries,'Cron retry never duplicates items');
await db.query("insert into christmas_wallets(edition_id,user_id)values('christmas-2026',$1)",[id(65)]);
await db.query("insert into christmas_runs(edition_id,user_id,day,seed,practice,retry,sniper,started_at,expires_at,status,score,deliveries,coins,lights)select 'christmas-2026',$1,'2026-12-01',1,false,true,false,'2026-11-30 23:00Z'::timestamptz+n*interval'1 minute','2026-12-01 03:00Z','finished',n,0,1,0 from generate_series(1,25)n",[id(65)]);
const historyState=await state(65);check(historyState.runs['1'].count,25,'Run totals retain all completed paid runs');check(historyState.runs['1'].score,325,'Daily score aggregate remains exact beyond history cap');check(historyState.runs['1'].history.length,20,'State detail is bounded to twenty recent runs per day');check(historyState.runs['1'].history[0].score,6,'Bounded history keeps newest runs in chronological order');
console.log(`Christmas event SQL checks passed (${checks} assertions).`);
}catch(error){console.error('Christmas SQL test failed:',error.message,error.where??'',error.detail??'');process.exitCode=1;}
finally{await db.close();}
