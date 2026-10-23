// Real PostgreSQL RLS regression, isolated WASM only. No network or credentials.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const modulePath=process.argv[2];
if(!modulePath||!/^(?:[A-Za-z]:[\\/]|\/)/.test(modulePath)||!modulePath.replaceAll('\\','/').endsWith('/pglite/dist/index.js'))throw Error('Absolute isolated PGlite module required');
const {PGlite}=await import(pathToFileURL(modulePath).href);
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
const scalar=async(sql,args=[])=>Object.values((await rows(sql,args))[0])[0];
let checks=0;
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const denied=async sql=>{await assert.rejects(()=>db.query(sql),error=>error.code==='42501');checks++;};
const auth=async(n,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[n===null?'':id(n)]);await db.exec(`set role ${role}`);};
try{
 await db.exec(`create schema auth;create role authenticated;create role anon;create role service_role bypassrls;
 grant usage on schema auth,public to authenticated,anon,service_role;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table public.sporting_directors(id uuid primary key,auth_user_id uuid,status text);
 create table public.team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
 create table public.direct_transfer_offers(id uuid primary key,rider_id uuid,offered_rider_id uuid,buyer_team_id uuid,seller_team_id uuid,status text);
 alter table public.sporting_directors enable row level security;
 alter table public.team_manager_assignments enable row level security;
 alter table public.direct_transfer_offers enable row level security;
 create policy sporting_directors_select_own on public.sporting_directors for select to authenticated using(auth.uid()=auth_user_id);
 grant select on public.sporting_directors to authenticated;
 insert into public.sporting_directors values('${id(1)}','${id(101)}','active'),('${id(2)}','${id(102)}','active'),('${id(3)}','${id(103)}','active'),('${id(4)}','${id(104)}','suspended'),('${id(5)}','${id(105)}','active');
 insert into public.team_manager_assignments values('${id(1)}','${id(11)}','general_manager','active'),('${id(2)}','${id(12)}','general_manager','active'),('${id(3)}','${id(13)}','general_manager','active'),('${id(4)}','${id(11)}','general_manager','active'),('${id(5)}','${id(12)}','general_manager','inactive');
 insert into public.direct_transfer_offers values('${id(21)}','${id(31)}',null,'${id(11)}','${id(12)}','pending'),('${id(22)}','${id(32)}','${id(33)}','${id(11)}','${id(12)}','accepted'),('${id(23)}','${id(34)}',null,'${id(13)}','${id(14)}','pending');`);
 const source=readFileSync('supabase/migrations/20260809140000_add_direct_transfer_offers_and_rider_dismissals.sql','utf8').replaceAll('\r\n','\n');
 const start=source.indexOf('create policy direct_transfer_offers_select_managed_teams');
 const end=source.indexOf('grant all privileges',start);
 await db.exec(source.slice(start,end));
 const youth=readFileSync('supabase/migrations/20260722090000_create_youth_development_center.sql','utf8').replaceAll('\r\n','\n');
 const helperStart=youth.indexOf('create or replace function public.current_user_manages_team(');
 const helperEnd=youth.indexOf('$$;',helperStart)+3;
 await db.exec(youth.slice(helperStart,helperEnd));
 await db.exec('revoke all on function public.current_user_manages_team(uuid) from public,anon;grant execute on function public.current_user_manages_team(uuid) to authenticated,service_role;');
 const before=await rows('select * from public.direct_transfer_offers order by id');
 const helperBefore=await scalar("select md5(replace(pg_get_functiondef('public.current_user_manages_team(uuid)'::regprocedure),chr(13),''))");
 for(const n of [101,102]){await auth(n);await denied(`select rider_id,offered_rider_id from public.direct_transfer_offers where id='${id(21)}'`);}
 await db.exec('reset role');
 await db.exec(readFileSync('supabase/migrations/20261023093000_fix_direct_offer_participant_read_policy.sql','utf8'));
 check(await scalar("select has_table_privilege('authenticated','public.team_manager_assignments','select')"),false);
 check(await scalar("select md5(replace(pg_get_functiondef('public.current_user_manages_team(uuid)'::regprocedure),chr(13),''))"),helperBefore);
 check(await rows('select * from public.direct_transfer_offers order by id'),before);
 for(const n of [101,102]){
   await auth(n);
   check(await rows(`select rider_id,offered_rider_id from public.direct_transfer_offers where id='${id(21)}'`),[{rider_id:id(31),offered_rider_id:null}]);
   check((await rows('select id from public.direct_transfer_offers order by id')).map(row=>row.id),[id(21),id(22)]);
   check((await rows(`select offered_rider_id from public.direct_transfer_offers where id='${id(22)}'`))[0].offered_rider_id,id(33));
   check(await rows(`select id from public.direct_transfer_offers where id='${id(23)}'`),[]);
   await denied('select * from public.team_manager_assignments');
   await denied(`update public.direct_transfer_offers set status='accepted' where id='${id(21)}'`);
   await denied(`delete from public.direct_transfer_offers where id='${id(21)}'`);
 }
 for(const n of [103,104,105,null]){
   await auth(n);check(await rows(`select id from public.direct_transfer_offers where id='${id(21)}'`),[]);
 }
 await auth(null,'anon');await denied('select * from public.direct_transfer_offers');
 await db.exec('reset role');
 check(await rows('select * from public.direct_transfer_offers order by id'),before);
 check(await scalar("select polcmd::text from pg_policy where polname='direct_transfer_offers_select_managed_teams'"),'r');
 check(await scalar("select relrowsecurity from pg_class where oid='public.direct_transfer_offers'::regclass"),true);
 console.log(JSON.stringify({isolatedPostgres:'passed',checks,reproducedOriginalFailure:true,productionWrites:0}));
}finally{await db.close();}
