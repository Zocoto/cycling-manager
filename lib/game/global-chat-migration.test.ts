import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260727220000_create_global_game_chat.sql",
  ),
  "utf8",
);

describe("global chat migration", () => {
  it("keeps reads authenticated and writes behind the secured RPC", () => {
    expect(migration).toContain(
      "create policy global_chat_messages_select_authenticated",
    );
    expect(migration).not.toContain(
      "create policy global_chat_messages_insert",
    );
    expect(migration).toContain(
      "security definer\nset search_path = ''",
    );
    expect(migration).toContain(
      "director.auth_user_id = (select auth.uid())",
    );
  });

  it("enforces message limits and server-side rate limiting", () => {
    expect(migration).toContain(
      "char_length(btrim(message)) between 1 and 500",
    );
    expect(migration).toContain("interval '2 seconds'");
    expect(migration).toContain("interval '1 minute'");
  });

  it("validates shared internal URLs and enables realtime delivery", () => {
    expect(migration).toContain("'/jeu/equipes/'");
    expect(migration).toContain("'/jeu/coureurs/'");
    expect(migration).toContain(
      "alter publication supabase_realtime",
    );
    expect(migration).toContain(
      "add table public.global_chat_messages",
    );
  });
});
