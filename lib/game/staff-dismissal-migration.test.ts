import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260729100000_dismiss_staff_with_compensation.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("staff dismissal migration", () => {
  it("sécurise et expose uniquement le RPC de licenciement attendu", () => {
    expect(migration).toContain(
      "create or replace function public.dismiss_current_team_staff",
    );
    expect(migration).toContain("security definer\nset search_path = ''");
    expect(migration).toContain("to authenticated;");
  });

  it("facture le solde courant et une saison supplémentaire", () => {
    expect(migration).toContain(
      "v_current_remaining + v_contract.salary_per_season",
    );
    expect(migration).toContain("'staff-dismissal:'");
    expect(migration).toContain("termination_compensation = v_compensation");
  });

  it("désactive les dépendances qui ne doivent pas survivre au contrat", () => {
    expect(migration).toContain("update public.staff_rider_assignments");
    expect(migration).toContain("update public.youth_scouting_missions");
    expect(migration).toContain("update public.staff_academy_trainings");
  });
});
