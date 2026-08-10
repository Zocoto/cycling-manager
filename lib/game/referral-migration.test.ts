import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260810123000_create_referral_program.sql",
  ),
  "utf8",
);

describe("referral program migration", () => {
  it("attribue une seule fois chaque inscription et interdit l’auto-parrainage", () => {
    expect(migration).toContain("referred_director_id uuid unique");
    expect(migration).toContain("sporting_director_referrals_not_self");
    expect(migration).toContain("on conflict (referred_director_id) do nothing");
  });

  it("qualifie le filleul après le Critérium de la découverte", () => {
    expect(migration).toContain("qualify_referral_after_criterium");
    expect(migration).toContain("new.tutorial_key <> 'criterium-discovery'");
    expect(migration).toContain("status = 'qualified'");
  });

  it("verse les cinq paliers dans l’inventaire existant", () => {
    for (const count of [1, 3, 5, 10, 25]) {
      expect(migration).toContain(`(${count},`);
    }
    expect(migration).toContain("source_referral_reward_id");
    expect(migration).toContain("daily_reward_inventory_exactly_one_source");
    expect(migration).toContain("pg_advisory_xact_lock");
  });
});
