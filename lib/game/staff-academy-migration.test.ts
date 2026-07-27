import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260727190000_create_staff_academy.sql",
  ),
  "utf8",
);

describe("staff academy migration", () => {
  it("opens one simultaneous training slot per academy level", () => {
    expect(migration).toContain("if v_active_count >= v_academy_level then");
    expect(migration).toContain(
      "infrastructure.infrastructure_code = 'staff_academy'",
    );
  });

  it("keeps trainings between five and twenty game days", () => {
    expect(migration).toContain("duration_days between 5 and 20");
    expect(migration).toContain("v_duration := least(");
  });

  it("selects a compatible missing talent at random", () => {
    expect(migration).toContain("order by random()");
    expect(migration).toContain("owned.talent_code = talent.code");
    expect(migration).toContain("'professions_building'");
  });

  it("does not make the staff unavailable during training", () => {
    expect(migration).not.toMatch(
      /update public\.staff_contracts[\s\S]{0,160}status\s*=/,
    );
  });
});