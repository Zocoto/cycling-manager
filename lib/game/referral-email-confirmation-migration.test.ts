import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260828153000_confirm_email_before_referral_rewards.sql",
  ),
  "utf8",
);

describe("referral email confirmation", () => {
  it("keeps the tutorial optional while preventing rewards for unconfirmed accounts", () => {
    expect(migration).toContain("after insert or update of email_confirmed_at on auth.users");
    expect(migration).toContain("new.email_confirmed_at is null");
    expect(migration).toContain("referral.status = 'registered'");
    expect(migration).not.toContain("tutorial_progress");
    expect(migration).not.toContain("criterium-discovery");
  });
});
