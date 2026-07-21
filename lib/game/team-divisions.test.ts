import { describe, expect, it } from "vitest";

import {
  getTeamDivisionLabel,
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
});
