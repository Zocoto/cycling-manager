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
} finally {
  await db.close();
}
