// Isolated synthetic PostgreSQL only. Never reads/writes a Supabase database.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const read=file=>readFileSync(`supabase/migrations/${file}`,'utf8').replaceAll('\r','');
const original=read('20260903100000_add_federation_jerseys_and_lounge.sql');
const programme=read('20260904130000_expand_federation_program.sql');
const president=read('20260907193000_restrict_federation_jersey_to_president.sql');
const migration=read('20261017120000_separate_federation_jersey_roles.sql');
const extract=(source,name)=>{const start=source.indexOf(`create or replace function public.${name}(`);assert.ok(start>=0);return source.slice(start,source.indexOf('$$;',start)+3);};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const baseline={schemaVersion:2,baseColor:'#FFFFFF',elements:[]};
const selection={schemaVersion:2,baseColor:'#102E4D',elements:[{id:'country-name',kind:'text',shape:'rectangle',color:'#FFFFFF',secondaryColor:'#111111',x:60,y:54,width:84,height:12,rotation:0,opacity:1,text:'MAURITIUS'}]};
const champion={schemaVersion:2,baseColor:'#16834A',elements:[]};
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
let checks=0;
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const reject=async(sql,args,pattern)=>{await assert.rejects(db.query(sql,args),pattern);checks++;};
const publish=(design,kind)=>db.query('select * from public.publish_national_federation_jersey($1,$2::jsonb,$3)',['MU',JSON.stringify(design),kind]);
const snapshot=async()=> (await db.query(`select 'team' kind,design,version,active_from_game_year,pending_design,pending_version,pending_activation_game_year from national_federation_jerseys
 union all select 'champion',design,version,active_from_game_year,pending_design,pending_version,pending_activation_game_year from national_federation_champion_jerseys order by kind`)).rows;
try {
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.auth_uid',true),'')::uuid$$;
 create table countries(id uuid primary key,iso_alpha2 text);
 create table sporting_directors(id uuid primary key);
 create table seasons(id uuid primary key,status text,game_year integer);
 create table national_federation_terms(country_id uuid,start_game_year integer,end_game_year integer,governance_mode text,president_director_id uuid);
 create table national_federation_elections(country_id uuid,term_start_game_year integer,term_end_game_year integer,election_type text,status text,elected_director_id uuid);
 insert into countries values('${id(1)}','MU');
 insert into sporting_directors values('${id(2)}'),('${id(3)}'),('${id(4)}');
 insert into seasons values('${id(5)}','active',4);
 insert into national_federation_terms values('${id(1)}',3,4,'elected','${id(2)}');
 create function public.get_current_federation_identity(code text) returns table(country_id uuid,sporting_director_id uuid)
 language sql stable as $$select c.id,auth.uid() from public.countries c where c.iso_alpha2=upper(code) and auth.uid() in('${id(2)}'::uuid,'${id(3)}'::uuid)$$;
 `);
 await db.exec(original.slice(original.indexOf('create table public.national_federation_jerseys'),original.indexOf('create table public.federation_chat_messages')));
 await db.exec(programme.slice(programme.indexOf('alter table public.national_federation_jerseys\n'),programme.indexOf('drop function public.publish_national_federation_jersey')));
 await db.exec(extract(president,'publish_national_federation_jersey'));
 await db.exec(extract(programme,'activate_due_national_federation_jerseys'));
 await db.query(`insert into national_federation_jerseys(country_id,design,version,published_by,active_from_game_year) values($1,$2,1,$3,4)`,[id(1),JSON.stringify(baseline),id(2)]);
 await db.query(`insert into national_federation_jersey_history(country_id,design,version,published_by) values($1,$2,1,$3)`,[id(1),JSON.stringify(baseline),id(2)]);
 await db.exec(migration);
 const initial=await snapshot();check(initial.length,2);check(initial[0].design,baseline);check(initial[1].design,baseline);
 check(await scalar('select count(*)::int from national_federation_champion_jersey_history'),1);
 check(await scalar("select has_function_privilege('anon','public.publish_national_federation_jersey(text,jsonb,text)','execute')"),false);
 check(await scalar("select has_function_privilege('authenticated','private.publish_national_champion_federation_jersey(text,jsonb)','execute')"),false);
 check(await scalar("select has_table_privilege('authenticated','public.national_federation_champion_jerseys','insert')"),false);
 check(await scalar("select relrowsecurity from pg_class where oid='public.national_federation_champion_jerseys'::regclass"),true);
 await reject('select * from public.publish_national_federation_jersey($1,$2,$3)',['MU',JSON.stringify(selection),'national_team'],/connecté/);
 await db.query("select set_config('test.auth_uid',$1,false)",[id(3)]);
 for(const kind of ['national_team','national_champion']) await reject('select * from public.publish_national_federation_jersey($1,$2,$3)',['MU',JSON.stringify(selection),kind],/président élu/);
 await db.query("select set_config('test.auth_uid',$1,false)",[id(4)]);
 await reject('select * from public.publish_national_federation_jersey($1,$2,$3)',['MU',JSON.stringify(selection),'national_champion'],/affiliée/);
 await db.query("select set_config('test.auth_uid',$1,false)",[id(2)]);
 const teamPublication=(await publish(selection,'national_team')).rows[0];check(teamPublication.activation_game_year,5);check(teamPublication.version,2);
 let rows=await snapshot();check(rows[0].pending_design,null);check(rows[1].pending_design,selection);check(rows[1].design,baseline);
 await publish(champion,'national_champion');
 rows=await snapshot();check(rows[0].pending_design,champion);check(rows[1].pending_design,selection);check(rows[0].design,baseline);
 check(await scalar('select public.activate_due_national_federation_jerseys()'),0);
 await reject('select * from public.publish_national_federation_jersey($1,$2,$3)',['MU',JSON.stringify(selection),'unknown'],/type de maillot/);
 for(const text of ['', 'A'.repeat(33), 'bad\ntext']) {
  const design={...selection,elements:[{...selection.elements[0],text}]};
  await reject('select * from public.publish_national_federation_jersey($1,$2,$3)',['MU',JSON.stringify(design),'national_team'],/texte du maillot/);
 }
 // Legacy clients may still publish a selection without selecting a kind.
 await db.query('select * from public.publish_national_federation_jersey($1,$2)',['MU',JSON.stringify(selection)]);
 rows=await snapshot();check(rows[1].pending_version,3);check(rows[0].pending_version,2);
 const beforeRetry=await snapshot();const championHistoryBefore=await scalar('select count(*)::int from national_federation_champion_jersey_history');
 await db.exec(migration);check(await snapshot(),beforeRetry);
 check(await scalar('select count(*)::int from national_federation_champion_jersey_history'),championHistoryBefore);
 await db.exec('update seasons set game_year=5');
 check(await scalar('select public.activate_due_national_federation_jerseys()'),2);
 rows=await snapshot();check(rows[0].design,champion);check(rows[1].design,selection);
 check(rows.every(row=>row.pending_design===null&&row.pending_activation_game_year===null&&row.active_from_game_year===5),true);
 check(await scalar('select public.activate_due_national_federation_jerseys()'),0);
 check(await scalar('select count(*)::int from national_federation_champion_jersey_history'),2);
 check(await scalar('select count(*)::int from national_federation_jersey_history'),3);
 // A president who published only a champion kit can leave without deleting
 // the nation's artwork or making its reserved next-season design invalid.
 await db.exec(`update national_federation_terms set start_game_year=5,end_game_year=6,president_director_id='${id(3)}'`);
 await db.query("select set_config('test.auth_uid',$1,false)",[id(3)]);
 await publish(champion,'national_champion');
 await db.exec(`delete from sporting_directors where id='${id(3)}'`);
 check(await scalar('select pending_published_by from national_federation_champion_jerseys'),null);
 await db.exec('update seasons set game_year=6');
 check(await scalar('select public.activate_due_national_federation_jerseys()'),1);
 check(await scalar('select design from national_federation_champion_jerseys'),champion);
 console.log(JSON.stringify({isolated:true,checks,independentRoles:true,presidentGuardPreserved:true,nextSeasonActivation:true,legacyApiCompatible:true}));
} finally {await db.close();}
