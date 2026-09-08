import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  getBestNaturalizationRequiredDays,
  getFederationInfrastructureEffectPercentage,
  getFederationNaturalizationRequiredDays,
  getNationalPerformanceCenterSpecializationBonusPercentage,
  isNationalPerformanceCenterSpecializationCode,
} from "./federation-infrastructure-effects";

const root = process.cwd();

describe("federation infrastructure effects", () => {
  it("plafonne les niveaux et conserve les coefficients du catalogue", () => {
    expect(
      getFederationInfrastructureEffectPercentage(
        "national_performance_center",
        5,
      ),
    ).toBe(1.5);
    expect(
      getFederationInfrastructureEffectPercentage(
        "race_organization_office",
        99,
      ),
    ).toBe(25);
    expect(
      getFederationInfrastructureEffectPercentage(
        "home_advantage_program",
        -2,
      ),
    ).toBe(0);
  });

  it("retient le meilleur délai de naturalisation sans cumuler", () => {
    expect(
      getFederationNaturalizationRequiredDays({ level: 5, baseDays: 84 }),
    ).toBe(68);
    expect(
      getBestNaturalizationRequiredDays({
        teamRequiredDays: 56,
        federalIntegrationLevel: 5,
        baseDays: 84,
      }),
    ).toBe(56);
  });

  it("cible les trois orientations du Centre national selon leur niveau", () => {
    expect(
      getNationalPerformanceCenterSpecializationBonusPercentage({
        level: 2,
        specializationCode: "altitude_endurance",
        ratingKey: "mountain",
      }),
    ).toBe(0);
    expect(
      getNationalPerformanceCenterSpecializationBonusPercentage({
        level: 3,
        specializationCode: "altitude_endurance",
        ratingKey: "mountain",
      }),
    ).toBe(0.9);
    expect(
      getNationalPerformanceCenterSpecializationBonusPercentage({
        level: 3,
        specializationCode: "altitude_endurance",
        ratingKey: "recovery",
      }),
    ).toBe(0.3);
    expect(
      getNationalPerformanceCenterSpecializationBonusPercentage({
        level: 4,
        specializationCode: "speed_power",
        ratingKey: "sprint",
      }),
    ).toBe(1.2);
    expect(
      getNationalPerformanceCenterSpecializationBonusPercentage({
        level: 4,
        specializationCode: "speed_power",
        ratingKey: "prologue",
      }),
    ).toBe(0.4);
    expect(
      getNationalPerformanceCenterSpecializationBonusPercentage({
        level: 5,
        specializationCode: "rolling_engine",
        ratingKey: "timeTrial",
      }),
    ).toBe(1.5);
    expect(
      getNationalPerformanceCenterSpecializationBonusPercentage({
        level: 5,
        specializationCode: "rolling_engine",
        ratingKey: "resistance",
      }),
    ).toBe(0.5);
    expect(
      getNationalPerformanceCenterSpecializationBonusPercentage({
        level: 5,
        specializationCode: "rolling_engine",
        ratingKey: "mountain",
      }),
    ).toBe(0);
    expect(isNationalPerformanceCenterSpecializationCode("speed_power")).toBe(
      true,
    );
    expect(isNationalPerformanceCenterSpecializationCode("elite_detection")).toBe(
      false,
    );
  });

  it("branche la statistique travaillée dans le règlement SQL", () => {
    const migration = readFileSync(
      join(
        root,
        "supabase/migrations/20260908200000_activate_national_performance_center_specializations.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      "get_team_national_performance_multiplier(v_rider.team_id, v_stat.stat_code)",
    );
    expect(migration).toContain("p_stat_code in ('mountain', 'endurance')");
    expect(migration).toContain("p_stat_code in ('sprint', 'acceleration')");
    expect(migration).toContain("p_stat_code in ('time_trial', 'flat')");
  });
});
