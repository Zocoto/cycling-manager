// In-memory PostgreSQL only. Uses the canonical departure-ownership helper
// and compares every SQL placement to the real TypeScript economy functions.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { tsImport } from "tsx/esm/api";

const modulePath = process.argv[2] ?? "";
if (!isAbsolute(modulePath) || !modulePath.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js")) {
  throw new Error("Pass the absolute path to a local PGlite installation.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const { calculateInternationalChampionshipReward, calculateNationalChampionshipReward } = await tsImport("../lib/game/economy.ts", import.meta.url);
const db = new PGlite();
const read = async (name) => (await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8")).replaceAll("\r", "");
const extract = (sql, name) => {
  const match = new RegExp(`create (?:or replace )?function ${name.replaceAll(".", "\\.")}\\(`, "i").exec(sql);
  assert.ok(match, `Function ${name} exists`);
  return sql.slice(match.index, sql.indexOf("$$;", match.index) + 3);
};
const ownership = extract(await read("20261103103000_fix_quadrennial_club_prize_ownership"), "private.get_quadrennial_games_club_beneficiaries");
const migration = await read("20261121110000_settle_federation_race_club_rewards");
let sequence = 0, checks = 0;
const id = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const scalar = async (sql, args = []) => Object.values((await query(sql, args))[0])[0];
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const audit = (event) => scalar("select public.get_federation_race_club_reward_audit($1)", [event.id]);
const settle = (event) => scalar("select public.settle_federation_race_club_rewards($1)", [event.id]);
const balance = (account) => scalar("select cash_balance::integer from team_seasons where id=$1", [account]);
const deny = async (event, reason) => {
  const preview = await audit(event);
  eq(preview.ready, false, `Audit refuses ${reason}`);
  assert.ok(preview.blockingReasons.includes(reason), JSON.stringify(preview)); checks++;
  await assert.rejects(settle(event), /not ready/); checks++;
};
const seasons = new Map();
const clubA = id(), clubB = id(), directorA = id(), directorB = id(), country = id();
async function createEvent({ year = 5, type = "continental_championship", status = "in_progress", stages = 1 } = {}) {
  let season = seasons.get(year);
  if (!season) {
    season = { id: id(), firstDay: id(), finalDay: id(), accountA: id(), accountB: id() };
    seasons.set(year, season);
    await db.query("insert into seasons values($1,$2,'active')", [season.id, year]);
    await db.query("insert into season_days values($1,$2,14),($3,$2,15)", [season.firstDay, season.id, season.finalDay]);
    await db.query("insert into team_seasons values($1,$2,$3,1000000,17),($4,$5,$3,1000000,17)", [season.accountA, clubA, season.id, season.accountB, clubB]);
  }
  const event = { id: id(), race: id(), season, year, firstStage: id(), finalStage: id(), registration: id(), selection: id() };
  await db.query("insert into races values($1,$2)", [event.race, type]);
  await db.query("insert into race_editions values($1,$2,$3,'Test championship',$4)", [event.id, event.race, season.id, status]);
  await db.query("insert into stages values($1,$2,$3,1,'completed','2026-11-20 13:00:00+00')", [event.firstStage, event.id, stages === 1 ? season.finalDay : season.firstDay]);
  if (stages > 1) await db.query("insert into stages values($1,$2,$3,2,'completed','2026-11-20 17:00:00+00')", [event.finalStage, event.id, season.finalDay]);
  else event.finalStage = event.firstStage;
  await db.query("insert into race_registrations values($1,$2,null)", [event.registration, event.id]);
  await db.query("insert into national_federation_selection_lists values($1,$2,$3)", [event.selection, country, season.id]);
  await db.query("insert into national_federation_selection_race_links values($1,$2,$3)", [event.selection, event.id, event.registration]);
  return event;
}
async function addResult(event, rank, { club = clubA, frozenClub = club, frozenDirector = directorA, status = "classified", signedAt = "2026-11-01 00:00:00+00" } = {}) {
  const rider = { id: id(), roster: id(), member: id(), contract: id() };
  await db.query("insert into riders values($1,$2)", [rider.id, country]);
  await db.query("insert into race_rosters values($1,$2,$3)", [rider.roster, event.registration, rider.id]);
  await db.query("insert into race_results values($1,$2,$3,$4)", [event.id, rider.roster, status, rank]);
  await db.query("insert into stage_results select id,$2 from stages where race_edition_id=$1", [event.id, rider.roster]);
  await db.query("insert into national_federation_selection_members values($1,$2,$3,$4,$5,'confirmed')", [rider.member, event.selection, rider.id, frozenClub, frozenDirector]);
  if (club) await db.query(`insert into rider_contracts values($1,$2,$3,$4,$4,null,1,null,'active',$5,$5)`, [rider.contract, rider.id, club, event.season.id, signedAt]);
  return rider;
}
const reference = (event, rider) => `official-race:${event.id}:rider:${rider.id}:v1`;
try {
  await db.exec(`
    create schema private; create role anon; create role authenticated; create role service_role;
    create table seasons(id uuid primary key,game_year integer,status text);
    create table season_days(id uuid primary key,season_id uuid,day_number smallint);
    create table races(id uuid primary key,competition_type text);
    create table race_editions(id uuid primary key,race_id uuid,season_id uuid,display_name text,status text);
    create table stages(id uuid primary key,race_edition_id uuid,season_day_id uuid,stage_number smallint,status text,departure_at timestamptz);
    create table riders(id uuid primary key,country_id uuid);
    create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid);
    create table race_rosters(id uuid primary key,race_registration_id uuid,rider_id uuid);
    create table race_results(race_edition_id uuid,race_roster_id uuid,status text,final_rank integer,primary key(race_edition_id,race_roster_id));
    create table stage_results(stage_id uuid,race_roster_id uuid);
    create table national_federation_selection_lists(id uuid primary key,country_id uuid,season_id uuid);
    create table national_federation_selection_race_links(selection_list_id uuid primary key,race_edition_id uuid,race_registration_id uuid unique);
    create table national_federation_selection_members(id uuid primary key,selection_list_id uuid,professional_rider_id uuid,owner_team_id uuid,owner_director_id uuid,response_status text,unique(selection_list_id,professional_rider_id));
    create table national_federation_olympic_events(season_id uuid,race_edition_id uuid,time_trial_race_edition_id uuid);
    create table rider_contracts(id uuid primary key,rider_id uuid,team_id uuid,start_season_id uuid,end_season_id uuid,left_season_id uuid,
      joined_day_number integer,left_day_number integer,status text,signed_at timestamptz,created_at timestamptz);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,cash_balance numeric(14,2),points integer,unique(team_id,season_id));
    create table sporting_directors(id uuid primary key,reputation_points numeric(12,2),experience_points integer);
    create table team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text);
    create table reward_events(id uuid primary key default gen_random_uuid(),source_reference text not null unique,source_type text,sporting_director_id uuid,
      team_season_id uuid,rider_id uuid,country_id uuid,reputation_points numeric(12,2),experience_points integer,cash_prize numeric(14,2),uci_points integer,description text);
    create table team_finance_transactions(id uuid primary key default gen_random_uuid(),team_season_id uuid,season_day_id uuid,day_number smallint,
      amount numeric(14,2),category text,status text,description text,source_reference text,posted_at timestamptz,unique(team_season_id,source_reference));
    create table rider_season_summaries(rider_id uuid,season_id uuid,victories integer,points integer,updated_at timestamptz,primary key(rider_id,season_id));
    insert into sporting_directors values('${directorA}',10,20),('${directorB}',10,20);
    insert into team_manager_assignments values('${clubA}','${directorA}','general_manager','active'),('${clubB}','${directorB}','general_manager','active');
    ${ownership}
  `);
  const helperBefore = await query("select oid,prosrc,proacl::text,proconfig from pg_proc where oid='private.get_quadrennial_games_club_beneficiaries(uuid)'::regprocedure");
  await db.exec(migration);
  eq(await query("select oid,prosrc,proacl::text,proconfig from pg_proc where oid='private.get_quadrennial_games_club_beneficiaries(uuid)'::regprocedure"), helperBefore, "Canonical Games ownership helper remains completely unchanged");
  eq(await scalar("select count(*)::integer from reward_events"), 0, "Installation never grants or backfills anything");
  for (const year of [null, 1, 2, 3, 4, 5, 8]) for (const type of ["continental_championship", "world_championship", "nations_cup"]) {
    for (const rank of [null, -1, 0, ...Array.from({ length: 26 }, (_, i) => i + 1)]) {
      const expected = type === "nations_cup" ? calculateNationalChampionshipReward({ gameYear: year ?? undefined, finalRank: rank })
        : calculateInternationalChampionshipReward({ gameYear: year ?? undefined, competitionType: type, finalRank: rank });
      const actual = (await query("select reputation_points,experience_points,cash_prize::integer,uci_points from private.calculate_federation_race_club_reward($1,$2,$3)", [type, year, rank]))[0];
      eq(actual, { reputation_points: expected.reputation, experience_points: expected.experience, cash_prize: expected.cashPrize, uci_points: expected.uciPoints }, `Real TS/SQL economy parity ${type}/S${year}/rank${rank}`);
    }
  }

  const event = await createEvent({ stages: 2 });
  const winner = await addResult(event, 1);
  await addResult(event, 2);
  await addResult(event, 3, { club: clubB, frozenDirector: directorB });
  await addResult(event, 20);
  await addResult(event, 21);
  await addResult(event, 4, { club: null, frozenDirector: null });
  await addResult(event, null, { status: "did_not_finish" });
  const beforeA = await balance(event.season.accountA), beforeB = await balance(event.season.accountB);
  const preview = await audit(event);
  eq(preview.ready, true, "Homologated classification can settle before edition completed");
  eq([preview.classifiedCount, preview.eligibleClubCount, preview.freeAgentCount, preview.missingRewardCount], [6, 4, 1, 4], "Preview distinguishes paid positions, free agent and rank21");
  eq(preview.expectedCash, 44150, "Preview cash is the exact payable club sum");
  eq(await scalar("select count(*)::integer from reward_events"), 0, "Preview is read-only");
  const result = await settle(event);
  eq([result.paidCount, result.cashAwarded, result.experienceAwarded, result.reputationAwarded, result.victoriesAwarded], [4, 44150, 620, 3, 1], "One transaction grants exact final prizes");
  eq(await balance(event.season.accountA), beforeA + 37150, "Same club receives both its riders and rank20 cash");
  eq(await balance(event.season.accountB), beforeB + 7000, "Other club receives its own podium prize");
  eq(await scalar("select count(*)::integer from team_finance_transactions where day_number=15 and season_day_id=$1 and category='race_prize' and status='posted'", [event.season.finalDay]), 4, "Finance dates use the last stage rather than first departure or current day");
  eq(await scalar("select victories from rider_season_summaries where rider_id=$1 and season_id=$2", [winner.id,event.season.id]), 1, "Winner gains one sporting victory");
  eq(await scalar("select sum(uci_points)::integer from reward_events"), 0, "S5 championship awards no UCI points");
  eq(await scalar("select source_reference from reward_events where rider_id=$1", [winner.id]), reference(event, winner), "Existing official-race canonical namespace is used");
  const retry = await settle(event);
  eq([retry.paidCount, retry.alreadyPaidCount, retry.cashAwarded], [0, 4, 0], "Retry never repays existing canonical receipts");
  eq(await scalar("select victories from rider_season_summaries where rider_id=$1", [winner.id]), 1, "Retry never doubles victories");
  eq((await audit(event)).missingRewardCount, 0, "Audit sees no missing payable receipt after settlement");

  const transfer = await createEvent({ type: "world_championship" });
  const transferred = await addResult(transfer, 1);
  await db.query("update rider_contracts set status='completed',left_day_number=13 where id=$1", [transferred.contract]);
  await db.query("insert into rider_contracts values($1,$2,$3,$4,$4,null,14,null,'active','2026-11-19 00:00:00+00','2026-11-19 00:00:00+00')", [id(),transferred.id,clubB,transfer.season.id]);
  const transferBefore = await balance(transfer.season.accountB);
  await settle(transfer);
  eq(await balance(transfer.season.accountB), transferBefore + 60000, "Transfer BEFORE departure pays the actual departure club");
  eq(await scalar("select sporting_director_id from reward_events where source_reference=$1", [reference(transfer,transferred)]), directorB, "Obsolete callup owner is replaced by the departure club's GM");

  const after = await createEvent();
  const movedAfter = await addResult(after, 1);
  await db.query("update rider_contracts set status='completed',left_day_number=15 where id=$1", [movedAfter.contract]);
  await db.query("insert into rider_contracts values($1,$2,$3,$4,$4,null,16,null,'active','2026-11-21 00:00:00+00','2026-11-21 00:00:00+00')", [id(),movedAfter.id,clubB,after.season.id]);
  await settle(after);
  eq(await scalar("select team_season_id from reward_events where source_reference=$1", [reference(after,movedAfter)]), after.season.accountA, "Transfer AFTER departure cannot redirect delayed prize");

  const recruited = await createEvent();
  const signed = await addResult(recruited, 1, { frozenClub: null, frozenDirector: null });
  await settle(recruited);
  eq(await scalar("select team_season_id from reward_events where source_reference=$1", [reference(recruited,signed)]), recruited.season.accountA, "Free agent at callup, signed before departure, receives the actual club prize");
  const freeEvent = await createEvent();
  const freeWinner = await addResult(freeEvent, 1, { club: null, frozenDirector: null });
  const freeResult = await settle(freeEvent);
  eq([freeResult.freeAgentCount,freeResult.cashAwarded,freeResult.experienceAwarded,freeResult.reputationAwarded,freeResult.victoriesAwarded], [1,0,0,0,1], "Free winner gains sporting victory without fictional club or director gains");
  eq((await query("select team_season_id,sporting_director_id from reward_events where source_reference=$1", [reference(freeEvent,freeWinner)]))[0], { team_season_id:null,sporting_director_id:null }, "Free victory receipt has no invented owner");
  const signedLate = await createEvent();
  const late = await addResult(signedLate, 1, { frozenClub:null,frozenDirector:null,signedAt:"2026-11-21 00:00:00+00" });
  await settle(signedLate);
  eq(await scalar("select cash_prize::integer from reward_events where source_reference=$1", [reference(signedLate,late)]), 0, "Signing AFTER departure does not create a retroactive cash prize");

  const historical = await createEvent({ year:4 });
  const past = await addResult(historical, 1);
  await db.query("update seasons set status='completed' where id=$1", [historical.season.id]);
  await settle(historical);
  eq(await scalar("select team_season_id from reward_events where source_reference=$1", [reference(historical,past)]), historical.season.accountA, "A delayed settlement credits the race's closed season, never today's season");
  const zeroExisting = await createEvent({ year:2,type:"world_championship" });
  const existing = await addResult(zeroExisting, 1);
  await db.query(`insert into reward_events(source_reference,source_type,rider_id,team_season_id,sporting_director_id,reputation_points,experience_points,cash_prize,uci_points,description)
    values($1,'race_result',$2,$3,$4,0,0,0,0,'historical existing receipt')`, [reference(zeroExisting,existing),existing.id,zeroExisting.season.accountA,directorA]);
  eq((await settle(zeroExisting)).paidCount, 0, "Existing zero-value historical receipt is never rewritten or paid again");
  eq(await scalar("select uci_points from reward_events where source_reference=$1", [reference(zeroExisting,existing)]), 0, "Historical UCI zero remains untouched");

  const noSelection = await createEvent();
  const orphan = await addResult(noSelection, 1);
  await db.query("delete from national_federation_selection_members where id=$1", [orphan.member]);
  await deny(noSelection, "missing_official_selection");
  const noAccount = await createEvent({ year:6 });
  await addResult(noAccount, 1, { club:clubB,frozenDirector:directorB });
  await db.query("delete from team_seasons where id=$1", [noAccount.season.accountB]);
  await deny(noAccount, "missing_club_account");
  eq(await scalar("select count(*)::integer from reward_events where source_reference like $1", [`official-race:${noAccount.id}:%`]), 0, "Failed validation leaves no partial rewards");
  const collision = await createEvent();
  const wrong = await addResult(collision, 1);
  await db.query("insert into reward_events(source_reference,source_type,rider_id,team_season_id) values($1,'race_result',$2,$3)", [reference(collision,wrong),wrong.id,collision.season.accountB]);
  await deny(collision, "existing_reward_beneficiary_mismatch");
  const games = await createEvent({ year:8,type:"nations_cup" });
  await db.query("insert into national_federation_olympic_events values($1,$2,null)", [games.season.id,games.id]);
  await deny(games, "official_quadrennial_games");
  const gamesTt = await createEvent({ year:8,type:"nations_cup" });
  await db.query("update national_federation_olympic_events set time_trial_race_edition_id=$1 where season_id=$2", [gamesTt.id,gamesTt.season.id]);
  await deny(gamesTt, "official_quadrennial_games");
  const nc = await createEvent({ year:8,type:"nations_cup" });
  await addResult(nc, 1);
  eq((await settle(nc)).cashAwarded, 12000, "An ordinary NC is not mistaken for Games by year or competition label");
  await deny(await createEvent({ year:3 }), "s3_continental_void");
  await deny(await createEvent({ type:"standard" }), "unsupported_competition");
  await deny(await createEvent({ status:"cancelled" }), "cancelled_edition");
  const pending = await createEvent();
  await db.query("update stages set status='in_progress' where id=$1", [pending.firstStage]);
  await deny(pending, "stages_not_homologated");
  const missingFinal = await createEvent();
  const missing = await addResult(missingFinal, 1);
  await db.query("delete from race_results where race_roster_id=$1", [missing.roster]);
  await deny(missingFinal, "incomplete_final_classification");
  const allDnf = await createEvent();
  for (const status of ["did_not_start","did_not_finish","outside_time_limit","disqualified"]) await addResult(allDnf,null,{status});
  eq((await audit(allDnf)).ready, true, "All DNS/DNF homologated field can close");
  eq((await settle(allDnf)).paidCount, 0, "All DNS/DNF field receives no reward");

  const missingDs = await createEvent();
  await addResult(missingDs, 1, { frozenDirector:null });
  await db.query("update team_manager_assignments set status='completed' where team_id=$1", [clubA]);
  await deny(missingDs, "missing_director");
  await db.query("update team_manager_assignments set status='active' where team_id=$1", [clubA]);
  const orphanFinance = await createEvent();
  const financed = await addResult(orphanFinance, 1);
  await db.query("insert into team_finance_transactions(team_season_id,source_reference,amount) values($1,$2,24000)", [orphanFinance.season.accountA,`reward:${reference(orphanFinance,financed)}`]);
  await deny(orphanFinance, "orphan_finance_receipt");

  const atomic = await createEvent();
  await addResult(atomic, 1);
  const second = await addResult(atomic, 2, { club:clubB,frozenDirector:directorB });
  const atomicBeforeA = await balance(atomic.season.accountA), atomicBeforeB = await balance(atomic.season.accountB);
  await db.exec(`create function public.fixture_finance_failure() returns trigger language plpgsql as $$
    begin if new.source_reference='reward:${reference(atomic,second)}' then raise exception 'isolated finance failure'; end if; return new; end $$;
    create trigger fixture_finance_failure before insert on team_finance_transactions for each row execute function fixture_finance_failure();`);
  await assert.rejects(settle(atomic), /isolated finance failure/); checks++;
  eq(await balance(atomic.season.accountA), atomicBeforeA, "A late finance failure rolls back earlier winner's cash");
  eq(await balance(atomic.season.accountB), atomicBeforeB, "A late finance failure rolls back the current runner-up's cash");
  eq(await scalar("select count(*)::integer from reward_events where source_reference like $1", [`official-race:${atomic.id}:%`]), 0, "Atomic rollback leaves no partial reward receipt");
  await db.exec("drop trigger fixture_finance_failure on team_finance_transactions");
  eq((await settle(atomic)).paidCount, 2, "Failed edition remains safely retryable");

  const fullField = await createEvent({ year:9 });
  for (let rank=1;rank<=220;rank++) await addResult(fullField,rank);
  const fullBefore = await balance(fullField.season.accountA);
  const expectedFull = Array.from({length:220},(_,i)=>calculateInternationalChampionshipReward({gameYear:9,competitionType:"continental_championship",finalRank:i+1}).cashPrize).reduce((sum,cash)=>sum+cash,0);
  const started = performance.now();
  const fullResult = await settle(fullField);
  const elapsed = performance.now()-started;
  eq([fullResult.classifiedCount,fullResult.eligibleClubCount,fullResult.paidCount,fullResult.cashAwarded], [220,20,20,expectedFull], "Full 220-rider field only pays the canonical top20");
  eq(await balance(fullField.season.accountA), fullBefore+expectedFull, "Full-field cash exactly matches TS sum");
  console.log(`Full 220-rider edition: ${elapsed.toFixed(0)} ms in isolated PGlite; not a production benchmark.`);

  // Real existing community-manager trigger remains active on these inserts.
  const staffSource = await read("20260727160000_create_unique_staff_talents");
  await db.exec(`
    create function get_active_team_staff_base_strength(uuid,text,integer) returns numeric language sql as $$ select 10::numeric $$;
    create function get_active_team_staff_talent_strength(uuid,text,integer) returns numeric language sql as $$ select 0::numeric $$;
    ${extract(staffSource,"public.apply_community_manager_reputation_bonus")}
    create trigger apply_community_manager_reputation_bonus after insert on reward_events
      for each row execute function apply_community_manager_reputation_bonus();
  `);
  const bonus = await createEvent();
  const bonusWinner = await addResult(bonus, 1);
  const repBefore = Number(await scalar("select reputation_points from sporting_directors where id=$1", [directorA]));
  await settle(bonus);
  eq(Number(await scalar("select reputation_points from sporting_directors where id=$1", [directorA])), repBefore+2.2, "Real reward insert trigger adds its staff reputation bonus");
  eq(Number(await scalar("select reputation_points from reward_events where source_reference=$1", [reference(bonus,bonusWinner)])), 2.2, "Ledger retains trigger-enriched reputation");
  await settle(bonus);
  eq(Number(await scalar("select reputation_points from sporting_directors where id=$1", [directorA])), repBefore+2.2, "Retry never re-runs the staff bonus");
  for (const signature of ["public.settle_federation_race_club_rewards(uuid)","public.get_federation_race_club_reward_audit(uuid)"]) {
    for (const role of ["anon","authenticated"]) eq(await scalar("select has_function_privilege($1,$2,'execute')", [role,signature]), false, `${role} cannot execute ${signature}`);
    eq(await scalar("select has_function_privilege('service_role',$1,'execute')", [signature]), true, "Service role can execute bounded RPC");
    eq(await scalar("select proconfig @> array['search_path=\"\"','statement_timeout=5s','lock_timeout=500ms'] from pg_proc where oid=$1::regprocedure", [signature]), true, "RPC retains empty search path and strict timeout bounds");
  }
  eq(await scalar("select has_function_privilege('service_role','private.get_federation_race_club_reward_rows(uuid)','execute')"), false, "Private row listing is not a directly callable service RPC");
  console.log(`Passed ${checks} isolated PostgreSQL federation reward checks (including TS scale parity).`);
} finally {
  await db.close();
}
