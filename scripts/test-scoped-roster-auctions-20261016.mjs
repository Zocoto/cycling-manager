// No production access: real SQL definitions, deterministic synthetic fixtures,
// and EXPLAIN ANALYZE all run in an isolated in-memory PGlite database.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const baseline = readFileSync("supabase/migrations/20260903130000_arbitrate_youth_promotions_at_roster_limit.sql", "utf8");
const source = baseline.match(/create or replace function public\.get_team_roster_commitment_count\([\s\S]*?\$\$;/i)?.[0];
assert.ok(source, "Committed baseline function is required.");
const body = (definition) => definition.replaceAll("\r", "").match(/as\s+(\$[^$]*\$)([\s\S]*?)\1\s*;?/i)?.[2].trim();
const capturePath = ".tmp-query-workload-20261016/schema.json";
if (existsSync(capturePath)) {
  const captured = JSON.parse(readFileSync(capturePath, "utf8")).find((row) => row.name === "get_team_roster_commitment_count(uuid,integer)")?.definition;
  if (captured) assert.equal(body(captured), body(source), "Production capture must match the committed baseline.");
}
const migration = readFileSync("supabase/migrations/20261016172000_scope_roster_auction_leader_ranking.sql", "utf8");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const yearId = (year) => id(1000 + year);
let checks = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const scalar = async (sql, parameters = []) => Object.values((await db.query(sql, parameters)).rows[0])[0];
const count = async (team, year) => scalar("select public.get_team_roster_commitment_count($1::uuid,$2::integer)", [team === null ? null : id(team), year]);
const listing = async (n, year, status = "open") => {
  await db.query("insert into public.transfer_market_listings(id,season_id,status) values($1::uuid,$2::uuid,$3)", [id(n), yearId(year), status]);
};
const bid = async (n, lot, team, amount, date = "2026-10-16T08:00:00Z") => {
  await db.query("insert into public.transfer_market_bids(id,listing_id,team_id,amount,created_at) values($1::uuid,$2::uuid,$3::uuid,$4,$5)", [id(n), id(lot), id(team), amount, date]);
};
const rankInputRows = (plan) => {
  if (plan["Node Type"] === "Unique") return plan.Plans.reduce((sum, child) => sum + child["Actual Rows"] * child["Actual Loops"], 0);
  return (plan.Plans ?? []).reduce((sum, child) => sum + rankInputRows(child), 0);
};
const explainRanking = async () => {
  const definition = await scalar("select prosrc from pg_proc where oid='public.get_team_roster_commitment_count(uuid,integer)'::regprocedure");
  const sql = definition.replaceAll("p_team_id", "$1::uuid").replaceAll("p_game_year", "$2::integer");
  const plan = await scalar(`explain (analyze, buffers, format json) ${sql}`, [id(1), 2027]);
  return rankInputRows(plan[0].Plan);
};

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.seasons(id uuid primary key, game_year integer);
    create table public.rider_contracts(id uuid primary key, rider_id uuid, team_id uuid, status text,
      start_season_id uuid, end_season_id uuid, acquisition_type text);
    create table public.transfer_market_listings(id uuid primary key, season_id uuid, status text);
    create table public.transfer_market_bids(id uuid primary key, listing_id uuid, team_id uuid, amount numeric, created_at timestamptz);
    create index on public.rider_contracts(team_id);
    create index on public.transfer_market_bids(listing_id, amount desc, created_at asc);
    create index on public.transfer_market_bids(team_id, created_at desc);
    create table public.youth_academy_riders(team_id uuid, promotion_game_year integer, status text);
  `);
  for (const year of [2025, 2026, 2027, 2028, 2029]) await db.query("insert into seasons values($1::uuid,$2)", [yearId(year), year]);
  await db.exec(source);
  await db.exec("revoke all on function public.get_team_roster_commitment_count(uuid,integer) from public,anon,authenticated; grant execute on function public.get_team_roster_commitment_count(uuid,integer) to service_role");
  const metadataSql = "select proowner,proacl,provolatile,prosecdef,proconfig,prorettype from pg_proc where oid='public.get_team_roster_commitment_count(uuid,integer)'::regprocedure";
  const metadataBefore = (await db.query(metadataSql)).rows[0];
  // Losing bids must remain losers; ties use date, then bid UUID, never team ID.
  await listing(101, 2026); await bid(201, 101, 1, 1000); await bid(202, 101, 2, 2000);
  check(await count(1, 2027), 0, "A losing team has no auction commitment.");
  check(await count(2, 2027), 1, "The highest bidder has one commitment.");
  await listing(102, 2026); await bid(203, 102, 1, 2000, "2026-10-16T07:00:00Z"); await bid(204, 102, 2, 2000);
  await listing(103, 2026); await bid(205, 103, 2, 3000); await bid(206, 103, 1, 3000);
  await listing(104, 2026); await bid(207, 104, 1, 1000); await bid(208, 104, 1, 4000); await bid(209, 104, 2, 3000);
  await listing(105, 2027); await bid(210, 105, 1, 6000);
  await listing(106, 2025); await bid(211, 106, 1, 6000);
  await listing(107, 2026, "closed"); await bid(212, 107, 1, 6000);
  await listing(108, 2026, "cancelled"); await bid(213, 108, 1, 6000);
  await listing(109, 2026); // No bids: cannot contribute a commitment.
  check(await count(1, 2027), 3, "Winner/date/UUID/repeated-bid decisions preserved.");
  check(await count(1, 2026), 3, "An auction reserves current and next year only.");
  check(await count(1, 2028), 1, "Following-year boundary inclusive.");
  check(await count(3, 2027), 0, "A non-participant has no auction commitment.");

  // Historical/professional commitments stay verbatim, including acquisition
  // types: a contract counts by status and year, not origin (loan/academy).
  const contracts = [
    [301, 401, 1, "active", 2026, 2027, "daily_auction"],
    [302, 401, 1, "planned", 2027, 2028, "renewal"], // Same rider counted once.
    [303, 402, 1, "planned", 2027, 2028, "academy"],
    [304, 403, 1, "active", 2026, 2028, "loan"],
    [305, 404, 1, "terminated", 2026, 2028, "daily_auction"],
    [306, 405, 1, "completed", 2026, 2028, "daily_auction"],
    [307, 406, 1, "planned", 2028, 2029, "academy"],
    [308, 407, 2, "active", 2026, 2028, "daily_auction"],
  ];
  for (const [key, rider, team, status, start, end, acquisition] of contracts) {
    await db.query("insert into rider_contracts values($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid,$6::uuid,$7)", [id(key), id(rider), id(team), status, yearId(start), yearId(end), acquisition]);
  }
  await db.exec(`insert into youth_academy_riders values('${id(1)}',2027,'recruited'),('${id(1)}',2026,'recruited')`);
  check(await count(1, 2027), 6, "Contracts counted uniquely; prospective youth without professional contract excluded.");
  check(await count(1, 2026), 5, "Professional contract start year inclusive.");

  // Large unrelated synthetic market proves a reduction of ranked bid rows,
  // independently of machine timing. All competing bids remain in candidates.
  await db.exec(`
    insert into transfer_market_listings
      select ('00000000-0000-4000-8000-'||lpad((10000+n)::text,12,'0'))::uuid,'${yearId(2026)}','open'
      from generate_series(1,1000) n;
    insert into transfer_market_bids
      select ('00000000-0000-4000-8000-'||lpad((100000+n*10+b)::text,12,'0'))::uuid,
        ('00000000-0000-4000-8000-'||lpad((10000+n)::text,12,'0'))::uuid,
        case when b=1 then '${id(2)}'::uuid else '${id(3)}'::uuid end,
        500+b*100,'2026-10-16T08:00:00Z'::timestamptz
      from generate_series(1,1000) n cross join generate_series(1,10) b;
    analyze;
  `);
  const beforeRows = await explainRanking();
  const fixturesBefore = (await db.query("select (select count(*) from rider_contracts)::int contracts,(select count(*) from transfer_market_listings)::int listings,(select count(*) from transfer_market_bids)::int bids,(select count(*) from youth_academy_riders)::int juniors")).rows[0];
  const before = [];
  for (const team of [1, 2, 3, 4, null]) for (const year of [2025, 2026, 2027, 2028, 2029, null]) {
    before.push({ team, year, count: await count(team, year) });
  }
  await db.exec(migration);
  check((await db.query(metadataSql)).rows[0], metadataBefore, "All function metadata, grants and owner unchanged.");
  for (const scenario of before) check(await count(scenario.team, scenario.year), scenario.count, `Equivalent counts for team ${scenario.team}, year ${scenario.year}.`);
  const afterRows = await explainRanking();
  check(beforeRows > 10000, true, "Original query ranks the world's auction bids.");
  check(afterRows <= 12 && afterRows > 0, true, "Optimized query ranks only relevant listings, with rivals retained.");
  check((await db.query("select (select count(*) from rider_contracts)::int contracts,(select count(*) from transfer_market_listings)::int listings,(select count(*) from transfer_market_bids)::int bids,(select count(*) from youth_academy_riders)::int juniors")).rows[0], fixturesBefore, "Migration changes no gameplay rows.");
  await assert.rejects(db.exec(migration), /Unexpected roster commitment source/); checks++;
  await db.exec("rollback");
  await db.exec(source.replace("'active', 'planned'", "'active', 'completed'"));
  await assert.rejects(db.exec(migration), /Unexpected roster commitment source/); checks++;
  await db.exec("rollback");
  console.log(`${checks} isolated auction commitment checks passed; ranked rows ${beforeRows} -> ${afterRows}.`);
} finally {
  await db.close();
}
