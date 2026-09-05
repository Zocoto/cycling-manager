import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260905170000_add_on_demand_global_chat_translation.sql",
  ),
  "utf8",
);
const route = readFileSync(
  resolve(
    process.cwd(),
    "app/jeu/chat/messages/[messageId]/translation/route.ts",
  ),
  "utf8",
);

describe("on-demand global chat translation", () => {
  it("keeps the translation cache server-only and invalidates it by fingerprint", () => {
    expect(migration).toContain("global_chat_message_translations");
    expect(migration).toContain("source_fingerprint");
    expect(migration).toMatch(
      /revoke all on table public\.global_chat_message_translations\s+from public, anon, authenticated/i,
    );
    expect(migration).toContain("grant all on table public.global_chat_message_translations to service_role");
  });

  it("rate limits provider calls and authenticates each translation request", () => {
    expect(migration).toContain("global_chat_translation_requests");
    expect(route).toContain("getAuthenticatedUser(supabase)");
    expect(route).toContain("ChatTranslationRateLimitError");
    expect(route).toContain("status: 429");
  });

  it("exposes author countries without treating them as source languages", () => {
    expect(migration).toContain("get_current_global_chat_identity_v3");
    expect(migration).toContain("get_online_global_chat_directors_v3");
    expect(migration).toContain("get_global_chat_director_profiles");
  });
});
