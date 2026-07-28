import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260728200000_lock_down_security_definer_functions.sql",
  ),
  "utf8",
);

describe("SECURITY DEFINER lockdown migration", () => {
  it("revokes anonymous execution from every existing privileged function", () => {
    expect(migration).toContain("and procedure.prosecdef");
    expect(migration).toContain(
      "revoke execute on function %I.%I(%s) from public, anon",
    );
  });

  it("makes future function execution opt-in for application roles", () => {
    expect(migration).toContain(
      "alter default privileges in schema public",
    );
    expect(migration).toContain(
      "revoke execute on functions from public",
    );
    expect(migration).toContain("revoke execute on functions from anon");
    expect(migration).toContain(
      "revoke execute on functions from authenticated",
    );
  });
});
