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
const chatService = readFileSync(
  resolve(process.cwd(), "services/global-chat.ts"),
  "utf8",
);
const optionalProfilesMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260905181500_restore_optional_global_chat_profiles.sql",
  ),
  "utf8",
);
const cacheRepairMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260905183500_restore_global_chat_translation_cache.sql",
  ),
  "utf8",
);
const requestRepairMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260905184500_restore_global_chat_translation_requests.sql",
  ),
  "utf8",
);
const privacyPage = readFileSync(
  resolve(process.cwd(), "app/(public)/confidentialite/page.tsx"),
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
    expect(cacheRepairMigration).toContain(
      "create table if not exists public.global_chat_message_translations",
    );
    expect(cacheRepairMigration).toMatch(
      /revoke all on table public\.global_chat_message_translations\s+from public, anon, authenticated/i,
    );
    expect(cacheRepairMigration).toContain(
      "grant all on table public.global_chat_message_translations to service_role",
    );
  });

  it("rate limits provider calls and authenticates each translation request", () => {
    expect(migration).toContain("global_chat_translation_requests");
    expect(requestRepairMigration).toContain(
      "create table if not exists public.global_chat_translation_requests",
    );
    expect(requestRepairMigration).toContain(
      "create index if not exists global_chat_translation_requests_director_created_idx",
    );
    expect(requestRepairMigration).toMatch(
      /revoke all on table public\.global_chat_translation_requests\s+from public, anon, authenticated/i,
    );
    expect(route).toContain("getAuthenticatedUser(supabase)");
    expect(route).toContain("ChatTranslationRateLimitError");
    expect(route).toContain("status: 429");
  });

  it("never makes the core chat render depend on translation RPCs", () => {
    expect(route).toContain('rpc("get_current_global_chat_identity_v2")');
    expect(route).not.toContain('rpc("get_current_global_chat_identity_v3")');
    expect(chatService).toContain('rpc("get_current_global_chat_identity_v2")');
    expect(chatService).toContain('rpc("get_online_global_chat_directors_v2")');
    expect(chatService).not.toContain('rpc("get_current_global_chat_identity_v3")');
    expect(chatService).not.toContain('rpc("get_online_global_chat_directors_v3")');
  });

  it("exposes author countries without treating them as source languages", () => {
    expect(migration).toContain("get_current_global_chat_identity_v3");
    expect(migration).toContain("get_online_global_chat_directors_v3");
    expect(migration).toContain("get_global_chat_director_profiles");
    expect(optionalProfilesMigration).toContain(
      "get_global_chat_director_profiles",
    );
    expect(chatService).toMatch(
      /rpc\(\s*"get_global_chat_director_profiles"/u,
    );
    expect(chatService).toContain(
      'rpc("get_global_chat_director_avatars"',
    );
  });

  it("discloses every translation processor and keeps translation opt-in", () => {
    expect(privacyPage).toContain("AI Gateway");
    expect(privacyPage).toContain("Google Gemini");
    expect(privacyPage).toContain("DeepL");
    expect(privacyPage).toContain("clic explicite");
  });
});
