import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260828214500_limit_dashboard_youth_alerts_to_age_18.sql",
  ),
  "utf8",
);

describe("dashboard junior signing alerts", () => {
  it("counts only unsigned active juniors aged exactly 18", () => {
    expect(migration).toContain("from public.youth_academy_riders as academy");
    expect(migration).toContain("academy.status = 'active'");
    expect(migration).toContain(
      "context.game_year - academy.birth_game_year = 18",
    );
  });

  it("stops using unread academy notifications as an urgency signal", () => {
    expect(migration).toContain("v_previous_cte");
    expect(migration).toContain("v_replacement_cte");
    expect(migration).toContain("if strpos(v_definition, v_previous_cte) = 0");
  });
});
