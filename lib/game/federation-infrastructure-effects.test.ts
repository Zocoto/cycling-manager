import { describe, expect, it } from "vitest";

import {
  getBestNaturalizationRequiredDays,
  getFederationInfrastructureEffectPercentage,
  getFederationNaturalizationRequiredDays,
} from "./federation-infrastructure-effects";

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
});
