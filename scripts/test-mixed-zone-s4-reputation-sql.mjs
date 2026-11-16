// Offline PostgreSQL-in-WASM regression. No Supabase client, credentials or network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : "@electric-sql/pglite");
const db = new PGlite();
const source = readFileSync("supabase/migrations/20260825130000_create_mixed_zone_events.sql", "utf8");
const fix = readFileSync("supabase/migrations/20261010190000_fix_mixed_zone_s4_reputation.sql", "utf8");
const personalityPatch = readFileSync("supabase/migrations/20261117104000_target_personality_interview_effects.sql", "utf8");
const moraleSource = readFileSync("supabase/migrations/20260927233500_reapply_persistent_rider_morale.sql", "utf8");
const start = source.indexOf("create or replace function public.submit_post_race_interview_with_event(");
const functionSource = source.slice(start, source.indexOf("$$;", start) + 3);
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const user = uid(1), director = uid(2), team = uid(3), season = uid(4), teamSeason = uid(5), day = uid(6), stage = uid(7), rider = uid(8);
const teammate = uid(9), nonStarterRider = uid(10), outsider = uid(14);
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const points = async () => Number((await one("select reputation_points from sporting_directors where id=$1", [director])).reputation_points);
const submit = (interviewId, choice = "react", owner = user) => db.query(
  "select submit_post_race_interview_with_event($1,$2,$3::jsonb,'Dernier mot',$4) result",
  [owner, interviewId, JSON.stringify(["Bonne course.", "Un collectif solide."]), choice],
);
let fixtureNumber = 100;
async function interview(pointsBefore, delta = 1, { cash = 0, event = true, eventRiderId, morale = 0 } = {}) {
  const interviewId = uid(fixtureNumber++);
  await db.query("update sporting_directors set reputation_points=$1 where id=$2", [pointsBefore, director]);
  const questions = [{ id: "result", text: "Résultat ?" }, { id: "tactics", text: "Tactique ?" }, { id: event ? "event" : "outlook", text: "Dernière question ?" }];
  const context = { riderId: rider, zoneMixteEvent: event ? { title: "Événement test", riderId: eventRiderId, choices: [{ id: "react", label: "Réagir", outcomes: [{ weight: 100, reputationDelta: delta, cashDelta: cash, riderPopularityDelta: 1, riderMoraleDelta: morale, summary: "Conséquence test." }] }] } : null };
  await db.query("insert into post_race_interviews(id,stage_id,team_id,season_id,sporting_director_id,question_set,context) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)",
    [interviewId, stage, team, season, director, JSON.stringify(questions), JSON.stringify(context)]);
  return interviewId;
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema private;
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text,reputation_points numeric(12,2) check(reputation_points>=0));
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,cash_balance numeric);
    create table season_days(id uuid primary key,day_number integer,calendar_date date);
    create table stages(id uuid primary key,season_day_id uuid);
    create table post_race_interviews(id uuid primary key,race_edition_id uuid,stage_id uuid,team_id uuid,season_id uuid,sporting_director_id uuid,
      question_set jsonb,context jsonb,status text default 'pending',answers jsonb default '[]',closing_note text,
      event_choice_id text,event_outcome jsonb,event_resolved_at timestamptz,submitted_at timestamptz,updated_at timestamptz,created_at timestamptz);
    create table race_registrations(id uuid primary key,team_season_id uuid);
    create table race_rosters(id uuid primary key,rider_id uuid,race_registration_id uuid);
    create table stage_results(stage_id uuid,race_roster_id uuid,status text);
    create table test_morale_events(rider_id uuid, adjustment numeric, source_reference text unique);
    create function public.apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb)
    returns jsonb language sql as $$
      insert into public.test_morale_events values ($1,$5,$4) returning jsonb_build_object('delta', $5);
    $$;
    create table reward_events(id uuid primary key default gen_random_uuid(),source_reference text unique,source_type text,
      sporting_director_id uuid,team_season_id uuid,rider_id uuid,reputation_points numeric(12,2),experience_points integer,
      cash_prize numeric,uci_points integer,description text,
      constraint reward_events_values_valid check(reputation_points between -50 and 1000 and experience_points>=0 and cash_prize>=0 and uci_points>=0));
    create table team_finance_transactions(team_season_id uuid,season_day_id uuid,day_number integer,amount numeric,
      category text,status text,description text,source_reference text,posted_at timestamptz);
    create table rider_popularity_profiles(rider_id uuid primary key,popularity_points integer,updated_at timestamptz);
    create table inventory_catalog_items(id uuid primary key,item_key text,rarity text,status text);
    create table team_item_inventory(team_season_id uuid,inventory_item_id uuid,quantity integer,acquisition_source text,
      acquired_at timestamptz,updated_at timestamptz,unique(team_season_id,inventory_item_id));
    insert into sporting_directors values('${director}','${user}','active',1151.12);
    insert into team_seasons values('${teamSeason}','${team}','${season}',10000);
    -- Tomorrow keeps this unrelated time-window check open, whatever the test clock.
    insert into season_days values('${day}',2,(now() at time zone 'Europe/Paris')::date+1);
    insert into stages values('${stage}','${day}');
    insert into race_registrations values ('${uid(11)}','${teamSeason}');
    insert into race_rosters values ('${uid(12)}','${teammate}','${uid(11)}'), ('${uid(13)}','${nonStarterRider}','${uid(11)}');
    insert into team_seasons values('${uid(15)}','${uid(16)}','${season}',0);
    insert into race_registrations values ('${uid(17)}','${uid(15)}');
    insert into race_rosters values ('${uid(18)}','${outsider}','${uid(17)}');
    insert into stage_results values ('${stage}','${uid(12)}','finished'), ('${stage}','${uid(13)}','did_not_start'), ('${stage}','${uid(18)}','finished');
  `);
  await db.exec(functionSource);
  await db.exec("revoke all on function submit_post_race_interview_with_event(uuid,uuid,jsonb,text,text) from public,anon,authenticated; grant execute on function submit_post_race_interview_with_event(uuid,uuid,jsonb,text,text) to service_role;");
  const failed = await interview(1151.12, 1, { cash: 100 });
  await assert.rejects(submit(failed), /reward_events_values_valid/);
  assert.equal(await points(), 1151.12, "Old failure rolls back reputation");
  assert.equal((await one("select status from post_race_interviews where id=$1", [failed])).status, "pending");
  assert.equal(Number((await one("select cash_balance from team_seasons where id=$1", [teamSeason])).cash_balance), 10000, "Old failure rolls back earlier cash update");
  assert.equal((await one("select count(*)::int n from team_finance_transactions")).n, 0);

  await db.exec(fix);
  await db.exec(fix); // Guarded patch is idempotent, and preserves function grants.
  const moraleStart = moraleSource.indexOf("create or replace function public.apply_interview_morale()");
  assert.ok(moraleStart >= 0);
  await db.exec(moraleSource.slice(moraleStart, moraleSource.indexOf("$$;", moraleStart) + 3));
  await db.exec("create trigger test_interview_morale after update on post_race_interviews for each row execute function public.apply_interview_morale();");
  await db.exec("grant select on post_race_interviews to authenticated; grant select on post_race_interviews to service_role;");
  await db.exec(personalityPatch);
  await db.exec(personalityPatch);
  assert.equal((await one("select has_column_privilege('authenticated','post_race_interviews','context','SELECT') allowed")).allowed, false);
  assert.equal((await one("select has_column_privilege('service_role','post_race_interviews','context','SELECT') allowed")).allowed, true);
  assert.equal((await one("select has_column_privilege('authenticated','post_race_interviews','event_outcome','SELECT') allowed")).allowed, true);
  assert.equal((await one("select has_function_privilege('authenticated','submit_post_race_interview_with_event(uuid,uuid,jsonb,text,text)','execute') allowed")).allowed, false);
  assert.equal((await one("select has_function_privilege('service_role','submit_post_race_interview_with_event(uuid,uuid,jsonb,text,text)','execute') allowed")).allowed, true);
  await submit(failed);
  assert.equal(await points(), 1152.12);
  assert.equal(Number((await one("select reputation_points from reward_events where source_reference=$1", [`mixed-zone:${failed}`])).reputation_points), 1);
  assert.equal(Number((await one("select cash_balance from team_seasons where id=$1", [teamSeason])).cash_balance), 10100);
  assert.equal((await one("select popularity_points from rider_popularity_profiles")).popularity_points, 1);
  const retry = await submit(failed);
  assert.equal(retry.rows[0].result.alreadySubmitted, true);
  assert.equal(await points(), 1152.12);
  assert.equal(Number((await one("select cash_balance from team_seasons where id=$1", [teamSeason])).cash_balance), 10100);
  assert.equal((await one("select popularity_points from rider_popularity_profiles")).popularity_points, 1);

  for (const [before, delta, after, applied] of [[999.88,1,1000.88,1],[130.62,1,131.62,1],[1151.12,-4,1147.12,-4],[1151.12,4,1155.12,4],[0.35,-4,0,-0.35]]) {
    const interviewId = await interview(before, delta);
    await submit(interviewId);
    assert.equal(await points(), after, `Exact total for ${before} + ${delta}`);
    assert.equal(Number((await one("select reputation_points from reward_events where source_reference=$1", [`mixed-zone:${interviewId}`])).reputation_points), applied);
  }
  const skipped = await interview(1151.12);
  await submit(skipped, "skip");
  assert.equal(await points(), 1151.12);
  assert.equal((await one("select count(*)::int n from reward_events where source_reference=$1", [`mixed-zone:${skipped}`])).n, 0);
  const ordinary = await interview(130.62, 0, { event: false });
  await db.query("select submit_post_race_interview_with_event($1,$2,$3::jsonb,'',null)", [user,ordinary,JSON.stringify(["Réponse un.","Réponse deux.","Réponse trois."])]);
  assert.equal(await points(), 130.62);
  const invalid = await interview(1151.12);
  await assert.rejects(submit(invalid, "react", uid(999)), /ne vous appartient pas/);
  await assert.rejects(submit(invalid, "injected"), /n’est pas proposée/);
  assert.equal(await points(), 1151.12);
  await assert.rejects(submit(await interview(1151.12, 5)), /dépassent le barème/);
  await assert.rejects(submit(await interview(1151.12, 1, { cash: -20000 })), /dépassent le barème/);

  const targeted = await interview(1151.12, 3, { eventRiderId: teammate, morale: 2 });
  await submit(targeted);
  await submit(targeted);
  assert.equal((await one("select rider_id from reward_events where source_reference=$1", [`mixed-zone:${targeted}`])).rider_id, teammate);
  assert.deepEqual(await one("select rider_id,adjustment from test_morale_events where source_reference=$1", [targeted]), { rider_id: teammate, adjustment: "2" });
  assert.equal((await one("select popularity_points from rider_popularity_profiles where rider_id=$1", [teammate])).popularity_points, 1);
  for (const invalidRider of [nonStarterRider, outsider]) {
    const wrongRider = await interview(1151.12, 3, { eventRiderId: invalidRider, morale: 2 });
    await assert.rejects(submit(wrongRider), /ne figure pas dans les résultats de votre équipe/);
    assert.equal(await points(), 1151.12);
    assert.equal((await one("select status from post_race_interviews where id=$1", [wrongRider])).status, "pending");
  }
  await db.exec("update team_seasons set cash_balance=0");
  const unfunded = await interview(1151.12, 1, { cash: -100 });
  await assert.rejects(submit(unfunded), /trésorerie/);
  assert.equal(await points(), 1151.12);
  assert.equal((await one("select status from post_race_interviews where id=$1", [unfunded])).status, "pending");
  await db.exec("update season_days set calendar_date=(now() at time zone 'Europe/Paris')::date-1");
  await assert.rejects(submit(invalid), /zone mixte est fermée/);
  console.log("Mixed-zone SQL passed offline: reputation, atomic effects, designated teammate, invalid riders, retries, timing and hidden outcomes.");
} finally {
  await db.close();
}
