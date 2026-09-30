import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260929110000_save_team_time_trial_roles.sql",
  ),
  "utf8",
);

describe("team time-trial role persistence", () => {
  it("saves roles and relay plans through one atomic RPC", () => {
    expect(migration).toContain("p_roles jsonb");
    expect(migration).toContain("p_strategy jsonb");
    expect(migration).toContain("save_current_team_race_preparation(");
    expect(migration).toContain(
      "save_current_team_time_trial_preparation(\n    p_race_edition_id",
    );
  });
});
