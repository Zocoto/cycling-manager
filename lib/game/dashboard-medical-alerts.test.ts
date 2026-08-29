import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260829110000_exclude_fatigue_from_dashboard_medical_alerts.sql",
  ),
  "utf8",
);

describe("dashboard medical alerts", () => {
  it("excludes active fatigue injuries that no doctor can treat", () => {
    expect(migration).toContain(
      "injury.diagnosis_code is distinct from 'fatigue_exhaustion'",
    );
  });

  it("keeps the compact assistant RPC and fails safely if its definition changed", () => {
    expect(migration).toContain(
      "public.get_current_dashboard_assistant_summary()",
    );
    expect(migration).toContain("if strpos(v_definition, v_previous_cte) = 0");
  });
});
