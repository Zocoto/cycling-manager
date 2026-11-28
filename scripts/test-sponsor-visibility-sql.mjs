// Isolated PostgreSQL/WASM only. The optional second path is a read-only
// pg_get_functiondef capture, never a database connection.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ?? "C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js";
assert.ok(isAbsolute(modulePath) && modulePath.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js"));
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const read = (name) => readFileSync(`supabase/migrations/${name}.sql`, "utf8").replaceAll("\r", "");
const get = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const progress = async () => (await db.query(`
  select o.id, o.status objective_status, p.status, p.current_value::integer as value, p.details, p.settled_at, p.achieved_at
  from sponsor_objectives o join objective_progress p on p.sponsor_objective_id=o.id
  where p.team_sponsor_contract_id=$1 order by o.display_order
`, [id(10)])).rows;
const positions = async () => (await progress()).map(({ value, status }) => [value, status]);
const refresh = (stage) => db.query("select public.refresh_sponsor_visibility_for_stage($1)", [id(stage)]);
const evaluate = (finalize) => db.query(
  "select public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821($1,$2)",
  [id(10), finalize],
);
const score = async () => (await get("select satisfaction_score from team_sponsor_contracts where id=$1", [id(10)])).satisfaction_score;

try {
  await db.exec(`
    create schema private;
    create role anon; create role authenticated; create role service_role;
    create table seasons(id uuid primary key,game_year int,status text,starts_on date,ends_on date);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,status text,final_rank int,next_sponsor_budget_bonus_percent numeric default 0);
    create table team_sponsor_contracts(id uuid primary key,team_id uuid,sponsor_offer_id uuid,start_season_id uuid,
      objective_season_id uuid,status text,satisfaction_score int default 0,satisfaction_updated_at timestamptz);
    create table sporting_directors(id uuid primary key,reputation_points int default 100);
    create table team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text);
    create table sponsor_objectives(id uuid primary key,sponsor_offer_id uuid,season_id uuid,
      objective_type text constraint sponsor_objectives_type_allowed check (objective_type='infrastructure'),
      status text,satisfaction_points int,target_details jsonb,display_order int,renewal_bonus_percent numeric default 0,updated_at timestamptz);
    create table objective_progress(id uuid primary key default gen_random_uuid(),sponsor_objective_id uuid,
      team_sponsor_contract_id uuid,season_id uuid,current_value numeric,status text,details jsonb,settled_at timestamptz,
      updated_at timestamptz,last_evaluated_at timestamptz,achieved_at timestamptz,reputation_penalty int default 0,
      unique(sponsor_objective_id,team_sponsor_contract_id,season_id));
    create table races(id uuid primary key,race_format text,competition_type text,slug text);
    create table race_editions(id uuid primary key,race_id uuid,season_id uuid,status text);
    create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid);
    create table race_rosters(id uuid primary key,race_registration_id uuid);
    create table stages(id uuid primary key,race_edition_id uuid,status text,stage_type text);
    create table stage_attack_participants(stage_id uuid,race_roster_id uuid,participation_type text);
    create table race_combativity_awards(race_edition_id uuid,stage_id uuid,race_roster_id uuid,award_scope text);
    create table official_race_historical_corrections(race_edition_id uuid,after_summary jsonb);
    create table private.sponsor_objective_ambition_plans(sponsor_offer_id uuid,
      objective_difficulty text,objectives jsonb,created_at timestamptz);
    create function public.reconcile_sponsor_race_objectives_for_edition(uuid) returns integer language sql as 'select 0';
    create function public.get_sponsor_objective_satisfaction_score(c uuid) returns integer language sql as $$
      select coalesce(sum(o.satisfaction_points),0)::integer from public.sponsor_objectives o join public.team_sponsor_contracts con
        on con.sponsor_offer_id=o.sponsor_offer_id and coalesce(con.objective_season_id,con.start_season_id)=o.season_id
      where con.id=c and o.status='completed'
    $$;
  `);
  if (process.argv[3]) {
    const capture = JSON.parse(readFileSync(process.argv[3], "utf8").replace(/^\uFEFF/, ""));
    assert.equal(capture.rows.length, 4);
    for (const { definition } of capture.rows) await db.exec(`${definition};`);
  } else {
    const source = read("20260813110000_expand_sponsor_objectives_and_satisfaction");
    const start = source.indexOf("create or replace function public.evaluate_sponsor_objectives_for_contract(");
    await db.exec(source.slice(start, source.indexOf("$$;", start) + 3)
      .replace("public.evaluate_sponsor_objectives_for_contract(", "public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821(")
      .replace("contract.start_season_id,", "coalesce(contract.objective_season_id, contract.start_season_id) as objective_season_id,")
      .replaceAll("= contract.start_season_id", "= coalesce(contract.objective_season_id, contract.start_season_id)")
      .replaceAll("v_contract.start_season_id", "v_contract.objective_season_id")
      .replaceAll("and objective.season_id = v_contract.objective_season_id", "and objective.season_id = v_contract.objective_season_id and objective.status <> 'cancelled'"));
    await db.exec(read("20261102120000_refresh_unsettled_sponsor_race_results"));

    const portfolios = read("20261121201037_consistent_new_sponsor_objective_portfolios");
    await db.exec(portfolios.slice(portfolios.indexOf("create function private.sponsor_objective_requirements_overlap"), portfolios.indexOf("-- Pure ten-slot")));
    const replay = read("20261003090000_reconcile_sponsor_objectives_after_official_replay");
    const hook = replay.indexOf("create or replace function private.reconcile_sponsor_objectives_after_official_replay");
    await db.exec(replay.slice(hook, replay.indexOf("$$;", hook) + 3));
  }

  await db.exec(read("20261128220000_add_sponsor_visibility_objectives").replaceAll("\n", "\r\n"));
  await db.exec(`
    create trigger reconcile_visibility after insert on official_race_historical_corrections
      for each row execute function private.reconcile_sponsor_objectives_after_official_replay();
    insert into seasons values
      ('${id(1)}',5,'completed','2026-11-06','2026-12-03'),('${id(2)}',6,'active','2026-12-04','2026-12-31');
    insert into team_seasons(id,team_id,season_id,status) values
      ('${id(6)}','${id(4)}','${id(1)}','completed'),('${id(7)}','${id(4)}','${id(2)}','active'),
      ('${id(8)}','${id(5)}','${id(2)}','active');
    insert into team_sponsor_contracts(id,team_id,sponsor_offer_id,start_season_id,objective_season_id,status)
      values('${id(10)}','${id(4)}','${id(11)}','${id(1)}','${id(2)}','active');
    insert into sporting_directors values('${id(9)}',100);
    insert into team_manager_assignments values('${id(4)}','${id(9)}','general_manager','active');
  `);
  const criteria = [
    ["classic_breakaways", 1, 15],
    ["stage_breakaways", 2, 20],
    ["combativity_awards", 2, 25],
  ];
  for (const [index, [metric, minimumCount, points]] of criteria.entries()) {
    await db.query(`
      insert into sponsor_objectives(id,sponsor_offer_id,season_id,objective_type,status,satisfaction_points,target_details,display_order)
      values($1,$2,$3,'race_visibility','active',$4,$5::jsonb,$6)
    `, [id(20+index), id(11), id(2), points, JSON.stringify({kind: "race_visibility", metric, minimumCount}), index+1]);
  }
  await assert.rejects(db.query("update sponsor_objectives set target_details=target_details || '{\"minimumCount\":0}'::jsonb where id=$1", [id(20)]), /sponsor_objectives_visibility_target_allowed/);

  const raceFixtures = [
    [30, 40, 50, 60, 70, "one_day", "standard", "club-classic", 2, "completed", "completed", "road", 7, "breakaway"],
    [31, 41, 51, 61, 71, "stage_race", "standard", "open-tour", 2, "in_progress", "completed", "road", 7, "breakaway"],
    [32, 42, 52, 62, 72, "one_day", "national_road", "nation", 2, "completed", "completed", "road", 7, "breakaway"],
    [33, 43, 53, 63, 73, "one_day", "standard", "criterium-de-la-decouverte", 2, "completed", "completed", "road", 7, "breakaway"],
    [34, 44, 54, 64, 74, "one_day", "standard", "chase", 2, "completed", "completed", "road", 7, "chase"],
    [35, 45, 55, 65, 75, "one_day", "standard", "tt", 2, "completed", "completed", "individual_time_trial", 7, "breakaway"],
    [36, 46, 56, 66, 76, "one_day", "standard", "cancelled", 2, "cancelled", "completed", "road", 7, "breakaway"],
    [37, 47, 57, 67, 77, "one_day", "standard", "prior-season", 1, "completed", "completed", "road", 6, "breakaway"],
    [38, 48, 58, 68, 78, "one_day", "standard", "other-club", 2, "completed", "completed", "road", 8, "breakaway"],
  ];
  for (const [race, edition, stage, registration, rider, format, competition, slug, season, status, stageStatus, stageType, teamSeason, participation] of raceFixtures) {
    await db.query("insert into races values($1,$2,$3,$4)", [id(race), format, competition, slug]);
    await db.query("insert into race_editions values($1,$2,$3,$4)", [id(edition), id(race), id(season), status]);
    await db.query("insert into stages values($1,$2,$3,$4)", [id(stage), id(edition), stageStatus, stageType]);
    await db.query("insert into race_registrations values($1,$2,$3)", [id(registration), id(edition), id(teamSeason)]);
    await db.query("insert into race_rosters values($1,$2)", [id(rider), id(registration)]);
    await db.query("insert into stage_attack_participants values($1,$2,$3)", [id(stage), id(rider), participation]);
    if (stage !== 54) {
      await db.query("insert into race_combativity_awards values($1,$2,$3,'stage')", [id(edition), id(stage), id(rider)]);
    }
  }
  await db.exec(`
    insert into race_rosters values('${id(80)}','${id(60)}');
    insert into stage_attack_participants values('${id(50)}','${id(80)}','breakaway');
    insert into race_combativity_awards values('${id(41)}',null,'${id(71)}','race');
    insert into stages values('${id(81)}','${id(41)}','in_progress','road');
    insert into stage_attack_participants values('${id(81)}','${id(71)}','breakaway');
  `);

  await evaluate(false);
  assert.deepEqual(await positions(), [[1, "achieved"], [1, "in_progress"], [2, "achieved"]]);
  assert.equal(await score(), 40);
  await refresh(81);
  assert.deepEqual(await positions(), [[1, "achieved"], [1, "in_progress"], [2, "achieved"]], "An unfinished stage is ineligible");
  await db.query("update stages set status='completed' where id=$1", [id(81)]);
  await refresh(81);
  assert.deepEqual(await positions(), [[1, "achieved"], [2, "achieved"], [2, "achieved"]], "Progress is visible before a tour finishes");
  assert.equal(await score(), 60);
  const unchanged = await progress();
  await refresh(81);
  assert.deepEqual(await progress(), unchanged, "Repeated publication does not rewrite progress");

  await db.query("delete from stage_attack_participants where stage_id=$1", [id(81)]);
  await db.query("delete from race_combativity_awards where stage_id=$1", [id(51)]);
  await db.query("insert into official_race_historical_corrections values($1,'{\"status\":\"applied\"}')", [id(41)]);
  assert.deepEqual(await positions(), [[1, "achieved"], [1, "in_progress"], [1, "in_progress"]], "Corrections can reopen achieved objectives");
  assert.equal(await score(), 15);

  await evaluate(true);
  assert.deepEqual(await positions(), [[1, "achieved"], [1, "failed"], [1, "failed"]]);
  const settled = await progress();
  assert.ok(settled.every((objective) => objective.settled_at));
  await db.query("insert into stage_attack_participants values($1,$2,'breakaway')", [id(81), id(71)]);
  await refresh(81);
  await evaluate(true);
  assert.deepEqual(await progress(), settled, "Official changes cannot alter final settlement");

  const goal = (metric, minimumCount) => JSON.stringify({ kind: "race_visibility", metric, minimumCount });
  const weight = (details) => get("select private.sponsor_objective_difficulty_weight($1::jsonb,'elite','visibility') as weight", [details]);
  assert.ok(Math.abs((await weight(goal("classic_breakaways", 4))).weight - 14.95) < 1e-9);
  assert.ok(Math.abs((await weight(goal("stage_breakaways", 5))).weight - 14.95) < 1e-9);
  assert.ok(Math.abs((await weight(goal("combativity_awards", 2))).weight - 20.7) < 1e-9);
  const overlap = (a,b) => get("select private.sponsor_objective_requirements_overlap($1::jsonb,$2::jsonb) as overlap", [a,b]);
  assert.equal((await overlap(goal("classic_breakaways", 2), goal("stage_breakaways", 2))).overlap, false);
  assert.equal((await overlap(goal("classic_breakaways", 2), goal("classic_breakaways", 3))).overlap, true);
  await db.query(`insert into private.sponsor_objective_ambition_plans values
    ($1,'accessible','[{"target_details":{"sportingPhilosophy":"visibility"}}]','2026-11-28'),
    ($1,'balanced','[{"target_details":{"sportingPhilosophy":"sprints"}}]','2026-11-29'),
    ($2,'balanced','[{"target_details":{"sportingPhilosophy":"youth_development"}}]','2026-11-28')`,
    [id(11), id(12)]);
  assert.deepEqual((await db.query("select * from public.get_archived_sponsor_offer_philosophies($1::uuid[])", [[id(11), id(13)]])).rows,
    [{ sponsor_offer_id: id(11), sporting_philosophy: "visibility" }]);
  assert.deepEqual(await get(`select
    has_function_privilege('service_role','public.refresh_sponsor_visibility_for_stage(uuid)','execute') as service,
    has_function_privilege('authenticated','public.refresh_sponsor_visibility_for_stage(uuid)','execute') as authenticated,
    has_function_privilege('authenticated','public.get_archived_sponsor_offer_philosophies(uuid[])','execute') as archive_authenticated`),
    { service: true, authenticated: false, archive_authenticated: false });
  console.log("Sponsor visibility SQL verified in isolated PostgreSQL.");
} finally {
  await db.close();
}
