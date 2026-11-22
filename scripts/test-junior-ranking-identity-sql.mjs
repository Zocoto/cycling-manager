import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Isolated, in-memory PostgreSQL only. This script never loads application
// credentials or connects to Supabase. Pass a local PGlite module path.
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const database = new PGlite();
const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const query = async (sql, parameters = []) => (await database.query(sql, parameters)).rows;
const oldMigration = readFileSync("supabase/migrations/20260926123000_remove_interactive_lock_hotspots.sql", "utf8");
const oldRefresh = oldMigration.slice(oldMigration.indexOf("create or replace function public.refresh_development_rankings("),
  oldMigration.indexOf("notify pgrst, 'reload schema';"));
const migration = readFileSync("supabase/migrations/20261122120000_unify_junior_ranking_identity.sql", "utf8");
const guardMigration = readFileSync("supabase/migrations/20261122121000_guard_junior_ranking_identity.sql", "utf8");
const repairSql = readFileSync("scripts/repair-junior-ranking-identity-season.sql", "utf8");
const repair = season => database.exec(repairSql.replace(":'season_id'", `'${id(season)}'`));
const refresh = async (season = 1) => query("select public.refresh_development_rankings($1) as count", [id(season)]);
const ranking = async (type, key) => (await query(
  "select * from development_ranking_entries where season_id = $1 and entity_type = $2 and entity_key = $3",
  [id(1), type, key],
))[0];
const metrics = row => Object.fromEntries(["points", "wins", "podiums", "race_count"].map(key => [key, row[key]]));
let sequence = 1000;
async function result({ race = 200, scope = "general", key, academy = null, team = 10,
  name = "Adarsh Shah", country = "FR", rank = 1, points = 0, teamName = "Snapshot club" }) {
  await query(`insert into development_race_results
    (id, race_edition_id, stage_id, result_scope, competitor_key, academy_rider_id,
      development_team_id, rider_name, team_name, country_code, rank, points, created_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
  [id(sequence++), id(race), scope === "stage" ? id(race + 300) : null, scope, key,
    academy === null ? null : id(academy), team === null ? null : id(team), name, teamName, country,
    rank, points, `2026-11-${String(race - 190).padStart(2, "0")}T12:00:00Z`]);
}

try {
  await database.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create table seasons(id uuid primary key, game_year integer, status text);
    create table countries(id uuid primary key, iso_alpha2 text unique, name text);
    create table youth_academy_riders(id uuid primary key);
    create table development_teams(id uuid primary key, display_name text);
    create table development_virtual_riders(id uuid primary key, team_name text);
    create table development_race_editions(id uuid primary key, season_id uuid, status text, end_day_number integer);
    create table development_race_results(
      id uuid primary key, race_edition_id uuid, stage_id uuid, result_scope text,
      competitor_key text, academy_rider_id uuid references youth_academy_riders(id),
      development_team_id uuid references development_teams(id), rider_name text,
      team_name text, country_code text, rank integer, points integer, created_at timestamptz
    );
    create table development_ranking_entries(
      id uuid primary key default gen_random_uuid(), season_id uuid, entity_type text, entity_key text,
      academy_rider_id uuid, development_team_id uuid, display_name text not null,
      secondary_name text, country_code text, points integer not null default 0,
      wins integer not null default 0, podiums integer not null default 0,
      race_count integer not null default 0, updated_at timestamptz default now(),
      unique(season_id, entity_type, entity_key),
      check(points >= 0 and wins >= 0 and podiums >= 0 and race_count >= 0)
    );
    create table season_awards(id uuid primary key, metadata jsonb);
    create table development_event_rewards(id uuid primary key, cash_prize integer);
  `);
  await query("insert into seasons values ($1,5,'active'),($2,4,'completed'),($3,2,'completed')", [id(1), id(2), id(3)]);
  await query("insert into season_awards values ($1,'{\"finalized\":true}')", [id(50)]);
  await query("insert into development_event_rewards values ($1,1000)", [id(51)]);
  await query("insert into countries values ($1,'FR','France'),($2,'BE','Belgique')", [id(5), id(6)]);
  await query("insert into development_teams values ($1,'Alpha club'),($2,'Beta club')", [id(10), id(20)]);
  await query("insert into development_virtual_riders values ($1,'Virtual Club'),($2,'Virtual Club')", [id(300), id(301)]);
  for (const academy of [100, 101, 102, 110, 111, 112, 113, 114, 115]) {
    await query("insert into youth_academy_riders values ($1)", [id(academy)]);
  }
  for (const [race, season, status, day] of [[200, 1, "completed", 8], [201, 1, "completed", 9],
    [202, 1, "completed", 10], [203, 1, "completed", 12], [204, 1, "planned", 28],
    [205, 1, "cancelled", 28], [206, 2, "completed", 27], [207, 2, "completed", 28]]) {
    await query("insert into development_race_editions values ($1,$2,$3,$4)", [id(race), id(season), status, day]);
  }
  await result({ key: `youth:${id(100)}`, academy: 100, name: "Zed old name", points: 20 });
  await result({ key: `youth:${id(100)}`, academy: 100, scope: "stage", name: "Zed old name", points: 5 });
  await result({ race: 201, key: `federation-youth:${id(100)}`, academy: 100, rank: 2, points: 30 });
  await result({ race: 201, key: `federation-youth:${id(100)}`, academy: 100, scope: "stage", rank: 2 });
  await result({ race: 202, key: `federation-youth:${id(100)}`, academy: 100, team: 20, country: "BE", points: 40 });
  await result({ race: 202, key: `federation-youth:${id(100)}`, academy: 100, team: 20, country: "BE", scope: "stage", points: 10 });
  // A homonym is a separate person. A club-only transfer must count on both clubs.
  await result({ key: `youth:${id(101)}`, academy: 101, rank: 4, points: 9 });
  await result({ key: `youth:${id(102)}`, academy: 102, name: "Transferred rider", rank: 5, points: 7 });
  await result({ race: 203, key: `youth:${id(102)}`, academy: 102, name: "Transferred rider", team: 20, rank: 4, points: 8 });
  for (const [index, points] of [60, 50, 40, 30, 20, 10].entries()) {
    await result({ key: `youth:${id(110 + index)}`, academy: 110 + index, name: `French rider ${index}`, rank: 10 + index, points });
  }
  // Matching virtual names stay separate; national result team labels do not
  // replace their persistent virtual club identity.
  await result({ key: `virtual:${id(300)}`, team: null, name: "Twin Rider", country: "GB", rank: 20, points: 11 });
  await result({ race: 201, key: `virtual:${id(300)}`, team: null, name: "Twin Rider", country: "GB", rank: 20, points: 12, teamName: "Great Britain" });
  await result({ key: `virtual:${id(301)}`, team: null, name: "Twin Rider", country: "GB", rank: 21, points: 13 });
  await result({ key: "legacy:unknown", team: null, name: "Independent", country: "GB", scope: "stage", rank: 22, points: 0, teamName: "Indépendants" });
  for (const race of [204, 205, 206]) {
    await result({ race, key: `youth:${id(100)}`, academy: 100, points: 9999 });
  }
  await result({ race: 207, key: `federation-youth:${id(100)}`, academy: 100, points: 3 });
  const ledgerBefore = await query("select * from development_race_results order by id");
  const awardsBefore = await query("select * from season_awards");
  const rewardsBefore = await query("select * from development_event_rewards");

  // Execute the actual former production function to prove the regression.
  await database.exec(oldRefresh);
  await refresh(2);
  const historicalBefore = await query("select * from development_ranking_entries where season_id = $1", [id(2)]);
  await refresh();
  const split = await query("select points from development_ranking_entries where season_id=$1 and entity_type='individual' and academy_rider_id=$2 order by points", [id(1), id(100)]);
  assert.deepEqual(split.map(row => row.points), [25, 80]);
  const oldAlphaCount = (await query(`select count(distinct academy_rider_id)::integer as count from development_ranking_entries
    where season_id=$1 and entity_type='individual' and development_team_id=$2`, [id(1), id(10)]))[0].count;
  assert.equal(oldAlphaCount, 8, "old projection loses the club-only transferred person from Alpha");

  // Installing the migration changes definitions only; archived snapshots and
  // the immutable source ledger must remain byte-for-byte equal.
  const activeBeforeMigration = await query("select * from development_ranking_entries where season_id=$1 order by entity_type,entity_key", [id(1)]);
  await database.exec(migration);
  const activeAfterMigration = await query("select * from development_ranking_entries where season_id=$1 order by entity_type,entity_key", [id(1)]);
  assert.deepEqual(activeAfterMigration.map(row => {
    const previousColumns = { ...row };
    delete previousColumns.ranked_rider_count;
    return previousColumns;
  }), activeBeforeMigration);
  assert.equal(activeAfterMigration.every(row => row.ranked_rider_count === null), true);
  await repair(1);
  const person = await ranking("individual", `youth:${id(100)}`);
  assert.deepEqual(metrics(person), { points: 105, wins: 2, podiums: 3, race_count: 3 });
  assert.equal(person.display_name, "Adarsh Shah");
  assert.equal(person.secondary_name, "Beta club");
  assert.equal(person.country_code, "BE");
  assert.equal(person.development_team_id, id(20));
  assert.equal((await query("select count(*)::integer as count from development_ranking_entries where season_id=$1 and entity_type='individual' and academy_rider_id=$2", [id(1), id(100)]))[0].count, 1);
  assert.equal((await ranking("individual", `youth:${id(101)}`)).points, 9, "homonyms must stay separate");
  assert.equal(await ranking("individual", `federation-youth:${id(100)}`), undefined);
  const alpha = await ranking("team", id(10));
  const beta = await ranking("team", id(20));
  assert.deepEqual(metrics(alpha), { points: 281, wins: 1, podiums: 2, race_count: 10 });
  assert.deepEqual(metrics(beta), { points: 58, wins: 1, podiums: 1, race_count: 2 });
  assert.equal(alpha.ranked_rider_count, 9, "count a transferred person for each team they represented");
  assert.equal(beta.ranked_rider_count, 2);
  assert.deepEqual(metrics(await ranking("nation", "FR")), { points: 235, wins: 1, podiums: 2, race_count: 5 });
  assert.deepEqual(metrics(await ranking("nation", "BE")), { points: 50, wins: 1, podiums: 1, race_count: 1 });
  assert.equal((await ranking("nation", "GB")).display_name, "GB", "unknown country name falls back to code");
  assert.equal((await ranking("team", "virtual-team:Virtual Club")).points, 36);
  assert.equal((await ranking("team", "virtual-team:Virtual Club")).ranked_rider_count, 2);
  assert.equal((await ranking("individual", "legacy:unknown")).race_count, 0);
  assert.equal((await ranking("team", "virtual-team:Indépendants")).ranked_rider_count, 1);
  assert.deepEqual(await query("select * from development_race_results order by id"), ledgerBefore);
  assert.deepEqual(await query("select * from development_ranking_entries where season_id=$1", [id(2)]),
    historicalBefore.map(row => ({ ...row, ranked_rider_count: null })));

  const snapshot = () => query(`select entity_type,entity_key,academy_rider_id,development_team_id,
    display_name,secondary_name,country_code,points,wins,podiums,race_count,ranked_rider_count
    from development_ranking_entries where season_id=$1 order by entity_type,entity_key`, [id(1)]);
  const once = await snapshot();
  const refreshed = await refresh();
  assert.equal(refreshed[0].count, once.length);
  assert.deepEqual(await snapshot(), once, "refresh must be idempotent");
  assert.equal((await refresh(3))[0].count, 0);
  assert.equal((await refresh(999))[0].count, 0);
  assert.deepEqual(await snapshot(), once);

  // Production path: each repair executes the actual reviewed one-season
  // script before the guard installs. The same person in another season is valid.
  await repair(2);
  const repairedHistory = await query("select * from development_ranking_entries where season_id=$1 and entity_type='individual'", [id(2)]);
  assert.equal(repairedHistory.length, 1);
  assert.equal(repairedHistory[0].points, 10002);
  await database.exec(guardMigration);
  await assert.rejects(query(`insert into development_ranking_entries
    (season_id,entity_type,entity_key,academy_rider_id,display_name)
    values ($1,'individual','bypass-another-context',$2,'Duplicate person')`, [id(1), id(100)]),
  /academy_identity_unique_idx/);
  await refresh();
  assert.deepEqual(await snapshot(), once);
  assert.deepEqual(await query("select * from development_race_results order by id"), ledgerBefore);
  assert.deepEqual(await query("select * from season_awards"), awardsBefore);
  assert.deepEqual(await query("select * from development_event_rewards"), rewardsBefore);

  await database.exec("set role authenticated");
  await assert.rejects(refresh(), /permission denied/);
  await database.exec("reset role; set role anon");
  await assert.rejects(refresh(), /permission denied/);
  await database.exec("reset role");
  await database.exec("set role service_role");
  await refresh();
  await database.exec("reset role");
  await assert.rejects(query(`update development_ranking_entries set ranked_rider_count=1
    where season_id=$1 and entity_type='individual'`, [id(1)]), /ranked_rider_count_valid/);

  // Replay path: another environment may still have legacy split projections
  // when installing both migrations, without running the operational script.
  await database.exec(`drop index development_ranking_entries_academy_identity_unique_idx;
    alter table development_ranking_entries drop column ranked_rider_count;`);
  await database.exec(oldRefresh);
  await refresh(1);
  await refresh(2);
  assert.equal((await query("select count(*)::integer as count from development_ranking_entries where season_id=$1 and entity_type='individual' and academy_rider_id=$2", [id(1), id(100)]))[0].count, 2);
  await database.exec(migration);
  await database.exec(guardMigration);
  assert.deepEqual(await snapshot(), once, "normal migration replay repairs remaining split seasons");
  assert.equal((await query("select points from development_ranking_entries where season_id=$1 and entity_type='individual' and academy_rider_id=$2", [id(2), id(100)]))[0].points, 10002);
  assert.deepEqual(await query("select * from development_race_results order by id"), ledgerBefore);
  assert.deepEqual(await query("select * from season_awards"), awardsBefore);
  assert.deepEqual(await query("select * from development_event_rewards"), rewardsBefore);
  console.log("Junior ranking identity SQL passed: old split reproduced, canonical people, transfers, naturalizations, top 5, virtuals, per-season repairs, unique guard, immutable ledger/awards/rewards, idempotence and permissions.");
} finally {
  await database.close();
}
