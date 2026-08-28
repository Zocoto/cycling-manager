import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260828200000_add_dashboard_ds_assistant.sql",
  ),
  "utf8",
);

describe("dashboard DS assistant migration", () => {
  it("keeps the dashboard query bounded and isolated", () => {
    expect(migration).toContain("set statement_timeout = '3000ms'");
    expect(migration).toContain("sporting_director_messages_expiry_idx");
    expect(migration).toContain("limit 12");
    expect(migration).toContain("interval '30 days'");
    expect(migration).not.toContain("eligible_race");
  });

  it("hard-deletes only messages owned by the connected director", () => {
    expect(migration).toContain("delete_current_director_message");
    expect(migration).toContain("director.auth_user_id = auth.uid()");
    expect(migration).toContain("p_scope not in ('read', 'older_than_7_days', 'all')");
  });

  it("retains important messages during the automatic purge", () => {
    expect(migration).toContain("message.is_important = false");
    expect(migration).toContain("message.sent_at < now() - interval '30 days'");
  });
});
