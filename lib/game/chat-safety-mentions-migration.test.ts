import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const safetyMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260825121000_secure_chat_links_and_expose_avatars.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const mentionMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260825122000_create_global_chat_mentions.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("chat link and avatar migration", () => {
  it("enforces the link allowlist for global and private messages", () => {
    expect(safetyMigration).toContain(
      "create trigger global_chat_messages_validate_links",
    );
    expect(safetyMigration).toContain(
      "create trigger direct_messages_validate_links",
    );
    expect(safetyMigration).toContain("cyclostratege\\.fr");
    expect(safetyMigration).toContain("(https?://|www\\.)");
    expect(safetyMigration).toContain("([[:alnum:]-]+\\.)+");
  });

  it("exposes avatars in bounded RPCs rather than one query per row", () => {
    expect(safetyMigration).toContain(
      "get_current_global_chat_identity_v2()",
    );
    expect(safetyMigration).toContain("director.avatar_key");
    expect(safetyMigration).toContain(
      "get_global_chat_director_avatars(\n  p_sporting_director_ids uuid[]",
    );
    expect(safetyMigration).toContain(
      "director.id = any(coalesce(p_sporting_director_ids",
    );
    expect(safetyMigration).toContain(
      "get_online_global_chat_directors_v2()",
    );
  });
});

describe("global chat mentions migration", () => {
  it("stores only selected recipients and caps fan-out", () => {
    expect(mentionMigration).toContain(
      "create table public.global_chat_mentions",
    );
    expect(mentionMigration).toContain(
      "global_chat_mentions_recipient_created_idx",
    );
    expect(mentionMigration).toContain(
      "create or replace function public.post_global_chat_message_v3",
    );
    expect(mentionMigration).toContain("if v_mention_count > 5 then");
    expect(mentionMigration).toContain(
      "strpos(\n    lower(v_result.message),\n    '@' || lower(director.username)",
    );
  });

  it("searches on demand and queues push only for mentioned members", () => {
    expect(mentionMigration).toContain(
      "search_current_global_chat_mentions",
    );
    expect(mentionMigration).toContain(
      "create trigger global_chat_mentions_enqueue_push",
    );
    expect(mentionMigration).toContain("'global_chat_mention'");
    expect(mentionMigration).toContain(
      "public.get_next_decent_push_delivery_at(new.created_at)",
    );
  });
});
