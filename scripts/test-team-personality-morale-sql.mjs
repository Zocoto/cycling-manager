import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const read = name => readFileSync("supabase/migrations/" + name + ".sql", "utf8");

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema private;
    create table seasons(id uuid primary key, game_year int, current_day_number int, status text);
    create table season_days(id uuid primary key, season_id uuid, day_number int, calendar_date date);
    create table riders(id uuid primary key, personality_key text);
    create table rider_contracts(id uuid primary key, rider_id uuid, team_id uuid, start_season_id uuid,
      end_season_id uuid, left_season_id uuid, left_day_number int, acquisition_type text, status text, signed_at timestamptz);
    create table races(id uuid primary key, country_id uuid);
    create table race_editions(id uuid primary key, season_id uuid, race_id uuid);
    create table stages(id uuid primary key, season_day_id uuid, race_edition_id uuid, status text, stage_type text, departure_at timestamptz);
    create table race_rosters(id uuid primary key, rider_id uuid, race_registration_id uuid);
    create table stage_results(stage_id uuid, race_roster_id uuid, rank int, status text);
    create table official_stage_simulations(stage_id uuid primary key, simulation_data jsonb);
    create table rider_condition_states(id uuid primary key default gen_random_uuid(), rider_id uuid, season_day_id uuid,
      morale numeric, form int, fatigue int, source text, updated_at timestamptz default now(), unique(rider_id, season_day_id));
    create table rider_morale_events(id uuid primary key default gen_random_uuid(), rider_id uuid, season_day_id uuid,
      source_type text, source_reference text, requested_delta numeric, applied_delta numeric, morale_before numeric,
      morale_after numeric, description text, metadata jsonb, unique(rider_id,source_type,source_reference));
  `);

  const morale = read("20260927233500_reapply_persistent_rider_morale");
  const start = morale.indexOf("create or replace function public.apply_rider_morale_event(");
  assert.ok(start >= 0);
  await db.exec(morale.slice(start, morale.indexOf("\n$$;", start) + 4));
  await db.exec(read("20261117095000_apply_team_personality_morale"));

  await db.query(
    "insert into seasons values ($1,1,28,'completed'),($2,2,28,'completed'),($3,3,4,'active'),($4,4,null,'planned')",
    [id(11), id(12), id(13), id(14)],
  );
  for (let day = 1; day <= 7; day += 1) {
    await db.query("insert into season_days values ($1,$2,$3,$4)", [id(30 + day), id(13), day, `2000-01-0${day}`]);
  }
  const riders = [
    { id: id(1), personalityKey: "mentor", age: 26 },
    { id: id(2), personalityKey: "collectif", age: 30 },
    { id: id(3), personalityKey: "globe_trotteur", age: 25 },
    { id: id(4), personalityKey: "meticuleux", age: 28, reconnaissanceBonus: 2.3 },
    { id: id(5), personalityKey: "assidu", age: 21 },
    { id: id(6), personalityKey: "mentor", age: 28 },
    { id: id(7), personalityKey: "fidele", age: 30 },
    { id: id(8), personalityKey: "fidele", age: 30 },
    { id: id(9), personalityKey: "meticuleux", age: 30, reconnaissanceBonus: 2.1 },
    { id: id(10), personalityKey: "globe_trotteur", age: 30 },
    { id: id(15), personalityKey: "fidele", age: 25 },
  ];
  for (const rider of riders) {
    await db.query("insert into riders values ($1,$2)", [rider.id, rider.personalityKey]);
  }
  const fixture = async ({ day, country, edition = 100 + day, snapshot, results, work = [] }) => {
    const stage = id(140 + day);
    await db.query("insert into races values ($1,$2) on conflict do nothing", [id(edition), id(country)]);
    await db.query("insert into race_editions values ($1,$2,$1) on conflict do nothing", [id(edition), id(13)]);
    await db.query("insert into stages values ($1,$2,$3,'in_progress','road',null)", [stage, id(30 + day), id(edition)]);
    await db.query("insert into official_stage_simulations values ($1,$2)", [stage, JSON.stringify({ resolvedRiders: snapshot, teamWork: work })]);
    for (const [rider, team, rank, status = "finished"] of results) {
      const roster = `${(edition * 100 + rider).toString().padStart(12, "0")}`;
      const rosterId = "00000000-0000-4000-8000-" + roster;
      await db.query("insert into race_rosters values ($1,$2,$3) on conflict do nothing", [rosterId, id(rider), id(edition * 100 + team)]);
      await db.query("insert into stage_results values ($1,$2,$3,$4)", [stage, rosterId, rank, status]);
    }
    return stage;
  };
  const settle = stage => db.query("select public.settle_stage_personality_team_morale($1) as count", [stage]).then(res => res.rows[0].count);
  const moraleOf = rider => db.query(
    "select requested_delta::int as delta, source_reference as reference, metadata from rider_morale_events where rider_id=$1 order by source_reference",
    [id(rider)],
  ).then(res => res.rows);
  const effort = (rider, kind, targets, endKm = 5) => ({
    riderId: id(rider), kind, targetRiderIds: targets.map(id), startKm: 2, endKm,
  });
  // The old lock is missing the character field even though the rider is now assigned one.
  const old = await fixture({ day: 1, country: 50, snapshot: [{ id: id(10), age: 30 }], results: [[10, 1, 8]] });
  assert.equal(await settle(old), 0);

  const first = await fixture({
    day: 2, country: 50, snapshot: riders,
    results: [[1, 1, 18], [2, 1, 19], [3, 1, 20], [4, 1, 21], [5, 1, 1], [6, 2, 25], [9, 1, null, "did_not_start"], [10, 1, 15]],
    work: [effort(1, "recovery", [5]), effort(2, "peloton", []), effort(6, "protection", [5])],
  });
  assert.equal(await settle(first), 4);
  assert.equal(await settle(first), 0);
  for (const rider of [1, 2, 3, 4]) assert.equal((await moraleOf(rider))[0].delta, 1);
  assert.equal((await moraleOf(1))[0].metadata.teammateRiderId, id(5));
  assert.equal((await moraleOf(2))[0].metadata.teammateRiderId, id(5));
  for (const rider of [5, 6, 9, 10]) assert.deepEqual(await moraleOf(rider), []);

  const repeated = await fixture({
    day: 3, country: 50, edition: 102, snapshot: riders,
    results: [[1, 1, 18], [2, 1, 19], [3, 1, 20], [4, 1, 21], [5, 1, 1], [6, 1, 25]],
    work: [effort(1, "recovery", [5]), effort(2, "leadout", []), effort(6, "protection", [5])],
  });
  assert.equal(await settle(repeated), 0);
  for (let day = 4; day <= 6; day += 1) {
    const stage = await fixture({ day, country: 51 + day, snapshot: riders, results: [[3, 1, 10]] });
    assert.equal(await settle(stage), day < 6 ? 1 : 0);
  }
  assert.equal((await moraleOf(3)).length, 3);
  const future = await fixture({ day: 7, country: 65, snapshot: riders, results: [[4, 1, 8]] });
  await db.query("update stages set departure_at='3000-01-01' where id=$1", [future]);
  assert.equal(await settle(future), 0);
  await db.query("update stages set departure_at=null, status='cancelled' where id=$1", [future]);
  assert.equal(await settle(future), 0);

  const contract = async (row, rider, team, start, end, status, type, left = null, leftDay = null) => {
    await db.query("insert into rider_contracts values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())",
      [id(row), id(rider), id(team), id(start), id(end), left ? id(left) : null, leftDay, type, status]);
  };
  await contract(200, 7, 40, 11, 13, "active", "initial");
  await contract(201, 7, 40, 14, 14, "planned", "renewal");
  assert.deepEqual((await moraleOf(7)).map(event => event.delta), [1]);
  await db.query("update rider_contracts set status='cancelled' where id=$1", [id(201)]);
  await db.query("update rider_contracts set status='planned' where id=$1", [id(201)]);
  assert.deepEqual((await moraleOf(7)).map(event => event.delta), [1]);
  await db.query("update rider_contracts set status='terminated', left_season_id=$1, left_day_number=4 where id=$2", [id(13), id(200)]);
  await contract(202, 7, 41, 13, 13, "active", "director_auction");
  assert.deepEqual((await moraleOf(7)).map(event => event.delta), [1, -1]);

  await contract(210, 8, 40, 12, 13, "terminated", "initial", 13, 4);
  await contract(211, 8, 42, 13, 13, "active", "direct_offer");
  assert.deepEqual(await moraleOf(8), []);

  await db.query("insert into season_days values ($1,$2,1,'2000-01-08')", [id(38), id(14)]);
  await contract(220, 15, 40, 12, 12, "completed", "initial");
  await contract(221, 15, 40, 13, 13, "completed", "renewal");
  await contract(222, 15, 43, 14, 14, "planned", "direct_offer");
  assert.deepEqual(await moraleOf(15), []);
  await db.query("update rider_contracts set status='active' where id=$1", [id(222)]);
  assert.deepEqual((await moraleOf(15)).map(event => event.delta), [-1]);

  console.log("Team character events verified in isolated PostgreSQL: renewal, transfer, actual teamwork, scouting preparation, new-country cap, replay safety.");
} finally {
  await db.close();
}
