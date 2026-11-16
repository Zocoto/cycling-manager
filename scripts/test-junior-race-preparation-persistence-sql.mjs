import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const database = new PGlite();
const migration = readFileSync("supabase/migrations/20261116224000_create_junior_race_preparations.sql", "utf8");
const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const ids = values => values.map(id);
const query = async (sql, parameters = []) => (await database.query(sql, parameters)).rows;
const save = (stage, registration, scope, orders) => query(
  "select public.save_current_junior_race_preparation($1, $2, $3, $4)",
  [id(stage), id(registration), scope, JSON.stringify(orders.map(([rider, instruction]) => ({ riderId: id(rider), instruction })))],
);
const preparations = () => query("select * from public.get_current_junior_race_preparations()");
const switchAccount = async (account, role = "authenticated") => {
  await database.exec(`reset role; set role ${role}`);
  await query("select set_config('request.jwt.claim.sub', $1, false)", [account ? id(account) : ""]);
};

try {
  await database.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema private;
    create schema auth;
    create function auth.uid() returns uuid language sql stable
      as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    create table countries(id uuid primary key, iso_alpha2 text, is_active boolean default true);
    create table seasons(id uuid primary key, status text, game_year integer, current_day_number smallint, starts_on date);
    create table sporting_directors(id uuid primary key, auth_user_id uuid, status text);
    create table team_manager_assignments(sporting_director_id uuid, team_id uuid, role text, status text);
    create table teams(id uuid primary key, status text);
    create table team_seasons(team_id uuid, season_id uuid, registration_country_id uuid, status text default 'active');
    create table development_teams(id uuid primary key, team_id uuid, season_id uuid, status text);
    create table development_race_editions(id uuid primary key, season_id uuid, name text, slug text, status text, competition_type text);
    create table development_race_stages(id uuid primary key, race_edition_id uuid, stage_number smallint, day_number smallint, name text,
      stage_type text, profile_type text, distance_km numeric(6, 1));
    create table development_race_registrations(id uuid primary key, development_team_id uuid, race_edition_id uuid, status text);
    create table development_race_registration_riders(registration_id uuid, academy_rider_id uuid, primary key(registration_id, academy_rider_id));
    create table development_race_results(race_edition_id uuid, stage_id uuid, result_scope text);
    create table youth_academy_riders(id uuid primary key, first_name text, last_name text, country_id uuid);
    create table national_federation_terms(country_id uuid, president_director_id uuid, start_game_year integer, end_game_year integer,
      governance_mode text default 'elected');
    create table national_federation_selection_slots(slot_key text, rider_category text);
    create table national_federation_selection_lists(id uuid primary key, country_id uuid, season_id uuid, slot_key text, status text);
    create table national_federation_junior_race_registrations(id uuid primary key, selection_list_id uuid, race_edition_id uuid, country_id uuid, status text);
    create table national_federation_junior_race_registration_riders(registration_id uuid, academy_rider_id uuid, primary key(registration_id, academy_rider_id));
  `);
  await database.exec(migration);
  await query("insert into countries values($1,'FR'),($2,'BE')", ids([1, 2]));
  await query(`insert into seasons values($1,'active',5,2,(statement_timestamp() at time zone 'Europe/Paris')::date - 1),
    ($2,'completed',4,28,(statement_timestamp() at time zone 'Europe/Paris')::date - 29)`, ids([3, 4]));
  await query("insert into sporting_directors values ($1,$2,'active'),($3,$4,'active')", ids([5, 6, 7, 8]));
  await query("insert into team_manager_assignments values ($1,$2,'general_manager','active'),($3,$4,'general_manager','active')", ids([5, 9, 7, 10]));
  await query("insert into teams values ($1,'active'),($2,'active')", ids([9, 10]));
  await query("insert into team_seasons values ($1,$2,$3),($4,$2,$5)", ids([9, 3, 1, 10, 2]));
  await query("insert into development_teams values ($1,$2,$3,'active'),($4,$5,$3,'active')", ids([11, 9, 3, 12, 10]));
  await query(`insert into development_race_editions values
    ($1,$4,'Club Tour','club-tour','planned','open'),($2,$4,'World Road','world-road','planned','world_road'),
    ($3,$4,'National Route','national-road','planned','national_road')`, ids([13, 14, 15, 3]));
  await query(`insert into development_race_stages values
    ($1,$6,1,5,'Road','road','hilly',125.0),($2,$6,2,6,'CLM','individual_time_trial','time_trial',17.0),
    ($3,$6,3,2,'Past','road','flat',125.0),($4,$7,1,7,'World Road','road','hilly',130.0),
    ($5,$8,1,7,'National Route','road','hilly',130.0)`, ids([16, 17, 18, 19, 20, 13, 14, 15]));
  await query(`insert into development_race_registrations values
    ($1,$4,$5,'registered'),($2,$6,$5,'registered'),($3,$4,$7,'registered')`, ids([21, 22, 23, 11, 13, 12, 15]));
  await query("insert into youth_academy_riders values ($1,'Ada','Basso',$4),($2,'Rosa','Cruz',$4),($3,'Léa','Ace',$5)", ids([24, 25, 26, 1, 2]));
  await query("insert into development_race_registration_riders values ($1,$4),($1,$5),($2,$6),($3,$4)", ids([21, 22, 23, 24, 25, 26]));
  await query("insert into national_federation_terms values ($1,$2,4,5),($3,$4,3,4)", ids([1, 5, 2, 7]));
  await query("insert into national_federation_selection_slots values ('w-jr-road','junior')");
  await query("insert into national_federation_selection_lists values ($1,$3,$5,'w-jr-road','finalized'),($2,$4,$5,'w-jr-road','pending_confirmation')", ids([27, 28, 1, 2, 3]));
  await query("insert into national_federation_junior_race_registrations values ($1,$3,$5,$6,'registered'),($2,$4,$5,$7,'registered')", ids([29, 30, 27, 28, 14, 1, 2]));
  await query("insert into national_federation_junior_race_registration_riders values ($1,$3),($2,$4)", ids([29, 30, 24, 26]));

  await switchAccount(6);
  const available = await preparations();
  assert.deepEqual(available.map(row => row.stage_id), ids([16, 17, 19]));
  assert.equal(available[1].stage_type, "individual_time_trial");
  assert.equal(available[2].country_code, "FR");
  assert.deepEqual(available.map(row => row.riders.map(rider => rider.instruction)), [["free", "free"], ["steady", "steady"], ["free"]]);
  assert.equal(await query("select (preparation_closes_at at time zone 'Europe/Paris')::time::text as deadline from public.get_current_junior_race_preparations()")
    .then(rows => rows.every(row => row.deadline === "00:00:00")), true);
  await save(16, 21, "club", [[24, "leader"], [25, "domestique"]]);
  await save(17, 21, "club", [[24, "progressive"], [25, "aggressive"]]);
  await save(19, 29, "federation", [[24, "attack"]]);
  assert.deepEqual((await preparations()).map(row => row.riders.map(rider => rider.instruction)), [["leader", "domestique"], ["progressive", "aggressive"], ["attack"]]);
  await assert.rejects(save(16, 21, "club", [[24, "leader"], [25, "leader"]]), /un seul leader/);
  await assert.rejects(save(17, 21, "club", [[24, "leader"], [25, "free"]]), /invalide/);
  await assert.rejects(save(16, 21, "club", [[24, "leader"], [24, "free"]]), /composition a changé/);
  await assert.rejects(save(16, 21, "club", [[24, "leader"], [26, "free"]]), /composition a changé/);
  await assert.rejects(save(16, 21, "club", [[24, "leader"]]), /composition a changé/);
  await assert.rejects(save(18, 21, "club", [[24, "leader"], [25, "free"]]), /verrouillées/);
  await assert.rejects(save(19, 21, "club", [[24, "leader"], [25, "free"]]), /verrouillées/);
  await assert.rejects(save(20, 23, "club", [[24, "leader"]]), /ce compte/);
  await assert.rejects(save(17, 21, "outside", [[24, "progressive"], [25, "steady"]]), /invalide/);
  await assert.rejects(query("select * from public.development_race_stage_plans"), /permission denied/);

  await switchAccount(8);
  assert.deepEqual((await preparations()).map(row => row.registration_id), ids([22, 22]));
  await assert.rejects(save(16, 21, "club", [[24, "leader"], [25, "free"]]), /ce compte/);
  await assert.rejects(save(19, 29, "federation", [[24, "attack"]]), /ce compte/);
  await assert.rejects(save(19, 30, "federation", [[26, "attack"]]), /ce compte/);
  await switchAccount(null, "anon");
  await assert.rejects(preparations(), /permission denied/);

  await database.exec("reset role");
  await query("insert into national_federation_terms values ($1,null,5,6,'automatic')", ids([1]));
  await switchAccount(6);
  assert.deepEqual((await preparations()).map(row => row.stage_id), ids([16, 17]));
  await assert.rejects(save(19, 29, "federation", [[24, "attack"]]), /ce compte/);
  await database.exec("reset role");
  await query("delete from national_federation_terms where country_id = $1 and start_game_year = 5", ids([1]));
  await query("update teams set status = 'inactive' where id = $1", ids([9]));
  await switchAccount(6);
  assert.deepEqual(await preparations(), []);
  await assert.rejects(save(16, 21, "club", [[24, "free"], [25, "free"]]), /ce compte/);
  await database.exec("reset role");
  await query("update teams set status = 'active' where id = $1", ids([9]));
  await query("delete from development_race_registration_riders where registration_id = $1 and academy_rider_id = $2", ids([21, 24]));
  await query("insert into development_race_results values ($1,$2,'stage')", ids([13, 17]));
  await switchAccount(6);
  const changed = await preparations();
  assert.deepEqual(changed.map(row => row.stage_id), ids([16, 19]));
  assert.deepEqual(changed[0].riders.map(rider => rider.riderId), ids([25]));
  await assert.rejects(save(16, 21, "club", [[24, "leader"], [25, "free"]]), /composition a changé/);
  await save(16, 21, "club", [[25, "free"]]);
  assert.equal((await preparations())[0].riders[0].instruction, "free");
  await database.exec("reset role");
  assert.equal((await query("select count(*)::integer as count from development_race_stage_plans where stage_id = $1", ids([16])))[0].count, 0);
  await query("update seasons set starts_on = starts_on - 5 where id = $1", ids([3]));
  await switchAccount(6);
  assert.deepEqual(await preparations(), []);
  await assert.rejects(save(16, 21, "club", [[25, "attack"]]), /verrouillées/);

  console.log("Junior preparation SQL passed: authority, stages, validation, changes, neutral reset and deadlines.");
} finally {
  await database.close();
}
