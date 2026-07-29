import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260729120000_create_alpha_manager_bots.sql",
  ),
  "utf8",
);

describe("alpha bot migration", () => {
  it("keeps bot metadata private and service-only", () => {
    expect(migration).toContain(
      "alter table public.alpha_bot_managers enable row level security",
    );
    expect(migration).toContain(
      "revoke all on table public.alpha_bot_managers from public, anon, authenticated",
    );
    expect(migration).toContain("auth.role() <> 'service_role'");
  });

  it("makes twice-daily cycles idempotent and retry-bounded", () => {
    expect(migration).toContain("unique (manager_id, cycle_key)");
    expect(migration).toContain("attempt_count < 3");
    expect(migration).toContain("p_slot not in ('morning', 'evening')");
  });
});
