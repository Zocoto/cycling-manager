import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260814071000_repair_active_sponsor_objective_sets.sql",
  ),
  "utf8",
);
const service = readFileSync(
  resolve(process.cwd(), "services/persisted-sponsor-objectives.ts"),
  "utf8",
);

describe("S2 sponsor objective repair", () => {
  it("completes only current active contract sets with neutral objectives", () => {
    expect(migration).toContain("season.status = 'active'");
    expect(migration).toContain("contract.status in ('active', 'terminated')");
    expect(migration).toContain("generate_series(1, 10)");
    expect(migration).toContain("'cancelled'");
    expect(migration).toMatch(/renewal_bonus_percent,[\s\S]*?0,[\s\n]+0,[\s\n]+true,/);
  });

  it("accepts zero satisfaction only for cancelled objectives", () => {
    expect(service).toContain(
      'objectiveRow.status === "cancelled" ? 0 : 1',
    );
    expect(service).toContain("satisfactionPoints < minimumSatisfactionPoints");
  });

  it("gives concurrent inserts enough time to become visible", () => {
    expect(service).toContain("OBJECTIVE_COMPLETION_ATTEMPTS = 8");
    expect(service).toContain("OBJECTIVE_COMPLETION_RETRY_DELAY_MS = 125");
  });
});
