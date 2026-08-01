import { describe, expect, it } from "vitest";

import {
  groupFormerTeamRidersByDepartureSeason,
  type TeamRiderMemoryEntry,
} from "./team-rider-memory";

describe("groupFormerTeamRidersByDepartureSeason", () => {
  it("classe chaque ancien coureur une seule fois dans sa derni?re saison", () => {
    const seasons = groupFormerTeamRidersByDepartureSeason(
      [
        rider({
          id: "former-two-seasons",
          firstName: "Luc",
          lastName: "Bernard",
          firstGameYear: 1,
          firstSeasonName: "Saison 1",
          lastGameYear: 2,
          lastSeasonName: "Saison 2",
          seasonsCount: 2,
        }),
        rider({
          id: "former-season-one",
          firstName: "Adam",
          lastName: "Ziani",
          lastGameYear: 1,
          lastSeasonName: "Saison 1",
        }),
        rider({
          id: "former-season-two",
          firstName: "Nora",
          lastName: "Alami",
          firstGameYear: 2,
          firstSeasonName: "Saison 2",
          lastGameYear: 2,
          lastSeasonName: "Saison 2",
        }),
      ],
      3,
    );

    expect(seasons.map((season) => season.seasonName)).toEqual([
      "Saison 2",
      "Saison 1",
    ]);
    expect(seasons[0]?.riders.map((entry) => entry.id)).toEqual([
      "former-season-two",
      "former-two-seasons",
    ]);
    expect(
      seasons.flatMap((season) => season.riders).filter(
        (entry) => entry.id === "former-two-seasons",
      ),
    ).toHaveLength(1);
  });

  it("exclut l?effectif actif et les d?parts de la saison en cours", () => {
    const seasons = groupFormerTeamRidersByDepartureSeason(
      [
        rider({ id: "current", isCurrent: true, lastGameYear: 4 }),
        rider({ id: "left-current", lastGameYear: 4 }),
        rider({ id: "former", lastGameYear: 3, lastSeasonName: "Saison 3" }),
      ],
      4,
    );

    expect(seasons).toHaveLength(1);
    expect(seasons[0]?.riders.map((entry) => entry.id)).toEqual(["former"]);
  });
});

function rider(
  overrides: Partial<TeamRiderMemoryEntry> = {},
): TeamRiderMemoryEntry {
  return {
    id: "rider",
    firstName: "Jean",
    lastName: "Martin",
    countryName: "France",
    countryCode: "FR",
    avatarProfileKey: "default",
    avatarSeed: 1,
    age: 27,
    firstSeasonName: "Saison 1",
    firstGameYear: 1,
    lastSeasonName: "Saison 1",
    lastGameYear: 1,
    seasonsCount: 1,
    isCurrent: false,
    isArchived: false,
    retirementSeasonName: null,
    ...overrides,
  };
}
