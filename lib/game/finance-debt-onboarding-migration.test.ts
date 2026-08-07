import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260807103000_fix_finance_debt_onboarding.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("finance debt onboarding migration", () => {
  it("mémorise le début de responsabilité financière de la carrière", () => {
    expect(migration).toContain("finance_start_day_number smallint not null default 1");
    expect(migration).toContain("create trigger initial_career_finance_start");
    expect(migration).toContain(
      "v_checkpoint <= v_context.finance_start_day_number",
    );
  });

  it("annule les échéances antérieures à la carrière ou au contrat", () => {
    expect(migration).toContain("guard_retroactive_salary_installment");
    expect(migration).toContain("rider-salary|staff-contract");
    expect(migration).toContain(
      "new.day_number <= greatest(v_finance_start_day, v_contract_start_day)",
    );
    expect(migration).toContain("new.status := 'cancelled'");
  });

  it("résout une alerte au premier contrôle positif sans nouvelle pénalité", () => {
    expect(migration).toContain("resolved_checkpoint_day_number = v_checkpoint");
    expect(migration).toContain("if v_checkpoint_balance >= 0 then");
    expect(migration).toContain("and resolved_at is null");
  });

  it("restitue les points retirés par une alerte recalculée à tort", () => {
    expect(migration).toContain(
      "director.reputation_points + refunds.points",
    );
    expect(migration).toContain(
      "repair.previous_penalty > repair.corrected_penalty",
    );
  });
});
