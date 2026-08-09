import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260809110000_reduce_staff_dismissal_compensation.sql",
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

  it("facture uniquement les échéances restantes de la saison active", () => {
    expect(migration).toContain(
      "v_compensation := round(v_current_remaining, 2);",
    );
    expect(migration).not.toContain(
      "v_current_remaining + v_contract.salary_per_season",
    );
    expect(migration).toContain("if v_compensation > 0 then");
    expect(migration).toContain("'staff-dismissal:'");
    expect(migration).toContain("termination_compensation = v_compensation");
  });

  it("désactive les dépendances qui ne doivent pas survivre au contrat", () => {
    expect(migration).toContain("update public.staff_rider_assignments");
    expect(migration).toContain("update public.youth_scouting_missions");
    expect(migration).toContain("update public.staff_academy_trainings");
  });
});
