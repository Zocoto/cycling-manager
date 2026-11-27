// Isolated PostgreSQL/WASM checks. Never connects to Supabase or the network.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath=process.argv[2]??'';
if(!isAbsolute(modulePath)||!modulePath.replaceAll('\\','/').endsWith('/@electric-sql/pglite/dist/index.js'))throw Error('Pass an installed local PGlite module path.');
const {PGlite}=await import(pathToFileURL(modulePath).href);
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const migration=await readFile(new URL('../supabase/migrations/20261127181000_guard_secondary_sponsor_jersey_season.sql',import.meta.url),'utf8');
const previous=(await readFile(new URL('../supabase/migrations/20261127130000_rebalance_secondary_sponsor_objectives.sql',import.meta.url),'utf8')).replaceAll('\r\n','\n');
const legacyStart=previous.indexOf('create or replace function public.update_secondary_sponsor_logo(\n  p_contract_id uuid,p_x_percent numeric,p_y_percent numeric,p_scale numeric,p_rotation_degrees numeric\n)');
assert(legacyStart>=0,'Missing existing five-argument compatibility function');
const legacyWrapper=previous.slice(legacyStart,previous.indexOf('$$;',legacyStart)+3);
let assertions=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);assertions++;};
const rows=async sql=>(await db.query(sql)).rows;
const snapshot=()=>rows('select * from public.secondary_sponsor_contracts order by id');
const save=(contract=id(30),color='white')=>db.query('select public.update_secondary_sponsor_logo($1,52,47,1.2,-3,$2)',[contract,color]);
async function rejectSave(label,contract=id(30)){
  const before=await snapshot();
  await assert.rejects(save(contract),/placement ne peut pas être modifié/);assertions++;
  eq(await snapshot(),before,label+' preserves all placements');
}
try{
  await db.exec(`
    create schema auth; create role anon; create role authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
    create table public.seasons(id uuid primary key,game_year int,status text);
    create table public.sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table public.team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text);
    create table public.team_sponsor_contracts(id uuid primary key,team_id uuid,role text,status text,start_season_id uuid,end_season_id uuid,contract_duration_seasons int,selected_jersey_id text,pending_jersey_id text,pending_jersey_season_id uuid);
    create table public.secondary_sponsor_contracts(id uuid primary key,team_id uuid,season_id uuid,status text,logo_x_percent numeric,logo_y_percent numeric,logo_scale numeric,logo_rotation_degrees numeric,logo_color_mode text);
    insert into public.seasons values('${id(5)}',5,'active'),('${id(6)}',6,'planned'),('${id(7)}',7,'planned'),('${id(4)}',4,'completed');
    insert into public.sporting_directors values('${id(1)}','${id(2)}','active');
    insert into public.team_manager_assignments values('${id(3)}','${id(1)}','general_manager','active');
    insert into public.team_sponsor_contracts values('${id(20)}','${id(3)}','principal','active','${id(5)}',null,2,'current-jersey','next-jersey','${id(6)}');
    insert into public.secondary_sponsor_contracts values
      ('${id(30)}','${id(3)}','${id(6)}','planned',50,48,1,0,'original'),
      ('${id(31)}','${id(3)}','${id(5)}','active',50,48,1,0,'original'),
      ('${id(32)}','${id(3)}','${id(4)}','completed',50,48,1,0,'original'),
      ('${id(33)}','${id(3)}','${id(7)}','planned',50,48,1,0,'original');
    select set_config('test.user','${id(2)}',false);
  `);
  await db.exec(migration);
  await db.exec(legacyWrapper);
  const principalBefore=await rows('select * from public.team_sponsor_contracts order by id');
  await save();
  eq((await rows(`select logo_color_mode from public.secondary_sponsor_contracts where id='${id(30)}'`))[0].logo_color_mode,'white','next season placement saved');
  eq((await rows(`select logo_color_mode from public.secondary_sponsor_contracts where id='${id(31)}'`))[0].logo_color_mode,'original','current season unchanged');
  eq(await rows('select * from public.team_sponsor_contracts order by id'),principalBefore,'principal jerseys untouched');
  await save(id(31),'black');
  eq((await rows(`select logo_color_mode from public.secondary_sponsor_contracts where id='${id(31)}'`))[0].logo_color_mode,'black','current placement remains editable on current jersey');
  await db.exec(`update public.team_sponsor_contracts set pending_jersey_season_id=null`);
  await rejectSave('missing future choice');
  await assert.rejects(db.query('select public.update_secondary_sponsor_logo($1,52,47,1.2,-3)',[id(30)]),/placement ne peut pas être modifié/);assertions++;
  await db.exec(`update public.team_sponsor_contracts set pending_jersey_season_id='${id(7)}'`);
  await rejectSave('wrong pending season');
  await db.exec(`update public.team_sponsor_contracts set pending_jersey_season_id='${id(6)}',pending_jersey_id=null`);
  await rejectSave('missing pending jersey');
  await db.exec(`update public.team_sponsor_contracts set pending_jersey_id='next-jersey',contract_duration_seasons=1`);
  await rejectSave('expired inferred contract');
  await db.exec(`update public.team_sponsor_contracts set contract_duration_seasons=2,end_season_id='${id(5)}'`);
  await rejectSave('explicit end prevents future placement');
  await db.exec(`update public.team_sponsor_contracts set end_season_id=null`);
  await rejectSave('two seasons away',id(33));
  await rejectSave('completed secondary',id(32));
  await db.exec(`insert into public.team_sponsor_contracts values('${id(21)}','${id(3)}','principal','planned','${id(6)}',null,1,null,null,null)`);
  await rejectSave('new signed principal without chosen jersey takes precedence');
  await db.exec(`update public.team_sponsor_contracts set selected_jersey_id='new-jersey' where id='${id(21)}'`);
  await save();assertions++;
  await db.query('select public.update_secondary_sponsor_logo($1,52,47,1.2,-3)',[id(30)]);assertions++;
  await db.exec(`select set_config('test.user','${id(99)}',false)`);
  await rejectSave('other player');
  await db.exec(`select set_config('test.user','',false)`);
  await rejectSave('unauthenticated');
  await db.exec(`select set_config('test.user','${id(2)}',false);update public.sporting_directors set status='suspended'`);
  await rejectSave('suspended manager');
  await db.exec(`update public.sporting_directors set status='active'`);
  await assert.rejects(db.query('select public.update_secondary_sponsor_logo($1,52,47,1.2,-3,$2)',[id(30),'red']),/hors des limites/);assertions++;
  eq((await rows("select has_function_privilege('anon','public.update_secondary_sponsor_logo(uuid,numeric,numeric,numeric,numeric,text)','execute') allowed"))[0].allowed,false,'anonymous cannot execute');
  eq((await rows("select has_function_privilege('authenticated','public.update_secondary_sponsor_logo(uuid,numeric,numeric,numeric,numeric,text)','execute') allowed"))[0].allowed,true,'authenticated can execute');
  console.log(JSON.stringify({isolated:true,assertions,productionRequests:0}));
}finally{await db.close();}
