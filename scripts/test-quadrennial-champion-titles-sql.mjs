// Isolated PostgreSQL-in-WASM regression checks. Never connects to Supabase.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = name => { const s=createHash('md5').update(name).digest('hex'); return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`; };
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const rows=async(sql,args=[]) => (await db.query(sql,args)).rows;
async function event(year,registered=true){
 await db.query('insert into seasons values($1,$2)',[id('season'+year),year]);
 for(const discipline of ['road','time_trial']){
  const key=`${year}-${discipline}`;
  await db.query("insert into races values($1,'nations_cup')",[id('race'+key)]);
  await db.query('insert into race_editions values($1,$2,$3)',[id(key),id('race'+key),id('season'+year)]);
 }
 if(registered)await db.query('insert into national_federation_olympic_events values($1,$2,$3)',[id('season'+year),id(`${year}-road`),id(`${year}-time_trial`)]);
}
async function result(key,rider='a',rank=1,status='classified'){
 const roster=id('roster'+key+rider);
 await db.query('insert into race_rosters values($1,$2) on conflict do nothing',[roster,id(rider)]);
 await db.query('insert into race_results values($1,$2,$3,$4,$5,now())',[id('result'+key+rider),id(key),roster,status,rank]);
}
const active=async(type='quadrennial_road')=>(await rows('select rider_id from rider_national_championship_titles where championship_type=$1 and relinquished_at is null',[type])).map(r=>r.rider_id);
try {
 await db.exec(`create schema private;create role anon;create role authenticated;create role service_role;
 create table countries(id uuid primary key);
 create table riders(id uuid primary key,country_id uuid not null);
 create table seasons(id uuid primary key,game_year int);
 create table races(id uuid primary key,competition_type text);
 create table race_editions(id uuid primary key,race_id uuid,season_id uuid);
 create table national_federation_olympic_events(season_id uuid primary key,race_edition_id uuid unique,time_trial_race_edition_id uuid unique);
 create table race_rosters(id uuid primary key,rider_id uuid);
 create table race_results(id uuid primary key,race_edition_id uuid,race_roster_id uuid,status text,final_rank int,updated_at timestamptz);
 create table rider_national_championship_titles(id uuid primary key default gen_random_uuid(),rider_id uuid,country_id uuid,season_id uuid,race_edition_id uuid,
 championship_type text,won_at timestamptz,relinquished_at timestamptz,constraint rider_national_titles_edition_type_unique unique(race_edition_id,championship_type),
 constraint rider_national_titles_type_allowed check(championship_type in ('road','time_trial','world_road','world_time_trial')));
 create unique index rider_national_titles_one_active_per_country_type_idx on rider_national_championship_titles(country_id,championship_type) where relinquished_at is null;`);
 await db.query('insert into countries values($1)',[id('country')]);
 for(const name of ['a','b','c'])await db.query('insert into riders values($1,$2)',[id(name),id('country')]);
 await event(4);await event(8);await event(5);await event(12,false);
 await result('4-road');
 await db.query("insert into rider_national_championship_titles(rider_id,country_id,season_id,race_edition_id,championship_type,won_at) values($1,$2,$3,$4,'world_road',now())",[id('b'),id('country'),id('season4'),id('4-road')]);
 const source=await readFile('supabase/migrations/20261022120000_quadrennial_champion_jerseys.sql','utf8');
 await db.exec(source);
 eq(await active(),[id('a')],'Backfills an existing official winner');
 eq(await active('world_road'),[id('b')],'World title is preserved');
 await result('12-road','b');eq(await active(),[id('a')],'Unregistered cup cannot award Games title');
 await result('5-road','b');eq(await active(),[id('a')],'Non-quadrennial season cannot award Games title');
 await result('4-time_trial','c');eq(await active('quadrennial_time_trial'),[id('c')],'Independent TT champion');
 await db.query('update race_results set final_rank=1,updated_at=now() where id=$1',[id('result4-roada')]);
 eq((await rows("select id from rider_national_championship_titles where championship_type='quadrennial_road'")).length,1,'Repeated settlement is idempotent');
 await result('8-road','b');eq(await active(),[id('b')],'New Games replace road holder');
 eq(await active('quadrennial_time_trial'),[id('c')],'Road turnover does not change TT');
 eq((await rows("select id from rider_national_championship_titles where championship_type='quadrennial_road' and relinquished_at is not null")).length,1,'Previous title remains in history');
 await db.query("update race_results set final_rank=1,updated_at=now()+interval '5 years' where id=$1",[id('result4-roada')]);
 eq(await active(),[id('b')],'Old replay cannot dethrone a newer season');
 await db.query("update race_results set status='disqualified' where id=$1",[id('result8-roadb')]);
 eq(await active(),[id('a')],'Invalidated champion loses jersey, previous champion restored');
 await result('8-road','c',2);await db.query('update race_results set final_rank=1 where id=$1',[id('result8-roadc')]);
 eq(await active(),[id('c')],'Corrected winner receives Games title');
 await result('8-road','a');eq(await active(),[id('a')],'Ambiguous new edition does not award title; old holder restored');
 eq((await rows("select id from rider_national_championship_titles where championship_type='quadrennial_road' and race_edition_id=$1",[id('8-road')])).length,0,'Ambiguous result has no champion');
 await db.query('delete from race_results where id=$1',[id('result8-roada')]);eq(await active(),[id('c')],'Removing erroneous duplicate restores valid winner');
 await db.query('delete from race_results where id=$1',[id('result8-roadc')]);eq(await active(),[id('a')],'Removing current result restores prior valid champion');
 await db.query("update race_results set status='did_not_start' where id=$1",[id('result4-roada')]);eq(await active(),[],'No classified winner means no road jersey');
 eq(await active('quadrennial_time_trial'),[id('c')],'TT title survives road deletion');
 eq(await active('world_road'),[id('b')],'Other title types remain unchanged throughout');
 const triggers=await rows("select tgname,pg_get_triggerdef(oid) as definition from pg_trigger where tgrelid='race_results'::regclass and not tgisinternal");
 eq(triggers.length,3,'Only three narrowly gated winner triggers');
 eq(triggers.every(t=>t.definition.includes('WHEN')),true,'Non-winning rows never call the synchronization');
 for(const role of ['anon','authenticated'])eq((await rows(`select has_function_privilege('${role}','private.sync_quadrennial_championship_title(uuid)','execute') as allowed`))[0].allowed,false,role+' cannot grant a title');
 console.log(`${checks} isolated PostgreSQL checks passed.`);
} finally { await db.close(); }
