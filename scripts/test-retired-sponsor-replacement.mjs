import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const old='9d979cd0-3321-423f-b3c4-b6102d443598',next='60edea22-3dc0-4511-9509-3ba647b4f903';
const objective='e1ef99d9-208c-4854-8385-142bf7273d73',team='27948dd4-0dac-416d-8f6c-118771bcb6eb';
const season='00000000-0000-4000-8000-000000000004',country='00000000-0000-4000-8000-000000000001';
let assertions=0;
const check=(a,b)=>{assert.deepEqual(a,b);assertions++;};
const rows=async sql=>(await db.query(sql)).rows;
const migration=await readFile(new URL('../supabase/migrations/20261016200000_replace_sevrinovitch_retired_sponsor_target.sql',import.meta.url),'utf8');
try {
  await db.exec(`create table seasons(id uuid,game_year int,status text);
    create table countries(id uuid,iso_alpha2 text,is_active boolean);
    create table riders(id uuid,country_id uuid,status text);
    create table rider_contracts(rider_id uuid,status text);
    create table rider_season_ratings(rider_id uuid,season_id uuid,mountain int,hills int,flat int,time_trial int,cobbles int,sprint int,acceleration int,downhill int,endurance int,resistance int,recovery int,breakaway int,prologue int);
    create table team_sponsor_contracts(id uuid,sponsor_offer_id uuid,start_season_id uuid,team_id uuid,status text);
    create table sponsor_objectives(id uuid,sponsor_offer_id uuid,season_id uuid,objective_type text,status text,target_details jsonb,name text,description text,updated_at timestamptz,satisfaction_points int,evaluation_timing text);
    create table objective_progress(sponsor_objective_id uuid,team_sponsor_contract_id uuid,season_id uuid,status text,current_value numeric,achieved_at timestamptz,last_evaluated_at timestamptz,details jsonb,updated_at timestamptz);
    insert into seasons values('${season}',4,'active');insert into countries values('${country}','RW',true);
    insert into riders values('${old}','${country}','retired'),('${next}','${country}','free_agent');
    insert into rider_season_ratings values('${next}','${season}',57,47,51,70,55,62,55,49,60,42,45,48,59);
    insert into team_sponsor_contracts values('${team}','${team}','${season}','${team}','active');
    insert into sponsor_objectives values('${objective}','${team}','${season}','rider_recruitment','active',
      '{"riderId":"${old}","riderName":"Idris Okello","accessibilityMaximumOverall":72,"kind":"rider_recruitment"}','Recruter Idris Okello','old',now(),12,'season_end');
    insert into objective_progress values('${objective}','${team}','${season}','in_progress',0,null,now(),'{"satisfactionPoints":12}',now());`);
  // Availability changes must abort the entire migration, not silently choose
  // a different country, recruit the rider or modify a completed objective.
  for(const [change,restore,pattern] of [
    [`update riders set status='retired' where id='${next}'`,`update riders set status='free_agent' where id='${next}'`,/free Rwandan/],
    [`insert into rider_contracts values('${next}','planned')`,`delete from rider_contracts`,/free Rwandan/],
    [`update objective_progress set status='achieved',current_value=1`,`update objective_progress set status='in_progress',current_value=0`,/achieved progress/],
  ]) {
    await db.exec(change);await assert.rejects(db.exec(migration),pattern);assertions++;
    await db.exec('rollback');await db.exec(restore);
    check((await rows(`select target_details->>'riderId' id from sponsor_objectives`))[0].id,old);
  }
  await db.exec(migration);
  check((await rows('select name,satisfaction_points,evaluation_timing,target_details from sponsor_objectives'))[0],{
    name:'Recruter Awet Khaled',satisfaction_points:12,evaluation_timing:'season_end',target_details:{
      riderId:next,riderName:'Awet Khaled',accessibilityMaximumOverall:72,kind:'rider_recruitment',countryCode:'RW',sportingProfile:'Rouleur',overallRating:53.85,replacedRetiredRiderId:old}});
  const progress=(await rows('select * from objective_progress'))[0];
  check(progress.current_value,'0');check(progress.status,'in_progress');check(progress.details.targetRiderId,next);
  check(progress.details.retiredTargetReplacement.previousTarget.riderId,old);
  check((await rows('select * from rider_contracts')).length,0);
  await db.exec(migration);
  check((await rows('select * from objective_progress'))[0],progress);
  console.log(JSON.stringify({isolated:true,assertions,pointsPreserved:true,availabilityGuard:true,idempotent:true}));
}finally{await db.close();}
