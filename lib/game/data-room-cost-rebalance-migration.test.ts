import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260830110000_rebalance_data_room_costs.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("Data Room cost rebalance migration", () => {
  it("charges 200 k€ for the first level", () => {
    expect(migration).toContain(
      "when 'recruitment_data_room' then\n      v_base_cost := 200000;",
    );
  });

  it("keeps the shared level-two and level-three upgrade ratios", () => {
    expect(migration).toContain("when 2 then 0.6");
    expect(migration).toContain("when 3 then 0.7");
  });

  it("preserves architect reductions after the base cost is calculated", () => {
    const dataRoomCost = migration.indexOf("v_base_cost := 200000;");
    const sharedScale = migration.indexOf("v_base_cost := round(");
    const architectReduction = migration.indexOf(
      "v_final_cost := round(v_base_cost * (1 - v_cost_reduction / 100.0));",
    );

    expect(dataRoomCost).toBeGreaterThan(-1);
    expect(sharedScale).toBeGreaterThan(dataRoomCost);
    expect(architectReduction).toBeGreaterThan(sharedScale);
  });
});
