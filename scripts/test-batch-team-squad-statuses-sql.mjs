// Isolated PostgreSQL/WASM only. No production connection or credentials.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
const modulePath=process.argv[2]??'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js';
if(!isAbsolute(modulePath)||!modulePath.replaceAll('\\','/').endsWith('/@electric-sql/pglite/dist/index.js'))throw Error('An absolute isolated PGlite module is required.');
const {PGlite}=await import(pathToFileURL(modulePath).href),db=new PGlite();
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const read=async name=>(await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8')).replaceAll('\r\n','\n');
const table=(sql,name)=>{const result=sql.match(new RegExp(`create table public\\.${name} \\([\\s\\S]*?\\n\\);`));assert.ok(result,name);return result[0];};
const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
const scalar=async(sql,args=[])=>Object.values((await rows(sql,args))[0])[0];
const batch=updates=>scalar('select public.set_current_team_rider_squad_statuses($1)',[updates]);
const edit=(riderId,squadStatus,expectedStatus)=>({riderId,squadStatus,expectedStatus});
const admin=()=>db.exec('reset role');
const login=async account=>{await admin();await db.query("select set_config('request.jwt.claim.sub',$1,false)",[account??'']);await db.exec('set role authenticated');};
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const rejects=async(fn,pattern,label)=>{await assert.rejects(fn,pattern,label);checks++;};
const owner=id(1),account=id(2),team=id(3),season=id(4),other=id(5),otherAccount=id(6),otherTeam=id(7),assistant=id(8),assistantAccount=id(9);
const r1=id(100),r2=id(101),r3=id(102),alien=id(103),inactive=id(104);
const state=()=>rows('select rider_id,squad_status from rider_contracts order by rider_id');
try{
  await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role bypassrls;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table countries(id uuid primary key);create table seasons(id uuid primary key);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table riders(id uuid primary key);
  `);
  const teamsSql=await read('20260714195812_create_team_core_tables');
  await db.exec(table(teamsSql,'teams'));await db.exec(table(teamsSql,'team_manager_assignments'));
  await db.exec(table(await read('20260714202027_create_rider_core_tables'),'rider_contracts'));
  await db.exec("create unique index rider_contracts_one_active_per_rider_idx on rider_contracts(rider_id) where status='active';");
  const old=await read('20260925133000_add_team_squad_statuses');
  await db.exec(old.slice(old.indexOf('alter table public.rider_contracts'),old.indexOf('alter function public.get_current_team_roster_with_potential()')));
  const before=await scalar("select pg_get_functiondef('public.set_current_team_rider_squad_status(uuid,text)'::regprocedure)");
  await db.exec(await read('20261105180000_batch_team_squad_statuses'));
  eq(await scalar("select pg_get_functiondef('public.set_current_team_rider_squad_status(uuid,text)'::regprocedure)"),before,'profile-page single-rider RPC unchanged');
  await db.query('insert into countries values($1)',[id(20)]);await db.query('insert into seasons values($1)',[season]);
  await db.query("insert into teams(id,home_country_id,founded_season_id,internal_name) values($1,$3,$4,'Owner'),($2,$3,$4,'Other')",[team,otherTeam,id(20),season]);
  await db.query("insert into sporting_directors values($1,$2,'active'),($3,$4,'active'),($5,$6,'active')",[owner,account,other,otherAccount,assistant,assistantAccount]);
  await db.query("insert into team_manager_assignments(sporting_director_id,team_id,start_season_id,role,status) values($1,$2,$5,'general_manager','active'),($3,$4,$5,'general_manager','active'),($6,$2,$5,'assistant_manager','active')",[owner,team,other,otherTeam,season,assistant]);
  for(const [rider,club,status,role]of [[r1,team,'active',null],[r2,team,'active','co_leader'],[r3,team,'active','road_captain'],[alien,otherTeam,'active',null],[inactive,team,'completed',null]]){
    await db.query('insert into riders values($1)',[rider]);
    await db.query('insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,squad_status) values($1,$2,$3,$3,$4,$5)',[rider,club,season,status,role]);
  }
  await db.exec('set role anon');await rejects(()=>batch([edit(r1,'free_role',null)]),/permission denied/,'anonymous RPC denied');
  await login(null);await rejects(()=>batch([edit(r1,'free_role',null)]),/Authentification/,'missing user identity denied');
  await login(account);
  const invalid=[null,{},[],Array.from({length:201},()=>edit(r1,null,null)),[3],[{riderId:r1,squadStatus:null}],[{...edit(r1,null,null),teamId:team}],
    [edit('not-a-uuid',null,null)],[edit(r1,'race_leader',null)],[edit(r1,null,'unknown')],[edit(r1,3,null)]];
  for(const payload of invalid)await assert.rejects(()=>batch(payload),/invalide|entre 1 et 200/);checks++;
  await rejects(()=>batch([edit(r1,null,null),edit(r1.toUpperCase(),'prospect',null)]),/qu’une fois/,'UUID-normalized duplicate riders denied');
  await login(assistantAccount);await rejects(()=>batch([edit(r1,'prospect',null)]),/Aucune équipe active/,'assistant is not an owning general manager');
  await login(account);await admin();await db.query("update sporting_directors set status='inactive' where id=$1",[owner]);await login(account);
  await rejects(()=>batch([edit(r1,'prospect',null)]),/Aucune équipe active/,'inactive director denied');
  await admin();await db.query("update sporting_directors set status='active' where id=$1",[owner]);await db.query("update teams set status='inactive' where id=$1",[team]);await login(account);
  await rejects(()=>batch([edit(r1,'prospect',null)]),/Aucune équipe active/,'inactive team denied');
  await admin();await db.query("update teams set status='active' where id=$1",[team]);const original=await state();await login(account);
  await rejects(()=>batch([edit(r1,'free_role',null),edit(alien,'prospect',null)]),/Seul le DS/,'alien rider rejects the entire batch');
  await rejects(()=>batch([edit(r1,'free_role',null),edit(inactive,'prospect',null)]),/Seul le DS/,'ended contract rejects the entire batch');
  await admin();eq(await state(),original,'failed ownership checks changed no valid rider');await login(account);
  const updates=[edit(r3,'stage_hunter','road_captain'),edit(r1,'absolute_leader',null),edit(r2,null,'co_leader')];
  eq(await batch(updates),3,'one mixed nullable/enum batch updates every owned rider');
  eq(await batch(updates),0,'lost-response replay is an idempotent no-op');
  await admin();const saved=await state();await login(account);
  await rejects(()=>batch([edit(r1,'free_role','absolute_leader'),edit(r2,'lieutenant','prospect')]),/ont changé/,'one stale baseline rejects the whole batch');
  await admin();eq(await state(),saved,'optimistic conflict preserves all rows');await login(account);
  await scalar('select set_current_team_rider_squad_status($1,$2)',[r1,'free_role']);
  await rejects(()=>batch([edit(r1,'co_leader','absolute_leader')]),/ont changé/,'concurrent profile-page change is not overwritten');
  eq(await batch([edit(r1,'free_role','absolute_leader'),edit(r2,'domestique',null)]),1,'already-applied row can share a batch with a new valid edit');
  await admin();const beforeTrigger=await state();await db.exec(`create function isolated_fail_squad_batch() returns trigger language plpgsql as $$begin if new.rider_id='${r2}'::uuid then raise exception 'isolated squad write failure';end if;return new;end$$;
    create trigger isolated_fail_squad_batch before update of squad_status on rider_contracts for each row execute function isolated_fail_squad_batch();`);await login(account);
  await assert.rejects(()=>batch([edit(r1,'prospect','free_role'),edit(r2,'lieutenant','domestique')]),/isolated squad/);await admin();assert.deepEqual(await state(),beforeTrigger);checks++;
  await db.exec('drop trigger isolated_fail_squad_batch on rider_contracts;drop function isolated_fail_squad_batch();');
  const bounded=[];for(let n=0;n<200;n++){
    const rider=id(1000+n);await db.query('insert into riders values($1)',[rider]);await db.query("insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status) values($1,$2,$3,$3,'active')",[rider,team,season]);bounded.push(edit(rider,'bottle_carrier',null));
  }
  const contractCount=await scalar('select count(*)::int from rider_contracts');await login(account);eq(await batch(bounded),200,'maximum bounded batch succeeds');await admin();assert.equal(await scalar('select count(*)::int from rider_contracts'),contractCount);
  await login(account);await rejects(()=>db.exec("update rider_contracts set squad_status='prospect'"),/permission denied/,'players receive no raw contract write permission');
  console.log(JSON.stringify({isolatedBatchChecks:checks,productionAccess:false,atomic:true,optimisticBaselines:true,maxBatch:200,legacyRpcPreserved:true}));
}finally{await db.close();}
