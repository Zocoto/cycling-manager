import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260922150000_cap_high_performance_cell_rating.sql",
  ),
  "utf8",
);

describe("plafond de la Cellule haute performance", () => {
  it("annonce et stocke la limite à 80", () => {
    expect(migration).toContain("reward_key = 'high-performance-cell'");
    expect(migration).toContain("'{maximumRating}'");
    expect(migration).toContain("maximum 80");
  });

  it("bloque atomiquement un bonus qui dépasserait la limite", () => {
    expect(migration).toContain(
      "v_current_rating + v_reward.amount > v_reward.maximum_rating",
    );
    expect(migration).toContain(
      "redeem_current_daily_reward_without_high_performance_cap",
    );
    expect(migration).toContain("v_reward.maximum_rating - v_reward.amount");
  });
});
