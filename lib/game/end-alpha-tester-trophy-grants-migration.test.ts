import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260816120000_end_alpha_tester_trophy_grants.sql",
  ),
  "utf8",
);

describe("end Alphatesteur trophy grants migration", () => {
  it("stops granting the reward to future directors", () => {
    expect(migration).toContain(
      "drop trigger if exists grant_alpha_tester_trophy_after_director_creation",
    );
    expect(migration).toContain(
      "drop trigger if exists grant_alpha_tester_trophy_after_director_activation",
    );
    expect(migration).toContain(
      "drop function if exists public.grant_alpha_tester_trophy_to_new_director()",
    );
  });

  it("preserves existing trophies, claims and avatar frames", () => {
    expect(migration).not.toContain("delete from public.sporting_director_trophies");
    expect(migration).not.toContain("update public.sporting_directors");
    expect(migration).not.toContain("claim_current_sporting_director_trophy");
    expect(migration).not.toContain("validate_sporting_director_avatar_frame");
  });
});
