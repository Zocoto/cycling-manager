// Isolated PostgreSQL only. No remote client, account or production fixture.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]?.endsWith('/dist/index.js')) throw new Error('Pass the existing local PGlite module path.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const user = '00000000-0000-4000-8000-000000000001';
const newcomer = '00000000-0000-4000-8000-000000000002';
const country = '00000000-0000-4000-8000-000000000099';
const literal = value => value === null ? 'null' : "'" + value.replaceAll("'", "''") + "'";
let assertions = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
const read = name => readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8');
const wallet = async () => (await db.query(`select inventory,cosmetics,coins,obtained,purchases from halloween_wallets where user_id='${user}'`)).rows[0];
const profile = async (id = user) => (await db.query(`select avatar_key,display_name,country_id from sporting_directors where auth_user_id='${id}'`)).rows[0];
const save = (items, overrides = {}) => {
  const p = { user, name: 'Updated', country, avatar: 'director_f_02', frame: null, email: true, ...overrides };
  return db.exec(`select save_sporting_director_avatar_cosmetics(${literal(p.user)}::uuid,${literal(p.name)},${literal(p.country)}::uuid,${literal(p.avatar)},${literal(p.frame)},${p.email},${items === null ? 'null' : `array[${items.map(literal).join(',')}]::text[]`});`);
};
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table sporting_directors(id uuid primary key,auth_user_id uuid unique,display_name text,country_id uuid,
      avatar_key text check(split_part(avatar_key,'~halloween~',1) in ('director_m_01','director_f_02')),avatar_frame_key text,is_email_visible boolean);
    create table halloween_wallets(edition_id text,user_id uuid,inventory jsonb not null default '{}',cosmetics jsonb not null default '{}',
      coins int not null default 100,obtained jsonb not null default '{}',purchases jsonb not null default '{}',primary key(edition_id,user_id));
    create table halloween_curses(edition_id text,user_id uuid,kind text,expires_at timestamptz);
    create table halloween_catalog(id text primary key,name text,kind text,price int,max_obtained int,draw_pool text,effect jsonb);
    insert into sporting_directors values('${user}','${user}','Original','${country}','director_m_01',null,true),
      ('${newcomer}','${newcomer}','Newcomer',null,'director_m_01',null,true);`);
  await db.exec(await read('20261008210200_halloween_catalog'));
  const original = await read('20261008210400_halloween_avatars_and_longevity');
  await db.exec(original.slice(original.indexOf('create function public.apply_halloween_avatar()'), original.indexOf('-- Patch the current training')));
  const inventory = Object.fromEntries(['lord-vlad','halloween-background','devil-trident','pumpkin-cap','pocket-bat','spectral-wheel','cobweb-frame','ghost-scarf','headless-skin','pumpkin-juice'].map(id => [id, 1]));
  await db.query(`insert into halloween_wallets(edition_id,user_id,inventory,cosmetics,obtained,purchases) values('halloween-2026',$1,$2,'{"frame":"cobweb-frame"}','{"cobweb-frame":1}','{"cobweb-frame":1}')`, [user, inventory]);
  const before = await wallet();
  const nonCosmetics = (await db.query("select id,price from halloween_catalog where kind<>'cosmetic' order by id")).rows;
  await db.exec(await read('20261010180000_halloween_avatar_wardrobe'));
  check((await wallet()).cosmetics, { frame_corner: 'cobweb-frame' }, 'existing web remains equipped in its compatible corner');
  check((await profile()).avatar_key, 'director_m_01~halloween~web', 'existing web still visible after migration');
  check((await db.query("select id,price from halloween_catalog where kind<>'cosmetic' order by id")).rows, nonCosmetics, 'consumable and spell prices unchanged');
  check((await db.query("select price from halloween_catalog where id='lord-vlad'")).rows[0].price, 50, 'server enforces the increased price');
  const all = Object.keys(inventory).filter(id => !['headless-skin','pumpkin-juice'].includes(id));
  await save(all);
  const after = await wallet();
  check(Object.values(after.cosmetics).sort(), all.sort(), 'eight compatible cosmetics coexist');
  for (const field of ['inventory','coins','obtained','purchases']) check(after[field], before[field], `selection never changes ${field}`);
  check((await profile()).avatar_key.split('~halloween~')[1].split(',').length, 8, 'cached public portrait includes the complete selection');
  check((await profile()).avatar_key.split('~halloween~')[0], 'director_f_02', 'native portrait change saved atomically');
  await save(all);
  check((await wallet()).cosmetics, after.cosmetics, 'repeated save is idempotent');
  for (const invalid of [['lord-vlad','headless-skin'],['pocket-bat','pocket-bat'],['pumpkin-juice'],['unknown'],[null],null]) {
    await assert.rejects(save(invalid)); assertions++;
    check(await wallet(), after, 'invalid selection changes nothing');
  }
  await db.exec(`update halloween_wallets set inventory=inventory-'pumpkin-cap' where user_id='${user}'`);
  await assert.rejects(save(['pumpkin-cap']), /possédez/); assertions++;
  await db.query(`update halloween_wallets set inventory=$1 where user_id='${user}'`, [inventory]);
  await assert.rejects(save(['pocket-bat'], { avatar: 'invalid' })); assertions++;
  check((await wallet()).cosmetics, after.cosmetics, 'profile constraint failure rolls back cosmetics too');
  await assert.rejects(save([], { country: newcomer }), /nationalité/); assertions++;
  check((await wallet()).cosmetics, after.cosmetics, 'nationality protection rolls back the whole save');
  await save(['pocket-bat'], { avatar: 'director_f_02~halloween~cap,vlad,unknown' });
  check((await profile()).avatar_key, 'director_f_02~halloween~bat', 'untrusted suffix cannot equip extra objects');
  await db.exec(`insert into halloween_curses values('halloween-2026','${user}','mummy',now()+interval '1 hour')`);
  await save(['lord-vlad','pumpkin-cap','pocket-bat']);
  check((await profile()).avatar_key, 'director_f_02~halloween~cap,bat,mummy', 'curse temporarily overrides the outfit only');
  check((await wallet()).cosmetics.outfit, 'lord-vlad', 'desired outfit preserved during curse');
  await db.exec(`delete from halloween_curses where user_id='${user}'`);
  check((await profile()).avatar_key, 'director_f_02~halloween~cap,vlad,bat', 'outfit restored by existing curse sync');
  await save([]);
  check((await profile()).avatar_key, 'director_f_02', 'all cosmetics can be removed without losing base portrait');
  check((await wallet()).inventory, inventory, 'deselection never consumes ownership');
  await save([], { user: newcomer });
  check((await db.query(`select user_id from halloween_wallets where user_id='${newcomer}'`)).rows, [], 'editing a newcomer never joins the event');
  await db.exec('set role authenticated');
  await assert.rejects(save([]), /permission denied/); assertions++;
  await db.exec('reset role');
  check((await db.query("select has_function_privilege('service_role','save_sporting_director_avatar_cosmetics(uuid,text,uuid,text,text,boolean,text[])','execute') as allowed")).rows[0].allowed, true, 'only trusted server can call the atomic save');
  console.log(JSON.stringify({ assertions, isolated: true, productionFixture: false }));
} finally { await db.close(); }
