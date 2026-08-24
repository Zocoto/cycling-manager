import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260824214500_refine_global_chat_online_presence.sql",
  "utf8",
);

describe("global site presence migration", () => {
  it("keeps SQL dollar-quoted blocks balanced", () => {
    expect(migration.match(/\$\$/g)?.length ?? 0).toBeGreaterThan(0);
    expect((migration.match(/\$\$/g)?.length ?? 0) % 2).toBe(0);
  });

  it("returns only directors active during the last three minutes", () => {
    expect(migration).toContain(
      "activity.last_seen_at >= pg_catalog.now() - interval '3 minutes'",
    );
    expect(migration).toContain("director.status = 'active'");
    expect(migration).toContain("assignment.status = 'active'");
    expect(migration).toContain("team.status = 'active'");
  });

  it("keeps bots excluded and the RPC authenticated", () => {
    expect(migration).toContain("from public.alpha_bot_managers as bot");
    expect(migration).toContain("where (select auth.uid()) is not null");
    expect(migration).toContain("to authenticated, service_role");
  });
});
