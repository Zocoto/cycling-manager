import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260912164723_repair_annual_sponsor_budgets.sql",
  ),
  "utf8",
);

describe("annual sponsor budget rollover repair migration", () => {
  it("applique satisfaction puis ambition aux programmes automatiques", () => {
    expect(migration).toContain(
      "private.finalize_continuing_sponsor_offer_budget",
    );
    expect(migration).toContain(
      "(v_context.satisfaction_score - 50) / 2.0",
    );
    expect(migration).toContain(
      "(v_context.satisfaction_score - 50) / 5.0",
    );
    expect(migration).toContain(
      "perform private.finalize_continuing_sponsor_offer_budget(v_contract.id, v_target.id)",
    );
    expect(migration).toContain("when 'accessible' then round");
    expect(migration).toContain("when 'ambitious' then round");
  });

  it("archive les budgets annuels et protège les échéances déjà postées", () => {
    expect(migration).toContain(
      "insert into public.sponsor_annual_objective_history",
    );
    expect(migration).toContain(
      "annual_history.budget_per_season",
    );
    expect(migration).toMatch(
      /when team_finance_transactions\.status = 'posted'[\s\S]*then team_finance_transactions\.amount/,
    );
    expect(migration).toContain(
      "create temporary table sponsor_installment_cash_delta",
    );
  });

  it("répare contrats, offres, saisons, échéances et conserve un audit", () => {
    expect(migration).toContain(
      "create table if not exists public.sponsor_annual_budget_repair_audit",
    );
    expect(migration).toContain(
      "update public.team_sponsor_contracts as contract",
    );
    expect(migration).toContain("update public.sponsor_offers as offer");
    expect(migration).toContain("update public.team_seasons as team_season");
    expect(migration).toContain(
      "update public.team_finance_transactions as transaction",
    );
    expect(migration).toContain("Réparation sponsor incomplète");
    expect(migration).toContain(
      "Au moins un budget annuel sponsor reste incohérent après réparation",
    );
  });
});
