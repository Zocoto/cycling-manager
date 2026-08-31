import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260831064500_add_manual_youth_training_dashboard_alert.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("manual youth training dashboard migration", () => {
  it("counts only active manual juniors without a session in the current slot", () => {
    expect(migration).toContain("'juniorManualTrainingDueCount'");
    expect(migration).toContain("academy.status in ('active', 'recruited')");
    expect(migration).toContain("academy.training_mode = 'manual'");
    expect(migration).toContain("not exists (");
    expect(migration).toContain(
      "session.season_day_id = context.season_day_id",
    );
    expect(migration).toContain("session.season_id = context.season_id");
  });

  it("uses the Paris morning and evening cut-off used by manual training", () => {
    expect(migration).toContain("'juniorManualTrainingSlot'");
    expect(migration).toContain("time zone 'Europe/Paris'");
    expect(migration).toContain("then 'manual_am'");
    expect(migration).toContain("else 'manual_pm'");
  });
});
