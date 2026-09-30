import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260927233500_reapply_persistent_rider_morale.sql",
  ),
  "utf8",
);

describe("persistent rider morale migration", () => {
  it("stores morale and its audit trail without expiry or decay", () => {
    expect(migration).toContain("add column if not exists morale");
    expect(migration).toContain("create table public.rider_morale_events");
    expect(migration).toContain("unique (rider_id, source_type, source_reference)");
    expect(migration).toContain("rider_condition_states_inherit_morale");
    expect(migration).not.toMatch(/expires_at|decay_rate|morale_decay/i);
  });

  it("applies results, injuries, overload and mixed-zone choices", () => {
    expect(migration).toContain("apply_stage_result_morale");
    expect(migration).toContain("apply_race_result_morale");
    expect(migration).toContain("apply_injury_morale");
    expect(migration).toContain("apply_training_overload_morale");
    expect(migration).toContain("riderMoraleDelta");
    expect(migration).toContain("post_race_interviews_apply_morale");
  });

  it("supports academy riders and carries morale into the pro roster", () => {
    expect(migration).toContain("create table public.youth_rider_morale_events");
    expect(migration).toContain("apply_development_result_morale");
    expect(migration).toContain("settle_due_youth_rider_morale");
    expect(migration).toContain("carry_youth_morale_to_professional");
    expect(migration).toContain("'academy_promotion'");
    expect(migration).toContain("'Centre de formation — ' || youth_event.description");
  });
});
