import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getRaceOrganizationOfficeEffects } from "./federation-infrastructure-effects";
import { calculateFederationHostingAttendance } from "./federation-hosting";
import { selectWeightedRandomDistinct } from "./weighted-random-selection";

const root = process.cwd();
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260909150000_activate_race_organization_office.sql",
  ),
  "utf8",
);

describe("race organization office", () => {
  it("branche les déblocages et remises du bâtiment principal", () => {
    expect(
      getRaceOrganizationOfficeEffects({
        level: 1,
        specializationCode: null,
      }),
    ).toMatchObject({
      raceRevenueBonusPercentage: 5,
      canCreateNationalRace: true,
      canSubmitInternationalCandidacy: false,
      hostingCostReductionPercentage: 0,
    });
    expect(
      getRaceOrganizationOfficeEffects({
        level: 4,
        specializationCode: null,
      }),
    ).toMatchObject({
      raceRevenueBonusPercentage: 20,
      canSubmitInternationalCandidacy: true,
      hostingCostReductionPercentage: 5,
    });
    expect(
      getRaceOrganizationOfficeEffects({
        level: 5,
        specializationCode: null,
      }).hostingCostReductionPercentage,
    ).toBe(10);
  });

  it("fait progresser les trois orientations aux niveaux 3 à 5", () => {
    expect(
      getRaceOrganizationOfficeEffects({
        level: 3,
        specializationCode: "prestige_events",
      }),
    ).toMatchObject({
      candidacyScoreBonusPercentage: 4.8,
      internationalHostingRevenueBonusPercentage: 3.6,
    });
    expect(
      getRaceOrganizationOfficeEffects({
        level: 4,
        specializationCode: "dense_calendar",
      }),
    ).toMatchObject({
      calendarPenaltyPerExistingRace: 8,
      regionalNationalHomologationThreshold: 56,
    });
    expect(
      getRaceOrganizationOfficeEffects({
        level: 5,
        specializationCode: "national_pipeline",
      }).marketNationalityChanceBonusPercentage,
    ).toBe(50);
  });

  it("intègre le bonus international aux recettes et le coût remisé", () => {
    const baseline = calculateFederationHostingAttendance({
      eventType: "nations_cup_junior",
      participationRate: 0.85,
      renown: 400,
    });
    const enhanced = calculateFederationHostingAttendance({
      eventType: "nations_cup_junior",
      participationRate: 0.85,
      renown: 400,
      hostingCost: 495_000,
      revenueBonusPercentage: 6,
    });

    expect(enhanced.attendance).toBe(baseline.attendance);
    expect(enhanced.grossRevenue).toBe(
      Math.round(baseline.grossRevenue * 1.06),
    );
    expect(enhanced.netReturn).toBe(enhanced.grossRevenue - 495_000);
  });

  it("pondère un tirage sans permettre de doublon", () => {
    const values = ["FR", "BE", "IT"];
    const selected = selectWeightedRandomDistinct({
      values,
      count: 2,
      getWeight: (country) => (country === "FR" ? 10 : 1),
      random: () => 0.2,
    });

    expect(selected[0]).toBe("FR");
    expect(new Set(selected).size).toBe(2);
  });

  it("raccorde les effets aux transactions et aux deux marchés", () => {
    expect(migration).toContain("race_revenue_bonus_percentage");
    expect(migration).toContain("hosting_cost_reduction_percentage");
    expect(migration).toContain("specialization_bonus_points");
    expect(migration).toContain("calendar_penalty_per_existing_race");
    expect(migration).toContain("national_pipeline");

    const transferMarket = readFileSync(
      join(root, "services/transfer-market.ts"),
      "utf8",
    );
    const staffMarket = readFileSync(
      join(root, "services/team-staff.ts"),
      "utf8",
    );
    for (const source of [transferMarket, staffMarket]) {
      expect(source).toContain("loadFederationMarketNationalityWeights");
      expect(source).toContain("selectWeightedRandomDistinct");
    }
  });
});
