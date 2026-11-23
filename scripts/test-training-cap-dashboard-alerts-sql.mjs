import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const readMigration = async (name) => (await readFile(
  new URL(`../supabase/migrations/${name}.sql`, import.meta.url),
  "utf8",
)).replaceAll("\r\n", "\n");
const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const user = id(1), team = id(2), season = id(3), prior = id(4), otherTeam = id(5), otherUser = id(6);
const expected = (rider, stat, cap = 70) => ({ riderId: id(rider), riderName: `Prénom ${rider}`, stat, cap });
const base = await readMigration("20260828200000_add_dashboard_ds_assistant");
const cap = await readMigration("20261011133000_enforce_training_potential_stat_caps");
const contextCtes = base.slice(base.indexOf("  with current_context as ("), base.indexOf("  effective_training_setting as ("));
const plansCte = base.slice(base.indexOf("  latest_training_plans as ("), base.indexOf("  medical_alerts as ("));

async function assertAlerts(expectedAlerts, owner = user) {
  await db.query("select set_config('test.user_id', $1, false)", [owner]);
  const { rows: [row] } = await db.query("select * from public.get_current_dashboard_assistant_summary()");
  assert.deepEqual(row.journal_items, {
    items: [{ id: "existing-journal-item" }],
    equipmentPartnerSignatureAvailable: false,
    trainingCapAlerts: expectedAlerts,
  });
  return row.zero_training_count;
}

try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    create table public.sporting_directors(id uuid, auth_user_id uuid, status text);
    create table public.team_manager_assignments(sporting_director_id uuid, team_id uuid, role text, status text);
    create table public.teams(id uuid, status text);
    create table public.team_seasons(id uuid, team_id uuid, season_id uuid, status text);
    create table public.seasons(id uuid, game_year int, current_day_number int, status text);
    create table public.season_days(id uuid, season_id uuid, day_number int, calendar_date date);
    create table public.rider_contracts(rider_id uuid, team_id uuid, start_season_id uuid, end_season_id uuid, status text);
    create table public.rider_training_plan_versions(rider_id uuid, team_id uuid, season_id uuid,
      effective_from_day_number int, created_at timestamptz default now(), intensity int, domain text);
    create table public.riders(id uuid, first_name text, last_name text, potential_steps smallint, status text);
    create table public.rider_season_ratings(rider_id uuid, season_id uuid, mountain smallint, hills smallint,
      cobbles smallint, time_trial smallint, breakaway smallint, sprint smallint, acceleration smallint, endurance smallint);
    ${cap.match(/create or replace function public.get_rider_potential_stat_cap[\s\S]*?\$\$;/)[0]}
    create function public.get_current_dashboard_assistant_summary()
    returns table (journal_items jsonb, zero_training_count integer)
    language sql stable security definer set search_path = '' as $summary$
${contextCtes}${plansCte}
    fixture_zero_training as (
      select count(*)::integer as zero_count from latest_training_plans as plan where plan.intensity = 0
    )
    select jsonb_build_object(
      'items', jsonb_build_array(jsonb_build_object('id', 'existing-journal-item')),
      'equipmentPartnerSignatureAvailable', (select false)
    ), zero_count
    from fixture_zero_training;
    $summary$;
    revoke all on function public.get_current_dashboard_assistant_summary() from public, anon;
    grant execute on function public.get_current_dashboard_assistant_summary() to authenticated;
    insert into public.sporting_directors values ('${id(11)}','${user}','active'), ('${id(12)}','${otherUser}','active');
    insert into public.teams values ('${team}','active'), ('${otherTeam}','active');
    insert into public.team_manager_assignments values ('${id(11)}','${team}','general_manager','active'),
      ('${id(12)}','${otherTeam}','general_manager','active');
    insert into public.seasons values ('${season}',5,28,'active'), ('${prior}',4,28,'completed');
    insert into public.season_days values ('${id(13)}','${season}',28,'2026-11-23');
    insert into public.team_seasons values ('${id(14)}','${team}','${season}','active'), ('${id(15)}','${otherTeam}','${season}','active');
  `);
  await db.exec(await readMigration("20260831230000_use_next_training_plan_in_dashboard_alert"));
  await db.exec(await readMigration("20261123110000_add_primary_training_cap_dashboard_alerts"));

  const scenarios = [
    // rider, domain, relevant grade, potential steps, intensity, rider status
    [20, "puncheur", 70, 1, 70, "active"],
    [21, "puncheur", 69, 1, 70, "active"],
    [22, "puncheur", 71, 1, 70, "active"],
    [23, "stage_racer", 100, 1, 70, "active"],
    [24, "puncheur", 70, 1, 0, "active"],
    [25, "climber", 85, 4, 30, "active"],
    [26, "sprinter", 100, 8, 30, "active"],
    [27, "rouleur", 75, 2, 30, "active"],
    [28, "northern_classics", 80, 3, 30, "active"],
    [29, "breakaway", 80, 3, 30, "active"],
    [30, "puncheur", 70, 1, 70, "retired"],
    [31, "puncheur", 70, 1, 70, "active"],
    [32, "puncheur", 70, 1, 70, "active"],
    [33, "puncheur", 70, 1, 70, "active"],
  ];
  for (const [rider, domain, grade, potential, intensity, status] of scenarios) {
    const roster = rider === 31 ? otherTeam : team;
    const planSeason = rider === 32 ? prior : season;
    const contractEnd = rider === 33 ? prior : season;
    await db.query("insert into public.riders values ($1, 'Prénom', $2, $3, $4)", [id(rider), String(rider), potential, status]);
    await db.query("insert into public.rider_contracts values ($1, $2, $3, $4, 'active')", [id(rider), roster, prior, contractEnd]);
    await db.query("insert into public.rider_training_plan_versions (rider_id,team_id,season_id,effective_from_day_number,intensity,domain) values ($1,$2,$3,28,$4,$5)",
      [id(rider), roster, planSeason, intensity, domain]);
    await db.query("insert into public.rider_season_ratings values ($1,$2,$3,$3,$3,$3,$3,$3,100,100)", [id(rider), season, grade]);
  }
  await db.query("insert into public.rider_season_ratings values ($1,$2,100,100,100,100,100,100,100,100)", [id(21), prior]);
  await db.exec("set role authenticated");
  const all = [
    expected(20, "hills"), expected(22, "hills"), expected(25, "mountain", 85),
    expected(26, "sprint", 100), expected(27, "timeTrial", 75),
    expected(28, "cobbles", 80), expected(29, "breakaway", 80),
  ];
  assert.equal(await assertAlerts(all), 1);
  await assertAlerts([expected(31, "hills")], otherUser);
  await assertAlerts([], id(99));

  await db.exec("reset role");
  await db.query("insert into public.rider_training_plan_versions (rider_id,team_id,season_id,effective_from_day_number,intensity,domain) values ($1,$2,$3,29,60,'stage_racer')",
    [id(20), team, season]);
  await db.exec("set role authenticated");
  assert.equal(await assertAlerts(all.slice(1)), 1);
  await db.exec("reset role; set role anon");
  await assert.rejects(db.query("select * from public.get_current_dashboard_assistant_summary()"), /permission denied/);
  console.log("Dashboard training cap SQL: all six principal ratings, potential tiers, pending plans, ownership, seasons and permissions verified.");
} finally {
  await db.close();
}
