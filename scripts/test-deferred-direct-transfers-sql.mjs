// Isolated PostgreSQL/WASM integration; no credentials, production URL or network.
// Reuse the versioned cash/trade fixture bootstrap and real contract hooks.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const baseline = readFileSync("scripts/test-direct-transfer-trades-sql.mjs", "utf8");
const marker = "  await scenario('future entries are withdrawn at submission only for the proposing manager'";
const split = baseline.indexOf(marker);
assert(split > 0, "The existing trade fixture bootstrap boundary must be present");
// Reviewed delivery normalizes Windows checkouts before executing guarded SQL.
// The historical bootstrap predates that normalization for its follow-up file.
const prefix = baseline.slice(0, split).replace(
  "await db.exec(readFileSync(futureRaceMigration,'utf8'));",
  "await db.exec(readFileSync(futureRaceMigration,'utf8').replaceAll('\\r\\n','\\n'));",
);

async function regressions({
  db, id, check, rows, scalar, root, auth, reject, scenario, addRider, owner,
  bookRace, snapshot, historicalFunction,
}) {
  const migration = "supabase/migrations/20261102090000_add_deferred_direct_transfers.sql";
  const submit = (rider = 202, amount = 1000, counterpart = null, message = null) =>
    scalar("select public.submit_deferred_direct_transfer_offer($1,$2,$3,$4)",
      [id(rider), amount, counterpart === null ? null : id(counterpart), message]);
  const offerId = result => typeof result === "string" ? result : result.offerId;
  const respond = (offer, accept = true) =>
    scalar("select public.respond_to_direct_transfer_offer($1,$2)", [offer, accept]);
  const contract = async (rider, status) => (await rows(
    "select * from public.rider_contracts where rider_id=$1 and status=$2 order by created_at,id",
    [id(rider), status]))[0];
  const cash = async teamSeason => Number(await scalar(
    "select cash_balance from public.team_seasons where id=$1", [id(teamSeason)]));
  const reservation = async (team = 10) => Number(await scalar(
    "select public.get_team_transfer_reserved_budget($1,null,null)", [id(team)]));
  const fieldSnapshot = () => rows(
    "select rider_id,team_id,status,start_season_id,end_season_id,salary_per_season,transfer_locked_season_id from public.rider_contracts order by rider_id,id");
  await root();
  // These are schema/calendar fixtures, never replacement business functions.
  await db.exec("alter table public.seasons add column name text,add column starts_on date,add column ends_on date; update public.seasons set name='Saison '||game_year,starts_on=date '2026-10-09'+(game_year-4)*28,ends_on=date '2026-11-05'+(game_year-4)*28; alter table public.season_days add column calendar_date date; update public.season_days set calendar_date=date '2026-10-09'+((select (game_year-4)*28 from public.seasons where id=season_id)+day_number-1); alter table public.rider_training_plan_versions add column team_id uuid;");
  await db.query("insert into public.seasons(id,game_year,status,current_day_number,name,starts_on,ends_on) values($1,6,'planned',1,'Saison 6',date '2026-12-04',date '2026-12-31')", [id(6)]);
  await db.query("insert into public.season_days(season_id,day_number,calendar_date) select $1,n,date '2026-12-04'+n-1 from generate_series(1,28)n", [id(6)]);
  await db.query("insert into public.team_seasons(id,team_id,season_id,display_name,status) values($1,$2,$3,'Acheteur S5','planned'),($4,$5,$3,'Vendeur S5','planned'),($6,$7,$3,'Tiers S5','planned')",
    [id(105),id(10),id(5),id(115),id(11),id(125),id(12)]);
  await db.exec("alter table public.season_days add column label text; alter table public.race_editions add column season_id uuid; alter table public.race_stage_equipment_assignments add column team_season_id uuid;");
  await db.query("insert into public.race_editions(id,status,season_id) values($1,'planned',$2)",[id(999),id(5)]);
  await db.exec(historicalFunction("supabase/migrations/20260827153000_speed_up_auction_settlement.sql","ensure_transfer_next_season"));
  await db.exec("alter table public.transfer_market_listings add column minimum_bid numeric,add column opens_at timestamptz,add column closes_at timestamptz;");
  await db.exec(historicalFunction("supabase/migrations/20260720233000_create_transfer_market.sql","create_director_transfer_listing"));
  // Load the real current versioned season lifecycle, including naturalization.
  const rollover = "supabase/migrations/20260827062000_sync_professional_naturalization_on_rollover.sql";
  for (const name of ["sync_active_professional_naturalization_progress", "settle_expiring_rider_contracts"])
    await db.exec(historicalFunction(rollover, name));
  await db.exec("create trigger contract_lifecycle_on_season_status after update of status on public.seasons for each row execute function public.settle_expiring_rider_contracts();");
  // Apply the real ledger constraints to the otherwise minimal shared fixture.
  // In particular, zero transactions and out-of-range days must fail exactly as
  // they would on the live schema; nullable season_day_id is intentional.
  const financeSchema=readFileSync("supabase/migrations/20260720203000_create_rewards_finances_and_rankings.sql","utf8").replaceAll("\r\n","\n");
  const constraintStart=financeSchema.indexOf("  constraint team_finance_transactions_day_range");
  const constraintEnd=financeSchema.indexOf("  constraint team_finance_transactions_source_unique");
  assert(constraintStart>0 && constraintEnd>constraintStart);
  const constraints=financeSchema.slice(constraintStart,constraintEnd).trim().replace(/,$/,"")
    .replace(/,\n  constraint /g,", add constraint ");
  await db.exec("alter table public.team_finance_transactions add "+constraints);
  await db.exec("alter table public.team_finance_transactions alter column team_season_id set not null,alter column day_number set not null,alter column amount set not null,alter column category set not null,alter column status set not null,alter column description set not null,alter column source_reference set not null,add foreign key(team_season_id) references public.team_seasons(id) on delete cascade,add foreign key(season_day_id) references public.season_days(id) on delete set null;");
  const careSource=readFileSync("supabase/migrations/20260721120000_create_health_center.sql","utf8").replaceAll("\r\n","\n");
  const careStart=careSource.indexOf("alter table public.team_finance_transactions");
  const careEnd=careSource.indexOf("create or replace function public.settle_current_health_and_form",careStart);
  assert(careStart>=0 && careEnd>careStart);
  await db.exec(careSource.slice(careStart,careEnd));
  await db.exec(historicalFunction("supabase/migrations/20260930210000_allow_junior_profile_links_in_chat.sql","validate_direct_message_links"));
  await db.exec("create trigger direct_messages_validate_links before insert or update of body on public.direct_messages for each row execute function public.validate_direct_message_links();");
  const before = await snapshot();
  await db.exec(readFileSync(migration, "utf8").replaceAll("\r\n","\n"));
  const after = await snapshot();
  const existingFields = new Set(Object.keys(before.offers[0].row));
  for (const offer of after.offers)
    for (const key of Object.keys(offer.row))
      if (!existingFields.has(key)) delete offer.row[key];
  check(after, before, "Migration preserves all existing records, apart from additive nullable metadata");

  await scenario("future cash keeps current programs and blocks funds without paying the seller", async () => {
    const booking = await bookRace(202, {status:"in_progress",stageStatus:"in_progress"});
    await db.query("insert into public.rider_form_camps(rider_id,season_id,status,team_season_id) values($1,$2,'active',$3)",[id(202),id(4),id(114)]);
    await db.query("insert into public.rider_equipment_assignments values($1,'seller-bike')",[id(202)]);
    await db.query("insert into public.rider_training_plan_versions(rider_id,team_id,season_id,effective_from_day_number,trainer_contract_id) values($1,$2,$3,1,$4)",[id(202),id(11),id(4),id(800)]);
    const programsBefore = await snapshot();
    await auth(1);
    const offer = offerId(await submit(202,10000,null,"Arrivée saison prochaine"));
    await root();
    const pending = (await rows("select * from public.direct_transfer_offers where id=$1",[offer]))[0];
    check(pending.effective_season_id,id(5),"Server chooses next season");
    check(await owner(202),id(11),"Submission does not transfer ownership");
    check(await reservation(),10000,"Pending offer reserves the agreed indemnity");
    await auth(2); await respond(offer); await root();
    check(await owner(202),id(11),"Accepted future offer keeps the rider in the current club");
    const future = await contract(202,"planned");
    check(future.team_id,id(10));
    check(future.start_season_id,id(5));
    check(future.end_season_id,id(5),"The new contract covers precisely next season");
    check(Number(future.salary_per_season),8200);
    check(await cash(104),990000,"Acceptance charges once");
    check(await cash(114),1000000,"Seller receives no current-season payment");
    check(await cash(115),1000000,"Seller's future opening balance is not credited early");
    check(await scalar("select count(*)::int from public.team_finance_transactions where team_season_id=any($1::uuid[]) and source_reference=$2",
      [[id(114),id(115)],"direct-transfer-sale:"+offer]),0,"No seller receipt is posted before arrival");
    check(await reservation(),0,"Accepted deal no longer reserves pending-offer cash");
    const programsAfter = await snapshot();
    for(const key of ["equipment","riderEquipment","pendingEquipment","naturalization","training","rosters","camps","reconnaissance"])
      check(programsAfter[key],programsBefore[key],"Current commitments remain unchanged: "+key);
    check(await scalar("select status from public.race_rosters where id=$1",[booking.roster]),"confirmed","A current in-progress race is not withdrawn");
    const salaries = await rows("select team_season_id,amount,status from public.team_finance_transactions where source_reference like $1",["rider-salary:"+future.id+":%"]);
    check(salaries.length,0,"Normal finance hook waits for planned contract activation");
    const accepted = await snapshot();
    await auth(2); await reject("select public.respond_to_direct_transfer_offer($1,true)",[offer]); await root();
    check(await snapshot(),accepted,"Retry cannot duplicate contracts, cash or messages");
  });

  await scenario("own future renewals are cancelled and the current long contract is shortened", async () => {
    await db.query("update public.rider_contracts set end_season_id=$1 where rider_id=$2 and status='active'",[id(6),id(202)]);
    await addRider(202,11,{status:"planned",start:5,end:6,acquisition:"renewal",salary:8800});
    await auth(1); const offer=offerId(await submit()); await auth(2); await respond(offer); await root();
    const active=await contract(202,"active");
    check(active.team_id,id(11));
    check(active.end_season_id,id(4),"Seller's current contract ends exactly at departure");
    check(Number(active.salary_per_season),8200,"Current salary remains unchanged");
    const renewals=await rows("select status from public.rider_contracts where rider_id=$1 and team_id=$2 and acquisition_type='renewal'",[id(202),id(11)]);
    check(renewals.every(row=>row.status==="cancelled"),true);
    check(await scalar("select public.get_team_roster_commitment_count($1,5)",[id(11)]),0,"Departure frees the seller's next-season slot");
    check(await scalar("select public.get_team_roster_commitment_count($1,6)",[id(11)]),0,"No residual return through S+2");
  });

  await scenario("an over-cap seller may improve its future roster one sale at a time", async () => {
    const base=Number(await scalar("select public.get_team_roster_base_limit($1)",[id(11)]));
    // Model an existing legacy over-cap roster. Re-enable the genuine guard
    // before any player action, so the workflow has no fixture bypass.
    await db.exec("alter table public.rider_contracts disable trigger enforce_team_roster_capacity_after_write");
    for(let n=0;n<base+3;n++) await addRider(1000+n,11,{end:5});
    await db.query("update public.rider_contracts set end_season_id=$1 where rider_id=$2 and status='active'",[id(5),id(202)]);
    await db.exec("alter table public.rider_contracts enable trigger enforce_team_roster_capacity_after_write");
    const initial=await scalar("select public.get_team_roster_commitment_count($1,5)",[id(11)]);
    await auth(1); const offer=offerId(await submit()); await auth(2); await respond(offer); await root();
    check(await scalar("select public.get_team_roster_commitment_count($1,5)",[id(11)]),initial-1,"Seller remains over cap but the reduction succeeds");
    check(await owner(202),id(11),"Current season remains playable");
  });

  await scenario("a currently full buyer may sign for next season when it has room", async () => {
    const base=Number(await scalar("select public.get_team_roster_base_limit($1)",[id(10)]));
    for(let n=1;n<base;n++) await addRider(1100+n,10);
    await auth(1); const offer=offerId(await submit()); await auth(2); await respond(offer); await root();
    check((await contract(202,"planned")).team_id,id(10));
    check(await scalar("select public.get_team_roster_commitment_count($1,4)",[id(10)]),base,"No current-season slot is consumed");
  });

  await scenario("future capacity is checked again at acceptance", async () => {
    const base=Number(await scalar("select public.get_team_roster_base_limit($1)",[id(10)]));
    await auth(1); const offer=offerId(await submit()); await root();
    for(let n=0;n<base;n++) await addRider(1200+n,10,{status:"planned",start:5,end:5});
    const before=await fieldSnapshot();
    await auth(2); await reject("select public.respond_to_direct_transfer_offer($1,true)",[offer]); await root();
    check(await fieldSnapshot(),before,"Full future destination fails atomically");
    check(await cash(104),1000000);
    await auth(1); await reject("select public.submit_deferred_direct_transfer_offer($1,1000,null,null)",[id(203)]);
  });

  await scenario("another future club prevents both creation and stale acceptance", async () => {
    await auth(1); const offer=offerId(await submit()); await root();
    await addRider(202,12,{status:"planned",start:5,end:5});
    const before=await snapshot();
    await auth(2); await reject("select public.respond_to_direct_transfer_offer($1,true)",[offer]); await root();
    check(await snapshot(),before);
    await auth(1); await reject("select public.submit_deferred_direct_transfer_offer($1,1000,null,null)",[id(202)]);
  });

  await scenario("both trade arrivals are atomic and keep current entries", async () => {
    const a=await bookRace(201); const b=await bookRace(202,{base:9010});
    await auth(1); const offer=offerId(await submit(202,0,201)); await auth(2); await respond(offer); await root();
    check(await owner(201),id(10)); check(await owner(202),id(11));
    check((await contract(201,"planned")).team_id,id(11));
    check((await contract(202,"planned")).team_id,id(10));
    check(await scalar("select status from public.race_rosters where id=$1",[a.roster]),"confirmed");
    check(await scalar("select status from public.race_rosters where id=$1",[b.roster]),"confirmed");
    check(await cash(104),1000000); check(await cash(114),1000000);
  });

  await scenario("second contract failure rolls back the entire future trade", async () => {
    await auth(1); const offer=offerId(await submit(202,1000,201)); await root();
    await db.exec("create function public.test_fail_deferred_second() returns trigger language plpgsql as $$begin if new.status='planned' and new.rider_id='00000000-0000-4000-8000-000000000201'::uuid then raise exception 'injected-second-contract'; end if; return new; end$$; create trigger zzz_test_fail_deferred_second before insert on public.rider_contracts for each row execute function public.test_fail_deferred_second();");
    const before=await snapshot();
    await auth(2); await reject("select public.respond_to_direct_transfer_offer($1,true)",[offer],"injected-second-contract"); await root();
    check(await snapshot(),before,"Cash, first contract and offer decision all roll back");
  });

  await scenario("rejection and withdrawal release pending budget", async () => {
    await auth(1); const offer=offerId(await submit()); await root(); check(await reservation(),1000);
    await auth(2); await respond(offer,false); await root(); check(await reservation(),0);
    await auth(1); const second=offerId(await submit()); await scalar("select public.cancel_current_direct_transfer_offer($1)",[second]); await root();
    check(await reservation(),0);
    check(await cash(104),1000000); check(await cash(114),1000000);
    check((await rows("select id from public.rider_contracts where status='planned'")).length,0);
  });

  await scenario("auth, ownership and cash boundaries are checked by SQL", async () => {
    await auth(null,"anon"); await reject("select public.submit_deferred_direct_transfer_offer($1,1000,null,null)",[id(202)]);
    await auth(1); await reject("select public.submit_deferred_direct_transfer_offer($1,499,null,null)",[id(202)]);
    await reject("select public.submit_deferred_direct_transfer_offer($1,-1,$2,null)",[id(202),id(201)]);
    await reject("select public.submit_deferred_direct_transfer_offer($1,1000,$2,null)",[id(202),id(203)]);
    const offer=offerId(await submit()); await auth(3);
    await reject("select public.respond_to_direct_transfer_offer($1,true)",[offer]);
  });

  await scenario("cash must still be available, but zero-fee swaps work in debt", async () => {
    await auth(1); const offer=offerId(await submit()); await root();
    await db.query("update public.team_seasons set cash_balance=0 where id=$1",[id(104)]);
    await auth(2); await reject("select public.respond_to_direct_transfer_offer($1,true)",[offer]); await root();
    check(await owner(202),id(11));
    await auth(1); await scalar("select public.cancel_current_direct_transfer_offer($1)",[offer]); await root();
    await db.query("update public.team_seasons set cash_balance=-1234 where id=$1",[id(104)]);
    await auth(1); const trade=offerId(await submit(202,0,201)); await auth(2); await respond(trade); await root();
    check(await cash(104),-1234,"Pure exchange creates neither debt nor a fictitious fee");
  });

  await scenario("real season hooks activate exactly once and detach old club equipment at departure", async () => {
    await db.query("update public.rider_contracts set end_season_id=$1 where rider_id=$2 and status='active'",[id(5),id(202)]);
    await db.query("insert into public.rider_equipment_assignments values($1,'seller-bike')",[id(202)]);
    await db.query("insert into public.rider_training_plan_versions(rider_id,team_id,season_id,effective_from_day_number,trainer_contract_id) values($1,$2,$3,1,$4),($1,$2,$5,1,$4)",
      [id(202),id(11),id(4),id(800),id(5)]);
    await auth(1); const offer=offerId(await submit()); await auth(2); await respond(offer); await root();
    check(await owner(202),id(11));
    check(await scalar("select count(*)::int from public.rider_equipment_assignments where rider_id=$1",[id(202)]),1,"Equipment remains through current season");
    await db.query("update public.seasons set status='completed',current_day_number=28 where id=$1",[id(4)]);
    await db.query("update public.team_seasons set status='completed' where season_id=$1",[id(4)]);
    await db.query("update public.team_seasons set status='active' where season_id=$1",[id(5)]);
    await db.query("update public.seasons set status='active',current_day_number=1 where id=$1",[id(5)]);
    check(await owner(202),id(10),"The existing season lifecycle activates the reserved arrival");
    check(await scalar("select count(*)::int from public.rider_contracts where rider_id=$1 and status='active'",[id(202)]),1,"No overlapping active clubs");
    check(await scalar("select count(*)::int from public.rider_equipment_assignments where rider_id=$1",[id(202)]),0,"Old team kit is detached only at departure");
    check(await scalar("select trainer_contract_id from public.rider_training_plan_versions where rider_id=$1 and season_id=$2",[id(202),id(4)]),id(800),"Historical training stays intact");
    check(await scalar("select trainer_contract_id from public.rider_training_plan_versions where rider_id=$1 and season_id=$2",[id(202),id(5)]),null,"An old-club coach is not retained in the new season");
    check(await cash(114),1000000,"No retrospective receipt in the seller's completed season");
    check(await cash(115),1001000,"Escrow pays the seller's new-season account at arrival");
    const arrival=await contract(202,"active");
    const wages=await rows("select team_season_id from public.team_finance_transactions where source_reference like $1",["rider-salary:"+arrival.id+":%"]);
    check(wages.length,4,"Normal activation schedules four salary installments");
    check(wages.every(row=>row.team_season_id===id(105)),true,"Only the buyer's new season carries these wages");
    check(await scalar("select count(*)::int from public.team_finance_transactions where team_season_id=$1 and source_reference=$2",
      [id(115),"direct-transfer-sale:"+offer]),1,"One uniquely referenced seller receipt");
    const stable=await fieldSnapshot();
    await db.query("update public.seasons set status='active' where id=$1",[id(5)]);
    check(await fieldSnapshot(),stable,"Repeated activation is idempotent");
    check(await cash(115),1001000,"Repeated activation cannot release escrow twice");
  });

  await scenario("legacy immediate cash keeps its end-of-current-season contract", async () => {
    await auth(1);
    const result=await scalar("select public.submit_direct_transfer_offer_with_message($1,1000,null)",[id(202)]);
    await auth(2); await respond(offerId(result)); await root();
    check(await owner(202),id(10));
    check(await contract(202,"planned"),undefined);
    check((await contract(202,"active")).end_season_id,id(4));
  });

  await scenario("accepted future arrival is protected from legacy immediate offers", async () => {
    await auth(1); const offer=offerId(await submit()); await auth(2); await respond(offer); await root();
    await auth(3);
    const immediate=offerId(await scalar("select public.submit_direct_transfer_offer_with_message($1,1000,null)",[id(202)]));
    await root(); const before=await snapshot();
    await auth(2); await reject("select public.respond_to_direct_transfer_offer($1,true)",[immediate]);
    await root(); check(await snapshot(),before,"Future buyer's paid contract cannot be cancelled silently");
  });

  await scenario("an existing current-season transfer lock does not forbid next-season negotiations", async () => {
    await db.query("update public.rider_contracts set transfer_locked_season_id=$1 where rider_id=$2 and status='active'",[id(4),id(202)]);
    await auth(1); const offer=offerId(await submit()); await auth(2); await respond(offer); await root();
    check((await contract(202,"planned")).start_season_id,id(5));
    check(await owner(202),id(11),"No second current-season transfer is performed");
  });

  await scenario("normal salary discounts and cash rebate apply once to the future contract", async () => {
    await db.query("insert into public.test_team_specialization_power values($1,1)",[id(10)]);
    await db.query("insert into public.youth_academy_riders(team_id,promoted_rider_id,status) values($1,$2,'promoted')",[id(10),id(202)]);
    await db.query("insert into public.rider_special_abilities values($1,'homegrown')",[id(202)]);
    await auth(1); const offer=offerId(await submit(202,10000)); await root();
    check(Number(await scalar("select salary_per_season from public.direct_transfer_offers where id=$1",[offer])),3977,"8200 × .97 DataRoom ÷ 2 homegrown");
    await auth(2); await respond(offer); await root();
    check(Number((await contract(202,"planned")).salary_per_season),3977,"Normal insertion discounts are not applied twice");
    check(await cash(104),990400,"Existing 4% transfer rebate applies to the current acceptance payment");
    check(await cash(105),1000000,"Future opening balance is not credited by a current transaction");
  });

  await scenario("failed arrival rolls back escrow release and can safely retry", async () => {
    await auth(1); const offer=offerId(await submit(202,10000)); await auth(2); await respond(offer); await root();
    check(await cash(104),990000,"Funds are already unavailable to the buyer");
    await db.query("update public.seasons set status='completed',current_day_number=28 where id=$1",[id(4)]);
    await db.query("update public.team_seasons set status='completed' where season_id=$1",[id(4)]);
    await db.query("update public.team_seasons set status='active' where season_id=$1",[id(5)]);
    await db.exec("create function public.test_fail_escrow_release() returns trigger language plpgsql as $$begin if new.source_reference like 'direct-transfer-sale:%' then raise exception 'injected-escrow-release'; end if; return new; end$$; create trigger zzz_test_fail_escrow_release before insert on public.team_finance_transactions for each row execute function public.test_fail_escrow_release();");
    const before=await snapshot();
    await reject("update public.seasons set status='active',current_day_number=1 where id=$1",[id(5)],"injected-escrow-release");
    check(await snapshot(),before,"Activation failure rolls back owner changes, receipt, release marker and salary effects");
    check((await contract(202,"planned")).team_id,id(10));
    check(await cash(115),1000000,"Seller is unpaid after rollback");
    await db.exec("drop trigger zzz_test_fail_escrow_release on public.team_finance_transactions");
    await db.query("update public.seasons set status='active',current_day_number=1 where id=$1",[id(5)]);
    check(await owner(202),id(10)); check(await cash(115),1010000);
    await db.query("update public.seasons set status='active' where id=$1",[id(5)]);
    check(await cash(115),1010000,"Retry pays precisely once");
  });

  await scenario("missing seller account does not block rollover and is credited once when created", async () => {
    await auth(1); const offer=offerId(await submit(202,10000)); await auth(2); await respond(offer); await root();
    await db.query("delete from public.team_seasons where id=$1",[id(115)]);
    await db.query("update public.seasons set status='completed',current_day_number=28 where id=$1",[id(4)]);
    await db.query("update public.team_seasons set status='completed' where season_id=$1",[id(4)]);
    await db.query("update public.team_seasons set status='active' where season_id=$1",[id(5)]);
    await db.query("update public.seasons set status='active',current_day_number=1 where id=$1",[id(5)]);
    check(await owner(202),id(10),"Rollover still activates the arrival");
    check(await scalar("select released_at is null from public.direct_transfer_offers where id=$1",[offer]),true,"Missing receiver account leaves funds in escrow");
    check(await cash(114),1000000,"Never credit the seller's old completed account");
    await db.query("insert into public.team_seasons(id,team_id,season_id,display_name,status) values($1,$2,$3,'Vendeur revient','active')",[id(115),id(11),id(5)]);
    check(await cash(115),1010000,"Creating the account recovers exactly the held consideration");
    check(await scalar("select released_team_season_id from public.direct_transfer_offers where id=$1",[offer]),id(115));
    await db.query("update public.team_seasons set status='active' where id=$1",[id(115)]);
    check(await cash(115),1010000,"Repeated account activation cannot pay twice");
    check(await scalar("select count(*)::int from public.team_finance_transactions where source_reference=$1",["direct-transfer-sale:"+offer]),1);
  });

  await scenario("withdrawn seller account keeps escrow until reactivated", async () => {
    await auth(1); const offer=offerId(await submit()); await auth(2); await respond(offer); await root();
    await db.query("update public.team_seasons set status='withdrawn' where id=$1",[id(115)]);
    await db.query("update public.seasons set status='completed',current_day_number=28 where id=$1",[id(4)]);
    await db.query("update public.team_seasons set status='completed' where season_id=$1",[id(4)]);
    await db.query("update public.team_seasons set status='active' where season_id=$1 and status<>'withdrawn'",[id(5)]);
    await db.query("update public.seasons set status='active',current_day_number=1 where id=$1",[id(5)]);
    check(await owner(202),id(10));
    check(await cash(115),1000000,"Inactive accounts are not credited");
    check(await scalar("select released_at is null from public.direct_transfer_offers where id=$1",[offer]),true);
    await db.query("update public.team_seasons set status='active' where id=$1",[id(115)]);
    check(await cash(115),1001000);
  });

  await scenario("late return waits for active season after cash carry before releasing escrow", async () => {
    await auth(1); const offer=offerId(await submit(202,10000)); await auth(2); await respond(offer); await root();
    await db.query("delete from public.team_seasons where id=$1",[id(115)]);
    await db.query("update public.seasons set status='completed',current_day_number=28 where id=$1",[id(4)]);
    await db.query("update public.team_seasons set status='completed' where season_id=$1",[id(4)]);
    await db.query("update public.team_seasons set status='active' where season_id=$1",[id(5)]);
    await db.query("update public.seasons set status='active',current_day_number=1 where id=$1",[id(5)]);
    await db.query("update public.seasons set status='completed',current_day_number=28 where id=$1",[id(5)]);
    await db.query("update public.team_seasons set status='completed' where season_id=$1",[id(5)]);
    await db.query("insert into public.team_seasons(id,team_id,season_id,display_name,status,cash_balance) values($1,$2,$3,'Retour S6','active',12345)",[id(116),id(11),id(6)]);
    check(await cash(116),12345,"A future active account must not receive money before its season is active");
    check(await scalar("select released_at is null from public.direct_transfer_offers where id=$1",[offer]),true);
    // Simulate the already-reviewed rollover ordering: source closing cash is
    // copied before target season activation, even for a precreated account.
    await db.query("update public.team_seasons set cash_balance=700000 where id=$1",[id(116)]);
    await db.query("update public.seasons set status='active',current_day_number=1 where id=$1",[id(6)]);
    check(await cash(116),710000,"Late escrow is released after cash carry, never overwritten by it");
    check(await scalar("select released_team_season_id from public.direct_transfer_offers where id=$1",[offer]),id(116));
    await db.query("update public.seasons set status='active' where id=$1",[id(6)]);
    check(await cash(116),710000,"A repeated active status cannot pay again");
    check(await scalar("select count(*)::int from public.team_finance_transactions where source_reference=$1",["direct-transfer-sale:"+offer]),1);
  });

  await scenario("legacy auction creation cannot put a promised rider into an unresolvable market batch", async () => {
    await auth(1); const offer=offerId(await submit(202,0,201)); await auth(2); await respond(offer);
    await reject("select public.create_director_transfer_listing($1,1000)",[id(202)],"transfert différé accepté");
    await auth(1);
    await reject("select public.create_director_transfer_listing($1,1000)",[id(201)],"transfert différé accepté");
    await root();
    check(await scalar("select count(*)::int from public.transfer_market_listings where rider_id=any($1::uuid[]) and status='open'",[[id(201),id(202)]]),0);
    const listing=await scalar("insert into public.transfer_market_listings(rider_id,season_id,status,seller_team_id) values($1,$2,'cancelled',$3) returning id",[id(202),id(4),id(11)]);
    await reject("update public.transfer_market_listings set status='open' where id=$1",[listing],"transfert différé accepté");
    await auth(3);
    const ordinaryListing=await scalar("select public.create_director_transfer_listing($1,1000)",[id(203)]);
    await root();
    check(await scalar("select status from public.transfer_market_listings where id=$1",[ordinaryListing]),"open","Unrelated ordinary auctions remain usable");
  });

  await scenario("existing private-message link guard remains atomic for new deferred offers", async () => {
    const before=await snapshot();
    await auth(1);
    await reject("select public.submit_deferred_direct_transfer_offer($1,1000,null,$2)",[id(202),"https://outside.invalid/spam"]);
    await root();
    check(await snapshot(),before,"Invalid message never leaves a hidden offer, reservation or notification behind");
  });
}

const footer = [
  '  console.log(JSON.stringify({ok:true,checks,scenarios,isolated:true,productionData:false,multiSessionConcurrency:false,migration:"20261102090000"}));',
  '} catch (error) {',
  '  console.error(JSON.stringify({ok:false,scenario:currentCase,checks,error:error.message,code:error.code,position:error.position,where:error.where}));',
  '  process.exitCode=1;',
  '} finally { await db.close(); }',
].join("\n");
const entry = prefix + "\nawait (" + regressions.toString() +
  ")({db,id,check,rows,scalar,root,auth,reject,scenario,addRider,owner,bookRace,snapshot,historicalFunction});\n" + footer;
// Own module scope without copying or replacing transfer/roster/salary logic.
await import("data:text/javascript;base64," + Buffer.from(entry).toString("base64"));
