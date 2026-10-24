// Isolated PostgreSQL-in-WASM only. Never connects to Supabase.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
let checks = 0;
const check = (value, expected, label) => { assert.deepEqual(value, expected, label); checks++; };
try {
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create table countries(id uuid primary key,is_active boolean);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,country_id uuid,status text);
    create table alpha_bot_managers(sporting_director_id uuid,auth_user_id uuid);
    grant select on countries,sporting_directors,alpha_bot_managers to service_role;
    insert into countries values('${id(1)}',true),('${id(2)}',true),('${id(3)}',true),('${id(4)}',false);
    insert into sporting_directors values
      ('${id(11)}','${id(111)}','${id(1)}','active'),
      ('${id(12)}','${id(112)}','${id(1)}','active'),
      ('${id(13)}','${id(113)}','${id(2)}','active'),
      ('${id(14)}','${id(114)}','${id(1)}','inactive'),
      ('${id(15)}',null,'${id(1)}','active'),
      ('${id(16)}','${id(116)}','${id(1)}','active'),
      ('${id(17)}','${id(117)}','${id(1)}','active'),
      ('${id(18)}','${id(118)}',null,'active'),
      ('${id(19)}','${id(119)}','${id(4)}','active');
    insert into alpha_bot_managers values ('${id(16)}',null),('${id(999)}','${id(117)}');`);
  await db.exec(readFileSync('supabase/migrations/20261024120000_add_onboarding_country_director_counts.sql', 'utf8'));
  const counts = async () => (await db.query('select country_id,director_count::int n from get_onboarding_country_director_counts() order by country_id')).rows;
  check(await counts(), [{ country_id: id(1), n: 2 }, { country_id: id(2), n: 1 }, { country_id: id(3), n: 0 }], 'All playable countries, human active directors only, real zero');
  for (const role of ['anon', 'authenticated', 'service_role']) {
    check((await db.query(`select has_function_privilege('${role}','public.get_onboarding_country_director_counts()','execute') ok`)).rows[0].ok, role === 'service_role', 'Only server access');
  }
  await db.exec('set role service_role');
  check((await counts()).length, 3, 'Application server can query counts');
  await db.exec('reset role');
  await db.exec(`insert into sporting_directors select gen_random_uuid(),gen_random_uuid(),'${id(2)}','active' from generate_series(1,1200);`);
  check((await counts())[1].n, 1201, 'Not truncated by PostgREST row limits');
  check((await db.query('select count(*)::int n from sporting_directors')).rows[0].n, 1209, 'Read-only function preserves player rows');
  console.log(`${checks} isolated SQL checks passed; no production fixtures.`);
} finally { await db.close(); }
