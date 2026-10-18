import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Isolated database only. No production connection or gameplay fixture.
const {PGlite}=await import(process.env.GAZETTE_SQL_TEST_MODULE
  ? pathToFileURL(process.env.GAZETTE_SQL_TEST_MODULE).href : '@electric-sql/pglite');
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let checks=0;
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table countries(id uuid primary key,iso_alpha2 text,name text);
    create table riders(id uuid primary key,country_id uuid,status text,first_name text,last_name text,avatar_profile_key text,avatar_seed bigint);
    create index on riders(country_id);
    create table rider_national_championship_titles(rider_id uuid,country_id uuid,championship_type text,won_at timestamptz,relinquished_at timestamptz);
    create unique index on rider_national_championship_titles(country_id,championship_type) where relinquished_at is null;
    create table national_federation_jersey_history(country_id uuid,version integer,design jsonb,published_at timestamptz,primary key(country_id,version));
    create table national_federation_champion_jersey_history(like national_federation_jersey_history including all);
    insert into countries values('${id(1)}','FR','France'),('${id(2)}','NL','Pays-Bas');
    insert into riders values('${id(11)}','${id(1)}','active','Jean','Martin','europe_west',9223372036854775000),
      ('${id(12)}','${id(1)}','active','Paul','Durand','europe_west',123),
      ('${id(13)}','${id(1)}','retired','Ancien','Champion','europe_west',456);
    insert into rider_national_championship_titles values('${id(12)}','${id(1)}','road','2026-10-10',null),('${id(11)}','${id(1)}','time_trial','2026-10-09',null);
  `);
  const migration=readFileSync('supabase/migrations/20261018110000_gazette_federation_jersey_changes.sql','utf8');
  await db.exec(migration);
  const history=async(kind,country,version,date,color)=>db.query(`insert into ${kind==='national_team'?'national_federation_jersey_history':'national_federation_champion_jersey_history'} values($1,$2,$3::jsonb,$4)`,[id(country),version,JSON.stringify({schemaVersion:2,baseColor:color,elements:[]}),date]);
  const read=async(date='2026-10-18',until='2026-10-18T18:05:00Z')=>(await db.query('select * from get_cyclogazette_jersey_changes($1,$2)',[date,until])).rows;
  assert.equal((await read()).length,0); checks++;
  await history('national_team',1,1,'2026-10-17T17:00:00Z','#FFFFFF');
  assert.equal((await read()).length,0); checks++;
  await history('national_team',1,2,'2026-10-18T08:00:00Z','#123456');
  await history('national_team',1,3,'2026-10-18T09:00:00Z','#654321');
  let rows=await read(); assert.equal(rows.length,1); checks++;
  assert.equal(rows[0].version,3); checks++;
  assert.equal(rows[0].previous_design.baseColor,'#FFFFFF'); checks++;
  assert.equal(rows[0].rider_id,id(11)); checks++;
  assert.equal(rows[0].avatar_seed,'9223372036854775000'); checks++;
  await history('national_champion',1,1,'2026-10-18T09:00:00Z','#ABCDEF');
  rows=await read(); assert.equal(rows.length,2); checks++;
  let champion=rows.find(r=>r.jersey_kind==='national_champion');
  assert.equal(champion.rider_id,id(12)); checks++;
  assert.equal(champion.championship_type,'road'); checks++;
  await db.exec(`update rider_national_championship_titles set rider_id='${id(13)}' where championship_type='road'`);
  champion=(await read()).find(r=>r.jersey_kind==='national_champion');
  assert.equal(champion.rider_id,id(11)); checks++;
  assert.equal(champion.championship_type,'time_trial'); checks++;
  await db.exec(`update rider_national_championship_titles set relinquished_at=now()`);
  assert.equal((await read()).find(r=>r.jersey_kind==='national_champion').rider_id,null); checks++;
  await history('national_team',2,1,'2026-10-18T18:00:00Z','#112233');
  assert.equal((await read()).find(r=>r.country_code==='NL').rider_id,null); checks++;
  assert.equal((await read('2026-10-18','2026-10-18T17:59:00Z')).some(r=>r.country_code==='NL'),false); checks++;
  await history('national_team',2,2,'2026-10-18T18:00:01Z','#334455');
  assert.equal((await read()).find(r=>r.country_code==='NL').version,1); checks++;
  assert.equal((await read('2026-10-19','2026-10-19T18:01:00Z')).find(r=>r.country_code==='NL').version,2); checks++;
  assert.equal((await read('2026-10-20','2026-10-20T18:01:00Z')).length,0); checks++;
  // Fixed Paris closing times include the whole editorial day across DST.
  await history('national_team',2,3,'2027-03-27T19:00:01Z','#123123');
  await history('national_team',2,4,'2027-03-28T18:00:00Z','#234234');
  assert.equal((await read('2027-03-28','2027-03-28T18:05:00Z')).find(r=>r.country_code==='NL').version,4); checks++;
  await history('national_team',2,5,'2027-03-28T18:00:01Z','#345345');
  assert.equal((await read('2027-03-29','2027-03-29T18:05:00Z')).find(r=>r.country_code==='NL').version,5); checks++;
  await history('national_team',2,6,'2026-10-24T18:00:01Z','#456456');
  await history('national_team',2,7,'2026-10-25T19:00:00Z','#567567');
  assert.equal((await read('2026-10-25','2026-10-25T19:05:00Z')).find(r=>r.country_code==='NL').version,7); checks++;
  assert.equal((await read('2026-10-26','2026-10-26T19:05:00Z')).length,0); checks++;
  assert.equal((await db.query(`select has_function_privilege('authenticated','get_cyclogazette_jersey_changes(date,timestamptz)','execute') as allowed`)).rows[0].allowed,false); checks++;
  assert.equal((await db.query(`select has_function_privilege('service_role','get_cyclogazette_jersey_changes(date,timestamptz)','execute') as allowed`)).rows[0].allowed,true); checks++;
  await db.exec('begin read only;'); await read(); await db.exec('commit;'); checks++;
  const beforeRepeat=await read();
  await db.exec(migration); assert.deepEqual(await read(),beforeRepeat); checks++;
  console.log(JSON.stringify({isolated:true,checks,passed:true}));
} finally { await db.close(); }
