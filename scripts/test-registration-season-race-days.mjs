// In-memory PostgreSQL only. Supply a local PGlite module path.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2];
if (!modulePath?.replaceAll("\\", "/").endsWith("/pglite/dist/index.js")) {
  throw new Error("Pass the local @electric-sql/pglite dist/index.js path.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const uuid = (n) => `'${id(n)}'`;

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create table seasons (id uuid primary key, current_day_number integer);
    create table season_days (id uuid primary key, day_number integer);
    create table rider_season_ratings (rider_id uuid, season_id uuid, season_race_days integer, primary key (rider_id, season_id));
    create table rider_special_abilities (rider_id uuid, ability_code text, primary key (rider_id, ability_code));
    create table race_editions (id uuid primary key, season_id uuid, status text);
    create table race_registrations (id uuid primary key, race_edition_id uuid, status text);
    create table race_rosters (id uuid primary key, race_registration_id uuid, rider_id uuid, status text, unique (race_registration_id, rider_id));
    create table stages (id uuid primary key, race_edition_id uuid, season_day_id uuid, stage_number smallint, status text);
    create table stage_results (stage_id uuid, race_roster_id uuid, status text, primary key (stage_id, race_roster_id));
    create index on race_rosters(rider_id);
    create index on stages(race_edition_id);
    create index on stage_results(race_roster_id);
    grant select on all tables in schema public to service_role;
  `);
  await db.exec(readFileSync(
    "supabase/migrations/20261108180719_add_registration_season_race_day_projections.sql", "utf8",
  ));
  await db.exec(readFileSync(
    "supabase/migrations/20261109163000_expose_etapovore_on_race_registration.sql", "utf8",
  ));
  await db.exec(`insert into rider_special_abilities values (${uuid(1)},'etapovore'),(${uuid(1)},'flahute'),(${uuid(2)},'flahute')`);

  const editions = [
    [100, 5, "in_progress"], [110, 5, "registration_open"], [120, 5, "registration_closed"],
    [130, 5, "cancelled"], [140, 5, "completed"], [150, 5, "planned"], [160, 4, "planned"],
  ];
  const registrations = [
    [200, 100, "accepted"], [201, 100, "accepted"], [202, 100, "withdrawn"],
    [210, 110, "pending"], [211, 110, "accepted"], [220, 120, "accepted"],
    [230, 130, "accepted"], [240, 140, "accepted"],
    [250, 150, "accepted"], [251, 150, "rejected"], [252, 150, "withdrawn"], [260, 160, "accepted"],
  ];
  const rosters = [
    [300, 200, 1, "confirmed"], [301, 201, 3, "confirmed"], [302, 202, 3, "withdrawn"],
    [303, 202, 1, "withdrawn"], [310, 210, 1, "selected"], [311, 211, 1, "confirmed"],
    [320, 220, 1, "confirmed"], [321, 220, 2, "did_not_start"], [322, 220, 4, "confirmed"],
    [330, 230, 1, "confirmed"], [340, 240, 1, "confirmed"],
    [350, 250, 1, "withdrawn"], [351, 251, 1, "selected"], [352, 252, 1, "confirmed"], [360, 260, 1, "confirmed"],
  ];
  const stages = [
    [400, 100, 57, 1, "completed"], [401, 100, 57, 2, "in_progress"],
    [402, 100, 58, 3, "in_progress"], [403, 100, 59, 4, "planned"],
    [404, 100, 59, 5, "cancelled"], [405, 100, 57, 6, "planned"],
    [410, 110, 58, 1, "planned"], [420, 120, 58, 1, "planned"],
    [430, 130, 59, 1, "planned"], [440, 140, 59, 1, "planned"],
    [450, 150, 59, 1, "planned"], [460, 160, 48, 1, "planned"],
  ];
  const values = (rows, encode) => rows.map((row) => `(${encode(...row)})`).join(", ");
  await db.exec(`
    insert into seasons values (${uuid(5)},8), (${uuid(4)},8);
    insert into season_days values (${uuid(57)},7), (${uuid(58)},8), (${uuid(59)},9), (${uuid(48)},8);
    insert into rider_season_ratings values
      (${uuid(1)},${uuid(5)},29), (${uuid(2)},${uuid(5)},0), (${uuid(3)},${uuid(5)},4),
      (${uuid(4)},${uuid(5)},10), (${uuid(1)},${uuid(4)},50);
    insert into race_editions values ${values(editions, (edition, season, status) => `${uuid(edition)},${uuid(season)},'${status}'`)};
    insert into race_registrations values ${values(registrations, (registration, edition, status) => `${uuid(registration)},${uuid(edition)},'${status}'`)};
    insert into race_rosters values ${values(rosters, (roster, registration, rider, status) => `${uuid(roster)},${uuid(registration)},${uuid(rider)},'${status}'`)};
    insert into stages values ${values(stages, (stage, edition, day, number, status) => `${uuid(stage)},${uuid(edition)},${uuid(day)},${number},'${status}'`)};
    insert into stage_results values
      (${uuid(400)},${uuid(300)},'finished'), (${uuid(402)},${uuid(303)},'finished'),
      (${uuid(400)},${uuid(302)},'did_not_finish');
  `);

  const signature = "public.get_registration_season_race_days(uuid,uuid[])";
  for (const [role, allowed] of [["anon", false], ["authenticated", false], ["service_role", true]]) {
    const privilege = await db.query("select has_function_privilege($1, $2, 'execute') as allowed", [role, signature]);
    assert.equal(privilege.rows[0].allowed, allowed);
    const v2Privilege = await db.query("select has_function_privilege($1, $2, 'execute') as allowed", [role, "public.get_registration_season_race_days_v2(uuid,uuid[])"]);
    assert.equal(v2Privilege.rows[0].allowed, allowed);
  }
  await db.exec("set role service_role");
  const snapshot = async () => (await db.query(
    "select * from public.get_registration_season_race_days($1, $2) order by rider_id",
    [id(5), [id(1), id(1), id(2), id(3), id(9)]],
  )).rows;
  assert.deepEqual(await snapshot(), [
    // Two stages from the current tour and two different starts on J8.
    { rider_id: id(1), season_race_days: 29, projected_season_race_days: 33 },
    { rider_id: id(2), season_race_days: 0, projected_season_race_days: 0 },
    // The DNF persists even if the official roster was replaced.
    { rider_id: id(3), season_race_days: 4, projected_season_race_days: 4 },
  ]);
  assert.deepEqual((await db.query(
    "select * from public.get_registration_season_race_days_v2($1, $2) order by rider_id",
    [id(5), [id(1), id(1), id(2), id(3), id(9)]],
  )).rows, (await snapshot()).map(row => ({ ...row, has_etapovore: row.rider_id === id(1) })));
  await db.exec("reset role");
  await db.exec(`
    update stages set status = 'completed' where id = ${uuid(401)};
    insert into stage_results values (${uuid(401)}, ${uuid(300)}, 'finished');
    update rider_season_ratings set season_race_days = 30 where rider_id = ${uuid(1)} and season_id = ${uuid(5)};
  `);
  assert.deepEqual((await snapshot())[0], { rider_id: id(1), season_race_days: 30, projected_season_race_days: 33 });
  console.log("PASS: bounded roster, same-day stages, live delays, existing results, elimination, cancellations, retry and service-only access.");
} finally {
  await db.close();
}
