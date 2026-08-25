import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260825120000_create_direct_messages.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("direct messages migration", () => {
  it("keeps private data separate and participant-only", () => {
    expect(migration).toContain("create table public.direct_conversations");
    expect(migration).toContain("create table public.direct_messages");
    expect(migration).toContain("create policy direct_messages_select_participant");
    expect(migration).toContain(
      "viewer.id in (\n        direct_messages.sender_id,\n        direct_messages.recipient_id",
    );
    expect(migration).not.toContain("grant insert on table public.direct_messages");
  });

  it("uses indexed cursors and pre-calculated unread counts", () => {
    expect(migration).toContain(
      "direct_conversation_states_director_activity_idx",
    );
    expect(migration).toContain(
      "direct_messages_conversation_created_idx",
    );
    expect(migration).toContain("unread_count = public.direct_conversation_states.unread_count + 1");
    expect(migration).toContain("get_current_unread_direct_message_count()");
    expect(migration).not.toContain("count(*)\n  from public.direct_messages");
  });

  it("serializes sends, rate-limits writers and filters realtime delivery", () => {
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).toContain("interval '1 second'");
    expect(migration).toContain("interval '1 minute'");
    expect(migration).toContain("add table public.direct_messages");
    expect(migration).toContain("get_current_game_header_indicators_v2()");
  });
});
