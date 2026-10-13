// Fixtures run exclusively in a disposable, local PGlite database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

if (!process.env.STAFF_ACADEMY_SQL_TEST_MODULE) throw new Error("Local PGlite module required.");
const { PGlite } = await import(pathToFileURL(process.env.STAFF_ACADEMY_SQL_TEST_MODULE).href);
const db = new PGlite();
const migration = readFileSync("supabase/migrations/20261012203000_grant_samuelrodri_fresh_start.sql", "utf8");
const targets = [...migration.matchAll(/\('([a-f0-9-]+)'::uuid, '([a-f0-9-]+)'::uuid, '([a-f0-9-]+)'::uuid, (\d+), (\d+)\)/g)]
  .map(([,rider,contract,renewal,salary,nextSalary]) => ({rider,contract,renewal,salary:Number(salary),nextSalary:Number(nextSalary)}));
assert.equal(targets.length, 11);
const team = "c7d4f299-3430-4aaf-a029-ac9b97a07ed2", season = "c0c5824c-43a4-442e-907c-265c479efa0a";
const teamSeason = "94e82d7f-40d5-40a6-8d49-6455de0bfbb2", director = "266044fe-2b1d-4aeb-bbd6-eb3be00ae458";
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0];
function historicalFunction(file, name) {
  const source = readFileSync(file,"utf8").replaceAll("\r", "");
  const match = source.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`, "i"));
  if (!match) throw new Error(`Missing function ${name}`);
  return match[0];
}
async function rejectUnchanged(pattern) {
  await assert.rejects(db.exec(migration), pattern);
  await db.exec("rollback;");
  assert.equal(Number(await scalar(`select cash_balance from team_seasons where id='${teamSeason}'`)), 84350);
  assert.equal(Number(await scalar("select count(*) from rider_contracts where status='terminated'")), 0);
}
try {
  await db.exec(`
    create schema private;
    create table seasons(id uuid primary key,status text,game_year integer,current_day_number integer);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,currency text,cash_balance numeric,registration_country_id uuid);
    create table sporting_directors(id uuid primary key,status text,username text);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,status text,role text);
    create table riders(id uuid primary key,status text,first_name text,last_name text);
    create table rider_contracts(id uuid primary key,rider_id uuid,team_id uuid,status text,salary_per_season numeric,
      start_season_id uuid,end_season_id uuid,left_season_id uuid,left_day_number integer);
    create table team_finance_transactions(id uuid primary key default gen_random_uuid(),team_season_id uuid,
      day_number integer,amount numeric,category text,status text,description text,source_reference text,
      posted_at timestamptz,unique(team_season_id,source_reference));
    create table transfer_market_listings(id uuid primary key,rider_id uuid,seller_team_id uuid,status text,settled_at timestamptz);
    create table transfer_market_bids(listing_id uuid);
    create table rider_equipment_pending_assignments(rider_id uuid,team_season_id uuid);
    create table rider_equipment_assignments(rider_id uuid);
    create table race_editions(id uuid primary key,status text);
    create table race_registrations(id uuid primary key,team_season_id uuid,race_edition_id uuid);
    create table race_rosters(rider_id uuid,race_registration_id uuid,status text);
    create table rider_form_camps(id uuid primary key,rider_id uuid,team_season_id uuid,status text,completed_at timestamptz);
    create table stage_reconnaissances(id uuid primary key,team_season_id uuid,status text,completed_at timestamptz);
    create table stage_reconnaissance_riders(reconnaissance_id uuid,form_camp_id uuid);
    create table test_departures(rider_id uuid,season_id uuid,day_number integer);
    create function pause_rider_naturalization_progress(uuid,uuid,integer) returns void language sql as $$
      insert into public.test_departures values($1,$2,$3); $$;
    insert into seasons values('${season}','active',4,4),('${id(5)}','planned',5,1);
    insert into team_seasons values('${teamSeason}','${team}','${season}','EUR',84350,'${id(1)}');
    insert into sporting_directors values('${director}','active','SamuelRodri');
    insert into team_manager_assignments values('${director}','${team}','active','general_manager');
    insert into race_editions values('${id(101)}','scheduled'),('${id(102)}','in_progress'),('${id(103)}','completed');
    insert into race_registrations values('${id(111)}','${teamSeason}','${id(101)}'),
      ('${id(112)}','${teamSeason}','${id(102)}'),('${id(113)}','${teamSeason}','${id(103)}');
    insert into team_finance_transactions(team_season_id,day_number,amount,category,status,description,source_reference)
    values('${teamSeason}',1,-1625,'rider_salary','posted','Historique payé','rider-salary:${targets[0].contract}:old:4');
  `);
  for (const [i,t] of targets.entries()) {
    await db.exec(`insert into riders values('${t.rider}','active','Rider','${i}');
      insert into rider_contracts values('${t.contract}','${t.rider}','${team}','active',${t.salary},'${season}','${season}',null,null),
        ('${t.renewal}','${t.rider}','${team}','planned',${t.nextSalary},'${id(5)}','${id(5)}',null,null);
      insert into rider_equipment_assignments values('${t.rider}');
      insert into rider_equipment_pending_assignments values('${t.rider}','${teamSeason}');
      insert into race_rosters values('${t.rider}','${id(111)}','confirmed'),('${t.rider}','${id(112)}','confirmed'),('${t.rider}','${id(113)}','finished');
      insert into rider_form_camps values('${id(200+i)}','${t.rider}','${teamSeason}','active',null);`);
    for (let installment=1;installment<=4;installment++) {
      await db.exec(`insert into team_finance_transactions(team_season_id,day_number,amount,category,status,description,source_reference)
        values('${teamSeason}',${installment*7},${-t.salary/4},'rider_salary','pending','Salaire',
          'rider-salary:${t.contract}:${season}:${installment}');`);
    }
  }
  for (let i=0;i<24;i++) {
    await db.exec(`insert into riders values('${id(300+i)}','active','Other','${i}');
      insert into rider_contracts values('${id(400+i)}','${id(300+i)}','${team}','active',8625,'${season}','${season}',null,null);`);
  }
  await db.exec(`insert into rider_equipment_assignments values('${id(300)}');
    insert into rider_equipment_pending_assignments values('${id(300)}','${teamSeason}');
    insert into race_rosters values('${id(300)}','${id(111)}','confirmed');
    insert into rider_form_camps values('${id(250)}','${id(300)}','${teamSeason}','active',null);
    insert into stage_reconnaissances values('${id(251)}','${teamSeason}','active',null);
    insert into stage_reconnaissance_riders values('${id(251)}','${id(250)}');`);
  const lifecycle = "supabase/migrations/20260809120000_secure_rider_career_transitions.sql";
  for (const name of ["detach_departing_rider","stamp_rider_contract_departure","handle_rider_contract_transition"]) {
    await db.exec(historicalFunction(lifecycle,name));
  }
  const finance = "supabase/migrations/20260720203000_create_rewards_finances_and_rankings.sql";
  for (const name of ["sync_rider_salary_installments","handle_finance_contract_change"]) {
    await db.exec(historicalFunction(finance,name));
  }
  await db.exec(`create trigger stamp before update of status on rider_contracts for each row execute function stamp_rider_contract_departure();
    create trigger departure after update of status on rider_contracts for each row execute function handle_rider_contract_transition();
    create trigger finances after update of status on rider_contracts for each row execute function handle_finance_contract_change();`);

  await db.exec(`update sporting_directors set username='DifferentOwner'`);
  await rejectUnchanged(/DS actif/);
  await db.exec(`update sporting_directors set username='SamuelRodri'; update seasons set status='completed' where id='${season}'`);
  await rejectUnchanged(/saison 4 active/);
  await db.exec(`update seasons set status='active' where id='${season}'; update rider_contracts set salary_per_season=6501 where id='${targets[0].contract}'`);
  await rejectUnchanged(/salaire a changé/);
  await db.exec(`update rider_contracts set salary_per_season=6500 where id='${targets[0].contract}';
    insert into rider_contracts values('${id(600)}','${targets[0].rider}','${id(601)}','planned',6500,'${id(5)}','${id(5)}',null,null);`);
  await rejectUnchanged(/engagements tiers/);
  await db.exec(`delete from rider_contracts where id='${id(600)}';
    insert into transfer_market_listings values('${id(610)}','${targets[0].rider}','${team}','open',null);
    insert into transfer_market_bids values('${id(610)}');`);
  await rejectUnchanged(/enchère avec offres/);
  await db.exec(`delete from transfer_market_bids;
    insert into team_finance_transactions(team_season_id,day_number,amount,category,status,description,source_reference)
    values('${teamSeason}',4,100,'other','posted','Incorrect receipt','owner-approved-fresh-start:samuelrodri:20261012');`);
  await rejectUnchanged(/versement existant est incohérent/);
  await db.exec(`delete from team_finance_transactions where source_reference='owner-approved-fresh-start:samuelrodri:20261012'`);

  await db.exec(migration);
  assert.equal(Number(await scalar(`select cash_balance from team_seasons where id='${teamSeason}'`)),234350);
  assert.equal(Number(await scalar("select count(*) from rider_contracts where status='active'")),24);
  assert.equal(Number(await scalar("select sum(salary_per_season) from rider_contracts where status='active'")),207000);
  assert.equal(Number(await scalar("select count(*) from rider_contracts where status='terminated'")),11);
  assert.equal(Number(await scalar("select count(*) from rider_contracts where status='cancelled'")),11);
  assert.equal(Number(await scalar("select count(*) from riders where status='free_agent'")),11);
  assert.equal(Number(await scalar("select count(*) from rider_contracts where left_season_id is not null and left_day_number=4")),22);
  assert.equal(Number(await scalar("select count(*) from team_finance_transactions where status='pending'")),0);
  assert.equal(Number(await scalar("select count(*) from team_finance_transactions where status='cancelled'")),44);
  assert.equal(Number(await scalar("select sum(amount) from team_finance_transactions where status='cancelled'")),-81500);
  assert.equal(Number(await scalar("select amount from team_finance_transactions where description='Historique payé'")),-1625);
  assert.equal(Number(await scalar("select count(*) from rider_equipment_assignments")),1);
  assert.equal(Number(await scalar("select count(*) from rider_equipment_pending_assignments")),1);
  assert.equal(Number(await scalar("select count(*) from race_rosters where status='withdrawn'")),11);
  assert.equal(Number(await scalar("select count(*) from race_rosters where status='finished'")),11);
  assert.equal(Number(await scalar(`select count(*) from race_rosters where race_registration_id='${id(112)}' and status='confirmed'`)),11);
  assert.equal(Number(await scalar("select count(*) from rider_form_camps where status='active'")),1);
  assert.equal(await scalar("select status from stage_reconnaissances"),"active");
  assert.equal(Number(await scalar("select count(*) from test_departures")),11);
  assert.equal(await scalar("select status from transfer_market_listings"),"cancelled");
  await db.exec(migration);
  assert.equal(Number(await scalar(`select cash_balance from team_seasons where id='${teamSeason}'`)),234350);
  assert.equal(Number(await scalar("select count(*) from team_finance_transactions where source_reference='owner-approved-fresh-start:samuelrodri:20261012'")),1);
  assert.equal(Number(await scalar("select count(*) from test_departures")),11);
  console.log("PASS: exact owner/season/contracts, no third-party engagement cancellation, all-or-nothing guards, 150000 EUR once, 11 free releases, 11 cancelled renewals, 44 cancelled salary installments, preserved histories/equipment and unrelated riders, retry idempotency.");
} catch (error) {
  console.error(JSON.stringify({message:error.message,code:error.code,detail:error.detail,where:error.where}));
  process.exitCode=1;
} finally {
  await db.close();
}
