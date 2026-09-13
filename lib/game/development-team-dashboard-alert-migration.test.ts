import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260913090000_add_development_team_setup_dashboard_alert.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Development Team dashboard alert migration", () => {
  it("uses the authoritative J1-J7 window and the saved team as source of truth", () => {
    expect(migration).toContain("context.current_day_number between 1 and 7");
    expect(migration).toContain("not exists (");
    expect(migration).toContain("from public.development_teams as development_team");
    expect(migration).toContain("development_team.team_id = context.team_id");
    expect(migration).toContain("development_team.season_id = context.season_id");
  });

  it("keeps the check in the existing compact dashboard payload", () => {
    expect(migration).toContain("'developmentTeamSetup'");
    expect(migration).toContain(
      "public.get_current_dashboard_assistant_summary()",
    );
  });
});
