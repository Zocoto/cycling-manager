// Local PostgreSQL only. No production client, fixtures or gameplay actions.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]?.endsWith('/dist/index.js')) throw new Error('Pass the existing local PGlite module path.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const read = name => readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const extract = (source, name) => source.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`, 'i'))?.[0] ?? assert.fail(`Missing function ${name}`);
let assertions = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
const summary = async () => (await db.query('select journal_items from get_current_dashboard_assistant_summary()')).rows[0]?.journal_items;
const opportunity = async () => (await summary())?.physiotherapistOpportunity;
try {
  await db.exec(`create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
    create table sporting_directors(id uuid,auth_user_id uuid,status text);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table teams(id uuid,status text);
    create table seasons(id uuid,status text,game_year int,current_day_number int);
    create table team_seasons(id uuid,team_id uuid,season_id uuid,status text);
    create table season_days(id uuid,season_id uuid,day_number int,calendar_date date);
    create table rider_contracts(rider_id uuid,team_id uuid,status text,start_season_id uuid,end_season_id uuid);
    create table staff_members(id uuid,role text,level int);
    create table staff_contracts(id uuid,team_id uuid,staff_member_id uuid,status text);
    create table staff_member_talents(staff_member_id uuid,talent_code text);
    create table staff_rider_assignments(staff_contract_id uuid,rider_id uuid,status text);
    create index on staff_contracts(team_id,status);
    create index on staff_rider_assignments(staff_contract_id,rider_id) where status='active';
    create index on staff_rider_assignments(rider_id) where status='active';
    insert into sporting_directors values('${id(1)}','${id(1)}','active');
    insert into teams values('${id(2)}','active'),('${id(3)}','active');
    insert into team_manager_assignments values('${id(1)}','${id(2)}','general_manager','active');
    insert into seasons values('${id(4)}','active',2026,1),('${id(5)}','planned',2027,1),('${id(6)}','completed',2025,28);
    insert into team_seasons values('${id(7)}','${id(2)}','${id(4)}','active');
    insert into season_days values('${id(8)}','${id(4)}',1,'2026-10-11');
    insert into rider_contracts values
      ('${id(11)}','${id(2)}','active','${id(4)}','${id(4)}'),
      ('${id(12)}','${id(2)}','active','${id(4)}','${id(4)}'),
      ('${id(13)}','${id(2)}','active','${id(4)}','${id(4)}'),
      ('${id(14)}','${id(2)}','active','${id(5)}','${id(5)}'),
      ('${id(15)}','${id(2)}','active','${id(6)}','${id(6)}'),
      ('${id(16)}','${id(3)}','active','${id(4)}','${id(4)}'),
      ('${id(17)}','${id(2)}','ended','${id(4)}','${id(4)}');
    select set_config('test.user','${id(1)}',false);`);
  await db.exec(extract(await read('20260721160000_create_staff_management'), 'get_physiotherapist_rider_capacity'));
  await db.exec(extract(await read('20260727160000_create_unique_staff_talents'), 'get_staff_contract_talent_flat_bonus'));
  await db.exec(extract(await read('20260909160000_add_operational_staff_affixes'), 'get_physiotherapist_contract_rider_capacity'));
  const original = await read('20260828200000_add_dashboard_ds_assistant');
  const scopes = original.slice(original.indexOf('  with current_context as ('), original.indexOf('  effective_training_setting as ('));
  // Use the production authentication/roster CTEs and the actual payload anchor.
  await db.exec(`create function public.get_current_dashboard_assistant_summary()
    returns table(journal_items jsonb) language sql stable security definer
    set search_path='' set statement_timeout='3000ms' as $$
${scopes}  journal as (
    select jsonb_build_object(
      'items', '[]'::jsonb,
      'equipmentPartnerSignatureAvailable', (
        select false
      ), 'untouchedAlert', 42
    ) as items
  ) select journal.items from current_context cross join journal;
$$;`);
  const configBefore = (await db.query("select proconfig from pg_proc where oid='public.get_current_dashboard_assistant_summary()'::regprocedure")).rows[0].proconfig;
  const migration = await read('20261011120000_add_physiotherapist_dashboard_alert');
  await db.exec(migration);
  check((await summary()).untouchedAlert, 42, 'other payload entries preserved');
  check((await db.query("select proconfig from pg_proc where oid='public.get_current_dashboard_assistant_summary()'::regprocedure")).rows[0].proconfig, configBefore, 'security path and RPC timeout preserved');
  check(await opportunity(), { freeSlotCount: 0, unassignedRiderCount: 3 }, 'no physio, only current roster counted');
  await db.exec(`insert into staff_members values('${id(21)}','physiotherapist',1),('${id(22)}','doctor',5),('${id(23)}','physiotherapist',5),('${id(24)}','physiotherapist',5);
    insert into staff_contracts values('${id(31)}','${id(2)}','${id(21)}','active'),('${id(32)}','${id(2)}','${id(22)}','active'),('${id(33)}','${id(3)}','${id(23)}','active'),('${id(34)}','${id(2)}','${id(24)}','terminated');`);
  check(await opportunity(), { freeSlotCount: 2, unassignedRiderCount: 3 }, 'doctors, foreign staff and terminated contracts excluded');
  await db.exec(`insert into staff_rider_assignments values('${id(31)}','${id(11)}','active'),('${id(31)}','${id(12)}','ended'),('${id(34)}','${id(13)}','active');`);
  check(await opportunity(), { freeSlotCount: 1, unassignedRiderCount: 2 }, 'ended assignments and inactive physios do not provide follow-up');
  await db.exec(`insert into staff_rider_assignments values('${id(31)}','${id(12)}','active');`);
  check(await opportunity(), { freeSlotCount: 0, unassignedRiderCount: 1 }, 'full physio stops the alert even with an unassigned rider');
  await db.exec(`insert into staff_member_talents values('${id(21)}','physio_rider_capacity');`);
  check(await opportunity(), { freeSlotCount: 1, unassignedRiderCount: 1 }, 'expanded capacity opens a real extra slot');
  await db.exec(`delete from staff_rider_assignments where staff_contract_id='${id(34)}'; insert into staff_rider_assignments values('${id(31)}','${id(13)}','active');`);
  check(await opportunity(), { freeSlotCount: 0, unassignedRiderCount: 0 }, 'all riders followed');
  await db.exec(`update staff_members set level=4 where id='${id(21)}';`);
  check(await opportunity(), { freeSlotCount: 8, unassignedRiderCount: 0 }, 'level-4 talent adds two slots; no alert when no rider needs it');
  await db.exec(`update staff_rider_assignments set status='ended' where rider_id='${id(13)}'; update staff_contracts set status='active' where id='${id(34)}';`);
  check(await opportunity(), { freeSlotCount: 21, unassignedRiderCount: 1 }, 'free capacity is summed across kinés');
  await db.exec(`insert into staff_rider_assignments select '${id(34)}',('00000000-0000-4000-8000-' || lpad((40+i)::text,12,'0'))::uuid,'active' from generate_series(1,13) i;`);
  check(await opportunity(), { freeSlotCount: 9, unassignedRiderCount: 1 }, 'overfull historical assignment is clamped per kiné, not deducted from another');
  await db.exec("select set_config('test.user','',false)");
  check(await summary(), undefined, 'no authenticated DS means no other team data');
  await db.exec(`select set_config('test.user','${id(1)}',false); update team_manager_assignments set status='ended';`);
  check(await summary(), undefined, 'inactive manager cannot read team opportunity');
  await assert.rejects(db.exec(migration), /déjà installée/); assertions++;
  await db.exec('rollback');
  console.log(JSON.stringify({ assertions, isolated: true, productionFixture: false }));
} finally { await db.close(); }
