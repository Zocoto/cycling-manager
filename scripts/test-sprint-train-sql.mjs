// Isolated PostgreSQL contract tests. Canonical preparation RPCs are test doubles:
// this migration delegates to them unchanged, rather than replacing their rules.
// No credentials or production connections are used by this script.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]?.replaceAll('\\','/').endsWith('/pglite/dist/index.js')) throw Error('Pass an existing PGlite module.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const migration = await readFile('supabase/migrations/20261022200000_add_optional_ordered_sprint_trains.sql','utf8');
const fields = migration.match(/create type public.race_preparation_with_sprint_row as \(([\s\S]*?)\n\);/)[1]
  .trim().replace(/, sprint_train_order uuid\[\]$/, '');
const columns = fields.split(',').map(value => value.trim().split(/\s+/));
const projection = columns.map(([name,type]) => ['race_edition_id','race_registration_id','team_id','stage_id'].includes(name)
  ? `s.${name}` : name === 'rider_id' ? 'r.rider_id' : `null::${type}`).join(',');
let checks = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const query = async (sql, args=[]) => (await db.query(sql,args)).rows;
const order = async stage => (await query('select sprint_train_order from race_stage_strategies where stage_id=$1',[id(stage)]))[0].sprint_train_order;
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    create table sporting_directors(id uuid primary key,auth_user_id uuid);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,status text,role text);
    create table race_registrations(id uuid primary key,race_edition_id uuid);
    create table race_rosters(race_registration_id uuid,rider_id uuid,status text,primary key(race_registration_id,rider_id));
    create table stages(id uuid primary key,closed boolean default false);
    create table race_stage_strategies(race_registration_id uuid,stage_id uuid,team_id uuid,race_edition_id uuid,
      primary key(race_registration_id,stage_id),unique(team_id,stage_id));
    create table canonical_calls(kind text);
    insert into sporting_directors values('${id(1)}','${id(101)}'),('${id(2)}','${id(102)}');
    insert into team_manager_assignments values('${id(1)}','${id(11)}','active','general_manager'),('${id(2)}','${id(12)}','active','general_manager');
    insert into race_registrations values('${id(21)}','${id(31)}'),('${id(22)}','${id(31)}'),('${id(23)}','${id(31)}');
    insert into stages values('${id(41)}',false),('${id(42)}',false),('${id(43)}',false);
    insert into race_stage_strategies values('${id(21)}','${id(41)}','${id(11)}','${id(31)}'),
      ('${id(22)}','${id(42)}','${id(12)}','${id(31)}'),('${id(23)}','${id(43)}','${id(13)}','${id(31)}');
    insert into race_rosters select '${id(21)}',('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'confirmed' from generate_series(51,58) n;
    insert into race_rosters values('${id(22)}','${id(61)}','confirmed'),('${id(23)}','${id(62)}','confirmed');
    create function private.assert_federation_race_preparation_context(text,uuid,uuid,boolean)
    returns table(registration_id uuid) language plpgsql as $$begin
      if auth.uid() is distinct from '${id(101)}'::uuid or $1<>'MU' or $2<>'${id(31)}'::uuid or $3<>'${id(43)}'::uuid
        or (select closed from stages where id=$3) then raise exception 'canonical context rejected'; end if;
      return query select '${id(23)}'::uuid;
    end$$;
    create function save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)
    returns table(stage_id uuid,stage_number int,updated_rider_count int) language plpgsql security definer as $$begin
      if auth.uid() is distinct from '${id(101)}'::uuid or $1<>'${id(31)}'::uuid or $2<>'${id(41)}'::uuid
        or (select closed from stages where id=$2) then raise exception 'canonical context rejected'; end if;
      if jsonb_typeof($3)<>'array' or jsonb_typeof($4)<>'object' then raise exception 'canonical plan rejected'; end if;
      insert into canonical_calls values('team');
      return query select $2,1,jsonb_array_length($3);
    end$$;
    create function save_national_federation_race_preparation(text,uuid,uuid,jsonb,jsonb)
    returns void language plpgsql security definer as $$begin
      perform private.assert_federation_race_preparation_context($1,$2,$3,false);
      insert into canonical_calls values('federation');
    end$$;
    create function get_current_team_race_preparation() returns table(${fields})
    language sql security definer as $$select ${projection} from race_stage_strategies s join race_rosters r
      on r.race_registration_id=s.race_registration_id join team_manager_assignments a on a.team_id=s.team_id
      join sporting_directors d on d.id=a.sporting_director_id where d.auth_user_id=auth.uid()$$;
    create function get_current_national_federation_race_preparation(text) returns table(${fields})
    language sql security definer as $$select ${projection} from race_stage_strategies s join race_rosters r
      on r.race_registration_id=s.race_registration_id where s.team_id='${id(13)}' and $1='MU' and auth.uid()='${id(101)}'$$;
    revoke all on all tables in schema public from public,anon,authenticated;
    alter function public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb) set search_path=public;
    alter function public.save_national_federation_race_preparation(text,uuid,uuid,jsonb,jsonb) set search_path=public;
    alter function private.assert_federation_race_preparation_context(text,uuid,uuid,boolean) set search_path=public;
    alter function public.get_current_team_race_preparation() set search_path=public;
    alter function public.get_current_national_federation_race_preparation(text) set search_path=public;
  `);
  const hashes = await query("select proname,md5(pg_get_functiondef(oid)) hash from pg_proc where proname in('save_current_team_race_preparation','save_national_federation_race_preparation','get_current_team_race_preparation','get_current_national_federation_race_preparation') order by proname");
  await db.exec(migration);
  check(await order(41), [], 'existing rows default to automatic without a rewrite');
  check(await query("select proname,md5(pg_get_functiondef(oid)) hash from pg_proc where proname in('save_current_team_race_preparation','save_national_federation_race_preparation','get_current_team_race_preparation','get_current_national_federation_race_preparation') order by proname"), hashes, 'canonical RPCs untouched');
  const roles = Array.from({length:8},(_,i)=>({riderId:id(51+i),role:i===0?'sprinter':'leadout'}));
  const save = (preferences, submittedRoles=roles) => query('select * from save_current_team_race_preparation_with_sprint($1,$2,$3,$4)',
    [id(31),id(41),JSON.stringify(submittedRoles),JSON.stringify({sprintTrainOrder:preferences})]);
  await db.exec(`set role authenticated; select set_config('test.uid','${id(101)}',false)`);
  await save(roles.slice(1).map(r=>r.riderId).reverse());
  await db.exec('reset role');
  check(await order(41), roles.slice(1).map(r=>r.riderId).reverse(), 'all seven leadouts persisted in submitted order');
  await save([id(53),id(53),id(51),id(61),'bad',null,id(52)]);
  check(await order(41),[id(53),id(52)],'deduplicated; sprinter, foreign, stale and malformed entries ignored');
  await save([id(53),id(52)],roles.map(r=>r.riderId===id(53)?{...r,role:'domestique'}:r));
  check(await order(41),[id(52)],'changed roles are not silently reassigned');
  for(const malformed of [null,'broken',{},12,[]]) { await save(malformed); check(await order(41),[],'malformed optional order falls back to auto'); }
  await save([id(52)]);
  const own = await query('select * from get_current_team_race_preparation_with_sprint() order by race_edition_id,stage_id,rider_id limit 3 offset 2');
  check(own.length,3,'new getter remains sortable and pageable');
  check(own.every(r=>r.sprint_train_order[0]===id(52)&&r.team_id===id(11)),true,'reader preserves ownership scope');
  check((await query("select has_function_privilege('authenticated','private.store_sprint_train_order(uuid,uuid,jsonb,jsonb)','execute') allowed"))[0].allowed,false,'helper is private');
  check((await query("select has_function_privilege('anon','public.get_current_team_race_preparation_with_sprint()','execute') allowed"))[0].allowed,false,'anonymous reader forbidden');
  await db.exec('reset role');
  await db.exec(`select set_config('test.uid','${id(102)}',false)`);
  await assert.rejects(()=>save([id(54)]),/canonical context rejected/); checks++;
  check(await order(41),[id(52)],'unauthorized mutation has no effect');
  check((await query('select distinct team_id from get_current_team_race_preparation_with_sprint()'))[0].team_id,id(12),'other manager only sees own team');
  await db.exec(`select set_config('test.uid','${id(101)}',false);update stages set closed=true where id='${id(41)}'`);
  await assert.rejects(()=>save([id(54)]),/canonical context rejected/); checks++;
  check(await order(41),[id(52)],'deadline checked by canonical writer before saving sprint');
  await query('select save_national_federation_race_preparation_with_sprint($1,$2,$3,$4,$5)', ['MU',id(31),id(43),JSON.stringify([{riderId:id(62),role:'leadout'}]),JSON.stringify({sprintTrainOrder:[id(62),id(52)]})]);
  check(await order(43),[id(62)],'federation context and roster respected');
  check((await query("select sprint_train_order from get_current_national_federation_race_preparation_with_sprint('MU')"))[0].sprint_train_order,[id(62)],'federation order reloads in same request');
  check(await order(42),[],'other team / stage never touched');
  console.log(JSON.stringify({checks,status:'passed',database:'isolated PGlite',canonicalFunctions:'unchanged contract doubles'}));
} catch(error) {
  console.error(JSON.stringify({status:'failed',message:error.message,code:error.code,where:error.where}));
  process.exitCode=1;
} finally { await db.close(); }
