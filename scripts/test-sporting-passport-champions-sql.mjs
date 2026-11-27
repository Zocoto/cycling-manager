// Actual passport and manual naturalization functions in isolated PostgreSQL.
// No Supabase connection or production fixture is used.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ?? "";
if (!modulePath.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js")) {
  throw new Error("Pass the absolute path to a local PGlite installation.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const readMigration = async filename => (
  await readFile(new URL("../supabase/migrations/" + filename, import.meta.url), "utf8")
).replaceAll("\r\n", "\n");
const functionSource = (source, name) => {
  const start = source.indexOf("create or replace function public." + name + "(");
  const alternate = source.indexOf("create function public." + name + "(");
  const from = start >= 0 ? start : alternate;
  assert(from >= 0, "Missing actual function " + name);
  const end = source.indexOf("$$;", from);
  assert(end > from, "Missing actual function boundary " + name);
  return source.slice(from, end + 3);
};
const scalar = async (sql, values = []) => Object.values((await db.query(sql, values)).rows[0])[0];
let assertions = 0;
const check = (actual, expected, reason) => {
  assert.deepEqual(actual, expected, reason);
  assertions++;
};
const rejects = async (sql, pattern) => {
  await assert.rejects(db.query(sql), pattern);
  assertions++;
};
const redeem = (passport, rider) => `select public.redeem_current_daily_reward('${id(passport)}','${id(rider)}')`;
const manual = rider => `select public.naturalize_current_team_professional_rider('${id(rider)}')`;
const status = passport => scalar("select status from public.daily_reward_inventory where id=$1", [id(passport)]);
const country = rider => scalar("select country_id from public.riders where id=$1", [id(rider)]);
const targets = () => scalar("select public.get_current_team_item_target_values()");

try {
  const rewardsSource = await readMigration("20260801110000_create_daily_rewards.sql");
  const targetSource = await readMigration("20260827110000_add_injury_care_items.sql");
  const manualSource = await readMigration("20260817090000_fix_youth_naturalization_progress.sql");
  await db.exec(`
    create schema auth;
    create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('passport_fixture.user',true),'')::uuid $$;
    create function public.sync_active_season_day() returns void language plpgsql as $$ begin return; end; $$;
    create table public.sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table public.team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table public.seasons(id uuid primary key,game_year integer,status text,current_day_number integer);
    create table public.team_seasons(id uuid primary key,team_id uuid,season_id uuid,registration_country_id uuid,status text);
    create table public.season_days(id uuid primary key,season_id uuid,day_number integer);
    create table public.countries(id uuid primary key,name text,iso_alpha2 text,is_active boolean,continent_code text);
    create table public.riders(id uuid primary key,first_name text,last_name text,country_id uuid,status text,career_race_days integer default 0,potential_steps integer default 4);
    create table public.rider_contracts(id uuid primary key default gen_random_uuid(),rider_id uuid,team_id uuid,status text,start_season_id uuid,end_season_id uuid,joined_day_number integer default 1);
    create table public.rider_season_ratings(rider_id uuid,season_id uuid,
      mountain integer default 60,hills integer default 60,flat integer default 60,time_trial integer default 60,cobbles integer default 60,sprint integer default 60,
      acceleration integer default 60,downhill integer default 60,endurance integer default 60,resistance integer default 60,recovery integer default 60,breakaway integer default 60,prologue integer default 60);
    create table public.rider_condition_states(rider_id uuid,season_day_id uuid,form numeric,updated_at timestamptz default now());
    create table public.rider_special_abilities(rider_id uuid,ability_code text);
    create table public.rider_injuries(id uuid primary key,rider_id uuid,diagnosis_code text,expected_recovery_at timestamptz,status text);
    create table public.race_editions(id uuid primary key);
    create table public.rider_naturalizations(id uuid primary key default gen_random_uuid(),subject_type text,rider_id uuid,academy_rider_id uuid,team_id uuid,sporting_director_id uuid,
      season_id uuid,day_number integer,from_country_id uuid,to_country_id uuid,elapsed_tenure_days integer);
    create table public.rider_naturalization_country_progress(rider_id uuid,country_id uuid,required_days_override integer);
    create function public.get_rider_country_progress_days(uuid,uuid,uuid,integer) returns integer language sql as $$ select 0 $$;
    create function public.get_team_professional_naturalization_days(uuid) returns integer language sql as $$ select 84 $$;
    create table public.daily_reward_inventory(id uuid primary key,sporting_director_id uuid,reward_key text,status text default 'available',
      expires_after_game_year integer default 8,used_at timestamptz,usage_payload jsonb default '{}');
    create table public.fixture_country_changes(rider_id uuid,from_country_id uuid,to_country_id uuid);
    create function public.fixture_existing_country_trigger() returns trigger language plpgsql as $trigger$
    begin
      if current_setting('passport_fixture.block_country_change',true)='true' then
        raise exception 'Existing race reconciliation rejected the nationality change';
      end if;
      insert into public.fixture_country_changes values(new.id,old.country_id,new.country_id);
      return new;
    end;
    $trigger$;
    create trigger fixture_existing_country_trigger after update of country_id on public.riders
      for each row when (old.country_id is distinct from new.country_id)
      execute function public.fixture_existing_country_trigger();
    insert into public.countries values('${id(1)}','Belgique','BE',true,'europe'),('${id(2)}','France','FR',true,'europe');
    insert into public.seasons values('${id(3)}',5,'active',4);
    insert into public.season_days values('${id(4)}','${id(3)}',4);
    insert into public.sporting_directors values('${id(5)}','${id(6)}','active'),('${id(7)}','${id(8)}','active');
    insert into public.team_manager_assignments values('${id(5)}','${id(9)}','general_manager','active'),('${id(7)}','${id(10)}','general_manager','active');
    insert into public.team_seasons values('${id(11)}','${id(9)}','${id(3)}','${id(1)}','active'),('${id(12)}','${id(10)}','${id(3)}','${id(2)}','active');
    select set_config('passport_fixture.user','${id(6)}',false);
  `);
  const nationalSource = await readMigration("20260722160000_create_national_championships.sql");
  const titleTableStart = nationalSource.indexOf("create table public.rider_national_championship_titles (");
  const titleTableEnd = nationalSource.indexOf("alter table public.rider_national_championship_titles", titleTableStart);
  assert(titleTableStart >= 0 && titleTableEnd > titleTableStart, "Missing real title table schema");
  await db.exec(nationalSource.slice(titleTableStart, titleTableEnd));
  await db.exec(rewardsSource.match(/create table public\.daily_reward_catalog \([\s\S]*?\n\);/)[0]);
  await db.exec(`insert into public.daily_reward_catalog(reward_key,name,description,effect_summary,importance,effect_kind,effect_payload)
    values ('automatic-naturalization','Passeport sportif','Original description','Original summary',7,'naturalization','{}');`);
  await db.exec(functionSource(rewardsSource, "redeem_current_daily_reward"));
  await db.exec(`alter function public.redeem_current_daily_reward(uuid,uuid,text,text,uuid)
    rename to redeem_current_daily_reward_without_high_performance_cap;
    revoke all on function public.redeem_current_daily_reward_without_high_performance_cap(uuid,uuid,text,text,uuid) from public,anon,authenticated;`);
  const capSource = await readMigration("20260922150000_cap_high_performance_cell_rating.sql");
  await db.exec(functionSource(capSource, "redeem_current_daily_reward"));
  await db.exec(functionSource(targetSource, "get_current_team_item_target_values"));
  await db.exec(await readMigration("20261022090000_expose_sporting_passport_eligible_targets.sql"));
  await db.exec(functionSource(manualSource, "naturalize_current_team_professional_rider"));
  await db.exec(`
    revoke all on function public.redeem_current_daily_reward(uuid,uuid,text,text,uuid),
      public.get_current_team_item_target_values(),public.naturalize_current_team_professional_rider(uuid) from public,anon;
    grant execute on function public.redeem_current_daily_reward(uuid,uuid,text,text,uuid),
      public.get_current_team_item_target_values(),public.naturalize_current_team_professional_rider(uuid) to authenticated;
    grant select on public.riders,public.daily_reward_inventory to authenticated;
  `);
  for (let rider = 20; rider <= 28; rider++) {
    await db.query("insert into public.riders(id,first_name,last_name,country_id,status) values($1,'Rider',$2,$3,$4)",
      [id(rider), String(rider), id(rider === 24 ? 1 : 2), rider === 26 ? "retired" : "active"]);
    await db.query("insert into public.rider_contracts(rider_id,team_id,status,start_season_id,end_season_id) values($1,$2,$3,$4,$4)",
      [id(rider), id(rider === 25 ? 10 : 9), rider === 27 ? "expired" : "active", id(3)]);
    await db.query("insert into public.rider_season_ratings(rider_id,season_id) values($1,$2)", [id(rider), id(3)]);
    await db.query("insert into public.daily_reward_inventory(id,sporting_director_id,reward_key) values($1,$2,'automatic-naturalization')",
      [id(rider + 100), id(5)]);
  }
  await db.exec(`insert into public.race_editions values('${id(220)}'),('${id(221)}'),('${id(222)}'),('${id(223)}');
    insert into public.rider_national_championship_titles(rider_id,country_id,championship_type,relinquished_at,season_id,race_edition_id) values
    ('${id(20)}','${id(2)}','road',null,'${id(3)}','${id(220)}'),
    ('${id(21)}','${id(2)}','road','2026-10-01T00:00:00Z','${id(3)}','${id(221)}'),
    ('${id(22)}','${id(2)}','time_trial',null,'${id(3)}','${id(222)}'),
    ('${id(23)}','${id(2)}','time_trial','2026-10-01T00:00:00Z','${id(3)}','${id(223)}');`);

  const titlesBefore = await scalar("select jsonb_agg(to_jsonb(t)-'relinquished_at' order by id) from public.rider_national_championship_titles t");
  const inactiveBefore = await scalar("select jsonb_agg(to_jsonb(t) order by id) from public.rider_national_championship_titles t where relinquished_at is not null");
  const wrapperBefore = await scalar("select pg_get_functiondef('public.redeem_current_daily_reward(uuid,uuid,text,text,uuid)'::regprocedure)");
  const manualBefore = await scalar("select pg_get_functiondef('public.naturalize_current_team_professional_rider(uuid)'::regprocedure)");
  const oldTargets = await targets();
  check(oldTargets.map(rider => rider.canNaturalizeWithPassport), [false,false,false,false,false,true], "reproduces champion exclusion before the change");
  await rejects(redeem(120, 20), /ancien champion national/);
  check(await status(120), "available", "failed champion use retains passport");

  const passportMigration = await readFile(new URL(
    "../supabase/migrations/20261123120000_allow_sporting_passport_for_national_champions.sql",
    import.meta.url,
  ), "utf8");
  const windowsMigration = passportMigration.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n");
  check(windowsMigration.includes("\r\n"), true, "executes the actual migration with Windows line endings");
  await db.exec(windowsMigration);
  await db.exec("create schema private");
  await db.exec(await readMigration("20261127120000_relinquish_ineligible_champion_jerseys_on_nationality_change.sql"));
  check(await scalar("select pg_get_functiondef('public.redeem_current_daily_reward(uuid,uuid,text,text,uuid)'::regprocedure)"), wrapperBefore, "public high-performance wrapper is unchanged");
  check(await scalar("select pg_get_functiondef('public.naturalize_current_team_professional_rider(uuid)'::regprocedure)"), manualBefore, "ordinary naturalization function is unchanged");
  const newTargets = await targets();
  check(newTargets.map(rider => rider.canNaturalizeWithPassport), [true,true,true,true,false,true], "current and past road/TT champions become passport candidates");
  const withoutFlag = riders => riders.map(({canNaturalizeWithPassport, ...rider}) => rider);
  check(withoutFlag(newTargets), withoutFlag(oldTargets), "other item targets and metadata are preserved");
  check(await scalar("select effect_summary from public.daily_reward_catalog where reward_key='automatic-naturalization'"),
    "Naturalisation immédiate · champions nationaux inclus", "passport text explains the exception");
  await db.exec("set role authenticated");
  for (const rider of [20,21,22,23]) {
    await rejects(manual(rider), /ancien champion national/);
    await db.query(redeem(rider + 100, rider));
    check(await country(rider), id(1), "passport naturalizes a champion");
    check(await status(rider + 100), "used", "passport is consumed exactly once");
    await rejects(redeem(rider + 100, rider), /plus disponible/);
  }
  await rejects(manual(28), /84 jours de jeu/);
  await rejects(redeem(124, 24), /déjà la nationalité/);
  check(await status(124), "available", "same-country rejection preserves the passport");
  await rejects(redeem(125, 25), /professionnel de votre équipe/);
  await rejects(redeem(126, 26), /professionnel de votre équipe/);
  await rejects(redeem(127, 27), /professionnel de votre équipe/);
  await db.exec("reset role");
  check(await scalar("select count(*)::integer from public.rider_naturalizations"), 4, "one history row per successful use");
  check(await scalar("select jsonb_agg(to_jsonb(t)-'relinquished_at' order by id) from public.rider_national_championship_titles t"), titlesBefore, "historical national titles retain their country, win and results");
  check(await scalar("select count(*)::integer from public.rider_national_championship_titles where relinquished_at is null"), 0, "passport immediately retires incompatible currently worn national jerseys");
  check(await scalar(`select jsonb_agg(to_jsonb(t) order by id) from public.rider_national_championship_titles t where rider_id in ('${id(21)}','${id(23)}')`), inactiveBefore, "passport preserves already relinquished national title history exactly");
  check(await scalar("select count(*)::integer from public.fixture_country_changes"), 4, "existing nationality trigger still runs on every successful use");

  await db.exec(`select set_config('passport_fixture.user','${id(8)}',false); set role authenticated;`);
  await rejects(redeem(128, 28), /plus disponible/);
  await db.exec(`reset role; select set_config('passport_fixture.user','${id(6)}',false);
    select set_config('passport_fixture.block_country_change','true',false); set role authenticated;`);
  await rejects(redeem(128, 28), /Existing race reconciliation rejected/);
  await db.exec("reset role");
  check(await status(128), "available", "a race reconciliation failure rolls back item consumption");
  check(await country(28), id(2), "a race reconciliation failure rolls back the country change");
  check(await scalar("select count(*)::integer from public.rider_naturalizations"), 4, "a failed change creates no history");
  await db.exec("set role anon");
  await rejects(redeem(128, 28), /permission denied/);
  await db.exec("reset role");
  check(await scalar("select has_function_privilege('authenticated','public.redeem_current_daily_reward_without_high_performance_cap(uuid,uuid,text,text,uuid)','execute')"), false, "internal redemption remains private");
  console.log(JSON.stringify({ isolated: true, productionActions: false, assertions, championPassports: 4, ordinaryNaturalizationPreserved: true }));
} catch (error) {
  console.error(JSON.stringify({ message: error.message, query: error.query, where: error.where }));
  process.exitCode = 1;
} finally {
  await db.close();
}

