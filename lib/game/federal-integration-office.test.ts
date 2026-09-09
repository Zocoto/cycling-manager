import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260909170000_activate_federal_integration_office.sql",
  ),
  "utf8",
);
const professionalService = readFileSync(
  join(root, "services/rider-naturalization.ts"),
  "utf8",
);
const youthService = readFileSync(
  join(root, "services/youth-development.ts"),
  "utf8",
);
const staffService = readFileSync(
  join(root, "services/team-staff.ts"),
  "utf8",
);

describe("federal integration office", () => {
  it("migre les anciennes orientations sans perdre les choix", () => {
    expect(migration).toContain("when 'fast_track' then 'professional_path'");
    expect(migration).toContain("when 'diaspora_network' then 'youth_gateway'");
    expect(migration).toContain("when 'integration_program' then 'technical_passport'");
  });

  it("sépare les routes de naturalisation du club et de la fédération", () => {
    expect(migration).toContain("team_days");
    expect(migration).toContain("federal_base_days");
    expect(migration).toMatch(/least\(\r?\n\s+team_days,/);
    expect(migration).toContain("federal_level)) * 0.10");
    expect(professionalService).toContain(
      'naturalizationLevel: "professional"',
    );
  });

  it("applique la passerelle aux délais et aux frais des juniors", () => {
    expect(youthService).toContain('naturalizationLevel: "youth"');
    expect(youthService).toContain(
      "federalIntegrationTuitionReductionPercentage",
    );
    expect(youthService).toContain(
      "federal_tuition_reduction_percentage:",
    );
  });

  it("ajoute le Passeport technique aux quotas contrôlés par la base", () => {
    expect(migration).toContain(
      "get_team_federal_staff_naturalization_bonus",
    );
    expect(migration).toContain("'technical_passport'");
    expect(staffService).toContain("staffNaturalizationSeasonBonus");
    expect(staffService).toContain("federalQuotaBonus");
  });
});
