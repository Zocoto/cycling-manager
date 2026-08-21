import { describe, expect, it } from "vitest";

import {
  getSponsorInitialBudgetBonusPercent,
  resolveSponsorSportingPhilosophy,
  SPONSOR_SPORTING_PHILOSOPHY_CONFIG,
} from "./sponsor-philosophy";

describe("sponsor sporting philosophies", () => {
  it("attribue explicitement la préférence nationale aux marques territoriales", () => {
    expect(resolveSponsorSportingPhilosophy("terroirs-unis")).toBe(
      "national_preference",
    );
    expect(resolveSponsorSportingPhilosophy("nordhavn-post")).toBe(
      "national_preference",
    );
  });

  it("attribue explicitement la philosophie formateur aux projets de développement", () => {
    expect(resolveSponsorSportingPhilosophy("pura-cadencia-test-team")).toBe(
      "youth_development",
    );
    expect(resolveSponsorSportingPhilosophy("koru-racing-collective")).toBe(
      "youth_development",
    );
  });

  it("réserve un bonus budgétaire élevé à la préférence nationale", () => {
    expect(getSponsorInitialBudgetBonusPercent("national_preference")).toBe(15);
    expect(getSponsorInitialBudgetBonusPercent("youth_development")).toBe(0);
    expect(
      SPONSOR_SPORTING_PHILOSOPHY_CONFIG.national_preference.description,
    ).toContain("15 %");
  });
});
