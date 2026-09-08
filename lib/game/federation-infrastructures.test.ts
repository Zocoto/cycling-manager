import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FEDERATION_INFRASTRUCTURE_CODES,
  FEDERATION_INFRASTRUCTURE_DEFINITIONS,
  MAX_FEDERATION_PROJECT_ARCHITECTS,
  calculateFederationConstructionPreview,
} from "@/lib/game/federation-infrastructures";
import {
  getFederalScoutReportPrecisionBonusPercentage,
  getFederalStaffAcademyDurationReductionPercentage,
  getFederalStaffInstituteBonusPercentage,
  getNationalDetectionNetworkEffects,
} from "@/lib/game/federation-infrastructure-effects";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260903235500_create_federation_infrastructure_projects.sql",
  ),
  "utf8",
);
const programmeMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260904130000_expand_federation_program.sql",
  ),
  "utf8",
);
const effectsMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260907120000_activate_federation_infrastructure_effects.sql",
  ),
  "utf8",
);
const detectionBonusMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260907160000_apply_detection_bonuses_to_youth_quality_and_reports.sql",
  ),
  "utf8",
);
const detectionSpecializationMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260908162000_activate_national_detection_network_specializations.sql",
  ),
  "utf8",
);
const staffInstituteSpecializationMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260908210000_activate_federal_staff_institute_specializations.sql",
  ),
  "utf8",
);
const youthDevelopmentService = readFileSync(
  join(process.cwd(), "services/youth-development.ts"),
  "utf8",
);

describe("federation infrastructures", () => {
  it("keeps the streamlined eight-building, five-level catalogue", () => {
    expect(FEDERATION_INFRASTRUCTURE_DEFINITIONS).toHaveLength(8);
    expect(new Set(FEDERATION_INFRASTRUCTURE_CODES)).toHaveProperty("size", 8);
    expect(FEDERATION_INFRASTRUCTURE_CODES).not.toContain("regional_academies");
    expect(
      FEDERATION_INFRASTRUCTURE_DEFINITIONS.every(
        (definition) => definition.levels.length === 5,
      ),
    ).toBe(true);
    expect(
      FEDERATION_INFRASTRUCTURE_DEFINITIONS.map(
        (definition) => definition.code,
      ),
    ).toEqual(FEDERATION_INFRASTRUCTURE_CODES);
  });

  it("caps architect contributions and never produces a negative quote", () => {
    const level = FEDERATION_INFRASTRUCTURE_DEFINITIONS[0].levels[4];
    const quote = calculateFederationConstructionPreview({
      level,
      architectCount: 99,
      priority: "cost",
    });

    expect(quote.architectCount).toBe(MAX_FEDERATION_PROJECT_ARCHITECTS);
    expect(quote.costReductionPercentage).toBe(20);
    expect(quote.cost).toBeGreaterThan(0);
    expect(quote.savedAmount).toBe(level.cost - quote.cost);
  });

  it("applies time and balanced priorities independently", () => {
    const performanceCenter = FEDERATION_INFRASTRUCTURE_DEFINITIONS.find(
      (definition) => definition.code === "national_performance_center",
    );
    expect(performanceCenter).toBeDefined();
    const level = performanceCenter!.levels[4];
    const fast = calculateFederationConstructionPreview({
      level,
      architectCount: 5,
      priority: "time",
    });
    const balanced = calculateFederationConstructionPreview({
      level,
      architectCount: 5,
      priority: "balanced",
    });

    expect(fast.cost).toBe(level.cost);
    expect(fast.durationReductionPercentage).toBe(30);
    expect(balanced.costReductionPercentage).toBe(10);
    expect(balanced.durationReductionPercentage).toBe(15);
  });

  it("persists S3 projects without permanently locking contributed architects", () => {
    expect(migration).toContain(
      "start_national_federation_infrastructure_project",
    );
    expect(migration).toContain(
      "contribute_architect_to_federation_project",
    );
    expect(migration).toContain(
      "settle_due_national_federation_infrastructure_projects",
    );
    expect(migration).toContain("if v_season.game_year < 3");
    expect(migration).toContain("v_architect_count >= 5");
    expect(migration).toContain("balance = balance + v_refund");
    expect(migration).not.toContain(
      "national_federation_architect_one_active_project_idx",
    );
  });

  it("uses federation-scale costs and releases dismissed architects", () => {
    expect(FEDERATION_INFRASTRUCTURE_DEFINITIONS[0].levels[0].cost).toBe(
      900_000,
    );
    expect(
      FEDERATION_INFRASTRUCTURE_DEFINITIONS.find(
        (definition) => definition.code === "national_technical_laboratory",
      )?.levels[4].durationDays,
    ).toBe(32);
    expect(programmeMigration).toContain(
      "release_federation_architect_on_contract_end",
    );
    expect(programmeMigration).toContain(
      "update_national_federation_project_priority",
    );
    expect(programmeMigration).toContain(
      "recalculate_national_federation_project",
    );
  });

  it("synchronise le débit et active chaque famille d’effets", () => {
    expect(programmeMigration).toContain(
      "array[900000,1700000,2800000,4400000,6400000]",
    );
    expect(programmeMigration).toContain(
      "array[700000,1350000,2250000,3500000,5000000]",
    );

    for (const marker of [
      "get_team_national_performance_multiplier",
      "get_staff_contract_federal_institute_multiplier",
      "federal_recovery_hours_reduced",
      "federal_integration_office",
      "federation_detection_bonus_percentage",
      "federal_tuition_reduction_percentage",
    ]) {
      expect(effectsMigration).toContain(marker);
    }
  });

  it("applies the national detection network to junior quality and report precision", () => {
    expect(
      FEDERATION_INFRASTRUCTURE_DEFINITIONS[0].levels.every((level) =>
        level.effect.includes("qualité réelle"),
      ),
    ).toBe(true);
    expect(detectionBonusMigration).toContain(
      "scouting_supervision_bonus_percentage",
    );
    expect(youthDevelopmentService).toContain(
      '"national_detection_network",',
    );
    expect(youthDevelopmentService).toContain(
      "federationDetectionBonusPercentage: federalDetectionBonusPercentage",
    );
    expect(youthDevelopmentService).toMatch(
      /supervisionBonusPercentage\s*\+\s*federationDetectionBonusPercentage\s*\+\s*federationSpecializationReportPrecisionBonusPercentage\s*\+\s*federalStaffReportPrecisionBonusPercentage\s*\+\s*toNumber\(mission\.data_room_report_precision_bonus_percentage/,
    );
    expect(youthDevelopmentService).toContain(
      "precisionBonusPercentage: reportPrecisionBonusPercentage",
    );
  });

  it("applique les trois orientations du réseau national à des mécaniques existantes", () => {
    expect(
      getNationalDetectionNetworkEffects({
        level: 3,
        specializationCode: "territorial_coverage",
      }),
    ).toMatchObject({
      additionalCandidateChance: 0.6,
      reportPrecisionBonusPercentage: 2.4,
      atypicalStyleRelativeBonusPercentage: 2,
    });
    expect(
      getNationalDetectionNetworkEffects({
        level: 5,
        specializationCode: "elite_detection",
      }),
    ).toMatchObject({
      elitePotentialRelativeBonusPercentage: 3,
      potentialPrecisionBonusPercentage: 5,
    });
    expect(
      getNationalDetectionNetworkEffects({
        level: 5,
        specializationCode: "profile_diversity",
      }).atypicalStyleRelativeBonusPercentage,
    ).toBe(12);
    expect(detectionSpecializationMigration).toContain(
      "federation_detection_spec_report_bonus_percentage",
    );
    expect(youthDevelopmentService).toContain(
      "federalDetectionNetworkEffects.additionalCandidateChance",
    );
    expect(youthDevelopmentService).toContain(
      "elitePotentialRelativeBonusPercentage:",
    );
  });

  it("applique les trois écoles de l’Institut au métier national choisi", () => {
    expect(
      getFederalStaffInstituteBonusPercentage({
        level: 3,
        specializationCode: "coach_school",
        role: "trainer",
        isNationalStaff: true,
      }),
    ).toBe(3.3);
    expect(
      getFederalStaffInstituteBonusPercentage({
        level: 5,
        specializationCode: "medical_school",
        role: "physiotherapist",
        isNationalStaff: true,
      }),
    ).toBe(5.5);
    expect(
      getFederalStaffInstituteBonusPercentage({
        level: 5,
        specializationCode: "scout_school",
        role: "scout",
        isNationalStaff: false,
      }),
    ).toBe(0);
    expect(
      getFederalScoutReportPrecisionBonusPercentage({
        level: 5,
        specializationCode: "scout_school",
        isNationalStaff: true,
      }),
    ).toBe(5);
    expect(
      getFederalStaffAcademyDurationReductionPercentage({
        level: 3,
        specializationCode: "medical_school",
        role: "doctor",
        isNationalStaff: true,
      }),
    ).toBe(3);

    for (const marker of [
      "federal_staff_spec_report_bonus_percentage",
      "get_staff_contract_federal_training_reduction",
      "federal_duration_reduction_percentage",
      "get_rider_physio_form_protection",
      "get_race_preparer_bonus_percentage",
      "get_architect_adjusted_reduction",
      "apply_federal_staff_to_academy_training",
      "apply_federal_staff_to_equipment_rnd",
    ]) {
      expect(staffInstituteSpecializationMigration).toContain(marker);
    }
  });
});
