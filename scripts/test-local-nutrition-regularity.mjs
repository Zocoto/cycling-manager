// Isolated in-memory PostgreSQL only: no env loading or live database access.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rider = id(1), occasionalRider = id(2), mediumRider = id(3), snackRider = id(4);
const season = id(10), nextSeason = id(11), teamSeason = id(20), nextTeamSeason = id(21);
const currentDay = id(107), pauseDay = id(114);
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.riders(id uuid primary key, weight_kg numeric);
    create table public.seasons(id uuid primary key, game_year integer);
    create table public.team_seasons(id uuid primary key, team_id uuid, season_id uuid);
    create table public.season_days(id uuid primary key, season_id uuid, day_number integer, calendar_date date);
    create table public.rider_nutrition_interventions(
      id uuid primary key, rider_id uuid not null, team_season_id uuid,
      season_day_id uuid not null, intervention_code text, nutritionist_level integer,
      applied_at timestamptz default now(), weight_before_kg numeric,
      weight_delta_kg numeric, weight_after_kg numeric,
      unique(rider_id, season_day_id)
    );
    create table public.rider_weight_events(
      rider_id uuid, team_id uuid, season_id uuid, season_day_id uuid,
      game_day_index integer, source text, weight_before_kg numeric,
      weight_delta_kg numeric, weight_after_kg numeric, source_reference text unique
    );
    -- Controlled deterministic roll tests both sides of each risk threshold.
    create function public.physiology_seed_fraction(text) returns numeric language sql as $$
      select current_setting('test.nutrition_roll')::numeric
    $$;
    insert into public.riders values('${rider}',70),('${occasionalRider}',70),('${mediumRider}',70),('${snackRider}',70);
    insert into public.seasons values('${season}',3),('${nextSeason}',4);
    insert into public.team_seasons values('${teamSeason}','${id(30)}','${season}'),('${nextTeamSeason}','${id(31)}','${nextSeason}');
  `);
  // Seed actual prior doses before installing the trigger. No historical replay.
  for (let day = 0; day <= 14; day++) {
    await db.query("insert into public.season_days values($1,$2,$3,date '2026-09-30' + $4::integer)",
      [id(100 + day), day < 7 ? season : nextSeason, day < 7 ? 28 + day : day - 6, day]);
  }
  for (let day = 0; day <= 6; day++) {
    for (const [index, target] of [rider, mediumRider, snackRider].entries()) {
      await db.query(`insert into public.rider_nutrition_interventions
        (id,rider_id,team_season_id,season_day_id,intervention_code,nutritionist_level,applied_at)
        values($1,$2,$3,$4,$5,1,'2026-12-01')`,
        [id(1000 + index * 100 + day), target, teamSeason, id(100 + day),
          day % 2 ? "recovery_snack" : "elite_recharge"]);
    }
  }
  await db.exec(await readFile("supabase/migrations/20261007120000_increase_supplement_risk_with_regularity.sql", "utf8"));
  await db.exec(`create trigger apply_supplement_weight_risk_before_insert
    before insert on public.rider_nutrition_interventions
    for each row execute function public.apply_supplement_weight_risk()`);

  const counts = async (riders, day) => (await db.query(
    "select * from public.get_recent_supplement_use_counts($1::uuid[],$2)", [riders, day])).rows;
  assert.deepEqual(await counts([rider, occasionalRider], currentDay), [
    { rider_id: rider, recent_use_count: 6 }, { rider_id: occasionalRider, recent_use_count: 0 },
  ], "six prior calendar days, across season/team/supplement changes, regardless of processing timestamp");
  assert.equal((await counts([rider, rider], currentDay)).length, 1, "deduplicated requested riders");
  assert.equal((await counts([rider], id(100))).at(0).recent_use_count, 0, "future doses do not count");
  assert.equal((await counts([rider], pauseDay)).at(0).recent_use_count, 0, "six-day window decays after a break");
  assert.deepEqual(await counts([], currentDay), []);
  await assert.rejects(() => counts(Array(101).fill(rider), currentDay), /100 coureurs/);
  await assert.rejects(() => counts([rider], id(999)), /no rows/);
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(() => counts([rider], currentDay), /permission denied/);
    await db.exec("reset role");
  }
  await db.exec("set role service_role");
  assert.equal((await counts([rider], currentDay)).at(0).recent_use_count, 6);
  await db.exec("reset role");

  const dose = async (target, day, code, level, doseId, roll) => {
    await db.query("select set_config('test.nutrition_roll',$1,false)", [String(roll)]);
    return (await db.query(`insert into public.rider_nutrition_interventions
      (id,rider_id,team_season_id,season_day_id,intervention_code,nutritionist_level)
      values($1,$2,$3,$4,$5,$6) returning weight_delta_kg,weight_after_kg`,
      [doseId, target, nextTeamSeason, day, code, level])).rows.at(0);
  };
  assert.equal(Number((await dose(rider,currentDay,"elite_recharge",5,id(2001),0.21)).weight_delta_kg),0.3,
    "21% roll gains 0.3 kg under 22% regular risk");
  assert.equal(Number((await dose(occasionalRider,currentDay,"elite_recharge",5,id(2002),0.21)).weight_delta_kg),0,
    "same roll does not gain weight under unchanged 10% occasional risk");
  assert.equal(Number((await dose(mediumRider,currentDay,"tailored_plan",3,id(2003),0.179)).weight_delta_kg),0.2,
    "medium dose: 18% regular risk, unchanged 0.2 kg gain");
  assert.equal(Number((await dose(snackRider,currentDay,"recovery_snack",1,id(2004),0.159)).weight_delta_kg),0.1,
    "small dose: 16% regular risk, unchanged 0.1 kg gain");
  assert.equal((await counts([rider],currentDay)).at(0).recent_use_count,6,"current dose excluded from preview");
  await assert.rejects(() => dose(rider,currentDay,"elite_recharge",5,id(2005),0), /unique constraint/);
  assert.equal(Number((await db.query("select weight_kg from public.riders where id=$1",[rider])).rows.at(0).weight_kg),70.3,
    "failed duplicate rolls back all weight effects");
  assert.equal((await db.query("select count(*)::integer as n from public.rider_weight_events")).rows.at(0).n,3,
    "one event per triggered gain, no event for zero gain or failed retry");
  assert.equal(Number((await dose(rider,pauseDay,"elite_recharge",5,id(2006),0.1)).weight_delta_kg),0,
    "risk resets to 10% after pause, threshold remains strictly less than risk");
  // Installing the same migration again cannot change past weight or duplicate the trigger.
  await db.exec(await readFile("supabase/migrations/20261007120000_increase_supplement_risk_with_regularity.sql", "utf8"));
  assert.equal(Number((await db.query("select weight_kg from public.riders where id=$1",[rider])).rows.at(0).weight_kg),70.3);
  console.log("PASS: progressive risk, base risk, potency, real history, pauses, season/team changes, future exclusion, roles, bounds, failed retries and no historical replay.");
} finally { await db.close(); }
