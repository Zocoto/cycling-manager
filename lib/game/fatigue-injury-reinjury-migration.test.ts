import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260728130000_prevent_fatigue_reinjury_during_active_injury.sql",
  ),
  "utf8",
);

describe("fatigue injury reinjury migration", () => {
  it("ignore la fatigue lorsqu’une autre blessure est active", () => {
    const activeInjuryGuard = migration.indexOf(
      "-- Une baisse de forme provoquee pendant une convalescence",
    );
    const fatigueInjuryInsert = migration.indexOf(
      "insert into public.rider_injuries",
    );

    expect(activeInjuryGuard).toBeGreaterThan(-1);
    expect(fatigueInjuryInsert).toBeGreaterThan(activeInjuryGuard);

    const activeInjuryGuardSql = migration.slice(
      activeInjuryGuard,
      fatigueInjuryInsert,
    );
    expect(activeInjuryGuardSql).toContain("if exists (");
    expect(activeInjuryGuardSql).toContain("and injury.status = 'active'");
    expect(activeInjuryGuardSql).toContain(
      "and injury.started_at <= v_started_at",
    );
    expect(activeInjuryGuardSql).toContain(
      "and injury.expected_recovery_at > v_started_at",
    );
    expect(activeInjuryGuardSql).toContain("return null;");
  });
  it("conserve la blessure de fatigue pour un coureur disponible", () => {
    expect(migration).toContain("if p_attempted_form >= 0 then");
    expect(migration).toContain("'fatigue_exhaustion'");
    expect(migration).toContain("v_started_at + interval '3 days'");
    expect(migration).toContain("return v_injury_id;");
  });
});
