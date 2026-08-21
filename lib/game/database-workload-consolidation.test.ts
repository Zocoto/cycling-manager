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

  it("groups training and health settlement behind one server RPC", () => {
    expect(migration).toContain("settle_current_rider_state_throttled()");
    expect(settlementService).toContain(
      'admin.rpc("settle_current_rider_state_throttled")',
    );
    expect(settlementService).toContain("cache(async ()");
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
