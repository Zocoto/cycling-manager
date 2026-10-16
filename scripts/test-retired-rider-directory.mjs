// Isolated PostgreSQL regression tests; no network or production data.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const read=async file=>(await readFile(new URL(file,import.meta.url),'utf8')).replaceAll('\r\n','\n');
let assertions=0;
const check=(a,b)=>{assert.deepEqual(a,b);assertions++;};
const rows=async sql=>(await db.query(sql)).rows;
try {
  await db.exec(`create schema auth;create role authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
    create table seasons(id uuid,status text);
    create table riders(id uuid,country_id uuid,first_name text,last_name text,avatar_profile_key text,status text);
    create table countries(id uuid,iso_alpha2 text,name text,is_active boolean);
    create table rider_contracts(rider_id uuid,team_id uuid,status text);
    create table teams(id uuid,status text);
    create table team_seasons(team_id uuid,season_id uuid,display_name text,status text);
    create table rider_season_summaries(rider_id uuid,season_id uuid,points int);`);
  const source=await read('../supabase/migrations/20260901010000_add_riders_to_global_search.sql');
  const fn=source.match(/create or replace function public\.search_game_directory\([\s\S]*?\$\$;/i)[0];
  const returnType=fn.match(/returns table \(([\s\S]*?)\)\s*language/i)[1];
  const nullColumns=returnType.trim().split(',').map(column=>'null::'+column.trim().split(/\s+/).slice(1).join(' ')).join(',');
  await db.exec(`create function search_game_directory_without_riders(text,integer) returns table(${returnType}) language sql as $$select ${nullColumns} where false$$;`);
  await db.exec(fn);
  await db.exec(`insert into countries values('00000000-0000-4000-8000-000000000001','RW','Rwanda',true);
    insert into riders select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-4000-8000-000000000001',
      case n when 2 then 'Idris' else 'Rider' end,case n when 2 then 'Okello' else n::text end,null,
      case n when 1 then 'active' when 2 then 'retired' when 3 then 'free_agent' else 'inactive' end from generate_series(1,4) n;
    select set_config('test.user','00000000-0000-4000-8000-000000000009',false);`);
  check(await rows(`select display_name from search_game_directory('Idris Okello',8)`),[]);
  const migration=await read('../supabase/migrations/20261016190000_include_retired_riders_in_directory.sql');
  // PGlite test runtime has no pg_trgm extension; exercise the exact function
  // patch and guards. The index is standard PostgreSQL GIN, verified on delivery.
  await db.exec(migration.match(/do \$\$[\s\S]*?end \$\$;/i)[0]);
  check(await rows(`select display_name from search_game_directory('Idris Okello',8)`),[{display_name:'Idris Okello'}]);
  check(await rows(`select display_name from search_game_directory('okel',8)`),[{display_name:'Idris Okello'}]);
  check((await rows(`select * from search_game_directory('RW',20)`)).length,3);
  check((await rows(`select * from search_game_directory('RW',1)`)).length,1);
  check((await rows(`select * from search_game_directory('R',8)`)).length,0);
  check(await rows(`select status from riders where first_name='Idris'`),[{status:'retired'}]);
  await db.exec(`select set_config('test.user','',false)`);
  check((await rows(`select * from search_game_directory('Okello',8)`)).length,0);
  await assert.rejects(db.exec(migration.match(/do \$\$[\s\S]*?end \$\$;/i)[0]),/Unexpected rider directory/);assertions++;
  console.log(JSON.stringify({isolated:true,assertions,retiredSearch:true,authenticationPreserved:true,noGameplayMutation:true}));
}finally{await db.close();}
