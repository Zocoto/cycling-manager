import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const modulePath = process.env.FEDERATION_WORKSHOP_PGLITE_MODULE ??
  "C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js";
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const migration = (name) => readFileSync(`supabase/migrations/${name}.sql`, "utf8").replace(/\r\n/g, "\n");
const projects = migration("20260904150000_create_federation_race_workshop");
const workflow = migration("20260914100000_rebuild_federation_race_workflow");
const settlement = migration("20261110120020_finalize_federation_race_workshop");

const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const value = async (query, params = []) => (await db.query(query, params)).rows[0];
const definition = (name) => {
  const start = workflow.indexOf(`create or replace function ${name}(`);
  assert.ok(start >= 0, `${name} exists in the baseline`);
  return workflow.slice(start, workflow.indexOf("\n$$;", start) + 4);
};
const stage = (name) => ({ name, stageType: "road", profileType: "flat", segments: [
  { distanceKm: 120, terrainType: "flat", surfaceType: "asphalt", averageGradientPct: 0 },
] });
const tour = [stage("Étape 1"), stage("Étape 2"), stage("Étape 3")];
const setPresident = (number) => value("select set_config('test.president', $1, false)", [id(number)]);
const addDraft = async (number, day, category, stages) => {
  await setPresident(number);
  return (await value(
    "select public.save_national_federation_race_draft($1,$2,$3,$4,$5,$6,$7,$8) as id",
    [`A${number}`, `Course fédérale ${number}`, `CF${number}`, stages.length > 1 ? "stage_race" : "one_day", category, day, "early", JSON.stringify(stages)],
  )).id;
};
const submit = async (number, projectId) => {
  await setPresident(number);
  return value("select public.submit_national_federation_race_vote($1, $2)", [`A${number}`, projectId]);
};
const project = (projectId) => value("select * from national_federation_race_projects where id = $1", [projectId]);
const balance = async (accountId) => Number((await value("select balance from national_federation_accounts where id = $1", [id(accountId)])).balance);
const reputation = async (directorId) => Number((await value("select reputation_points from sporting_directors where id = $1", [id(directorId)])).reputation_points);
const closeVote = (projectId, minutes) => db.query("update national_federation_race_projects set vote_opened_at=now()-interval '2 days', vote_closes_at=now()-make_interval(mins => $2) where id=$1", [projectId, minutes]);

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$select current_setting('test.president',true)::uuid$$;
    create table seasons(id uuid primary key, game_year int, status text, current_day_number int, ends_on date);
    create table season_days(id uuid primary key default gen_random_uuid(), season_id uuid, day_number int, calendar_date date);
    create table countries(id uuid primary key, iso_alpha2 text);
    create table teams(id uuid primary key);
    create table team_seasons(id uuid primary key, season_id uuid, team_id uuid, registration_country_id uuid, status text);
    create table team_manager_assignments(sporting_director_id uuid, team_id uuid, role text, status text);
    create table sporting_directors(id uuid primary key, reputation_points numeric);
    create table national_federation_terms(country_id uuid, start_game_year int, end_game_year int, governance_mode text, president_director_id uuid);
    create table national_federation_infrastructures(country_id uuid, infrastructure_code text, level int);
    create table national_federation_accounts(id uuid primary key, country_id uuid, season_id uuid, balance numeric, updated_at timestamptz);
    create table national_federation_transactions(account_id uuid, day_number int, amount numeric, category text, description text, source_reference text unique, metadata jsonb);
    create table national_federation_journal_entries(country_id uuid, season_id uuid, day_number int, category text, title text, detail text, source_reference text unique);
    create table race_categories(id uuid primary key, code text, is_active boolean, race_format_scope text);
    create table races(id uuid primary key, country_id uuid, name text, short_name text, race_format text, status text, slug text, competition_type text, is_monument boolean, is_grand_tour boolean);
    create table race_editions(id uuid primary key, race_id uuid, season_id uuid, race_category_id uuid, edition_number int, display_name text, status text, minimum_reputation int, registration_policy text, field_limit int, registration_closes_at timestamptz, withdrawal_closes_at timestamptz);
    create table development_race_editions(season_id uuid, start_day_number int, end_day_number int, status text, competition_type text);
    create table stages(id uuid primary key default gen_random_uuid(), race_edition_id uuid, season_day_id uuid, stage_number int, name text, stage_type text, distance_km numeric, status text, departure_at timestamptz, profile_type text, day_slot text);
    create table stage_segments(stage_id uuid, segment_number int, distance_km numeric, terrain_type text, surface_type text, average_gradient_pct numeric);
    create table cyclogazette_editions(season_id uuid, season_day_id uuid);
    create table test_hosting(country_id uuid, season_id uuid, amount numeric);
    create table test_messages(team_id uuid, subject text, source_reference text unique);
    create function private.create_team_operational_message(uuid,text,text,text,text,text,text,text,text,boolean,timestamptz)
      returns void language sql as $$insert into public.test_messages values ($1,$4,$9) on conflict do nothing$$;
    create function public.get_current_federation_identity(text) returns table(country_id uuid, sporting_director_id uuid, team_id uuid)
      language sql as $$select t.country_id, t.president_director_id, a.team_id from public.national_federation_terms t
        join public.team_manager_assignments a on a.sporting_director_id=t.president_director_id where t.president_director_id=auth.uid()$$;
    create function public.get_national_federation_race_creation_score(uuid,uuid) returns jsonb language sql as $$select '{"total":80,"threshold":60}'::jsonb$$;
    create function public.ensure_transfer_next_season(uuid) returns uuid language sql as $$select '${id(16)}'::uuid$$;
    create function public.initialize_due_national_federation_accounts() returns integer language sql as $$select 0$$;
    create function private.get_national_federation_reserved_hosting_amount(uuid,uuid) returns numeric
      language sql as $$select coalesce(sum(amount),0) from public.test_hosting where country_id=$1 and season_id=$2$$;
    insert into seasons values ('${id(15)}',5,'active',4,current_date+24), ('${id(16)}',6,'planned',1,current_date+52);
    insert into season_days(season_id,day_number,calendar_date)
      select '${id(16)}', day, current_date+24+day from generate_series(1,28) as day;
    insert into race_categories values ('${id(91)}','regional',true,'both'), ('${id(92)}','national',true,'both');
    ${projects.slice(projects.indexOf("create table public.national_federation_race_projects"), projects.indexOf("create or replace function"))}
    ${workflow.slice(workflow.indexOf("alter table public.national_federation_race_projects"), workflow.indexOf("create or replace function private.get_national_federation_race_costs"))}
  `);
  for (const name of [
    "private.get_national_federation_race_costs", "private.validate_national_federation_race_blueprint",
    "private.materialize_national_federation_race", "public.save_national_federation_race_draft",
    "public.submit_national_federation_race_vote", "public.vote_national_federation_race",
    "public.settle_due_national_federation_race_maintenance",
  ]) await db.exec(definition(name));

  for (const number of [1, 2, 3, 4]) {
    await db.exec(`
      insert into countries values ('${id(100 + number)}','A${number}');
      insert into sporting_directors values ('${id(number)}',${number >= 3 ? 180 : 250});
      insert into teams values ('${id(200 + number)}');
      insert into team_seasons values ('${id(300 + number)}','${id(15)}','${id(200 + number)}','${id(100 + number)}','active');
      insert into team_manager_assignments values ('${id(number)}','${id(200 + number)}','general_manager','active');
      insert into national_federation_terms values ('${id(100 + number)}',5,6,'elected','${id(number)}');
      insert into national_federation_infrastructures values ('${id(100 + number)}','race_organization_office',1);
      insert into national_federation_accounts values ('${id(400 + number)}','${id(100 + number)}','${id(15)}',${number >= 3 ? 300000 : 2000000},now());
    `);
  }

  const legacyId = await addDraft(3, 10, "regional", [stage("Classique")]);
  await db.query(`update national_federation_race_projects set status='voting', vote_round=1, resources_reserved=true,
    reservation_account_id=$2, vote_opened_at=now()-interval '2 days', vote_closes_at=now()-interval '1 day' where id=$1`, [legacyId, id(403)]);
  const lateLegacy = await addDraft(4, 14, "regional", [stage("Classique")]);
  await db.query(`update national_federation_race_projects set status='voting', vote_round=1, resources_reserved=true,
    reservation_account_id=$2, vote_opened_at=now()-interval '23 hours', vote_closes_at=now()+interval '1 hour' where id=$1`, [lateLegacy, id(404)]);
  await db.exec(settlement);
  assert.equal(Number((await project(legacyId)).reserved_reputation_cost), 20);
  assert.equal(await reputation(3), 180);

  await assert.rejects(addDraft(1, 1, "national", tour), /J1/);
  const valid = await addDraft(1, 12, "national", tour);
  const quote = await project(valid);
  assert.equal(Number(quote.creation_cost), 1_400_000);
  assert.equal(Number(quote.reputation_cost), 66);
  assert.equal(Number(quote.annual_maintenance_cost), 450_000);
  await db.query("insert into test_hosting values ($1,$2,700000)", [id(101), id(15)]);
  assert.equal(Number((await value("select * from get_national_federation_race_workshop_context($1,$2)", [id(101), id(15)])).available_balance), 1_300_000);
  await assert.rejects(submit(1, valid), /fonds.*insuffisants/);
  assert.equal(await balance(401), 2_000_000);
  await db.exec("update test_hosting set amount=500000");

  const currentEnd = (await value("select ends_on::text as date from seasons where status='active'")).date;
  await db.exec("update seasons set ends_on=current_date where status='active'");
  await assert.rejects(submit(1, valid), /J27/);
  assert.equal(await balance(401), 2_000_000);
  await db.query("update seasons set ends_on=$1 where status='active'", [currentEnd]);
  await submit(1, valid);
  assert.equal(await balance(401), 600_000);
  assert.equal(await reputation(1), 250);
  assert.equal((await value("select extract(epoch from vote_closes_at-vote_opened_at)::integer as seconds from national_federation_race_projects where id=$1", [valid])).seconds, 86_400);
  await assert.rejects(submit(1, valid), /brouillon/);

  const unavailable = await addDraft(2, 7, "regional", [stage("Classique")]);
  await submit(2, unavailable);
  await closeVote(unavailable, 90);
  await closeVote(valid, 30);
  await db.query("insert into development_race_editions values ($1,7,7,'planned','national_road')", [id(16)]);
  const slots = (await db.query("select * from get_national_federation_race_workshop_slots($1)", [id(16)])).rows;
  assert.equal(slots.length, 56);
  assert.ok(slots.filter(({ day_number }) => day_number === 1).every(({ unavailable }) => unavailable));
  assert.ok(slots.filter(({ day_number }) => day_number === 7).every(({ unavailable, protected_label }) => unavailable && protected_label === "CN"));
  assert.ok(slots.find(({ day_number, day_slot }) => day_number === 12 && day_slot === "early").labels.includes("Course fédérale 1"));

  const tally = await value("select public.settle_due_national_federation_race_votes() as result");
  assert.deepEqual(tally.result, { approved: 1, rejected: 1, failed: 1 });
  assert.equal((await project(valid)).status, "scheduled");
  assert.equal((await project(unavailable)).decision_error, "schedule_unavailable");
  assert.equal(await balance(402), 2_000_000);
  assert.equal(await reputation(2), 250);
  assert.equal(await balance(403), 600_000);
  assert.equal(await reputation(3), 200);
  assert.equal((await project(legacyId)).reserved_reputation_cost, "0");
  const created = await value(`select r.competition_type, e.status, count(*)::int as stages,
    count(segment.stage_id)::int as segments,
    extract(epoch from min(st.departure_at)-e.registration_closes_at)::int as notice
    from national_federation_race_projects p join races r on r.id=p.race_id
    join race_editions e on e.race_id=r.id join stages st on st.race_edition_id=e.id
    left join stage_segments segment on segment.stage_id=st.id where p.id=$1
    group by r.competition_type,e.status,e.registration_closes_at`, [valid]);
  assert.deepEqual(created, { competition_type: "standard", status: "registration_open", stages: 3, segments: 3, notice: 28_800 });
  assert.deepEqual((await value("select public.settle_due_national_federation_race_votes() as result")).result, { approved: 0, rejected: 0, failed: 0 });

  await db.exec(`
    update seasons set status='completed' where game_year=5;
    update seasons set status='active' where game_year=6;
    update national_federation_race_projects set status='active' where id='${valid}';
  `);
  assert.deepEqual((await value("select public.settle_due_national_federation_race_maintenance() as result")).result, { paid: 0, cancelled: 0 });
  await closeVote(lateLegacy, 15);
  assert.deepEqual((await value("select public.settle_due_national_federation_race_votes() as result")).result, { approved: 0, rejected: 0, failed: 0 });
  assert.equal((await project(lateLegacy)).status, "voting");
  assert.equal(await balance(404), 300_000);
  assert.equal(await reputation(4), 180);
  await db.query("insert into national_federation_accounts values ($1,$2,$3,2000000,now())", [id(604), id(104), id(16)]);
  assert.deepEqual((await value("select public.settle_due_national_federation_race_votes() as result")).result, { approved: 0, rejected: 1, failed: 0 });
  assert.equal(await balance(604), 2_300_000);
  assert.equal(await balance(404), 300_000);
  assert.equal(await reputation(4), 200);
  await db.exec(`
    update seasons set status='completed' where game_year=6;
    insert into seasons values ('${id(17)}',7,'active',1,current_date+80);
    insert into national_federation_accounts values ('${id(701)}','${id(101)}','${id(17)}',1000000,now());
  `);
  assert.deepEqual((await value("select public.settle_due_national_federation_race_maintenance() as result")).result, { paid: 1, cancelled: 0 });
  assert.equal(await balance(701), 550_000);
  assert.deepEqual((await value("select public.settle_due_national_federation_race_maintenance() as result")).result, { paid: 0, cancelled: 0 });
  console.log("Atelier fédéral isolé : devis, calendrier, votes, échecs, remboursement et maintenance vérifiés.");
} catch (error) {
  console.error(error instanceof Error ? error.stack?.split("\n").slice(0, 7).join("\n") : error);
  if (error?.where) console.error(error.where);
  process.exitCode = 1;
} finally {
  await db.close();
}
