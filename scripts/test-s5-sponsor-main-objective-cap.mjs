// Isolated PostgreSQL/WASM fixtures only. No network or production connection.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isAbsolute } from 'node:path';

const repo = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
const localRequire = createRequire(`${repo}/package.json`);
localRequire('tsx/cjs');
const { calculateSponsorMainObjectiveTerms } = localRequire(`${repo}/lib/game/sponsor-main-objective.ts`);
const pgliteModule = process.argv[2];
if (process.argv.length !== 3 || !pgliteModule || !isAbsolute(pgliteModule) ||
  !pgliteModule.replace(/\\/g, '/').endsWith('/@electric-sql/pglite/dist/index.js')) {
  throw new Error('Pass the absolute local @electric-sql/pglite/dist/index.js module path. Production URLs are unsupported.');
}
const { PGlite } = await import(pathToFileURL(pgliteModule).href);
const migration = await readFile(`${repo}/supabase/migrations/20261026110000_cap_future_sponsor_main_objective_rewards.sql`, 'utf8');
const db = new PGlite();
const id = value => {
  const h = createHash('md5').update(value).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
};
let checks = 0;
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const rows = async (sql, values=[]) => (await db.query(sql, values)).rows;
const scalar = async (sql, values=[]) => Object.values((await rows(sql, values))[0])[0];
const snapshot = async key => (await rows('select cash_reward::float8 as cash, reputation_penalty::float8 as reputation, settlement_status as status from sponsor_main_objective_terms where sponsor_objective_id=$1', [id(`objective-${key}`)]))[0];
const changes = key => scalar('select count(*)::int from term_audit where objective_id=$1', [id(`objective-${key}`)]);

async function fixture(key, { year=5, budget=1034000, cash=460000, reputation=60, rank=1, status='pending', contractBudget=null, contractStatus='active' }={}) {
  await db.query('insert into seasons values($1,$2) on conflict do nothing', [id(`season-${year}`), year]);
  await db.query('insert into sponsor_offers values($1,$2,$3)', [id(`offer-${key}`), id(`season-${year}`), budget]);
  if (contractBudget !== null) await db.query('insert into team_sponsor_contracts values($1,$2,null,$3,$3,\'principal\',$4,$5)', [id(`contract-${key}`),id(`offer-${key}`),id(`season-${year}`),contractStatus,contractBudget]);
  const details = rank === 1 ? { kind:'race_result', achievementType:'win', targetRank:null } : { kind:'race_result', achievementType:'top_n', targetRank:rank };
  await db.query('insert into sponsor_objectives values($1,$2,$3,$4)', [id(`objective-${key}`),id(`offer-${key}`),id(`season-${year}`),JSON.stringify(details)]);
  await db.query('insert into sponsor_main_objective_terms values($1,$2,$3,$4)', [id(`objective-${key}`),cash,reputation,status]);
}

try {
  await db.exec(`
    create schema private;
    create role anon; create role authenticated; create role service_role;
    create table seasons(id uuid primary key,game_year int not null);
    create table sponsor_offers(id uuid primary key,season_id uuid not null,budget_per_season numeric not null);
    create table team_sponsor_contracts(id uuid primary key,sponsor_offer_id uuid unique,pending_sponsor_offer_id uuid,
      objective_season_id uuid,start_season_id uuid not null,role text not null,status text not null,budget_per_season numeric not null);
    create table sponsor_objectives(id uuid primary key,sponsor_offer_id uuid not null references sponsor_offers(id),
      season_id uuid not null references seasons(id),target_details jsonb not null);
    create index on sponsor_objectives(sponsor_offer_id);
    create table sponsor_main_objective_terms(sponsor_objective_id uuid primary key references sponsor_objectives(id),
      cash_reward numeric(14,2) not null check(cash_reward>0),reputation_penalty numeric(12,2) not null check(reputation_penalty>0),
      settlement_status text not null check(settlement_status in('pending','achieved','failed','cancelled')));
    create table term_audit(objective_id uuid,old_cash numeric,new_cash numeric,old_reputation numeric,new_reputation numeric);
    create function private.audit_term() returns trigger language plpgsql as $$ begin
      insert into term_audit values(new.sponsor_objective_id,old.cash_reward,new.cash_reward,old.reputation_penalty,new.reputation_penalty); return new;
    end; $$;
    create trigger fixture_audit after update on sponsor_main_objective_terms for each row execute function private.audit_term();
    create table team_finance_transactions(id uuid primary key,amount numeric);
    create table team_seasons(id uuid primary key,cash_balance numeric);
    insert into team_seasons values('${id('balance')}',1234567);
  `);
  await db.exec(migration);

  for (const year of [1,4]) for (const status of ['pending','achieved','failed','cancelled']) {
    const key = `historical-${year}-${status}`;
    await fixture(key,{year,status});
    const before = await snapshot(key);
    await db.query('update sponsor_offers set budget_per_season=10000 where id=$1',[id(`offer-${key}`)]);
    eq(await snapshot(key),before,`S${year} ${status} remains byte-for-byte identical after budget cut`);
    eq(await changes(key),0,`S${year} budget cut does not even write terms`);
    await db.query('update sponsor_main_objective_terms set cash_reward=cash_reward where sponsor_objective_id=$1',[id(`objective-${key}`)]);
    eq(await snapshot(key),before,`S${year} direct terms update is not capped`);
  }

  const budgets = [0.10,1.4,22.2,99.99,10000,10002.72,10006.8,33333.33,33333.34,40000,100001.01,1034000,10000000];
  for (const year of [5,6]) for (const prestige of [1,4,5]) for (const category of ['national','continental','world','elite']) for (const rank of [1,3,8]) for (const budget of budgets) {
    const key = `parity-${year}-${prestige}-${category}-${rank}-${budget}`;
    const input = {sponsorPrestige:prestige,raceCategoryCode:category,targetRank:rank,annualSponsorBudget:budget};
    const legacy = calculateSponsorMainObjectiveTerms({...input,targetSeasonGameYear:4});
    const expected = calculateSponsorMainObjectiveTerms({...input,targetSeasonGameYear:year});
    await fixture(key,{year,budget,rank,cash:legacy.cashReward,reputation:legacy.reputationPenalty});
    eq(await snapshot(key),{cash:expected.cashReward,reputation:expected.reputationPenalty,status:'pending'},`SQL equals TS for ${key}`);
    // Already-calculated modern clients are not penalized a second time.
    await db.query('update sponsor_main_objective_terms set cash_reward=$2,reputation_penalty=$3 where sponsor_objective_id=$1',[id(`objective-${key}`),expected.cashReward,expected.reputationPenalty]);
    eq(await snapshot(key),{cash:expected.cashReward,reputation:expected.reputationPenalty,status:'pending'},`No double scaling for ${key}`);
  }

  await fixture('offer-cut');
  eq(await snapshot('offer-cut'),{cash:155000,reputation:20,status:'pending'},'Original 460k/60 becomes 155k/20');
  await db.query('update sponsor_offers set budget_per_season=800000 where id=$1',[id('offer-offer-cut')]);
  eq(await snapshot('offer-cut'),{cash:120000,reputation:15,status:'pending'},'Offer decrease proportionally reduces current promise once');
  eq(await changes('offer-cut'),1,'One terms write for the actual cap reduction');
  await db.query('update sponsor_offers set budget_per_season=2000000 where id=$1',[id('offer-offer-cut')]);
  await db.query('update sponsor_offers set budget_per_season=budget_per_season where id=$1',[id('offer-offer-cut')]);
  eq(await snapshot('offer-cut'),{cash:120000,reputation:15,status:'pending'},'Increasing or unchanged budget never raises the reward');
  eq(await changes('offer-cut'),1,'Higher/identical budget performs no terms update');

  await fixture('contract-cut',{contractBudget:1034000});
  await db.query('update team_sponsor_contracts set budget_per_season=800000 where id=$1',[id('contract-contract-cut')]);
  eq(await snapshot('contract-cut'),{cash:120000,reputation:15,status:'pending'},'Actual matching contract overrides its older offer');
  await db.query('update team_sponsor_contracts set budget_per_season=2000000 where id=$1',[id('contract-contract-cut')]);
  eq(await snapshot('contract-cut'),{cash:120000,reputation:15,status:'pending'},'Contract increase does not re-inflate reward');
  eq(await changes('contract-cut'),1,'Contract only writes terms on the decrease');

  for (const status of ['achieved','failed','cancelled']) {
    const key = `settled-${status}`;
    await fixture(key,{status,contractBudget:1034000});
    const before = await snapshot(key);
    await db.query('update sponsor_offers set budget_per_season=10000 where id=$1',[id(`offer-${key}`)]);
    await db.query('update team_sponsor_contracts set budget_per_season=10000 where id=$1',[id(`contract-${key}`)]);
    eq(await snapshot(key),before,`S5 ${status} settlement immutable`);
    eq(await changes(key),0,`S5 ${status} has no terms writes`);
  }

  await fixture('pending-annual',{budget:1200000});
  await db.query('insert into team_sponsor_contracts values($1,$2,$3,$4,$4,\'principal\',\'active\',1000000)',[id('old-annual-contract'),id('offer-historical-4-pending'),id('offer-pending-annual'),id('season-4')]);
  await db.query('update team_sponsor_contracts set budget_per_season=500000 where id=$1',[id('old-annual-contract')]);
  eq(await snapshot('pending-annual'),{cash:180000,reputation:23,status:'pending'},'S4 contract reduction does not leak into S5 pending-offer budget');
  eq(await changes('pending-annual'),0,'Wrong objective-season budget does not cause writes');
  await db.query('update sponsor_offers set budget_per_season=800000 where id=$1',[id('offer-pending-annual')]);
  eq(await snapshot('pending-annual'),{cash:120000,reputation:15,status:'pending'},'Final S5 offer budget caps before activation');
  await db.query('update team_sponsor_contracts set sponsor_offer_id=$2,pending_sponsor_offer_id=null,objective_season_id=$3,budget_per_season=800000 where id=$1',[id('old-annual-contract'),id('offer-pending-annual'),id('season-5')]);
  eq(await snapshot('pending-annual'),{cash:120000,reputation:15,status:'pending'},'Atomic annual activation uses S5 budget and does not double-scale');
  eq(await changes('pending-annual'),1,'Rollover offer/contract updates cause only one actual reduction');

  await fixture('same-budget-source',{year:4,budget:800000});
  await fixture('same-budget-annual',{budget:1200000});
  await db.query('insert into team_sponsor_contracts values($1,$2,$3,$4,$4,\'principal\',\'active\',800000)',[id('same-budget-contract'),id('offer-same-budget-source'),id('offer-same-budget-annual'),id('season-4')]);
  await db.query('update sponsor_offers set budget_per_season=800000 where id=$1',[id('offer-same-budget-annual')]);
  await db.query('update team_sponsor_contracts set sponsor_offer_id=$2,pending_sponsor_offer_id=null,objective_season_id=$3,budget_per_season=800000 where id=$1',[id('same-budget-contract'),id('offer-same-budget-annual'),id('season-5')]);
  eq(await snapshot('same-budget-annual'),{cash:120000,reputation:15,status:'pending'},'Same-budget annual activation is capped by the preceding final-offer update');
  eq(await changes('same-budget-annual'),1,'Same-budget identity switch does not require or cause a second cap write');

  await fixture('planned-renewal',{budget:1200000,contractBudget:1200000,contractStatus:'planned'});
  await db.query('update team_sponsor_contracts set budget_per_season=800000 where id=$1',[id('contract-planned-renewal')]);
  await db.query('update sponsor_offers set budget_per_season=800000 where id=$1',[id('offer-planned-renewal')]);
  eq(await snapshot('planned-renewal'),{cash:120000,reputation:15,status:'pending'},'Planned renewal works in the existing contract-first finalization order');
  eq(await changes('planned-renewal'),1,'Contract-first finalization cannot scale reputation twice');

  for (const badBudget of [0,-1,'NaN','Infinity',0.01]) {
    const key = `invalid-insert-${badBudget}`;
    await assert.rejects(fixture(key,{budget:badBudget}),/budget annuel/); checks++;
    eq(await scalar('select count(*)::int from sponsor_main_objective_terms where sponsor_objective_id=$1',[id(`objective-${key}`)]),0,`Invalid budget ${badBudget} fails closed before inventory terms exist`);
  }
  await fixture('invalid-parent',{contractBudget:1034000});
  const validBefore = await snapshot('invalid-parent');
  await assert.rejects(db.query('update team_sponsor_contracts set budget_per_season=0 where id=$1',[id('contract-invalid-parent')]),/budget annuel/); checks++;
  eq(await scalar('select budget_per_season::int from team_sponsor_contracts where id=$1',[id('contract-invalid-parent')]),1034000,'Invalid contract budget update rolls back atomically');
  eq(await snapshot('invalid-parent'),validBefore,'Failed contract update does not alter recorded terms');
  await fixture('invalid-offer');
  await assert.rejects(db.query('update sponsor_offers set budget_per_season=0 where id=$1',[id('offer-invalid-offer')]),/budget annuel/); checks++;
  eq(await scalar('select budget_per_season::int from sponsor_offers where id=$1',[id('offer-invalid-offer')]),1034000,'Invalid offer budget update rolls back atomically');

  eq(await scalar('select count(*)::int from team_finance_transactions'),0,'Caps never settle objectives or post any finance transactions');
  eq(await scalar('select cash_balance::int from team_seasons where id=$1',[id('balance')]),1234567,'Cash balance untouched by all cap and budget operations');
  eq(await scalar("select has_function_privilege('authenticated','private.cap_sponsor_main_objective_reward()','execute')"),false,'Player role cannot invoke private cap function');
  eq(await scalar("select has_function_privilege('anon','private.recap_sponsor_main_objectives_after_budget_change()','execute')"),false,'Anonymous role cannot invoke private budget relay');

  const auditCount = await scalar('select count(*)::int from term_audit');
  await db.exec(migration);
  eq(await scalar('select count(*)::int from term_audit'),auditCount,'Reinstalling trigger definitions does not backfill or rewrite any commitment');
  console.log(JSON.stringify({checks,source:'isolated PGlite fixtures only',migration:'20261026110000_cap_future_sponsor_main_objective_rewards.sql',result:'passed'}));
} finally {
  await db.close();
}
