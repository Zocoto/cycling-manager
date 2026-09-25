import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260925103000_reopen_remaining_s3_automatic_callups.sql",
  "utf8",
).replaceAll("\r", "");

describe("S3 federation call-up transition", () => {
  it("keeps H-24 from S4 and grants only S3 the necessary H-1 repair window", () => {
    expect(migration).toContain("when season.game_year = 3");
    expect(migration).toContain("then interval ''1 hour''");
    expect(migration).toContain("then interval ''24 hours''");
  });

  it("reopens only the exact timestamp signature of an automatic confirmation", () => {
    expect(migration).toContain(
      "member.responded_at = selection_list.published_at",
    );
    expect(migration).toContain(
      "set response_status = 'pending', responded_at = null",
    );
    expect(migration).toContain(
      "set response_status = 'declined', responded_at = now()",
    );
  });

  it("withdraws non-qualified future registrations and resynchronizes lists", () => {
    expect(migration).toContain(
      "from public.international_nation_qualification_snapshots as snapshot",
    );
    expect(migration).toContain("set status = 'withdrawn'");
    expect(migration).toContain(
      "select public.sync_due_national_federation_championship_lineups(now(), true)",
    );
  });
});
