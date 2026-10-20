import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// No credentials, environment loading or network DB: PostgreSQL lives in memory.
if (process.argv.length !== 3 || process.argv[2] !== "--isolated") {
  throw new Error("Only --isolated is accepted; external databases are forbidden.");
}
const { PGlite } = await import(
  "../artifacts/.tmp-performance-preparations/node_modules/@electric-sql/pglite/dist/index.js"
);
const database = new PGlite();
const uuid = (number) => `00000000-0000-0000-0000-${String(number).padStart(12, "0")}`;
const rider = uuid(1);
const other = uuid(2);
const country = uuid(3);
let passed = 0;
async function test(name, callback) {
  await callback();
  passed += 1;
  console.log(`PASS ${name}`);
}
const rows = async (sql, parameters = []) => (await database.query(sql, parameters)).rows;
const context = async (bounds) => rows(
  `select * from public.get_race_calendar_rider_context($1::uuid[]${bounds ? ", $2::integer, $3::integer" : ""})`,
  bounds ? [[rider, other], ...bounds] : [[rider, other]],
);
const starts = (result) => result[0].performance_preparations.map((item) => item.bonus_start_game_day);
try {
  await database.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.riders(id uuid primary key, country_id uuid,
      avatar_profile_key text, avatar_seed bigint, career_race_days integer,
      height_cm numeric, weight_kg numeric, baseline_weight_kg numeric,
      physiology_version smallint);
    create table public.rider_special_abilities(rider_id uuid, ability_code text);
    create table public.rider_performance_preparations(id uuid primary key,
      rider_id uuid, preparation_type text, bonus_start_game_day integer not null,
      bonus_end_game_day integer not null, rating_bonus numeric, status text);
    create table public.rider_national_championship_titles(rider_id uuid,
      championship_type text, country_id uuid, relinquished_at timestamptz);
    create table public.countries(id uuid, iso_alpha2 text, name text);
  `);
  await database.query(`insert into public.riders values
    ($1,$3,'fixed-profile',123,45,180,72,73,1),($2,$3,null,456,0,170,60,60,0)`, [rider, other, country]);
  await database.query("insert into public.countries values ($1,'RW','Rwanda')", [country]);
  await database.query("insert into public.rider_special_abilities values ($1,'sprint'),($1,'aero')", [rider]);
  await database.query(`insert into public.rider_national_championship_titles values
    ($1,'road',$2,null),($1,'time_trial',$2,now())`, [rider, country]);
  const preparations = [[100,105,"completed"],[108,112,"completed"],
    [112,117,"completed"],[139,144,"planned"],[140,145,"planned"],[116,122,"cancelled"]];
  for (const [index, [start, end, status]] of preparations.entries()) {
    await database.query("insert into public.rider_performance_preparations values ($1,$2,'indoor_track',$3,$4,3.3,$5)",
      [uuid(10 + index), rider, start, end, status]);
  }
  const original = await readFile("supabase/migrations/20260927210000_add_rider_physiology_and_weight_management.sql", "utf8");
  const start = original.indexOf("create function public.get_race_calendar_rider_context(p_rider_ids uuid[])");
  const end = original.indexOf("comment on column public.riders.physiology_version", start);
  assert.ok(start >= 0 && end > start);
  await database.exec(original.slice(start, end));
  const before = await context();
  const oldOid = (await rows("select 'public.get_race_calendar_rider_context(uuid[])'::regprocedure::oid as oid"))[0].oid;
  const migration = await readFile("supabase/migrations/20261020121000_bound_performance_preparation_context.sql", "utf8");
  await database.exec(migration);

  await test("legacy OID, all metadata and unbounded results are unchanged", async () => {
    assert.deepEqual(await context(), before);
    assert.equal((await rows("select 'public.get_race_calendar_rider_context(uuid[])'::regprocedure::oid as oid"))[0].oid, oldOid);
    assert.deepEqual(await context([null, null]), before);
  });
  await test("full season preserves inclusive carry-over and end-of-season bonuses", async () => {
    assert.deepEqual(starts(await context([112,139])), [108,112,139]);
    assert.deepEqual(starts(await context([112,112])), [108,112]);
    assert.deepEqual(starts(await context([139,139])), [139]);
  });
  await test("metadata and riders without preparations survive bounded loading", async () => {
    const bounded = await context([112,139]);
    for (const [index, row] of bounded.entries()) {
      const { performance_preparations: ignoredBounded, ...actual } = row;
      const { performance_preparations: ignoredBefore, ...expected } = before[index];
      assert.ok(Array.isArray(ignoredBounded) && Array.isArray(ignoredBefore));
      assert.deepEqual(actual, expected);
    }
    assert.deepEqual(bounded[1].performance_preparations, []);
    assert.deepEqual(bounded[0].special_ability_codes, ["aero", "sprint"]);
    assert.equal(bounded[0].championship_titles[0].country_name, "Rwanda");
  });
  await test("one-sided bounds, empty/inverted windows and cancelled rows are safe", async () => {
    assert.deepEqual(starts(await context([139,null])), [139,140]);
    assert.deepEqual(starts(await context([null,108])), [100,108]);
    assert.deepEqual(starts(await context([200,201])), []);
    assert.deepEqual(starts(await context([139,112])), []);
    assert.ok(!(await context()).flatMap((row) => row.performance_preparations).some((item) => item.bonus_start_game_day === 116));
    assert.deepEqual(await rows("select * from public.get_race_calendar_rider_context('{}'::uuid[],112,139)"), []);
  });
  await test("required overload has no default ambiguity and is backend-only", async () => {
    const functions = await rows(`select pronargs, pronargdefaults, prosecdef,
      has_function_privilege('service_role',oid,'EXECUTE') as service,
      has_function_privilege('anon',oid,'EXECUTE') as anon,
      has_function_privilege('authenticated',oid,'EXECUTE') as authenticated
      from pg_proc where pronamespace='public'::regnamespace
      and proname='get_race_calendar_rider_context' order by pronargs`);
    assert.equal(functions.length,2);
    assert.deepEqual(functions.map((item) => item.pronargs), [1,3]);
    for (const fn of functions) {
      assert.equal(fn.pronargdefaults,0);
      assert.equal(fn.prosecdef,true);
      assert.equal(fn.service,true);
      assert.equal(fn.anon,false);
      assert.equal(fn.authenticated,false);
    }
  });
  await test("window index exists and rerunning reviewed migration is idempotent", async () => {
    const snapshot = await context([112,139]);
    const index = (await rows("select indexdef from pg_indexes where indexname='rider_performance_preparations_rider_window_idx'"))[0];
    assert.match(index.indexdef,/rider_id, bonus_end_game_day, bonus_start_game_day/);
    assert.match(index.indexdef,/WHERE.*status.*<>.*cancelled/);
    await database.exec(migration);
    assert.deepEqual(await context([112,139]),snapshot);
    assert.deepEqual(await context(),before);
  });
  console.log(JSON.stringify({passed,memoryOnly:true,productionAccess:false}));
} finally {
  await database.close();
}
