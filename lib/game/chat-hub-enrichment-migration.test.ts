import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260912190000_add_current_chat_federation_context.sql",
  ),
  "utf8",
);

describe("chat hub enrichment migration", () => {
  it("resolves the authenticated team federation without a client supplied id", () => {
    expect(migration).toContain(
      "create or replace function public.get_current_chat_federation_context()",
    );
    expect(migration).toContain("director.auth_user_id = (select auth.uid())");
    expect(migration).toContain("team_season.registration_country_id");
  });

  it("returns the durable global chat reading position", () => {
    expect(migration).toContain(
      "create or replace function public.get_current_global_chat_last_read_at()",
    );
    expect(migration).toContain("public.global_chat_read_receipts");
    expect(migration).toContain("to authenticated, service_role");
  });
});
