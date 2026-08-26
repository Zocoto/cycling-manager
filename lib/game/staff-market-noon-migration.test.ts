import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260826090000_add_noon_staff_market_wave.sql",
  ),
  "utf8",
).toLowerCase();

describe("migration de la seconde vague du marché du staff", () => {
  it("étend le marché quotidien à cinquante emplacements", () => {
    expect(migration).toContain("staff_count in (25, 50)");
    expect(migration).toContain("daily_slot between 1 and 50");
  });

  it("ajoute vingt-cinq profils dans les emplacements 26 à 50", () => {
    expect(migration).toContain(
      "create or replace function public.append_daily_staff_market",
    );
    expect(migration).toContain("v_slot integer := 25");
    expect(migration).toContain("jsonb_array_length(p_candidates) <> 25");
    expect(migration).toContain("set staff_count = 50");
  });

  it("verrouille la vague et la rend idempotente", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("if v_existing_count >= 50 then");
    expect(migration).toContain("if v_existing_count <> 25 then");
    expect(migration).toContain("to service_role");
  });
});
