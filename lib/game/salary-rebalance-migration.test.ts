import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260727213000_rebalance_rider_and_staff_salaries.sql",
  ),
  "utf8",
);

describe("salary rebalance migration", () => {
  it("applique une courbe coureur plus exigeante sans salaire professionnel nul", () => {
    expect(migration).toContain("least(\n        400000,");
    expect(migration).toContain(") * 240000");
    expect(migration).not.toContain("v_overall < 60");
    expect(migration).toContain(
      "public.calculate_rider_season_salary(\n    p_rider_id,\n    v_next_season_id",
    );
  });

  it("rend les cinq étoiles rares à financer et revalorise leurs promotions", () => {
    expect(migration).toContain(
      "array[1.00, 1.50, 2.20, 3.30, 5.00]::numeric[]",
    );
    expect(migration).toContain(
      "array[0.15, 0.20, 0.30, 0.45, 0.65]::numeric[]",
    );
    expect(migration).toContain(
      "create trigger staff_progression_reprices_contract",
    );
  });

  it("préserve les échéances déjà payées en ne changeant que le contrat", () => {
    expect(migration).toContain("update public.staff_contracts as contract");
    expect(migration).not.toContain("set status = 'pending'");
  });
});
