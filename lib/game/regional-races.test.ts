import { describe, expect, it } from "vitest";

import { canTeamAccessRaceCategory } from "./regional-races";

describe("regional race access", () => {
  it("autorise uniquement une équipe amateure du continent organisateur", () => {
    expect(
      canTeamAccessRaceCategory({
        categoryCode: "regional",
        raceContinentCode: "america",
        context: { isAmateur: true, teamContinentCode: "america" },
      }),
    ).toBe(true);
    expect(
      canTeamAccessRaceCategory({
        categoryCode: "regional",
        raceContinentCode: "america",
        context: { isAmateur: true, teamContinentCode: "asia" },
      }),
    ).toBe(false);
    expect(
      canTeamAccessRaceCategory({
        categoryCode: "regional",
        raceContinentCode: "america",
        context: { isAmateur: false, teamContinentCode: "america" },
      }),
    ).toBe(false);
  });

  it("ne filtre pas les catégories supérieures", () => {
    expect(
      canTeamAccessRaceCategory({
        categoryCode: "national",
        raceContinentCode: "america",
        context: null,
      }),
    ).toBe(true);
  });
});
