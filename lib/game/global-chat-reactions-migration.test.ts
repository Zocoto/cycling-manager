import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260809080000_add_named_global_chat_reactions.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("global chat named reactions migration", () => {
  it("stores one named reaction per director, message and emoji", () => {
    expect(migration).toContain(
      "primary key (message_id, sporting_director_id, emoji)",
    );
    expect(migration).toContain("reactor_display_name text not null");
    expect(migration).toContain("team_display_name text not null");
    expect(migration).toContain(
      "create or replace function public.toggle_global_chat_message_reaction",
    );
    expect(migration).toContain("pg_advisory_xact_lock");
  });

  it("exposes reactions read-only to authenticated realtime clients", () => {
    expect(migration).toContain(
      "create policy global_chat_message_reactions_select_authenticated",
    );
    expect(migration).toContain(
      "add table public.global_chat_message_reactions",
    );
    expect(migration).not.toContain(
      "create policy global_chat_message_reactions_insert",
    );
  });

  it("derives every visible identity field on the server", () => {
    expect(migration).toContain(
      "from public.get_current_global_chat_identity() as identity",
    );
    expect(migration).toContain("v_display_name");
    expect(migration).toContain("v_team_name");
  });
});
