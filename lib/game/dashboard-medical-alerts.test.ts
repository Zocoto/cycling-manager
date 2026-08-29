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

const shortRecoveryMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260829150000_exclude_short_recovery_injuries_from_dashboard_alerts.sql",
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

  it("excludes injuries once fewer than 24 hours remain", () => {
    expect(shortRecoveryMigration).toContain(
      "injury.expected_recovery_at >= now() + interval '24 hours'",
    );
    expect(shortRecoveryMigration).toContain("injury.protocol_code is null");
  });

  it("updates the existing compact RPC without adding another dashboard query", () => {
    expect(shortRecoveryMigration).toContain(
      "public.get_current_dashboard_assistant_summary()",
    );
    expect(shortRecoveryMigration).toContain(
      "if strpos(v_definition, v_previous_cte) = 0",
    );
  });
});
