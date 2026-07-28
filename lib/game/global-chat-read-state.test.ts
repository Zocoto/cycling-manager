import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260728120000_add_global_chat_read_receipts.sql",
  ),
  "utf8",
);

describe("global chat read receipts migration", () => {
  it("stores one durable read receipt per sporting director", () => {
    expect(migration).toContain(
      "create table public.global_chat_read_receipts",
    );
    expect(migration).toContain(
      "sporting_director_id uuid primary key",
    );
    expect(migration).toContain("last_read_at timestamptz not null");
  });

  it("ignores the current director's own messages", () => {
    expect(migration).toContain(
      "message.sporting_director_id <>",
    );
    expect(migration).toContain(
      "current_director.sporting_director_id",
    );
  });

  it("keeps reads and writes behind authenticated secured functions", () => {
    expect(migration).toContain(
      "create or replace function public.has_unread_global_chat_messages()",
    );
    expect(migration).toContain(
      "create or replace function public.mark_global_chat_messages_read(",
    );
    expect(migration).toContain(
      "security definer\nset search_path = ''",
    );
    expect(migration).toContain(
      "to authenticated, service_role",
    );
  });
});
