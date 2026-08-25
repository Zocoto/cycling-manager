import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260825141000_rebalance_equipment_rnd_duration_and_cap.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("equipment R&D duration and bonus ceiling migration", () => {
  it("sets the +5, +6 and +10 duration milestones", () => {
    expect(migration).toContain("when value <= 6 then value * 2");
    expect(migration).toContain(
      "else least(28, 12 + (value - 6) * 4)",
    );
  });

  it("rejects a new project when its input already reached +10", () => {
    expect(migration).toContain("enforce_equipment_rnd_bonus_cap");
    expect(migration).toContain("coalesce(v_bonus_total, 0) >= 10");
    expect(migration).toContain("plafond R&D de +10");
  });

  it("clamps exceptional outcomes and recalculates active projects", () => {
    expect(migration).toContain(
      "v_delta := least(v_delta, greatest(0, 10 - v_bonus_total));",
    );
    expect(migration).toContain("where project.status = 'active'");
    expect(migration).toContain(
      "project.starts_game_day_index + recalculated.duration_days",
    );
  });
});
