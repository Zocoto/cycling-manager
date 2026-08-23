import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260823123000_add_architect_building_efficiency.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("architect building efficiency migration", () => {
  it("reserves the talent for architects of at least two stars", () => {
    expect(migration).toContain("'architect_building_efficiency'");
    expect(migration).toContain("minimum_level");
    expect(migration).toContain("'Conception haute performance',\n  2");
  });

  it("captures a two-percent bonus per architect level on the project", () => {
    expect(migration).toContain("select member.level * 2");
    expect(migration).toContain("least(10, coalesce(v_efficiency, 0))");
    expect(migration).toContain("infrastructure_project_architect_efficiency");
  });

  it("persists the bonus on the building delivered by the project", () => {
    expect(migration).toContain("efficiency_bonus_percentage smallint");
    expect(migration).toContain("sync_completed_infrastructure_efficiency");
    expect(migration).toContain("where completed_project_id = new.id");
  });

  it("scales the continuous effects of performance buildings", () => {
    expect(migration).toContain(
      "get_team_infrastructure_efficiency_multiplier",
    );
    expect(migration).toContain("'training_center'");
    expect(migration).toContain("'media_center'");
    expect(migration).toContain("'research_lab'");
    expect(migration).toContain("'cryotherapy_center'");
    expect(migration).toContain("p_preparation_type), 2");
  });
});
