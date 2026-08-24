import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260821170000_consolidate_database_workload.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const settlementService = readFileSync(
  join(process.cwd(), "services/game-state-settlement.ts"),
  "utf8",
);
const maintenanceMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260824052000_move_rider_state_settlement_off_page_reads.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const maintenanceRoute = readFileSync(
  join(process.cwd(), "app/api/cron/rider-state-maintenance/route.ts"),
  "utf8",
);
const vercelConfig = readFileSync(
  join(process.cwd(), "vercel.json"),
  "utf8",
);
const interactiveReaders = [
  "services/public-rider-profile.ts",
  "services/team-health.ts",
  "services/team-training.ts",
  "services/rider-season-planning.ts",
  "services/team-race-reconnaissance.ts",
  "services/race-calendar.ts",
].map((path) => readFileSync(join(process.cwd(), path), "utf8"));

describe("database workload consolidation", () => {
  it("rate-limits global rider settlements without exposing the throttle table", () => {
    expect(migration).toContain("create table if not exists public.game_settlement_throttles");
    expect(migration).toContain("interval '1 minute'");
    expect(migration).toContain("settle_due_training_sessions_throttled()");
    expect(migration).toContain("settle_current_health_and_form_throttled()");
    expect(migration).toContain(
      "revoke all on table public.game_settlement_throttles\n  from public, anon, authenticated",
    );
  });

  it("moves the global rider settlement outside interactive page reads", () => {
    expect(migration).toContain("settle_current_rider_state_throttled()");
    expect(maintenanceMigration).toContain(
      "settle_current_rider_state_for_maintenance()",
    );
    expect(maintenanceMigration).toContain("set statement_timeout = '240s'");
    expect(maintenanceMigration).toContain("last_completed_day_number");
    expect(settlementService).toContain(
      '"settle_current_rider_state_for_maintenance"',
    );
    expect(maintenanceRoute).toContain(
      "settleCurrentRiderStateForMaintenance()",
    );
    expect(vercelConfig).toContain(
      '"path": "/api/cron/rider-state-maintenance"',
    );
    expect(vercelConfig).toContain('"schedule": "*/5 * * * *"');
    for (const reader of interactiveReaders) {
      expect(reader).not.toContain('@/services/game-state-settlement');
      expect(reader).not.toContain('rpc("settle_current_health_and_form")');
      expect(reader).not.toContain('rpc("settle_due_training_sessions")');
    }
  });

  it("loads all header indicators with one authenticated function", () => {
    expect(migration).toContain(
      "create or replace function public.get_current_game_header_indicators()",
    );
    expect(migration).toContain(
      "public.get_current_director_unread_message_count()",
    );
    expect(migration).toContain("public.has_unread_global_chat_messages()");
    expect(migration).toContain("public.has_unread_cyclogazette_editions()");
    expect(migration).toContain("to authenticated, service_role");
  });

  it("calculates each objective metric only once per summary", () => {
    expect(migration).toContain(
      "create or replace function public.get_current_game_objectives()",
    );
    expect(migration).toContain("metric_keys as materialized");
    expect(migration).toContain("metric_progress as materialized");
    expect(migration).toContain(
      "join metric_progress as progress\n    on progress.metric_key = definition.metric_key",
    );
  });
});
