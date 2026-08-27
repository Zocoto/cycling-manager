import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260827080000_allow_free_mutual_dismissals_in_debt.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("licenciements gratuits en trésorerie négative", () => {
  it("couvre les coureurs, le staff et les juniors côté base", () => {
    expect(migration).toContain("public.dismiss_current_team_rider");
    expect(migration).toContain("public.dismiss_current_team_staff");
    expect(migration).toContain("public.dismiss_current_team_youth_rider");
  });

  it("verrouille le solde et réserve la gratuité aux soldes strictement négatifs", () => {
    expect(migration.match(/where team_season\.id = v_context\.team_season_id\n  for update;/g))
      .toHaveLength(3);
    expect(migration.match(/v_cash_balance < 0/g)).toHaveLength(3);
    expect(migration).toContain("when v_cash_balance < 0 then 0");
    expect(migration.match(/when v_mutual_agreement then 0/g)).toHaveLength(2);
  });

  it("n’écrit aucune transaction financière de montant nul", () => {
    expect(migration.match(/if v_compensation > 0 then/g)).toHaveLength(2);
    expect(migration).toContain("if v_tuition_cost > 0 then");
  });

  it("renvoie au client le mode appliqué pour les coureurs et juniors", () => {
    expect(migration.match(/'mutualAgreement', v_mutual_agreement/g))
      .toHaveLength(2);
  });
});
