import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260801110000_create_daily_rewards.sql",
  ),
  "utf8",
);

describe("daily rewards migration", () => {
  it("enforces one atomic claim per director and season day", () => {
    expect(migration).toContain("daily_reward_claims_one_per_day");
    expect(migration).toContain("claim_current_daily_reward");
    expect(migration).toContain("pg_advisory_xact_lock");
  });

  it("contains the validated endgame rewards without the duplicate legendary gift", () => {
    expect(migration).toContain("'historic-training'");
    expect(migration).toContain("'{\"multiplier\":3}'");
    expect(migration).toContain("'high-performance-cell'");
    expect(migration).toContain("'{\"amount\":2,\"statScope\":\"primary\"}'");
    expect(migration).toContain("'talent-revealed'");
    expect(migration).not.toContain("don-legendaire");
  });

  it("wires temporary effects to training, scouting and Elite registration", () => {
    expect(migration).toContain(
      "get_daily_reward_training_multiplier_for_session",
    );
    expect(migration).toContain("daily_reward_wildcard_reservations");
    expect(migration).toContain("apply_daily_reward_wildcard_registration");
  });
});
