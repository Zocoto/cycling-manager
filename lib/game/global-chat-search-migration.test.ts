import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260912210000_add_secured_global_chat_search.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("global chat secured search migration", () => {
  it("limits search to authenticated active sporting directors", () => {
    expect(migration).toContain("security definer\nset search_path = ''");
    expect(migration).toContain("director.auth_user_id = (select auth.uid())");
    expect(migration).toContain("assignment.status = 'active'");
    expect(migration).toContain("from public, anon");
  });

  it("searches the retained history with hard result limits", () => {
    expect(migration).toContain("interval '30 days'");
    expect(migration).toContain("char_length(v_query) < 2");
    expect(migration).toContain("least(greatest(coalesce(p_limit, 30), 1), 40)");
    expect(migration).toContain("coalesce(message.source_label, '') ilike");
  });
});
