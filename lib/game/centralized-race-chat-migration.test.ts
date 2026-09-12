import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260912180000_centralize_race_chat_in_global_feed.sql",
  ),
  "utf8",
);

describe("centralized race chat migration", () => {
  it("stores new race comments once in the global feed", () => {
    expect(migration).toContain(
      "create or replace function public.post_race_context_global_chat_message",
    );
    expect(migration).toContain("public.post_global_chat_message_v4(");
    expect(migration).toContain("source_race_edition_id");
    expect(migration).toContain("global_chat_messages_race_source_created_idx");
    expect(migration).not.toContain("insert into public.race_live_messages");
  });

  it("keeps a complete and safe race link snapshot", () => {
    expect(migration).toContain("global_chat_messages_race_source_complete");
    expect(migration).toContain(
      "source_href ~ '^/jeu/resultats/[a-z0-9-]+/[0-9]+$'",
    );
  });
});
