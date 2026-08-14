import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260814060000_restore_authenticated_division_reads.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

describe("division read access migration", () => {
  it("restores authenticated reads without exposing writes or anonymous access", () => {
    expect(migration).toContain(
      "grant select on table public.divisions to authenticated",
    );
    expect(migration).toContain("for select\n  to authenticated");
    expect(migration).toContain("using (true)");
    expect(migration).not.toMatch(/grant\s+(all|insert|update|delete)/i);
    expect(migration).not.toMatch(/\bto\s+(anon|public)\b/i);
  });
});
