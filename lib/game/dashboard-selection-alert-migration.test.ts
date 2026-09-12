import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260911200000_scope_dashboard_selection_alerts_to_live_races.sql",
  ),
  "utf8",
);

describe("dashboard international selection alert migration", () => {
  it("keeps the dashboard alert aligned with actionable selections", () => {
    expect(migration).toContain(
      "get_current_dashboard_assistant_summary()",
    );
    expect(migration).toContain(
      "international_championship_nation_selections",
    );
    expect(migration).toContain("edition.season_id = context.season_id");
    expect(migration).toContain("stage.departure_at > now()");
    expect(migration).toContain("selection.nation_selection_id");
  });
});
