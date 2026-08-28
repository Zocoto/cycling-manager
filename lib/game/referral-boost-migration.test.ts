import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260828150000_boost_referrals_and_unlock_patron_hat.sql",
  ),
  "utf8",
);

describe("boosted referral programme", () => {
  it("qualifies a referral at signup without requiring the tutorial", () => {
    expect(migration).toContain("qualify_referral_after_signup");
    expect(migration).toContain(
      "after insert on public.sporting_director_referrals",
    );
    expect(migration).toContain(
      "drop trigger if exists qualify_referral_after_criterium",
    );
    expect(migration).not.toContain("new.tutorial_key");
    expect(migration).toContain("where status = 'registered'");
  });

  it("upgrades every inventory milestone to a premium reward", () => {
    expect(migration).toContain("(1, 'premium-equipment'::text)");
    expect(migration).toContain("(3, 'primary-breakthrough'::text)");
    expect(migration).toContain("(5, 'talent-revealed-plus'::text)");
    expect(migration).toContain("(10, 'staff-expertise-badge'::text)");
    expect(migration).toContain("(25, 'high-performance-cell'::text)");
    expect(migration).toContain(
      "where daily_reward_inventory.status = 'available'",
    );
  });

  it("makes the career bonuses meaningful and unlocks the hat at 25", () => {
    expect(migration).toContain("when 'referral_qualified_1' then 75000");
    expect(migration).toContain("when 'referral_qualified_5' then 350000");
    expect(migration).toContain("when 'referral_qualified_25' then 2000000");
    expect(migration).toContain(
      "'patronHatUnlocked', v_qualified_count >= 25",
    );
  });
});
