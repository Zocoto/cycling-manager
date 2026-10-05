// Runs entirely in an isolated, in-memory PostgreSQL instance.
// Pass a local @electric-sql/pglite module path if it is not installed here.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(process.argv[2]
  ? pathToFileURL(process.argv[2]).href
  : "@electric-sql/pglite");
const db = new PGlite();
const read = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8").replaceAll("\r", "");
const definition = (source, name) => {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert(start >= 0, `Missing function ${name}`);
  const end = source.indexOf("\n$$;", start);
  assert(end >= start, `Missing end for ${name}`);
  return source.slice(start, end + 4);
};
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const scalar = async (sql, params = []) => (await db.query(sql, params)).rows[0].value;
const opportunity = () => scalar("select public.get_current_equipment_rnd_opportunity() as value");
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table sporting_directors(id uuid primary key, auth_user_id uuid, status text);
    create table team_manager_assignments(sporting_director_id uuid, team_id uuid, role text, status text);
    create table seasons(id uuid primary key, game_year integer, current_day_number integer, status text);
    create table team_seasons(id uuid primary key, team_id uuid, season_id uuid, status text);
    create table team_infrastructures(team_id uuid, infrastructure_code text, level integer);
    create table staff_members(id uuid primary key, role text, level integer);
    create table staff_contracts(id uuid primary key, staff_member_id uuid, team_id uuid, status text);
    create table staff_member_talents(staff_member_id uuid, talent_code text);
    create table equipment_catalog_items(
      id uuid primary key default gen_random_uuid(), catalog_key text, name text, slot_type text,
      status text, supplier_key text, supplier_name text, description text, price numeric,
      rarity text, image_path text, effect_summary text, effect_payload jsonb,
      acquisition_channel text, owner_team_id uuid
    );
    create table team_equipment_inventory(
      team_season_id uuid, equipment_item_id uuid, quantity integer, last_purchase_price numeric,
      primary key(team_season_id,equipment_item_id)
    );
    create table rider_contracts(rider_id uuid, team_id uuid, status text);
    create table rider_equipment_assignments(rider_id uuid, equipment_item_id uuid);
    create table rider_equipment_pending_assignments(team_season_id uuid, equipment_item_id uuid);
    create table equipment_rnd_projects(
      id uuid primary key default gen_random_uuid(), team_id uuid, started_team_season_id uuid,
      input_equipment_item_id uuid, engineer_contract_id uuid, lab_level integer, success_rate integer,
      research_cost numeric, starts_game_day_index integer, completes_game_day_index integer,
      status text default 'active', prototype_name text,
      prototype_equipment_item_id uuid, rating_key text, outcome text, rating_delta integer, completed_at timestamptz
    );
    create unique index on equipment_rnd_projects(engineer_contract_id)
      where status = 'active' and engineer_contract_id is not null;
    create function public.sync_active_season_day() returns void language sql as $$ select $$;
    create function public.get_team_infrastructure_efficiency_multiplier(uuid,text)
      returns numeric language sql as $$ select 1::numeric $$;
    create function public.get_equipment_rnd_setback_delta(uuid)
      returns integer language sql as $$ select -1 $$;
  `);
  const parallel = read("20260824150000_make_equipment_rnd_free_scalable_and_parallel.sql");
  const duration = read("20260825141000_rebalance_equipment_rnd_duration_and_cap.sql");
  const named = read("20260830170000_repeat_name_and_resell_rnd_prototypes.sql");
  await db.exec(definition(parallel, "calculate_equipment_rnd_bonus_total"));
  await db.exec(definition(duration, "calculate_equipment_rnd_base_duration_days"));
  for (const name of ["calculate_equipment_rnd_duration_days", "start_current_team_equipment_rnd"])
    await db.exec(definition(parallel, name));
  await db.exec(definition(duration, "enforce_equipment_rnd_bonus_cap"));
  await db.exec("create trigger enforce_equipment_rnd_bonus_cap before insert or update of status, input_equipment_item_id on equipment_rnd_projects for each row execute function public.enforce_equipment_rnd_bonus_cap()");
  await db.exec(definition(named, "settle_due_equipment_rnd_projects"));
  // Include both later settlement extensions, proving the name-only migration
  // preserves them instead of replacing the settlement with an older version.
  const exceptional = read("20260919030000_add_exceptional_rnd_prototypes.sql");
  await db.exec(definition(exceptional, "get_equipment_rnd_exceptional_chance"));
  await db.exec(exceptional.match(/do \$migration\$[\s\S]*?\$migration\$;/)[0]);
  const setback = read("20260909160000_add_operational_staff_affixes.sql");
  const setbackBlock = setback.match(/do \$migration\$[\s\S]*?\$migration\$;/g)
    .find((block) => block.includes("'v_delta := -1;'"));
  assert(setbackBlock);
  await db.exec(setbackBlock);
  await db.exec(read("20261005120000_preserve_researched_prototype_names_and_alert_free_engineers.sql"));

  await db.exec(`
    set request.jwt.claim.sub = '${uuid(1)}';
    insert into sporting_directors values ('${uuid(1)}','${uuid(1)}','active'),('${uuid(2)}','${uuid(2)}','active');
    insert into team_manager_assignments values ('${uuid(1)}','${uuid(10)}','general_manager','active'),('${uuid(2)}','${uuid(20)}','general_manager','active');
    insert into seasons values ('${uuid(30)}',2026,1,'active');
    insert into team_seasons values ('${uuid(40)}','${uuid(10)}','${uuid(30)}','active'),('${uuid(50)}','${uuid(20)}','${uuid(30)}','active');
    insert into team_infrastructures values ('${uuid(10)}','research_lab',1),('${uuid(20)}','research_lab',7);
    insert into staff_members values ('${uuid(60)}','research_engineer',2),('${uuid(61)}','research_engineer',3),('${uuid(62)}','scout',5);
    insert into staff_contracts values ('${uuid(70)}','${uuid(60)}','${uuid(10)}','active'),('${uuid(71)}','${uuid(61)}','${uuid(20)}','active'),('${uuid(72)}','${uuid(62)}','${uuid(10)}','active');
    insert into equipment_catalog_items(id,name,slot_type,status,effect_payload,acquisition_channel,owner_team_id,effect_summary)
      values ('${uuid(80)}','Aquila RS-X','frame','active','{"ratingBonuses":{"mountain":5},"timeTrialRatingBonuses":{"timeTrial":1,"prologue":-1}}','research_prototype','${uuid(10)}','Prototype');
    insert into team_equipment_inventory values ('${uuid(40)}','${uuid(80)}',1,0);
  `);
  check(await opportunity(), 1);
  await db.exec(`update team_infrastructures set level=0 where team_id='${uuid(10)}'`);
  check(await opportunity(), 0);
  await db.exec(`update team_infrastructures set level=1 where team_id='${uuid(10)}'`);
  await db.exec(`insert into rider_contracts values ('${uuid(90)}','${uuid(10)}','active'); insert into rider_equipment_assignments values ('${uuid(90)}','${uuid(80)}')`);
  check(await opportunity(), 0);
  await db.exec("delete from rider_equipment_assignments");
  await db.exec(`insert into rider_equipment_pending_assignments values ('${uuid(40)}','${uuid(80)}')`);
  check(await opportunity(), 0);
  await db.exec("delete from rider_equipment_pending_assignments");
  await db.exec(`update equipment_catalog_items set slot_type='helmet'`);
  check(await opportunity(), 0);
  await db.exec(`update equipment_catalog_items set slot_type='frame',acquisition_channel='equipment_partner'`);
  check(await opportunity(), 0);
  await db.exec(`update equipment_catalog_items set acquisition_channel='research_prototype',owner_team_id='${uuid(20)}'`);
  check(await opportunity(), 0);
  await db.exec(`update equipment_catalog_items set owner_team_id='${uuid(10)}',effect_payload='{"ratingBonuses":{"mountain":10}}'`);
  check(await opportunity(), 0);
  await assert.rejects(db.query("select start_current_team_equipment_rnd($1,$2,null)",[uuid(80),uuid(70)]), /plafond R&D/); checks++;
  await db.exec(`update equipment_catalog_items set effect_payload='{"ratingBonuses":{"mountain":5},"timeTrialRatingBonuses":{"timeTrial":1,"prologue":-1}}'`);
  await db.exec(`set request.jwt.claim.sub = '${uuid(2)}'`);
  check(await opportunity(), 0);
  await assert.rejects(db.query("select start_current_team_equipment_rnd($1,$2,null)",[uuid(80),uuid(71)]), /ne peut pas/); checks++;
  await db.exec(`set request.jwt.claim.sub = '${uuid(1)}'`);
  const projectId = await scalar("select start_current_team_equipment_rnd($1,$2,$3) as value",[uuid(80),uuid(70),"Unwanted rename"]);
  check(await scalar("select prototype_name as value from equipment_rnd_projects where id=$1",[projectId]), null);
  check(await scalar("select completes_game_day_index-starts_game_day_index as value from equipment_rnd_projects where id=$1",[projectId]),10);
  check(await opportunity(), 0);
  await assert.rejects(db.query("select start_current_team_equipment_rnd($1,$2,null)",[uuid(80),uuid(70)]), /déjà une recherche/); checks++;
  // Force a deterministic setback, then research the result immediately.
  await db.query("update equipment_rnd_projects set success_rate=0 where id=$1",[projectId]);
  await db.exec("update seasons set current_day_number=11");
  check(await scalar("select settle_due_equipment_rnd_projects() as value"),1);
  const result1 = await scalar("select prototype_equipment_item_id as value from equipment_rnd_projects where id=$1",[projectId]);
  check(await scalar("select name as value from equipment_catalog_items where id=$1",[result1]),"Aquila RS-X");
  check(await scalar("select calculate_equipment_rnd_bonus_total(effect_payload) as value from equipment_catalog_items where id=$1",[result1]),4);
  check(await opportunity(),1);
  const project2 = await scalar("select start_current_team_equipment_rnd($1,$2,null) as value",[result1,uuid(70)]);
  check(await scalar("select completes_game_day_index-starts_game_day_index as value from equipment_rnd_projects where id=$1",[project2]),8);
  await db.query("update equipment_rnd_projects set success_rate=100 where id=$1",[project2]);
  await db.exec("update seasons set current_day_number=19");
  check(await scalar("select settle_due_equipment_rnd_projects() as value"),1);
  const result2 = await scalar("select prototype_equipment_item_id as value from equipment_rnd_projects where id=$1",[project2]);
  check(await scalar("select name as value from equipment_catalog_items where id=$1",[result2]),"Aquila RS-X");
  const score2 = await scalar("select calculate_equipment_rnd_bonus_total(effect_payload) as value from equipment_catalog_items where id=$1",[result2]);
  assert(score2 > 4); checks++;
  const project3 = await scalar("select start_current_team_equipment_rnd($1,$2,null) as value",[result2,uuid(70)]);
  const nextDuration = await scalar("select completes_game_day_index-starts_game_day_index as value from equipment_rnd_projects where id=$1",[project3]);
  assert(nextDuration > 8); checks++;
  await db.query("update equipment_rnd_projects set status='cancelled' where id=$1",[project3]);
  await db.exec(`insert into equipment_catalog_items(id,name,slot_type,status,effect_payload,acquisition_channel,effect_summary) values ('${uuid(81)}','Commercial frame','frame','active','{}','commercial','Series'); insert into team_equipment_inventory values ('${uuid(40)}','${uuid(81)}',1,0)`);
  await assert.rejects(db.query("select start_current_team_equipment_rnd($1,$2,null)",[uuid(81),uuid(70)]), /nom du prototype/); checks++;
  const first = await scalar("select start_current_team_equipment_rnd($1,$2,$3) as value",[uuid(81),uuid(70),"  My   first prototype  "]);
  check(await scalar("select prototype_name as value from equipment_rnd_projects where id=$1",[first]),"My first prototype");
  const installed = await scalar("select pg_get_functiondef('public.settle_due_equipment_rnd_projects()'::regprocedure) as value");
  assert(installed.includes("get_equipment_rnd_exceptional_chance")); checks++;
  assert(installed.includes("get_equipment_rnd_setback_delta")); checks++;
  console.log(`${checks} PostgreSQL R&D integration checks passed (isolated memory database).`);
} catch (error) {
  console.error(`R&D integration check failed: ${error.message}`);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally {
  await db.close();
}
