import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260831073000_add_available_scout_dashboard_alert.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("available scout dashboard alert migration", () => {
  it("counts active scouts without an active youth scouting mission", () => {
    expect(migration).toContain("'availableScoutCount'");
    expect(migration).toContain("from public.staff_contracts as contract");
    expect(migration).toContain("contract.status = 'active'");
    expect(migration).toContain("member.role = 'scout'");
    expect(migration).toContain("not exists (");
    expect(migration).toContain("mission.scout_contract_id = contract.id");
    expect(migration).toContain("mission.status = 'active'");
  });

  it("keeps the lookup inside the existing dashboard summary", () => {
    expect(migration).toContain(
      "public.get_current_dashboard_assistant_summary()",
    );
    expect(migration).toContain("join current_context as context");
  });
});
