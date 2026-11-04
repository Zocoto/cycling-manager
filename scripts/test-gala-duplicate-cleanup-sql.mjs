// Isolated PostgreSQL only. Never run these fixtures against the live project.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const sql=readFileSync('supabase/migrations/20261104193037_remove_babacar_sow_stale_gala_entry.sql','utf8');
const rider='9ae5e40f-1503-4537-9469-5232529db373',oldTeam='a81d26fc-5b1f-4267-8c60-073d53389733',newTeam='69b20e97-b88b-4c8c-b98b-b0fd28939913';
const oldReg='3e040827-121d-4447-84ac-fea828f17e29',newReg='00000000-0000-4000-8000-000000000002',season='c0c5824c-43a4-442e-907c-265c479efa0a';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let checks=0;const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const rows=async(sql,args=[]) => (await db.query(sql,args)).rows;
const state=()=>rows('select * from season_gala_registration_riders order by registration_id,profile,position');
const rejected=async(pattern)=>{await assert.rejects(()=>db.exec(sql),pattern);await db.exec('rollback');checks++;};
try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create table seasons(id uuid primary key,game_year int);
    create table teams(id uuid primary key);
    create table riders(id uuid primary key);
    create table rider_contracts(rider_id uuid,team_id uuid,status text);
    create table pcm_gala_events(id uuid);
    create table season_gala_result_imports(season_id uuid,event_key text);
    create table team_finance_transactions(amount numeric);
    insert into team_finance_transactions values(123456);`);
  await db.exec(readFileSync('supabase/migrations/20261022220000_prepare_private_season_gala_startlists.sql','utf8'));
  await db.query('insert into seasons values($1,4)',[season]);
  await db.query('insert into teams values($1),($2)',[oldTeam,newTeam]);
  await db.query('insert into riders values($1)',[rider]);
  for(let n=100;n<120;n++)await db.query('insert into riders values($1)',[id(n)]);
  await db.query('insert into rider_contracts values($1,$2,\'active\')',[rider,newTeam]);
  await db.query(`insert into season_gala_registrations(id,season_id,team_id,program) values($1,$2,$3,'continental'),($4,$2,$5,'continental')`,[oldReg,season,oldTeam,newReg,newTeam]);
  await db.query(`insert into season_gala_registration_riders values($1,'mountain',$2,3)`,[oldReg,rider]);
  for(let p=1;p<=8;p++)if(p!==3)await db.query(`insert into season_gala_registration_riders values($1,'mountain',$2,$3)`,[oldReg,id(100+p),p]);
  for(const profile of ['hills','sprint']){
    await db.query('insert into season_gala_registration_riders values($1,$2,$3,1)',[newReg,profile,rider]);
    for(let p=2;p<=8;p++)await db.query('insert into season_gala_registration_riders values($1,$2,$3,$4)',[newReg,profile,id(110+p),p]);
  }
  const initial=await state();
  const registrations=await rows('select * from season_gala_registrations order by id');
  await db.exec(sql);
  const expected=initial.filter(row=>!(row.registration_id===oldReg&&row.rider_id===rider)).map(row=>({...row,
    position:row.registration_id===oldReg&&row.position>3?row.position-1:row.position}));
  check(await state(),expected,'only the obsolete entry is removed; survivor order and other profiles preserved');
  check((await state()).filter(r=>r.registration_id===oldReg).map(r=>r.position),[1,2,3,4,5,6,7],'seven contiguous positions');
  check((await state()).filter(r=>r.rider_id===rider).length,2,'current club keeps the rider in both its selected courses');
  check(await rows('select * from season_gala_registrations order by id'),registrations,'programme registrations unchanged');
  check((await rows('select amount from team_finance_transactions'))[0].amount,'123456','finances untouched');
  await db.exec(sql);check(await state(),expected,'retry cannot reintroduce a duplicate');
  const restore=async()=>{
    await db.exec('delete from season_gala_registration_riders');
    for(const row of initial)await db.query('insert into season_gala_registration_riders values($1,$2,$3,$4)',[row.registration_id,row.profile,row.rider_id,row.position]);
  };
  await restore();await db.query('update rider_contracts set team_id=$1 where rider_id=$2',[oldTeam,rider]);
  await rejected(/club actuel/);check(await state(),initial,'ownership drift aborts without deleting the valid club');
  await db.query('update rider_contracts set team_id=$1 where rider_id=$2',[newTeam,rider]);
  await db.query(`delete from season_gala_registration_riders where registration_id=$1 and position=8`,[oldReg]);
  const partial=await state();await rejected(/sept coureurs/);check(await state(),partial,'no incomplete lineup silently produced');
  await restore();await db.query(`delete from season_gala_registration_riders where registration_id=$1 and rider_id=$2`,[newReg,rider]);
  const missing=await state();await rejected(/club actuel doit/);check(await state(),missing,'current-club entry is required before any removal');
  await restore();await db.query(`insert into season_gala_result_imports values($1,'continental:mountain')`,[season]);
  await rejected(/déjà été importés/);check(await state(),initial,'settled results are never changed');
  console.log(`${checks} gala duplicate cleanup checks passed in isolated PostgreSQL.`);
}finally{await db.close();}
