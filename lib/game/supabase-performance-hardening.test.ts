import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260824113000_harden_header_and_dashboard_performance.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const headerService = readFileSync(
  join(process.cwd(), "services/game-header-data.ts"),
  "utf8",
);

describe("Supabase performance hardening", () => {
  it("closes the legacy header snapshot and migrates the server caller", () => {
    expect(migration).toContain(
      "create or replace function public.get_current_game_header_identity()",
    );
    expect(migration).toContain(
      "revoke all on function public.get_current_game_header_snapshot()",
    );
    expect(headerService).toContain(
      '.rpc("get_current_game_header_identity")',
    );
    expect(headerService).not.toContain(
      '.rpc("get_current_game_header_snapshot")',
    );
  });

  it("keeps every global rider settlement outside authenticated traffic", () => {
    for (const settlement of [
      "settle_due_training_sessions()",
      "settle_current_health_and_form()",
      "settle_current_rider_state_throttled()",
      "settle_current_rider_state_for_maintenance()",
    ]) {
      expect(migration).toContain(
        `revoke execute on function public.${settlement}\n  from public, anon, authenticated`,
      );
    }
  });

  it("caches only dashboard objective counters and invalidates claims", () => {
    expect(migration).toContain(
      "create table if not exists public.game_objective_summary_cache",
    );
    expect(migration).toContain("interval '60 seconds'");
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).toContain(
      "invalidate_game_objective_summary_cache_on_claim",
    );
    expect(migration).toContain(
      "from public.get_current_game_objective_summary_cached() as summary",
    );
  });
});
