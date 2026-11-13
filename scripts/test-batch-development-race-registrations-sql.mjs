// Isolated PostgreSQL only. Never connect this fixture to the live game.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2];
if (!modulePath || !isAbsolute(modulePath)) {
  throw new Error("Provide the absolute path to an isolated PGlite module.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1);
const junior = id(2);
const teammate = id(3);
const validRace = id(10);
const secondRace = id(11);
const closedRace = id(12);
const automaticRace = id(13);
const edit = (raceEditionId, ...riderIds) => ({ raceEditionId, riderIds });

const readMigration = (name) =>
  readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8");
const selectRegistrations = async () => {
  await db.exec("reset role");
  const result = await db.query(`
    select registration.race_edition_id as race, rider.academy_rider_id as rider
    from public.development_race_registrations as registration
    join public.development_race_registration_riders as rider
      on rider.registration_id = registration.id
    order by race, rider
  `);
  await db.exec("set role authenticated");
  return result.rows;
};
const batch = async (updates) =>
  (await db.query(
    "select public.register_current_development_races($1::jsonb) as count",
    [JSON.stringify(updates)],
  )).rows[0].count;

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table public.seasons (
      id uuid primary key, status text, current_day_number int, game_year int
    );
    create table public.development_teams (
      id uuid primary key, team_id uuid, season_id uuid, status text
    );
    create table public.development_race_editions (
      id uuid primary key, season_id uuid, name text, status text,
      start_day_number int, selection_mode text, selection_minimum int,
      selection_maximum int
    );
    create table public.development_team_roster (
      development_team_id uuid, academy_rider_id uuid
    );
    create table public.development_race_registrations (
      id uuid default gen_random_uuid() primary key,
      development_team_id uuid, race_edition_id uuid, status text,
      updated_at timestamptz, unique (development_team_id, race_edition_id)
    );
    create table public.development_race_registration_riders (
      registration_id uuid, academy_rider_id uuid,
      primary key (registration_id, academy_rider_id)
    );
    create function public.current_user_manages_team(uuid)
    returns boolean language sql stable as $$
      select auth.uid() = $1
    $$;
    grant select on table public.development_race_editions to authenticated;
  `);
  await db.exec(await readMigration("20260812131000_fix_development_race_registration_context"));
  const seasonThree = await readMigration("20260825140000_add_season_three_junior_competition");
  await db.exec(seasonThree.slice(
    seasonThree.indexOf("alter function public.register_current_development_race(uuid, uuid[])"),
    seasonThree.indexOf("-- CLASSEMENTS PRÉ-AGRÉGÉS"),
  ));
  await db.exec(await readMigration("20261113120000_batch_development_race_registrations"));
  await db.exec(`
    insert into public.seasons values ('${id(4)}', 'active', 8, 5);
    insert into public.development_teams values ('${id(5)}', '${owner}', '${id(4)}', 'active');
    insert into public.development_team_roster values ('${id(5)}', '${junior}'), ('${id(5)}', '${teammate}');
    insert into public.development_race_editions values
      ('${validRace}', '${id(4)}', 'Classique junior', 'planned', 9, 'manual', 1, 2),
      ('${secondRace}', '${id(4)}', 'Tour junior', 'planned', 10, 'manual', 1, 2),
      ('${closedRace}', '${id(4)}', 'Course close', 'planned', 8, 'manual', 1, 2),
      ('${automaticRace}', '${id(4)}', 'Sélection fédérale', 'planned', 11, 'automatic', 1, 2);
    set role anon;
  `);
  await assert.rejects(() => batch([edit(validRace, junior)]), /permission denied/);
  await db.exec("reset role; set role authenticated");
  await assert.rejects(() => batch([edit(validRace, junior)]), /authentifié/);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id(6)]);
  await assert.rejects(() => batch([edit(validRace, junior)]), /Constituez d’abord/);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
  await assert.rejects(() => batch([edit(validRace, junior), edit(validRace, teammate)]), /qu’une fois/);
  await assert.rejects(() => batch([edit(validRace)]), /invalide/);
  await assert.rejects(() => batch([edit(validRace, junior), edit(closedRace, junior)]), /Course close · Les inscriptions sont closes/);
  assert.deepEqual(await selectRegistrations(), []);
  await assert.rejects(() => batch([edit(validRace, junior), edit(secondRace, id(99))]), /Tour junior · La sélection contient un junior extérieur/);
  assert.deepEqual(await selectRegistrations(), []);
  await assert.rejects(() => batch([edit(validRace, junior), edit(automaticRace, junior)]), /Sélection fédérale · Cette sélection nationale/);
  assert.deepEqual(await selectRegistrations(), []);

  const validUpdates = [edit(secondRace, teammate), edit(validRace, junior, teammate)];
  assert.equal(await batch(validUpdates), 2);
  const expected = [
    { race: validRace, rider: junior },
    { race: validRace, rider: teammate },
    { race: secondRace, rider: teammate },
  ];
  assert.deepEqual(await selectRegistrations(), expected);
  assert.equal(await batch(validUpdates), 2);
  assert.deepEqual(await selectRegistrations(), expected);
  assert.equal(await batch([edit(validRace, teammate)]), 1);
  assert.deepEqual(await selectRegistrations(), expected.slice(1));
  console.log("Dev Team batch verified with the existing registration RPC and atomic rollback.");
} finally {
  await db.close();
}
