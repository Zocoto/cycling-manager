import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260927210000_add_rider_physiology_and_weight_management.sql",
  ),
  "utf8",
);

describe("rider physiology migration", () => {
  it("neutralizes existing riders while activating future generation", () => {
    expect(migration).toContain("physiology_version = 0");
    expect(migration).toContain("physiology_version = 1");
    expect(migration).toContain("assign_new_professional_physiology_after_rating");
    expect(migration).toContain("copy_promoted_youth_physiology_after_update");
  });

  it("supports varied junior growth without exposing a public target", () => {
    expect(migration).toContain("'early_stop'");
    expect(migration).toContain("'late_spurt'");
    expect(migration).toContain("get_youth_current_height_cm");
  });

  it("enforces the adjustable five-day weight-cut program", () => {
    expect(migration).toContain(
      "p_weight_loss_kg not in (0.2, 0.4, 0.6, 0.8, 1.0)",
    );
    expect(migration).toContain("v_form_cost := p_weight_loss_kg * 20");
    expect(migration).toContain("event.game_day_index > v_game_day - 5");
  });

  it("records supplement and weight-cut changes", () => {
    expect(migration).toContain("create table public.rider_weight_events");
    expect(migration).toContain("apply_supplement_weight_risk_before_insert");
    expect(migration).toContain("source in ('supplement', 'weight_cut')");
  });
});
