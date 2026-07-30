import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260730160000_create_alpha_tester_trophy.sql",
  ),
  "utf8",
);

describe("Alphatesteur trophy migration", () => {
  it("grants the reward to human alpha directors while excluding bots", () => {
    expect(migration).toContain("create table public.sporting_director_trophies");
    expect(migration).toContain("from public.alpha_bot_managers as bot");
    expect(migration).toContain("remove_alpha_tester_trophy_after_bot_creation");
    expect(migration).toContain("grant_alpha_tester_trophy_after_director_activation");
  });

  it("claims the reward idempotently for the authenticated director", () => {
    expect(migration).toContain("claim_current_sporting_director_trophy");
    expect(migration).toContain("set claimed_at = coalesce(claimed_at, now())");
    expect(migration).toContain("where director.auth_user_id = auth.uid()");
  });

  it("prevents an unearned public avatar frame", () => {
    expect(migration).toContain("validate_sporting_director_avatar_frame");
    expect(migration).toContain("trophy.claimed_at is not null");
    expect(migration).toContain("avatar_frame_key = 'alpha_tester'");
  });
});