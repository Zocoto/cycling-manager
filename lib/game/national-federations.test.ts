import { describe, expect, it } from "vitest";

import {
  FEDERATION_MANAGEMENT_START_GAME_YEAR,
  canAccessNationalFederationManagement,
  getFederationDivisionPreview,
  getFederationManagementPhase,
  getInternationalAcademyImpact,
  isFederationManagementSeason,
  parseNationalFederationTab,
} from "./national-federations";

describe("national federations", () => {
  it("keeps management in preview during Season 2", () => {
    expect(FEDERATION_MANAGEMENT_START_GAME_YEAR).toBe(3);
    expect(getFederationManagementPhase(2)).toBe("preview");
    expect(isFederationManagementSeason(2)).toBe(false);
    expect(getFederationManagementPhase(3)).toBe("automatic");
    expect(isFederationManagementSeason(3)).toBe(true);
  });

  it("normalizes federation tabs", () => {
    expect(parseNationalFederationTab("finances")).toBe("finances");
    expect(parseNationalFederationTab("races")).toBe("races");
    expect(parseNationalFederationTab(["lounge", "overview"])).toBe("lounge");
    expect(parseNationalFederationTab("unknown")).toBe("overview");
    expect(parseNationalFederationTab(undefined)).toBe("overview");
  });

  it("reserves federation management to teams from that federation", () => {
    expect(canAccessNationalFederationManagement("fr", "FR")).toBe(true);
    expect(canAccessNationalFederationManagement("BE", "FR")).toBe(false);
    expect(canAccessNationalFederationManagement(null, "FR")).toBe(false);
    expect(canAccessNationalFederationManagement("FRA", "FR")).toBe(false);
  });

  it("previews divisions from the previous UCI rank", () => {
    expect(getFederationDivisionPreview(1).label).toBe("Division 1");
    expect(getFederationDivisionPreview(21)).toEqual({
      division: 2,
      group: "A",
      label: "Division 2 · groupe A",
    });
    expect(getFederationDivisionPreview(22).group).toBe("B");
    expect(getFederationDivisionPreview(101).group).toBe("A");
    expect(getFederationDivisionPreview(null).label).toContain("à confirmer");
  });

  it("caps the shared academy impact at 90 percent", () => {
    expect(getInternationalAcademyImpact([1, 2, 3])).toBe(26);
    expect(getInternationalAcademyImpact([5, 5])).toBe(39);
    expect(getInternationalAcademyImpact([-4, 12])).toBe(22);
  });
});
