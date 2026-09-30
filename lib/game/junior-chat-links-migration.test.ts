import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260930210000_allow_junior_profile_links_in_chat.sql",
  ),
  "utf8",
);

describe("junior chat links migration", () => {
  it("allows junior profile links in both chat validation triggers", () => {
    expect(migration).toContain(
      "create or replace function public.validate_global_chat_message_links()",
    );
    expect(migration).toContain(
      "create or replace function public.validate_direct_message_links()",
    );
    expect(
      migration.match(/centre-de-formation\/development\//g),
    ).toHaveLength(2);
    expect(migration).toContain("fiche coureur, junior, équipe ou DS");
  });
});
