// Isolated PostgreSQL only. No network or production configuration is loaded.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite }=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const read=name=>readFileSync(`supabase/migrations/${name}.sql`,'utf8').replaceAll('\r','');
const source=read('20260927233500_reapply_persistent_rider_morale');
const def=name=>{
  const start=source.indexOf(`create or replace function public.${name}(`);
  assert(start>=0,name);return source.slice(start,source.indexOf('$$;',start)+3);
};
let checks=0;
try{
  await db.exec(`
    create schema private;create role anon;create role authenticated;create role service_role;
    create table seasons(id uuid primary key,game_year integer,status text,current_day_number integer);
    create table season_days(id uuid primary key,season_id uuid,day_number integer,unique(season_id,day_number));
    create table riders(id uuid primary key);
    create table rider_season_ratings(rider_id uuid,season_id uuid,primary key(rider_id,season_id));
    create table race_editions(id uuid primary key,season_id uuid);
    create table stages(id uuid primary key,race_edition_id uuid,season_day_id uuid);
    create table race_rosters(id uuid primary key,rider_id uuid);
    create table stage_results(id uuid primary key default gen_random_uuid(),stage_id uuid,race_roster_id uuid,status text,rank integer,unique(stage_id,race_roster_id));
    create table rider_condition_states(id uuid primary key default gen_random_uuid(),rider_id uuid,season_day_id uuid,form numeric default 75,fatigue integer default 0,morale numeric default 60,source text,updated_at timestamptz default now(),unique(rider_id,season_day_id),check(morale between 0 and 100));
    create table rider_morale_events(id uuid primary key default gen_random_uuid(),rider_id uuid,season_day_id uuid,source_type text,source_reference text,requested_delta numeric,applied_delta numeric,morale_before numeric,morale_after numeric,description text,metadata jsonb,occurred_at timestamptz default now(),unique(rider_id,source_type,source_reference),
      constraint rider_morale_events_source_allowed check(source_type in('social_integration','team_tenure','stage_result','race_result','favorite_race','injury','training_overload','mixed_zone_interview','academy_promotion','manual_adjustment')));
  `);
  await db.exec(def('apply_rider_morale_event'));
  await db.exec(`revoke all on function public.apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb) from public,anon,authenticated; grant execute on function public.apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb) to service_role;`);
  const acl=(await db.query(`select proacl::text acl from pg_proc where oid='public.apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb)'::regprocedure`)).rows[0].acl;
  await db.exec(read('20261102150000_add_season_race_load_morale'));
  await db.exec(`
    insert into seasons values('${id(4)}',4,'completed',28),('${id(5)}',5,'active',25),('${id(6)}',6,'planned',1);
    insert into riders values('${id(1)}'),('${id(2)}');
    insert into race_rosters values('${id(10)}','${id(1)}'),('${id(11)}','${id(2)}');
    insert into rider_season_ratings(rider_id,season_id) select r.id,s.id from riders r cross join seasons s;
    insert into season_days select ('00000000-0000-4000-8000-'||lpad((s.game_year*100+n)::text,12,'0'))::uuid,s.id,n from seasons s cross join generate_series(1,28) n;
    insert into race_editions select ('00000000-0000-4000-8000-'||lpad((s.game_year*1000)::text,12,'0'))::uuid,s.id from seasons s;
    insert into stages select ('00000000-0000-4000-8000-'||lpad((s.game_year*10000+n)::text,12,'0'))::uuid,e.id,
      ('00000000-0000-4000-8000-'||lpad((s.game_year*100+(n+1)/2)::text,12,'0'))::uuid
      from seasons s join race_editions e on e.season_id=s.id cross join generate_series(1,45) n;
    insert into rider_condition_states(rider_id,season_day_id,morale) values('${id(1)}','${id(525)}',60),('${id(2)}','${id(525)}',60);
  `);
  const insert=async(from,to,year=5,status='finished',roster=10)=>db.query(`insert into stage_results(stage_id,race_roster_id,status,rank)
    select ('00000000-0000-4000-8000-'||lpad(($3*10000+n)::text,12,'0'))::uuid,$4,$5,20 from generate_series($1::integer,$2::integer)n order by n`,[from,to,year,id(roster),status]);
  const snap=async(rider=1,year=5)=> (await db.query(`select r.season_race_days days,r.race_load_morale_debit debit,
    (select morale from rider_condition_states where rider_id=r.rider_id and season_day_id=$3) morale,
    (select count(*)::integer from rider_morale_events where rider_id=r.rider_id and source_type='race_load') events
    from rider_season_ratings r where rider_id=$1 and season_id=$2`,[id(rider),id(year),id(year===5?525:601)])).rows[0];
  const check=async(days,morale,debit)=>{
    const row=await snap(); assert.equal(row.days,days);assert.equal(Number(row.morale),morale);assert.equal(Number(row.debit),debit);checks+=3;return row;
  };
  // Exact threshold and a second stage on the same calendar day.
  await insert(1,30);let row=await check(30,60,0);assert.equal(row.events,0);checks++;
  await insert(31,31);await check(31,59,1);
  await insert(32,32);row=await check(32,58,2);assert.equal(row.events,2);checks++;
  // Result upserts and ordinary re-rankings do not count a second start.
  await db.exec(`insert into stage_results(stage_id,race_roster_id,status,rank) values('${id(50031)}','${id(10)}','finished',1) on conflict(stage_id,race_roster_id) do update set rank=excluded.rank,status=excluded.status;`);
  row=await check(32,58,2);assert.equal(row.events,2);checks++;
  // A DNS correction refunds the actual loss; OTL and DNF still count starts.
  await db.exec(`update stage_results set status='did_not_start' where stage_id='${id(50032)}';`);await check(31,59,1);
  await db.exec(`update stage_results set status='outside_time_limit' where stage_id='${id(50032)}';`);await check(32,58,2);
  const before=await snap();await db.exec(`update stage_results set status='abandoned' where stage_id='${id(50032)}';`);assert.deepEqual(await snap(),before);checks++;
  await insert(33,45);await check(45,45,15);
  // Official replay: deleting/reinserting identical sporting results is neutral.
  await db.exec(`delete from stage_results where race_roster_id='${id(10)}';`);await check(0,60,0);
  await insert(1,45);await check(45,45,15);
  // S4 and DNS never count toward the S5 threshold or alter its morale.
  await insert(1,40,4);assert.equal((await snap(1,4)).days,0);await check(45,45,15);checks++;
  await insert(1,45,5,'did_not_start',11);assert.equal((await snap(2)).days,0);assert.equal(Number((await snap(2)).morale),60);checks+=2;
  // Transferring a rider/registration cannot reset the rider-season counter.
  await db.exec(`insert into race_rosters values('${id(12)}','${id(1)}');update stage_results set race_roster_id='${id(12)}' where stage_id='${id(50045)}' and race_roster_id='${id(10)}';`);await check(45,45,15);
  await db.exec(`update rider_condition_states set morale=100 where rider_id='${id(1)}' and season_day_id='${id(525)}';update stage_results set race_roster_id='${id(10)}' where stage_id='${id(50045)}' and race_roster_id='${id(12)}';`);await check(45,100,15);
  // No free morale can be manufactured by deleting a penalty clipped at zero.
  await db.exec(`delete from stage_results where stage_id in ('${id(50044)}','${id(50045)}') and race_roster_id in ('${id(10)}','${id(12)}');update rider_condition_states set morale=0 where rider_id='${id(1)}' and season_day_id='${id(525)}';`);
  await insert(44,44);row=await snap();const clippedDebit=Number(row.debit);assert.equal(Number(row.morale),0);checks++;
  // Clear other recorded debit first to isolate the fully clipped case.
  await db.exec(`delete from stage_results where race_roster_id='${id(10)}';update rider_condition_states set morale=0 where rider_id='${id(1)}' and season_day_id='${id(525)}';`);
  await insert(1,31);await check(31,0,0);
  await db.exec(`delete from stage_results where stage_id='${id(50031)}' and race_roster_id='${id(10)}';`);await check(30,0,0);
  assert(clippedDebit>=0);checks++;
  // A new season starts at zero and old-season corrections cannot alter it.
  await db.exec(`update seasons set status='completed' where id='${id(5)}';update seasons set status='active' where id='${id(6)}';insert into rider_condition_states(rider_id,season_day_id,morale) values('${id(1)}','${id(601)}',75);`);
  await db.exec(`delete from stage_results where stage_id='${id(50030)}' and race_roster_id='${id(10)}';`);
  assert.equal((await snap(1,6)).days,0);assert.equal(Number((await snap(1,6)).morale),75);checks+=2;
  await insert(1,31,6);assert.equal((await snap(1,6)).days,31);assert.equal(Number((await snap(1,6)).morale),74);checks+=2;
  // Missing archived ratings do not block result persistence.
  await db.exec(`delete from rider_season_ratings where rider_id='${id(2)}' and season_id='${id(6)}';`);await insert(1,1,6,'finished',11);checks++;
  assert.equal((await db.query(`select proacl::text acl from pg_proc where oid='public.apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb)'::regprocedure`)).rows[0].acl,acl);checks++;
  for(const fn of ['private.adjust_rider_season_race_load(uuid,uuid,uuid,integer)','private.sync_season_race_load_from_stage_result()']){
    assert.equal((await db.query('select has_function_privilege($1,$2,\'execute\') allowed',['authenticated',fn])).rows[0].allowed,false);checks++;
  }
  console.log(`PASS ${checks} isolated SQL assertions: S5 threshold, stages, retries, DNS/DNF/OTL, replay/refunds, clipping, transfers, rollover, missing archives and privileges.`);
}catch(error){console.error('FAIL:',error.message,error.where??'');process.exitCode=1;}
finally{await db.close();}
