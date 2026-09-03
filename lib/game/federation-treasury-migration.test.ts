import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260903234500_create_federation_treasury.sql",
  ),
  "utf8",
);

describe("federation treasury migration", () => {
  it("creates a durable account and an immutable financial ledger", () => {
    expect(migration).toContain("create table public.national_federation_accounts");
    expect(migration).toContain("create table public.national_federation_transactions");
    expect(migration).toContain("balance >= 0");
    expect(migration).toContain("source_reference text not null unique");
  });

  it("derives the S3 opening budget from S2 UCI points and real race activity", () => {
    expect(migration).toContain("get_national_championship_country_rankings(v_previous_season_id)");
    expect(migration).toContain("stage.status = 'completed'");
    expect(migration).toContain("1200000 + v_uci_grant + v_nations_grant + v_race_revenue");
    expect(migration).toContain("'completedRaceDays', v_completed_days");
  });

  it("debits team donations atomically and prevents uncovered solidarity", () => {
    expect(migration).toContain("set cash_balance = cash_balance - v_amount");
    expect(migration).toContain("set balance = balance + v_amount");
    expect(migration).toContain("if v_total > v_account.balance then");
    expect(migration).toContain("Le fonds de solidarité de cette saison a déjà été versé");
  });

  it("keeps all production writes locked until S3 and serialized", () => {
    expect(migration).toContain("v_season.game_year < 3");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("set statement_timeout = '15s'");
    expect(migration).toContain("<> 'BE'");
  });
});
