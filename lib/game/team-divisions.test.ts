import { describe, expect, it } from "vitest";

import {
  getTeamDivisionLabel,
  getTeamSportingStatusLabel,
  normalizeTeamDivisionCode,
} from "@/lib/game/team-divisions";

describe("team divisions", () => {
  it("preserves a persisted seasonal division", () => {
    expect(normalizeTeamDivisionCode("elite")).toBe("elite");
    expect(normalizeTeamDivisionCode("continental")).toBe("continental");
  });

  it("treats a missing seasonal assignment as amateur", () => {
    expect(normalizeTeamDivisionCode(null)).toBe("amateur");
    expect(normalizeTeamDivisionCode("unknown")).toBe("amateur");
    expect(getTeamDivisionLabel(null)).toBe("Amateur");
  });

  it("presents a sponsored amateur-division team as professional", () => {
    expect(getTeamSportingStatusLabel("amateur", false)).toBe("Amateur");
    expect(getTeamSportingStatusLabel("amateur", true)).toBe(
      "Professionnelle"
    );
    expect(getTeamSportingStatusLabel("continental", true)).toBe(
      "Continentale"
    );
  });
});
