import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260801120000_add_global_chat_replies_and_reactions.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("global chat interaction migration", () => {
  it("stores durable reply snapshots through a secured RPC", () => {
    expect(migration).toContain("reply_to_message_id uuid");
    expect(migration).toContain("reply_to_author_display_name text");
    expect(migration).toContain("reply_to_message_excerpt text");
    expect(migration).toContain(
      "create or replace function public.post_global_chat_message_v2",
    );
    expect(migration).toContain("security definer\nset search_path = ''");
    expect(migration).toContain(
      "Le message auquel vous répondez n’existe plus.",
    );
  });

  it("keeps one reaction per director, message and emoji", () => {
    expect(migration).toContain(
      "primary key (message_id, sporting_director_id, emoji)",
    );
    expect(migration).toContain(
      "create or replace function public.toggle_global_chat_message_reaction",
    );
    expect(migration).toContain(
      "if p_emoji is null or p_emoji not in (",
    );
    expect(migration).toContain("pg_advisory_xact_lock");
  });

  it("exposes reactions as authenticated realtime data", () => {
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
});
