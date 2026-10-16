// Synthetic data in isolated PostgreSQL only. Never connects to Supabase.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const base=readFileSync('supabase/migrations/20260812170000_expand_modern_feature_objectives.sql','utf8');
const extract=name=>{const start=base.indexOf(`create or replace function public.${name}(`);assert.ok(start>=0);return base.slice(start,base.indexOf('$$;',start)+3);};
const source=extract('calculate_game_objective_progress').replace('public.calculate_game_objective_progress(','public.calculate_game_objective_progress_pre_recruitment_rewards(');
const helper=extract('was_rider_contracted_by_team_in_season');
const migration=readFileSync('supabase/migrations/20261016173000_inline_objective_title_contract_filter.sql','utf8');
const metrics=['team_national_championship_titles','team_national_championship_disciplines','team_continental_championship_titles','team_world_championship_titles','team_championship_title_countries','team_championship_crown_types'];
let checks=0;
try {
 await db.exec(`create table seasons(id uuid primary key,game_year integer);
 create table rider_contracts(rider_id uuid,team_id uuid,start_season_id uuid,end_season_id uuid,status text);
 create index contracts_team_rider on rider_contracts(team_id,rider_id);
 create table rider_national_championship_titles(rider_id uuid,country_id uuid,season_id uuid,championship_type text);
 create function calculate_game_objective_progress_pre_modern_pool(text,uuid,uuid,numeric) returns integer language sql stable as $$select 17$$;
 insert into seasons values('${id(1)}',3),('${id(2)}',4),('${id(3)}',5);
 `);
 await db.exec(helper);await db.exec(source);
 for(const [n,status,start,end] of [[10,'active',1,2],[11,'completed',1,2],[12,'terminated',1,2],[13,'planned',1,2],[14,'active',3,3],[15,'active',1,1]]) {
  await db.query('insert into rider_contracts values($1,$2,$3,$4,$5)',[id(n),id(100),id(start),id(end),status]);
  for(const kind of ['road','time_trial','continental_eu_road','continental_eu_time_trial','world_road','world_time_trial'])
   await db.query('insert into rider_national_championship_titles values($1,$2,$3,$4)',[id(n),id(n%2?201:202),id(2),kind]);
 }
 // Duplicate historical contracts must not duplicate a title; multiple teams
 // and exact season endpoints must preserve the original EXISTS semantics.
 await db.exec(`insert into rider_contracts values('${id(10)}','${id(100)}','${id(2)}','${id(3)}','completed'),('${id(11)}','${id(101)}','${id(1)}','${id(3)}','active');`);
 const get=async team=>{const out=[];for(const metric of metrics)out.push((await db.query('select public.calculate_game_objective_progress_pre_recruitment_rewards($1,$2,$3,0) value',[metric,id(999),team])).rows[0].value);return out;};
 const before=await get(id(100)),otherBefore=await get(id(101)),noneBefore=await get(id(102));
 assert.deepEqual(before,[6,2,6,6,2,6]);checks++;
 await db.exec(migration);
 for(const [team,expected] of [[id(100),before],[id(101),otherBefore],[id(102),noneBefore],[null,noneBefore]]) {assert.deepEqual(await get(team),expected);checks++;}
 assert.equal((await db.query("select public.calculate_game_objective_progress_pre_recruitment_rewards('unrelated',$1,$2,0) value",[id(999),id(100)])).rows[0].value,17);checks++;
 await db.exec(migration);assert.deepEqual(await get(id(100)),before);checks++;
 // If this expensive scalar helper were called after the patch, fail. This
 // proves the six calculations no longer fan out into per-title function calls.
 await db.exec(`create or replace function public.was_rider_contracted_by_team_in_season(p_rider_id uuid,p_team_id uuid,p_game_year integer) returns boolean language plpgsql stable as $$begin raise exception 'Unnecessary scalar helper executed';end$$;`);
 assert.deepEqual(await get(id(100)),before);checks++;
 console.log(JSON.stringify({isolated:true,checks,metrics:metrics.length,perTitleScalarCallsAfter:0,allPassed:true}));
} finally {await db.close();}
