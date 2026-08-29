import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260829120000_gate_training_throttle_at_daily_cutoff.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("professional training cutoff throttle", () => {
  it("claims the latest cutoff-eligible day instead of the raw season day", () => {
    expect(migration).toContain("v_due_day_number integer");
    expect(migration).toContain("time '08:00'");
    expect(migration).toContain("at time zone 'Europe/Paris'");
    expect(migration).toContain(
      "throttle.last_completed_day_number < v_due_day_number",
    );
    expect(migration).toContain(
      "last_completed_day_number = v_due_day_number",
    );
  });

  it("re-arms the idempotent settlement to catch up today's missing sessions", () => {
    expect(migration).toContain("last_completed_season_id = null");
    expect(migration).toContain("last_completed_day_number = null");
    expect(migration).toContain(
      "from public.settle_due_training_sessions() as settlement",
    );
  });

  it("keeps the maintenance entry point restricted to the service role", () => {
    expect(migration).toContain(
      "from public, anon, authenticated",
    );
    expect(migration).toContain("to service_role");
  });
});
