import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260823160000_add_staff_educator.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const staffService = readFileSync(
  join(process.cwd(), "services/team-staff.ts"),
  "utf8",
);

describe("staff educator migration", () => {
  it("registers the educator role and its four compatible talents", () => {
    expect(migration).toContain("'research_engineer', 'educator'");
    expect(migration).toContain("'educator_training_time'");
    expect(migration).toContain("'educator_training_cost'");
    expect(migration).toContain("'educator_parallel_training'");
    expect(migration).toContain("'educator_training_effectiveness'");
    expect(migration).toContain("'Double cursus',\n    3");
  });

  it("locks every standard or custom educator hire behind the academy", () => {
    expect(migration).toContain(
      "create or replace function public.hire_current_team_staff",
    );
    expect(migration).toContain(
      "Construisez l’Académie des métiers avant de recruter un formateur.",
    );
    expect(migration).toContain(
      "public.redeem_custom_staff_recruitment_reward",
    );
    expect(migration).toContain(
      "v_definition := replace(v_definition, E'\\r\\n', E'\\n');",
    );
    expect(staffService).toContain('member.role === "educator"');
    expect(staffService).toContain(
      "Construisez l’Académie des métiers avant de recruter ce formateur.",
    );
  });

  it("applies capped cost, duration and parallel-course bonuses atomically", () => {
    expect(migration).toContain(
      "create or replace function public.get_team_staff_academy_educator_bonuses",
    );
    expect(migration).toContain("round(cost_specialist + effectiveness, 1)");
    expect(migration).toContain("round(time_specialist + effectiveness, 1)");
    expect(migration).toContain(
      "talent_code = 'educator_parallel_training' and level >= 3",
    );
    expect(migration).toContain("v_capacity := v_academy_level + coalesce(");
    expect(migration).toContain("v_cost * (1 - v_cost_reduction / 100.0)");
    expect(migration).toContain(
      "v_duration * (1 - v_duration_reduction / 100.0)",
    );
    expect(migration).toContain("educator_cost_reduction_percentage");
    expect(migration).toContain("educator_duration_reduction_percentage");
  });

  it("updates the all-professions objective to eleven roles", () => {
    expect(migration).toContain("target_value = 11");
    expect(migration).toContain(
      "Réunir simultanément les onze métiers de staff.",
    );
  });
});
