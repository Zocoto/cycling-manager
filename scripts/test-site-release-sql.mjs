// Isolated PostgreSQL/WASM only. No credentials, network or production fixtures.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const modulePath = process.argv[2];
if (!modulePath || !/^(?:[A-Za-z]:[\\/]|\/)/.test(modulePath) || !modulePath.replaceAll('\\', '/').endsWith('/pglite/dist/index.js')) throw Error('Absolute local PGlite module path required');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
let checks = 0;
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const scalar = async sql => Object.values((await query(sql))[0])[0];
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const fail = async (sql, args, code) => { await assert.rejects(() => db.query(sql, args), error => error.code === code); checks++; };
const auth = async (n, role = 'authenticated') => {
  await db.exec('reset role');
  await db.query("select set_config('test.uid', $1, false)", [n === null ? '' : id(n)]);
  await db.exec(`set role ${role}`);
};
const current = async () => (await query('select * from get_active_site_release()'))[0];
const management = async () => (await query('select * from get_site_release_management()'))[0];
const save = async (version, revision, note = '') => (await query('select * from set_active_site_release($1,$2,$3)', [version, note, revision]))[0];
try {
  await db.exec(`
    create schema private; create schema auth;
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public, auth to anon, authenticated, service_role;
    create table auth.users(id uuid primary key);
    insert into auth.users values('${id(1)}'),('${id(2)}'),('${id(3)}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create table private.roles(user_id uuid primary key,role text,active boolean default true);
    insert into private.roles values('${id(1)}','owner',true),('${id(2)}','game_staff',true);
    create function private.current_game_role() returns text language sql stable security definer set search_path='' as $$
      select role from private.roles where user_id=auth.uid() and active $$;
    create table private.game_product_news(id int primary key,draft jsonb,published jsonb);
    insert into private.game_product_news values(1,'{"title":"Un brouillon"}','{"title":"Une publication"}');
    create table public.unchanged_race_results(id int primary key,finish_position int);
    insert into public.unchanged_race_results values(1,1);
  `);
  await db.exec(await readFile('supabase/migrations/20261022230000_add_site_release_management.sql', 'utf8'));
  const originalNews = await query('select * from private.game_product_news');
  const originalRace = await query('select * from public.unchanged_race_results');
  check((await current()).version, '0.9.1');
  check((await current()).revision, 1);
  check(Object.keys(await current()).sort(), ['revision', 'updated_at', 'version']);
  check(await scalar("select count(*)::int from pg_class where oid in('private.site_release_events'::regclass,'private.site_release_settings'::regclass) and relrowsecurity"), 2);
  for (const [n, role] of [[null, 'anon'], [3, 'authenticated'], [2, 'authenticated'], [null, 'service_role']]) {
    await auth(n, role);
    check((await current()).version, '0.9.1');
    await fail('select * from get_site_release_management()', [], '42501');
    await fail("select * from set_active_site_release('1.0.0','',1)", [], '42501');
    await fail('select * from private.site_release_settings', [], '42501');
    await fail('select * from private.site_release_events', [], '42501');
  }
  await auth(1);
  check((await management()).history.length, 1);
  check((await save('0.9.1', 1)).revision, 1);
  check((await management()).history.length, 1);
  const first = await save(' 1.0.0 ', 1, ' Premier journal ');
  check(first.version, '1.0.0'); check(first.revision, 2);
  check(first.history[0].note, 'Premier journal'); check(first.history[0].previous_version, '0.9.1');
  check(Object.keys(first.history[0]).sort(), ['note', 'previous_version', 'recorded_at', 'revision', 'version']);
  await fail("select * from set_active_site_release('9.9.9','old browser',1)", [], '40001');
  check((await current()).version, '1.0.0');
  for (const version of ['', '1', '1.2', '01.2.3', 'v1.2.3', '<script>', '1.2.3/4', '1000000.1.1', '1.2.3-', '1.2.3-' + 'a'.repeat(40), null]) {
    await fail('select * from set_active_site_release($1,$2,$3)', [version, '', 2], '22023');
  }
  for (const revision of [null, 0, -1, 2147483647]) await fail('select * from set_active_site_release($1,$2,$3)', ['1.2.3', '', revision], '22023');
  await fail('select * from set_active_site_release($1,$2,$3)', ['1.2.3', 'a'.repeat(181), 2], '22023');
  // Labels can be corrected backwards; this never rewinds application code or news.
  check((await save('0.9.1', 2, 'Correction du numéro')).revision, 3);
  for (let n = 0; n < 12; n++) await save(`1.1.${n}`, n + 3);
  const recent = (await management()).history;
  check(recent.length, 10); check(recent[0].revision, 15); check(recent.at(-1).revision, 6);
  await db.exec('reset role');
  check(await scalar('select count(*)::int from private.site_release_events'), 15);
  check(await scalar('select actor_user_id::text from private.site_release_events where revision=2'), id(1));
  await db.exec(`create function private.fail_site_release_event() returns trigger language plpgsql as $$begin raise exception 'Injected isolated failure';end$$;
    create trigger injected_failure before insert on private.site_release_events for each row execute function private.fail_site_release_event();`);
  await auth(1);
  await fail("select * from set_active_site_release('2.0.0','must roll back',15)", [], 'P0001');
  check((await current()).revision, 15); check((await current()).version, '1.1.11');
  await db.exec('reset role; drop trigger injected_failure on private.site_release_events; update private.roles set active=false where role=\'owner\';');
  await auth(1);
  await fail('select * from get_site_release_management()', [], '42501');
  await fail("select * from set_active_site_release('2.0.0','',15)", [], '42501');
  await db.exec('reset role');
  check(await query('select * from private.game_product_news'), originalNews);
  check(await query('select * from public.unchanged_race_results'), originalRace);
  console.log(JSON.stringify({ isolatedPostgres: 'passed', checks, productionWrites: 0 }));
} finally { await db.close(); }
