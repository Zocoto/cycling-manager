import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Intentionally no environment loading, URL, Supabase client or external DB.
// This harness creates only an ephemeral, in-memory PostgreSQL instance.
// Install its test-only dependency with:
// npm install --no-save --package-lock=false --ignore-scripts --prefix artifacts/.tmp-performance-preparations @electric-sql/pglite@0.5.10
if (process.argv.slice(2).some((argument) => argument !== "--isolated")) {
  throw new Error("Only --isolated is accepted; external databases are forbidden.");
}
const { PGlite } = await import(
  "../artifacts/.tmp-performance-preparations/node_modules/@electric-sql/pglite/dist/index.js"
);
const database = new PGlite();
const uuid = (number) => `00000000-0000-0000-0000-${String(number).padStart(12, "0")}`;
const AUTH = uuid(1);
const DIRECTOR = uuid(2);
const TEAM = uuid(3);
const OTHER_TEAM = uuid(4);
const SEASON = uuid(5);
const TEAM_SEASON = uuid(6);
const OTHER_TEAM_SEASON = uuid(7);
const RIDERS = Array.from({ length: 8 }, (_, index) => uuid(20 + index));
const FOREIGN_RIDER = uuid(30);
const DAY = 10;
const GAME_YEAR = 4;
const GAME_DAY = GAME_YEAR * 28 + DAY - 1;
const START = GAME_DAY + 3;
const POLICIES = [
  { level: 1, bonus: 1, days: 3, capacity: 1 },
  { level: 2, bonus: 1.5, days: 4, capacity: 1 },
  { level: 3, bonus: 2, days: 4, capacity: 2 },
  { level: 4, bonus: 2.5, days: 5, capacity: 2 },
  { level: 5, bonus: 3, days: 6, capacity: 3 },
];
let passed = 0;

async function test(name, callback) {
  await callback();
  passed += 1;
  console.log(`PASS ${name}`);
}

async function reset({ level = 5, day = DAY, multiplier = 1 } = {}) {
  await database.exec(`
    truncate public.sporting_directors, public.team_manager_assignments,
      public.seasons, public.team_seasons, public.riders,
      public.rider_contracts, public.team_infrastructures, public.rider_injuries,
      public.rider_form_camps, public.rider_performance_preparations,
      public.race_rosters, public.race_registrations, public.stages,
      public.season_days, public.fixture_efficiency;
  `);
  await database.query("select set_config('test.auth_user_id', $1, false)", [AUTH]);
  await database.query("insert into public.fixture_efficiency values ($1)", [multiplier]);
  await database.query("insert into public.sporting_directors values ($1, $2, 'active')", [DIRECTOR, AUTH]);
  await database.query("insert into public.team_manager_assignments values ($1, $2, 'general_manager', 'active')", [DIRECTOR, TEAM]);
  await database.query("insert into public.seasons values ($1, 'active', $2, $3)", [SEASON, GAME_YEAR, day]);
  await database.query("insert into public.team_seasons values ($1, $2, $3), ($4, $5, $3)", [TEAM_SEASON, TEAM, SEASON, OTHER_TEAM_SEASON, OTHER_TEAM]);
  for (const rider of [...RIDERS, FOREIGN_RIDER]) {
    await database.query("insert into public.riders values ($1, 73.5, 76.25)", [rider]);
    await database.query("insert into public.rider_contracts values ($1, $2, 'active')", [rider, rider === FOREIGN_RIDER ? OTHER_TEAM : TEAM]);
  }
  for (const type of ["indoor_track", "wind_tunnel"]) {
    await database.query("insert into public.team_infrastructures values ($1, $2, $3), ($4, $2, 5)", [TEAM, type, level, OTHER_TEAM]);
  }
}

async function start(rider = RIDERS[0], type = "indoor_track") {
  const { rows } = await database.query(
    "select public.start_current_team_rider_performance_preparation($1::uuid, $2::text) as id",
    [rider, type],
  );
  return (await database.query("select * from public.rider_performance_preparations where id = $1", [rows[0].id])).rows[0];
}

async function rejected(message, rider = RIDERS[0], type = "indoor_track") {
  const before = (await database.query("select count(*)::integer as count from public.rider_form_camps")).rows[0].count;
  await assert.rejects(() => start(rider, type), (error) => {
    assert.ok(error.message.includes(message), `Expected ${message}; received ${error.message}`);
    return true;
  });
  assert.equal((await database.query("select count(*)::integer as count from public.rider_form_camps")).rows[0].count, before);
}

async function oldPreparation({
  rider = RIDERS[0], team = TEAM, type = "indoor_track", status = "completed",
  bonusStart = START - 2, bonusEnd = START + 2,
  prepStart = GAME_DAY - 4, prepEnd = GAME_DAY - 3,
} = {}) {
  return (await database.query(`
    insert into public.rider_performance_preparations (
      team_id, team_season_id, season_id, rider_id, form_camp_id,
      preparation_type, building_level, preparation_start_game_day,
      preparation_end_game_day, bonus_start_game_day, bonus_end_game_day,
      rating_bonus, status
    ) values ($1, $2, $3, $4, gen_random_uuid(), $5, 3, $6, $7, $8, $9, 2.2, $10)
    returning *
  `, [team, team === TEAM ? TEAM_SEASON : OTHER_TEAM_SEASON, SEASON, rider, type,
    prepStart, prepEnd, bonusStart, bonusEnd, status])).rows[0];
}

try {
  await database.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.auth_user_id', true), '')::uuid
    $$;
    create table public.fixture_efficiency (multiplier numeric not null);
    create function public.sync_active_season_day() returns void language plpgsql as $$ begin return; end $$;
    create function public.get_team_infrastructure_efficiency_multiplier(uuid, text)
      returns numeric language sql stable as $$ select multiplier from public.fixture_efficiency limit 1 $$;
    create table public.sporting_directors (id uuid primary key, auth_user_id uuid, status text);
    create table public.team_manager_assignments (sporting_director_id uuid, team_id uuid, role text, status text);
    create table public.seasons (id uuid primary key, status text, game_year integer, current_day_number integer);
    create table public.team_seasons (id uuid primary key, team_id uuid, season_id uuid);
    create table public.riders (id uuid primary key, sprint numeric, time_trial numeric);
    create table public.rider_contracts (rider_id uuid, team_id uuid, status text);
    create table public.team_infrastructures (team_id uuid, infrastructure_code text, level integer, primary key (team_id, infrastructure_code));
    create table public.rider_injuries (rider_id uuid, status text);
    create table public.rider_form_camps (
      id uuid primary key default gen_random_uuid(), rider_id uuid,
      team_season_id uuid, season_id uuid, camp_type text,
      start_day_number integer, end_day_number integer,
      form_gain_per_day numeric, price_per_day numeric, total_price numeric,
      status text not null default 'planned'
    );
    create table public.rider_performance_preparations (
      id uuid primary key default gen_random_uuid(), team_id uuid,
      team_season_id uuid, season_id uuid, rider_id uuid, form_camp_id uuid,
      preparation_type text not null check (preparation_type in ('indoor_track', 'wind_tunnel')),
      building_level integer not null check (building_level between 1 and 5),
      preparation_start_game_day integer, preparation_end_game_day integer,
      bonus_start_game_day integer, bonus_end_game_day integer,
      rating_bonus numeric(5, 2) not null check (rating_bonus between 1 and 3.3),
      status text not null default 'planned'
    );
    create unique index rider_performance_preparations_facility_active_idx
      on public.rider_performance_preparations(team_id, preparation_type) where status = 'planned';
    create table public.race_rosters (rider_id uuid, race_registration_id uuid);
    create table public.race_registrations (id uuid, status text, race_edition_id uuid);
    create table public.stages (race_edition_id uuid, season_day_id uuid);
    create table public.season_days (id uuid, season_id uuid, day_number integer);
  `);
  await reset();
  const legacy = await oldPreparation({ status: "planned" });
  const ridersBefore = (await database.query("select * from public.riders order by id")).rows;
  const migration = await readFile(new URL("../supabase/migrations/20261020090000_rebalance_performance_preparations.sql", import.meta.url), "utf8");
  await database.exec(migration);

  await test("deployment receipts match the exact normalized function bodies", async () => {
    for (const [name, parameters] of [
      ["get_performance_preparation_policy", "integer"],
      ["start_current_team_rider_performance_preparation", "uuid,text"],
    ]) {
      const body = migration.match(new RegExp(
        `create or replace function public\\.${name}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`, "i",
      ))?.[1];
      assert.ok(body);
      const expected = createHash("md5").update(body.replace(/\s/g, "")).digest("hex");
      const { rows } = await database.query(
        "select md5(regexp_replace(prosrc, '[[:space:]]', '', 'g')) as hash from pg_catalog.pg_proc where oid=to_regprocedure($1)",
        [`public.${name}(${parameters})`],
      );
      assert.equal(rows[0].hash, expected);
    }
  });

  await test("migration compiles and preserves every legacy preparation value and rider rating", async () => {
    assert.deepEqual((await database.query("select * from public.rider_performance_preparations where id = $1", [legacy.id])).rows[0], legacy);
    assert.deepEqual((await database.query("select * from public.riders order by id")).rows, ridersBefore);
    assert.equal((await database.query("select to_regclass('public.rider_performance_preparations_facility_active_idx') as name")).rows[0].name, null);
    assert.ok((await database.query("select to_regclass('public.rider_performance_preparations_facility_planned_idx') as name")).rows[0].name);
  });

  await test("five exact policies and invalid levels", async () => {
    for (const policy of POLICIES) {
      const { rows } = await database.query("select * from public.get_performance_preparation_policy($1)", [policy.level]);
      assert.deepEqual(rows.map((row) => ({ bonus: Number(row.rating_bonus), days: row.bonus_days, capacity: row.capacity })), [{ bonus: policy.bonus, days: policy.days, capacity: policy.capacity }]);
    }
    for (const invalid of [0, -1, 6, null]) {
      assert.equal((await database.query("select * from public.get_performance_preparation_policy($1)", [invalid])).rows.length, 0);
    }
  });

  for (const type of ["indoor_track", "wind_tunnel"]) {
    for (const policy of POLICIES) {
      await test(`${type} level ${policy.level}: bonus, duration, exact capacity and free two-day camp`, async () => {
        await reset({ level: policy.level });
        for (let index = 0; index < policy.capacity; index += 1) {
          const row = await start(RIDERS[index], type);
          assert.equal(Number(row.rating_bonus), policy.bonus);
          assert.equal(row.bonus_start_game_day, START);
          assert.equal(row.bonus_end_game_day - row.bonus_start_game_day + 1, policy.days);
          assert.equal(row.preparation_start_game_day, GAME_DAY + 1);
          assert.equal(row.preparation_end_game_day, GAME_DAY + 2);
          const camp = (await database.query("select * from public.rider_form_camps where id = $1", [row.form_camp_id])).rows[0];
          assert.equal(camp.start_day_number, DAY + 1);
          assert.equal(camp.end_day_number, DAY + 2);
          assert.equal(Number(camp.total_price), 0);
          assert.equal(Number(camp.form_gain_per_day), 0);
        }
        await rejected("Toutes les places", RIDERS[policy.capacity], type);
      });
    }
  }

  await test("architect efficiency remains applied and capped at 3.3", async () => {
    await reset({ multiplier: 1.1 });
    assert.equal(Number((await start()).rating_bonus), 3.3);
    await reset({ level: 2, multiplier: 1.1 });
    assert.equal(Number((await start()).rating_bonus), 1.65);
    await reset({ multiplier: 9 });
    assert.equal(Number((await start()).rating_bonus), 3.3);
  });

  await test("authentication, active assignment, ownership and input guards", async () => {
    await reset();
    await database.query("select set_config('test.auth_user_id', '', false)");
    await rejected("Authentification requise");
    await database.query("select set_config('test.auth_user_id', $1, false)", [AUTH]);
    await rejected("Type de préparation invalide", null);
    await rejected("Type de préparation invalide", RIDERS[0], null);
    await rejected("Type de préparation invalide", RIDERS[0], "unknown");
    await rejected("n’appartient pas", FOREIGN_RIDER);
    await database.exec("update public.rider_contracts set status = 'expired'");
    await rejected("n’appartient pas");
    await database.exec("update public.team_manager_assignments set status = 'inactive'");
    await rejected("Aucune équipe active");
  });

  await test("missing, unbuilt and invalid-level buildings are rejected", async () => {
    await reset();
    await database.query("delete from public.team_infrastructures where team_id = $1 and infrastructure_code = 'indoor_track'", [TEAM]);
    await rejected("Construisez d’abord la Piste indoor");
    await database.query("update public.team_infrastructures set level = 0 where team_id = $1", [TEAM]);
    await rejected("Construisez d’abord la Soufflerie", RIDERS[0], "wind_tunnel");
    await database.query("update public.team_infrastructures set level = 6 where team_id = $1", [TEAM]);
    await rejected("Niveau d’installation invalide", RIDERS[0], "wind_tunnel");
  });

  await test("injury guards reject active injuries and allow recovered injuries", async () => {
    await reset();
    await database.query("insert into public.rider_injuries values ($1, 'recovering')", [RIDERS[0]]);
    await rejected("actuellement blessé");
    await database.exec("update public.rider_injuries set status = 'recovered'");
    await start();
  });

  await test("camp overlap rejects concurrent preparation types but ignores cancelled camps", async () => {
    await reset();
    await start();
    await rejected("déjà indisponible", RIDERS[0], "wind_tunnel");
    await database.exec("update public.rider_form_camps set status = 'cancelled'");
    await start(RIDERS[0], "wind_tunnel");
  });

  await test("accepted race in either preparation day blocks the camp; rejected or later race does not", async () => {
    for (const offset of [1, 2]) {
      await reset();
      await database.query("insert into public.race_rosters values ($1, $2)", [RIDERS[0], uuid(50)]);
      await database.query("insert into public.race_registrations values ($1, 'accepted', $2)", [uuid(50), uuid(51)]);
      await database.query("insert into public.stages values ($1, $2)", [uuid(51), uuid(52)]);
      await database.query("insert into public.season_days values ($1, $2, $3)", [uuid(52), SEASON, DAY + offset]);
      await rejected("engagé en course");
      if (offset === 1) {
        await database.exec("update public.race_registrations set status = 'rejected'");
      } else {
        await database.query("update public.season_days set day_number = $1", [DAY + 3]);
      }
      await start();
    }
  });

  await test("same-type overlap is inclusive, cross-team and independent of completion", async () => {
    for (const team of [TEAM, OTHER_TEAM]) {
      for (const boundary of [START, START + 5]) {
        await reset();
        await oldPreparation({ team, bonusStart: boundary, bonusEnd: boundary });
        await rejected("déjà d’une préparation de ce type");
      }
    }
  });

  await test("adjacent windows, cancelled preparations and different-type bonus overlap remain allowed", async () => {
    for (const row of [
      { bonusStart: START - 5, bonusEnd: START - 1 },
      { bonusStart: START + 6, bonusEnd: START + 8 },
      { status: "cancelled" },
      { type: "wind_tunnel" },
    ]) {
      await reset();
      await oldPreparation(row);
      await start();
    }
  });

  await test("J26 camp ends J28 and its six-day bonus crosses the season; J27 is rejected", async () => {
    await reset({ day: 26 });
    const row = await start();
    assert.equal(row.preparation_start_game_day, GAME_YEAR * 28 + 26);
    assert.equal(row.preparation_end_game_day, GAME_YEAR * 28 + 27);
    assert.equal(row.bonus_start_game_day, (GAME_YEAR + 1) * 28);
    assert.equal(row.bonus_end_game_day, (GAME_YEAR + 1) * 28 + 5);
    await reset({ day: 27 });
    await rejected("avant la fin de la saison");
  });

  await test("due-slot settlement is limited to the requesting team", async () => {
    await reset({ level: 1 });
    const own = await oldPreparation({ rider: RIDERS[6], status: "planned", bonusStart: START - 10, bonusEnd: START - 8 });
    const other = await oldPreparation({ rider: FOREIGN_RIDER, team: OTHER_TEAM, status: "planned", bonusStart: START - 10, bonusEnd: START - 8 });
    await start();
    const rows = (await database.query("select id, status from public.rider_performance_preparations where id = any($1::uuid[])", [[own.id, other.id]])).rows;
    assert.equal(rows.find((row) => row.id === own.id).status, "completed");
    assert.equal(rows.find((row) => row.id === other.id).status, "planned");
  });

  await test("anonymous execution is denied and authenticated/service roles retain explicit access", async () => {
    for (const signature of [
      "public.get_performance_preparation_policy(integer)",
      "public.start_current_team_rider_performance_preparation(uuid,text)",
    ]) {
      for (const role of ["anon", "authenticated", "service_role"]) {
        const { rows } = await database.query("select has_function_privilege($1, $2, 'execute') as allowed", [role, signature]);
        assert.equal(rows[0].allowed, role !== "anon");
      }
    }
    await database.exec("set role anon");
    try {
      await assert.rejects(() => database.query("select * from public.get_performance_preparation_policy(1)"), /permission denied/);
      await assert.rejects(() => database.query("select public.start_current_team_rider_performance_preparation($1::uuid, 'indoor_track')", [RIDERS[0]]), /permission denied/);
    } finally {
      await database.exec("reset role");
    }
  });

  console.log(`Isolated in-memory SQL harness: ${passed} cases passed. No external database was accessed.`);
} finally {
  await database.close();
}
