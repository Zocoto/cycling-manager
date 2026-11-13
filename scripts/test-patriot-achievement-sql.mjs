import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ?? "";
if (!isAbsolute(modulePath) || !modulePath.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js")) {
  throw new Error("Pass the absolute path to an isolated PGlite installation.");
}

const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const migration = (name) => readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8");
function statement(source, start, end = "$$;") {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.ok(startIndex >= 0 && endIndex > startIndex, start);
  return source.slice(startIndex, endIndex + end.length);
}

const base = migration("20260722170000_create_game_objectives");
const career = migration("20261015130000_prospective_career_achievements");
const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const directorId = id(1);
const teamId = id(2);
const teamSeasonId = id(3);
const currentSeasonId = id(4);
const nextSeasonId = id(5);
const pastSeasonId = id(6);
const nationalId = id(7);
const foreignId = id(8);
const otherTeamId = id(9);
const riderId = (number) => id(100 + number);
const objective = "journey_patriot_gold";

async function scalar(sql, parameters = []) {
  return Object.values((await db.query(sql, parameters)).rows[0])[0];
}

const progress = (metric = "patriot_national_roster") => scalar(
  "select public.calculate_game_objective_progress($1, $2, $3, 0)",
  [metric, directorId, teamId],
);
const claim = () => scalar("select public.claim_current_game_objective($1)", [objective]);

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema private;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table sporting_directors(id uuid primary key, auth_user_id uuid, status text,
      experience_points integer not null, reputation_points numeric not null);
    create table teams(id uuid primary key, status text);
    create table team_manager_assignments(sporting_director_id uuid, team_id uuid, role text, status text);
    create table seasons(id uuid primary key, status text, game_year integer, current_day_number integer);
    create table season_days(id uuid, season_id uuid, day_number integer);
    create table team_seasons(id uuid primary key, team_id uuid, season_id uuid, registration_country_id uuid,
      status text, cash_balance numeric, unique(team_id, season_id));
    create table riders(id uuid primary key, country_id uuid, status text);
    create table rider_season_ratings(rider_id uuid, season_id uuid, primary key(rider_id, season_id));
    create table rider_contracts(team_id uuid, rider_id uuid, start_season_id uuid, end_season_id uuid, status text);
    create table career_achievement_progress(sporting_director_id uuid, metric_key text, subject_key text, peak numeric);
    create table inventory_catalog_items(id uuid primary key, item_key text unique, name text, status text, category text);
    create table equipment_catalog_items(id uuid primary key, catalog_key text unique, name text, status text);
    create table reward_events(id uuid primary key default gen_random_uuid(), source_reference text unique,
      source_type text, sporting_director_id uuid, team_season_id uuid, reputation_points numeric,
      experience_points integer, cash_prize numeric, description text);
    create table team_finance_transactions(team_season_id uuid, season_day_id uuid, day_number integer,
      amount numeric, category text, status text, description text, source_reference text, posted_at timestamptz);
    create table sporting_director_trophies(sporting_director_id uuid, trophy_key text, available_at timestamptz,
      claimed_at timestamptz, primary key(sporting_director_id, trophy_key));
    create function public.calculate_game_objective_progress_pre_prospective(text, uuid, uuid, numeric)
    returns integer language sql stable as $$select 17$$;
  `);
  await db.exec(statement(base, "create table public.game_objective_definitions", ");"));
  await db.exec(statement(base, "create table public.game_objective_claims", ");"));
  await db.exec(statement(career, "create function public.calculate_game_objective_progress("));
  await db.exec(statement(career, "create function private.award_prospective_achievement_trophy()"));
  await db.exec(statement(career, "create trigger award_prospective_achievement_after_claim", ";"));
  await db.exec(statement(base, "create or replace function public.claim_current_game_objective("));
  await db.exec(migration("20261113110000_add_patriot_achievement"));

  await db.exec(`
    insert into sporting_directors values ('${directorId}', '${directorId}', 'active', 50, 10);
    insert into teams values ('${teamId}', 'active'), ('${otherTeamId}', 'active');
    insert into team_manager_assignments values ('${directorId}', '${teamId}', 'general_manager', 'active');
    insert into seasons values ('${pastSeasonId}', 'completed', 4, 28),
      ('${currentSeasonId}', 'active', 5, 8), ('${nextSeasonId}', 'planned', 6, 1);
    insert into team_seasons values ('${teamSeasonId}', '${teamId}', '${currentSeasonId}', '${nationalId}', 'active', 0);
    insert into riders values ${Array.from({ length: 34 }, (_, index) =>
      `('${riderId(index)}', '${nationalId}', 'active')`).join(", ")},
      ('${riderId(34)}', '${foreignId}', 'active'), ('${riderId(35)}', '${nationalId}', 'retired'),
      ('${riderId(36)}', '${nationalId}', 'active'), ('${riderId(37)}', '${nationalId}', 'active'),
      ('${riderId(38)}', '${nationalId}', 'active'), ('${riderId(39)}', '${nationalId}', 'active');
    insert into rider_season_ratings select id, '${currentSeasonId}' from riders where id <> '${riderId(39)}';
    insert into rider_contracts values ${Array.from({ length: 36 }, (_, index) =>
      `('${teamId}', '${riderId(index)}', '${pastSeasonId}', '${currentSeasonId}', 'active')`).join(", ")},
      ('${teamId}', '${riderId(36)}', '${nextSeasonId}', '${nextSeasonId}', 'planned'),
      ('${teamId}', '${riderId(37)}', '${pastSeasonId}', '${pastSeasonId}', 'active'),
      ('${otherTeamId}', '${riderId(38)}', '${currentSeasonId}', '${currentSeasonId}', 'active'),
      ('${teamId}', '${riderId(39)}', '${currentSeasonId}', '${currentSeasonId}', 'active'),
      ('${teamId}', '${riderId(1)}', '${currentSeasonId}', '${nextSeasonId}', 'active');
    set request.jwt.claim.sub = '${directorId}';
  `);
  assert.equal(await progress("existing_roster_metric"), 17);
  assert.equal(await progress(), 34);
  await assert.rejects(claim, /34\/35/);
  assert.equal(await scalar("select count(*)::integer from public.reward_events"), 0);
  assert.equal(await scalar("select count(*)::integer from public.sporting_director_trophies"), 0);

  await db.query("update public.riders set country_id = $1 where id = $2", [nationalId, riderId(34)]);
  assert.equal(await progress(), 35);
  assert.deepEqual(await claim(), {
    objectiveKey: objective, title: "Le Patriote", cash: 1000000, experience: 1000,
    reputation: 100, itemName: null, claimedAt: await scalar("select to_jsonb(claimed_at) from game_objective_claims"),
  });
  await assert.rejects(claim, /déjà été récupérée/);
  assert.equal(await scalar("select cash_balance::integer from public.team_seasons"), 1000000);
  assert.equal(await scalar("select experience_points from public.sporting_directors"), 1050);
  assert.equal(await scalar("select reputation_points::integer from public.sporting_directors"), 110);
  assert.equal(await scalar("select count(*)::integer from public.team_finance_transactions"), 1);
  assert.equal(await scalar("select trophy_key from public.sporting_director_trophies"), "journey_patriot");
  await db.query("update public.riders set country_id = $1 where id = $2", [foreignId, riderId(34)]);
  assert.equal(await progress(), 35);
  console.log("Le Patriote: 34/35 threshold, current contracts and nationality, duplicate protection, rewards and lasting distinction verified.");
} finally {
  await db.close();
}
