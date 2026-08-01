import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260801102000_save_training_plans_in_bulk.sql",
  ),
  "utf8",
);

describe("bulk training plan migration", () => {
  it("enregistre les programmes via une seule fonction RPC sécurisée", () => {
    expect(migration).toContain(
      "create or replace function public.save_current_rider_training_plans(",
    );
    expect(migration).toContain(
      "grant execute on function public.save_current_rider_training_plans(jsonb) to authenticated",
    );
    expect(migration).toContain("jsonb_array_length(p_plans) not between 1 and 35");
  });

  it("libère les affectations avant de valider la répartition finale", () => {
    const calls = migration.match(/public\.save_current_rider_training_plan\(/g);
    expect(calls).toHaveLength(2);
    expect(migration).toMatch(/v_plan\.domain,\s+null/);
    expect(migration).toContain("where plan.trainer_contract_id is not null");
  });
});
