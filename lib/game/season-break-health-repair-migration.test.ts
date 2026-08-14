import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260814080000_repair_season_break_health_state.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

describe("season break health repair", () => {
  it("heals injuries before writing the target-season condition", () => {
    const healPosition = migration.indexOf(
      "update public.rider_injuries as injury",
    );
    const conditionPosition = migration.indexOf(
      "insert into public.rider_condition_states",
    );

    expect(healPosition).toBeGreaterThan(-1);
    expect(conditionPosition).toBeGreaterThan(healPosition);
  });

  it("prevents recovered injuries from blocking rest or creating penalties", () => {
    expect(migration).toContain(
      "where injury.rider_id = v_rider.id' || chr(10) ||\n        '          and injury.status = ''active''",
    );
    expect(migration).toContain(
      "where injury.status = ''active''' || chr(10) ||\n        '      and injury.form_loss_per_day > 0",
    );
  });

  it("repairs only untouched rollover rows and stale post-rollover penalties", () => {
    expect(migration).toContain("target_state.source = 'season_break'");
    expect(migration).toContain("target_state.form = 0");
    expect(migration).toContain("target_state.updated_at <= v_settled_at");
    expect(migration).toContain("injury.recovered_at <= effect.applied_at");
  });
});
