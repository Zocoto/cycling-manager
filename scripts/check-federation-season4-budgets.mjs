import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// This runner only supports in-memory PGlite. It cannot connect to a live DB.
// Supply an installed @electric-sql/pglite/dist/index.js as the first argument.
const modulePath = process.argv[2];
if (!modulePath) throw new Error("Pass a local PGlite module path; live database URLs are not supported.");
const { PGlite } = await import(pathToFileURL(resolve(modulePath)).href);
const db = new PGlite();
const read = (name) => readFileSync(resolve(name), "utf8");
const extract = (sql, name) => {
  const start = sql.indexOf(`create or replace function public.${name}()`);
  const end = sql.indexOf("\n$$;", start);
  assert.ok(start >= 0 && end > start, `Missing ${name}`);
  return sql.slice(start, end + 4);
};
const scalar = async (sql) => (await db.query(sql)).rows[0].value;
const snapshot = async () => ({
  accounts: (await db.query("select * from public.national_federation_accounts order by id")).rows,
  ledger: (await db.query("select * from public.national_federation_transactions order by id")).rows,
});
const activateSeason = (gameYear) => db.query(`
  update public.seasons
  set status = case when game_year < $1 then 'completed'
                    when game_year = $1 then 'active' else 'planned' end
`, [gameYear]);

async function assertPriorAccountsUnchanged(prior) {
  const current = await snapshot();
  const accountIds = new Set(prior.accounts.map((account) => account.id));
  assert.deepEqual(current.accounts.filter((account) => accountIds.has(account.id)), prior.accounts);
  assert.deepEqual(current.ledger.filter((transaction) => accountIds.has(transaction.account_id)), prior.ledger);
}

async function checkCarryover(gameYear) {
  const { rows } = await db.query(`
    select country.iso_alpha2 as country, target.id as account_id,
           target.opening_balance as annual_budget, target.objective_bonus,
           target.balance, target.carryover_balance,
           source.id as source_account_id, source.season_id as source_season_id,
           source.balance as previous_balance,
           carry.amount as recorded_carryover, carry.day_number, carry.metadata,
           target.opening_balance = totals.annual_grants as annual_budget_matches,
           target.balance = totals.credits as balance_matches_ledger,
           target.balance = target.opening_balance + target.carryover_balance as balance_includes_carryover,
           totals.carryover_count::integer
    from public.national_federation_accounts target
    join public.seasons season on season.id = target.season_id
    join public.countries country on country.id = target.country_id
    left join public.seasons source_season on source_season.game_year = season.game_year - 1
    left join public.national_federation_accounts source
      on source.season_id = source_season.id and source.country_id = target.country_id
    left join public.national_federation_transactions carry
      on carry.account_id = target.id and carry.category = 'season_carryover'
    cross join lateral (
      select sum(transaction.amount) as credits,
             sum(transaction.amount) filter (
               where transaction.category in ('opening_grant', 'objective_bonus')
             ) as annual_grants,
             count(*) filter (where transaction.category = 'season_carryover') as carryover_count
      from public.national_federation_transactions transaction
      where transaction.account_id = target.id
    ) totals
    where season.game_year = $1 order by country.iso_alpha2
  `, [gameYear]);
  assert.equal(rows.length, 25, `S${gameYear} opens exactly one account per eligible country`);
  for (const row of rows) {
    const label = `S${gameYear} ${row.country}`;
    const expected = Number(row.previous_balance ?? 0);
    assert.equal(Number(row.carryover_balance), expected, label);
    assert.equal(row.carryover_count, expected > 0 ? 1 : 0, label);
    assert.equal(row.annual_budget_matches, true, label);
    assert.equal(row.balance_matches_ledger, true, label);
    assert.equal(row.balance_includes_carryover, true, label);
    if (expected > 0) {
      assert.equal(Number(row.recorded_carryover), expected, label);
      assert.equal(row.day_number, 1, label);
      assert.equal(row.metadata.sourceGameYear, gameYear - 1, label);
      assert.equal(row.metadata.sourceSeasonId, row.source_season_id, label);
      assert.equal(row.metadata.sourceAccountId, row.source_account_id, label);
    }
  }
  return rows;
}

try {
  await db.exec(read("supabase/tests/federation-season4-budgets-fixture.sql"));
  // The September Nations Cup migration patches this legacy initializer to
  // use the actual division. Reproduce that production behavior in fixtures.
  const assignmentLookup = `    perform public.seed_nations_cup_assignments_for_season(v_season.id);
    select assignment.division into v_division
    from public.national_federation_nations_cup_assignments as assignment
    where assignment.country_id = v_country.id and assignment.season_id = v_season.id;
`;
  await db.exec(extract(read("supabase/migrations/20260909180000_launch_all_federations.sql"), "initialize_due_national_federation_accounts").replace("    v_average_starters := case", assignmentLookup + "    v_average_starters := case"));
  await db.exec(extract(read("supabase/migrations/20260909194500_credit_previous_federation_objectives.sql"), "credit_previous_federation_objective_bonus"));
  await db.exec("create trigger credit_previous_federation_objective_bonus after insert on public.national_federation_accounts for each row execute function public.credit_previous_federation_objective_bonus();");
  assert.equal(await scalar("select public.initialize_due_national_federation_accounts() as value"), 25);
  const historical = await snapshot();
  await db.exec(read("supabase/migrations/20261005100000_reward_federation_sporting_rank_from_s4.sql"));
  assert.deepEqual(await snapshot(), historical, "Migration must not alter already credited S3 budgets");
  assert.equal(await scalar("select public.initialize_due_national_federation_accounts() as value"), 0);
  assert.deepEqual(await snapshot(), historical, "A scheduler retry must leave existing budgets unchanged");

  const grants = (await db.query(`select season, rank, division,
    public.get_national_federation_ranking_bonus(season, rank, division)::integer as bonus
    from generate_series(2, 5) season cross join generate_series(1, 173) rank cross join generate_series(1, 4) division`)).rows;
  for (const grant of grants) {
    const base = { 1: 450000, 2: 300000, 3: 200000, 4: 120000 }[grant.division];
    const expected = grant.season >= 4 ? Math.round(base / Math.sqrt(grant.rank) / 1000) * 1000 : 0;
    assert.equal(grant.bonus, expected, `SQL/preview parity S${grant.season} D${grant.division} rank ${grant.rank}`);
  }

  await db.exec("update public.seasons set status = case game_year when 4 then 'active' else 'completed' end;");
  assert.equal(await scalar("select public.initialize_due_national_federation_accounts() as value"), 25);
  const openings = (await db.query(`select account.uci_rank as rank, account.nations_cup_division as division,
    account.opening_balance::integer as opening, account.balance::integer as balance,
    account.objective_bonus::integer as objectives, account.source_game_year as source,
    transaction.metadata from public.national_federation_accounts account
    join public.seasons season on season.id = account.season_id
    join public.national_federation_transactions transaction on transaction.account_id = account.id and transaction.category = 'opening_grant'
    where season.game_year = 4 order by account.uci_rank`)).rows;
  assert.equal(openings.length, 25);
  for (const opening of openings) {
    const expectedDivision = opening.rank <= 20 || opening.rank === 25 ? 1 : 2;
    const base = expectedDivision === 1 ? 450000 : 300000;
    const premium = Math.round(base / Math.sqrt(opening.rank) / 1000) * 1000;
    const uci = Math.round((150000 + 850000 * Math.sqrt(1 - (opening.rank - 1) / 172)) / 5000) * 5000;
    const structural = 1200000 + uci + base + premium;
    const rate = opening.rank === 1 ? 0.1 : opening.rank === 2 ? 0.06 : opening.rank === 3 ? 0.03 : 0;
    const objectives = Math.round(structural * rate / 5000) * 5000;
    assert.equal(opening.source, 3);
    assert.equal(opening.division, expectedDivision, "Use the real Nations Cup division, not a division inferred from UCI rank");
    assert.equal(opening.metadata.nationsCupBaseGrant, base);
    assert.equal(opening.metadata.nationRankingBonus, premium);
    assert.equal(opening.metadata.nationsCupGrant, base + premium);
    assert.equal(opening.metadata.budgetGameYear, 4);
    assert.equal(opening.objectives, objectives);
    assert.equal(opening.opening, structural + objectives);
    assert.equal(opening.balance, structural + objectives);
  }
  const settled = await snapshot();
  assert.equal(await scalar("select public.initialize_due_national_federation_accounts() as value"), 0);
  assert.deepEqual(await snapshot(), settled, "S4 retry must not double-credit openings or objective bonuses");
  assert.equal(await scalar("select public.get_national_federation_ranking_bonus(null, null, null)::integer as value"), 0);
  assert.equal(await scalar("select public.get_national_federation_ranking_bonus(4, null, 1)::integer as value"), 34000);
  console.log(`PASS: ${grants.length} SQL/preview grant comparisons; 25 S4 openings; previous objectives; unchanged S3 accounts; idempotent retries.`);

  await db.exec(`
    insert into public.seasons (game_year, status)
    values (5, 'planned'), (6, 'planned'), (7, 'planned');
    insert into public.team_seasons (team_id, season_id, registration_country_id)
    select country.id, season.id, country.id
    from public.countries country cross join public.seasons season
    where season.game_year >= 5
      and (season.game_year <> 5 or country.iso_alpha2 not in ('T3', 'T5'));
    insert into public.test_country_scores (country_id, season_id, uci_points, objectives)
    select score.country_id, season.id, score.uci_points, score.objectives
    from public.test_country_scores score
    join public.seasons original on original.id = score.season_id and original.game_year = 3
    cross join public.seasons season where season.game_year between 4 and 6;
  `);
  await activateSeason(5);
  assert.equal(await scalar("select public.initialize_due_national_federation_accounts() as value"), 23);
  await db.exec(`
    with settled as (
      update public.national_federation_accounts account
      set balance = case country.iso_alpha2 when 'T1' then 123456.78 else 0 end
      from public.countries country, public.seasons season
      where account.country_id = country.id and account.season_id = season.id
        and season.game_year = 5 and country.iso_alpha2 in ('T1', 'T2')
      returning account.id, account.balance - account.opening_balance as spend
    )
    insert into public.national_federation_transactions
      (account_id, day_number, amount, category, description, source_reference, metadata)
    select id, 28, spend, 'infrastructure', 'Closing season expenditure', id::text || ':spend', '{}'::jsonb
    from settled;
  `);
  const beforeMigration = await snapshot();
  await db.exec(read("supabase/migrations/20261108160000_carry_over_federation_balances_from_s6.sql"));
  await assertPriorAccountsUnchanged({
    accounts: beforeMigration.accounts.map((account) => ({ ...account, carryover_balance: "0.00" })),
    ledger: beforeMigration.ledger,
  });

  await db.exec(`
    insert into public.team_seasons (team_id, season_id, registration_country_id)
    select country.id, season.id, country.id
    from public.countries country cross join public.seasons season
    where country.iso_alpha2 = 'T5' and season.game_year = 5;
  `);
  assert.equal(await scalar("select public.initialize_due_national_federation_accounts() as value"), 1);
  assert.equal(await scalar(`
    select count(*)::integer as value from public.national_federation_transactions where category = 'season_carryover'
  `), 0, "No carryover for an S5 account opened after installing the migration");

  const s5 = await snapshot();
  await activateSeason(6);
  assert.equal(await scalar("select public.initialize_due_national_federation_accounts() as value"), 25);
  const s6 = await checkCarryover(6);
  const s6First = s6.find((row) => row.country === "T1");
  assert.equal(Number(s6First.carryover_balance), 123456.78, "S6 carries the amount left after spending, including cents");
  assert.equal(Number(s6First.annual_budget), 3410000, "The new grant and solidarity basis exclude carryover");
  assert.equal(Number(s6First.objective_bonus), 310000, "The objective bonus excludes carryover");
  assert.equal(Number(s6.find((row) => row.country === "T2").previous_balance), 0, "Zero balance fixture");
  assert.equal(s6.find((row) => row.country === "T3").previous_balance, null, "Missing S5 account fixture");
  await assert.rejects(db.query(`
    update public.national_federation_accounts set carryover_balance = -1 where id = $1
  `, [s6First.account_id]), { code: "23514" }, "Negative carryover must fail");
  await assert.rejects(db.query(`
    insert into public.national_federation_transactions
      (account_id, day_number, amount, category, description, source_reference, metadata)
    values ($1, 1, 1, 'unknown_category', 'Invalid category', 'invalid-category', '{}'::jsonb)
  `, [s6First.account_id]), { code: "23514" }, "The ledger category constraint still rejects unknown values");
  await assertPriorAccountsUnchanged(s5);
  const s6Opening = await snapshot();
  assert.equal(await scalar("select public.initialize_due_national_federation_accounts() as value"), 0);
  assert.deepEqual(await snapshot(), s6Opening, "S6 retry leaves balances and ledger unchanged");

  await db.exec(`
    with settled as (
      update public.national_federation_accounts account
      set balance = balance - 78901.23
      from public.countries country, public.seasons season
      where account.country_id = country.id and account.season_id = season.id
        and season.game_year = 6 and country.iso_alpha2 = 'T1'
      returning account.id
    )
    insert into public.national_federation_transactions
      (account_id, day_number, amount, category, description, source_reference, metadata)
    select id, 28, -78901.23, 'infrastructure', 'Closing season expenditure', id::text || ':spend', '{}'::jsonb
    from settled;
  `);
  const s6Closing = await snapshot();
  await activateSeason(7);
  assert.equal(await scalar("select public.initialize_due_national_federation_accounts() as value"), 25);
  const s7 = await checkCarryover(7);
  assert.equal(Number(s7.find((row) => row.country === "T1").carryover_balance), 3454555.55);
  await assertPriorAccountsUnchanged(s6Closing);
  const s7Opening = await snapshot();
  assert.equal(await scalar("select public.initialize_due_national_federation_accounts() as value"), 0);
  assert.deepEqual(await snapshot(), s7Opening, "S7 retry leaves balances and ledger unchanged");
  console.log("PASS: no retroactive changes or S5 carryover; S6 and S7 closing balance carryover; zero and missing sources; separate grants and bonuses; balanced ledger and idempotent retries.");
} finally {
  await db.close();
}
