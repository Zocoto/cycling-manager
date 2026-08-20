import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260819130000_skip_unmanaged_injury_roster_notifications.sql",
  ),
  "utf8",
);

describe("injury roster notifications for unmanaged registrations", () => {
  it("keeps the medical withdrawal but skips manager alerts without a team", () => {
    expect(migration).toContain("status = 'withdrawn'");
    expect(migration).toContain("withdrawn_by_injury_id = new.id");
    expect(migration).toContain(
      "if v_entry.team_season_id is not null then",
    );
    expect(migration).toContain(
      "insert into public.race_roster_notifications",
    );
  });
});
