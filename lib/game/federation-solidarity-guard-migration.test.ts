import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260912123000_guard_and_repair_federation_solidarity.sql",
  ),
  "utf8",
);

describe("federation solidarity guard migration", () => {
  it("excludes the president team and caps each other team at 100k per season", () => {
    expect(migration).toContain("v_amount > 100000");
    expect(migration).toContain("team_season.team_id <> v_identity.team_id");
    expect(migration).toContain(
      "100000::numeric - coalesce(received.amount, 0)",
    );
    expect(migration).toContain(
      "transaction.source_reference like 'federation-solidarity:%'",
    );
    expect(migration).toContain("'presidentTeamExcluded', true");
  });

  it("reverses only self-grants posted on 11 and 12 September in Paris", () => {
    expect(migration).toContain(
      "plan.executed_at >= timestamptz '2026-09-10 22:00:00+00'",
    );
    expect(migration).toContain(
      "plan.executed_at < timestamptz '2026-09-12 22:00:00+00'",
    );
    expect(migration).toContain("assignment.team_id = team_season.team_id");
    expect(migration).toContain("set cash_balance = team_season.cash_balance - correction.amount");
    expect(migration).toContain("set balance = account.balance + correction.restored_amount");
    expect(migration).toContain("federation-solidarity-reversal:");
    expect(migration).toContain("president-own-team-ineligible");
  });
});
