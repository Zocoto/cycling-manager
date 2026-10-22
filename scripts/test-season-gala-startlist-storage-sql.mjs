import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);const db=new PGlite();let checks=0;
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
async function rejects(sql){let rejected=false;try{await db.exec(sql);}catch{rejected=true;}check(rejected,true);}
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create table seasons(id uuid primary key);create table teams(id uuid primary key);create table riders(id uuid primary key);create table pcm_gala_events(id uuid);insert into pcm_gala_events values('${id(90)}');`);
 await db.exec(readFileSync('supabase/migrations/20261022220000_prepare_private_season_gala_startlists.sql','utf8'));
 check((await db.query('select count(*)::int n from season_gala_registrations')).rows[0].n,0);
 for(const role of ['anon','authenticated'])for(const table of ['season_gala_registrations','season_gala_registration_riders']){
  check((await db.query(`select has_table_privilege('${role}','${table}','select') or has_table_privilege('${role}','${table}','insert') allowed`)).rows[0].allowed,false);
 }
 check((await db.query("select bool_and(relrowsecurity) ok from pg_class where relname in('season_gala_registrations','season_gala_registration_riders')")).rows[0].ok,true);
 await db.exec(`insert into seasons values('${id(1)}');insert into teams values('${id(2)}');insert into riders values('${id(3)}'),('${id(4)}');insert into season_gala_registrations(id,season_id,team_id,program) values('${id(5)}','${id(1)}','${id(2)}','world-tour');`);
 await rejects(`insert into season_gala_registrations(season_id,team_id,program) values('${id(1)}','${id(2)}','continental');`);
 await rejects(`insert into season_gala_registration_riders values('${id(5)}','mountain','${id(3)}',9);`);
 await rejects(`insert into season_gala_registration_riders values('${id(5)}','mountain','${id(3)}',0);`);
 await rejects(`insert into season_gala_registration_riders values('${id(5)}','unknown','${id(3)}',1);`);
 await db.exec(`insert into season_gala_registration_riders values('${id(5)}','mountain','${id(3)}',1),('${id(5)}','hills','${id(3)}',1);`);
 await rejects(`insert into season_gala_registration_riders values('${id(5)}','mountain','${id(4)}',1);`);
 check((await db.query('select count(*)::int n from season_gala_registration_riders')).rows[0].n,2);
 await db.exec(`delete from season_gala_registrations where id='${id(5)}';`);
 check((await db.query('select count(*)::int n from season_gala_registration_riders')).rows[0].n,0);
 check((await db.query('select count(*)::int n from pcm_gala_events')).rows[0].n,1);
 console.log(`${checks} isolated PostgreSQL storage checks passed; no production fixtures.`);
}finally{await db.close();}
