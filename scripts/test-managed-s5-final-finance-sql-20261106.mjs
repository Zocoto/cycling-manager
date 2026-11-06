// Local isolated PostgreSQL syntax/aggregation check, with no production access.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {MANAGED_S5_ACTION_KEYS,MANAGED_S5_SEASON} from './lib/managed-s5-action-sql-20261106.mjs';
import {createManagedFinanceAuditSql} from './lib/managed-s5-finance-audit-20261106.mjs';

assert.ok(process.argv[2],'Pass the local @electric-sql/pglite dist/index.js path');
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
let serial=0;const uuid=()=>`00000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`;
const identity=MANAGED_S5_ACTION_KEYS.map(bot_key=>({bot_key,team_id:uuid(),team_season_id:uuid(),manager_id:uuid()}));
try{
  await db.exec(`
    create table seasons(id uuid primary key,status text,game_year int,current_day_number int);
    create table alpha_bot_managers(id uuid primary key,bot_key text,team_id uuid,enabled bool,automation_season_id uuid,automation_end_day_number int);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,cash_balance numeric,opening_cash_balance numeric);
    create table team_finance_transactions(id uuid primary key,team_season_id uuid,day_number int,amount numeric,category text,status text,source_reference text,created_at timestamptz);
    create table rider_contracts(id uuid primary key,team_id uuid,rider_id uuid,status text,acquisition_type text,salary_per_season numeric,transfer_fee numeric,signed_at timestamptz,start_season_id uuid,end_season_id uuid);
    create table team_equipment_inventory(team_season_id uuid,equipment_item_id uuid,quantity int,last_purchase_price numeric);
    create table rider_equipment_assignments(rider_id uuid,slot_type text,equipment_item_id uuid);
    create table rider_equipment_pending_assignments(team_season_id uuid,rider_id uuid,slot_type text,equipment_item_id uuid,effective_at timestamptz);
    create table alpha_bot_cycles(manager_id uuid,cycle_key text,status text,actions jsonb,started_at timestamptz,completed_at timestamptz);
    create table season_draft_riders(rider_id uuid,edition_id uuid);
    create table season_draft_editions(id uuid primary key,status text,pool_reserved_at timestamptz);
    create table team_sponsor_contracts(id uuid primary key,team_id uuid,sponsor_offer_id uuid,status text,budget_per_season numeric,contract_duration_seasons int,start_season_id uuid,end_season_id uuid);
    create table sponsor_offers(id uuid primary key,status text,generation_version int);
    create table sponsor_objectives(sponsor_offer_id uuid,status text,is_provisional bool);
    insert into seasons values('${MANAGED_S5_SEASON}','active',5,1);
  `);
  for(const t of identity){
    await db.query('insert into alpha_bot_managers values($1,$2,$3,false,null,null)',[t.manager_id,t.bot_key,t.team_id]);
    await db.query('insert into team_seasons values($1,$2,$3,99000,100000)',[t.team_season_id,t.team_id,MANAGED_S5_SEASON]);
    await db.query("insert into team_finance_transactions values($1,$2,1,-1000,'training','posted','test-posted',now()),($3,$2,7,-2000,'rider_salary','pending','test-pending',now()),($4,$2,7,-3000,'other','cancelled','test-cancelled',now())",[uuid(),t.team_season_id,uuid(),uuid()]);
  }
  const results=await db.exec(createManagedFinanceAuditSql(identity));
  const snapshot=results.find(r=>r.rows?.[0]?.snapshot)?.rows[0].snapshot;
  assert.ok(snapshot);assert.equal(snapshot.teams.length,8);assert.equal(snapshot.bounds.ledger,24);assert.equal(snapshot.bounds.accounts,8);
  for(const t of snapshot.teams){assert.equal(Number(t.posted_total),-1000);assert.equal(Number(t.pending_total),-2000);assert.equal(Number(t.ledger_cash),99000);assert.equal(Number(t.projected_budget),97000);}
  assert.equal(snapshot.contracts.length,0);assert.equal(snapshot.receipts.length,0);assert.equal(snapshot.restored_sponsors.length,0);
  console.log(JSON.stringify({isolated_sql:'passed',teams:8,ledger_rows:24,checks:8,production_touched:false}));
}finally{await db.close();}
