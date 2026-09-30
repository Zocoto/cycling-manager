import { describe, expect, it } from "vitest";

import { canTeamAccessRaceCategory } from "./regional-races";

describe("regional race access", () => {
  it("autorise uniquement une équipe amateure du continent organisateur", () => {
    expect(
      canTeamAccessRaceCategory({
        categoryCode: "regional",
        raceCountryCode: "US",
        raceContinentCode: "america",
        context: {
          isAmateur: true,
          teamCountryCode: "CA",
          teamContinentCode: "america",
        },
      }),
    ).toBe(true);
    expect(
      canTeamAccessRaceCategory({
        categoryCode: "regional",
        raceCountryCode: "US",
        raceContinentCode: "america",
        context: {
          isAmateur: true,
          teamCountryCode: "JP",
          teamContinentCode: "asia",
        },
      }),
    ).toBe(false);
    expect(
      canTeamAccessRaceCategory({
        categoryCode: "regional",
        raceCountryCode: "US",
        raceContinentCode: "america",
        context: {
          isAmateur: false,
          teamCountryCode: "CA",
          teamContinentCode: "america",
        },
      }),
    ).toBe(false);
  });

  it("ne filtre pas les catégories supérieures", () => {
    expect(
      canTeamAccessRaceCategory({
        categoryCode: "national",
        raceCountryCode: "US",
        raceContinentCode: "america",
        context: null,
      }),
    ).toBe(true);
  });

  it("réserve une course locale aux équipes du pays organisateur", () => {
    expect(
      canTeamAccessRaceCategory({
        categoryCode: "local",
        raceCountryCode: "BE",
        raceContinentCode: "europe",
        context: {
          isAmateur: false,
          teamCountryCode: "BE",
          teamContinentCode: "europe",
        },
      }),
    ).toBe(true);
    expect(
      canTeamAccessRaceCategory({
        categoryCode: "local",
        raceCountryCode: "BE",
        raceContinentCode: "europe",
        context: {
          isAmateur: true,
          teamCountryCode: "FR",
          teamContinentCode: "europe",
        },
      }),
    ).toBe(false);
  });
});
