import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260829201500_reduce_weather_and_cryotherapy_center_costs.sql",
  ),
  "utf8",
);

describe("weather and cryotherapy center cost reduction migration", () => {
  it("keeps every SQL dollar-quoted block balanced", () => {
    expect((migration.match(/\$migration\$/g)?.length ?? 0) % 2).toBe(0);
    expect((migration.match(/\$definition\$/g)?.length ?? 0) % 2).toBe(0);
  });

  it("patches only the two expected construction prices", () => {
    expect(migration).toContain("v_base_cost := 150000;");
    expect(migration).toContain("v_base_cost := 50000;");
    expect(migration).toContain(
      "start_current_team_infrastructure_project(text,uuid,uuid)",
    );
    expect(migration).toContain(
      "Impossible de localiser le tarif actuel du centre météo.",
    );
  });
});
