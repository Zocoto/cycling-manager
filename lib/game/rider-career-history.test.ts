import { describe, expect, it } from "vitest";

import type { PublicRiderProfile } from "@/services/public-rider-profile";
import { groupRiderCareerHistoryBySeason } from "./rider-career-history";

type HistoryEntry = PublicRiderProfile["history"][number];

function historyEntry(
  overrides: Partial<HistoryEntry> & Pick<HistoryEntry, "teamId" | "teamName">,
): HistoryEntry {
  return {
    seasonId: "season-2",
    seasonName: "Saison 2",
    gameYear: 2,
    transferFee: null,
    currencyCode: "EUR",
    joinedDayNumber: 1,
    leftDayNumber: null,
    victories: 0,
    points: 0,
    uciRank: 12,
    nationalTitles: [],
    worldTitles: [],
    continentalTitles: [],
    notablePerformances: [],
    careerLevel: "professional",
    juniorRaceCount: null,
    juniorPodiums: null,
    ...overrides,
  };
}

describe("historique de carrière regroupé par saison", () => {
  it("réunit les équipes transférées dans une seule saison et consolide les résultats", () => {
    const history = groupRiderCareerHistoryBySeason([
      historyEntry({
        teamId: "new-team",
        teamName: "Dodo Blue Finance",
        transferFee: 150_000,
        joinedDayNumber: 28,
        points: 540,
        victories: 2,
        notablePerformances: [
          {
            raceEditionId: "race-2",
            raceName: "Grand Prix du Sud",
            uciPoints: 140,
            labels: ["2e place"],
            finalRank: 2,
          },
        ],
      }),
      historyEntry({
        teamId: "old-team",
        teamName: "Beijing Racing",
        leftDayNumber: 28,
        points: 320,
        victories: 1,
        nationalTitles: [
          {
            type: "road",
            countryName: "France",
            countryCode: "FR",
          },
        ],
        notablePerformances: [
          {
            raceEditionId: "race-1",
            raceName: "Tour du Nord",
            uciPoints: 180,
            labels: ["1re place"],
            finalRank: 1,
          },
        ],
      }),
    ]);

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      seasonName: "Saison 2",
      victories: 3,
      points: 860,
      uciRank: 12,
    });
    expect(history[0]?.teams).toEqual([
      expect.objectContaining({
        teamId: "old-team",
        joinedDayNumber: 1,
        leftDayNumber: 28,
      }),
      expect.objectContaining({
        teamId: "new-team",
        joinedDayNumber: 28,
        transferFee: 150_000,
      }),
    ]);
    expect(history[0]?.notablePerformances.map((item) => item.raceEditionId)).toEqual([
      "race-1",
      "race-2",
    ]);
    expect(history[0]?.nationalTitles).toHaveLength(1);
  });

  it("conserve les valeurs nulles lorsqu’une saison ne possède aucun bilan", () => {
    const history = groupRiderCareerHistoryBySeason([
      historyEntry({
        seasonId: "season-1",
        seasonName: "Saison 1",
        gameYear: 1,
        teamId: "team-1",
        teamName: "Équipe 1",
        victories: null,
        points: null,
        uciRank: null,
      }),
    ]);

    expect(history[0]).toMatchObject({
      victories: null,
      points: null,
      uciRank: null,
    });
  });

  it("sépare l’année junior de l’année professionnelle dans une même saison", () => {
    const history = groupRiderCareerHistoryBySeason([
      historyEntry({
        teamId: "pro-team",
        teamName: "Dodo Blue Finance",
        joinedDayNumber: 26,
        victories: 0,
        points: 95,
      }),
      historyEntry({
        teamId: "dev-team",
        teamName: "Dodo Blue Finance Dev Team",
        careerLevel: "junior",
        juniorRaceCount: 9,
        juniorPodiums: 5,
        uciRank: null,
        victories: 3,
        points: 1_288,
      }),
    ]);

    expect(history).toHaveLength(2);
    expect(history.map((entry) => entry.careerLevel)).toEqual([
      "professional",
      "junior",
    ]);
    expect(history[0]).toMatchObject({ victories: 0, points: 95 });
    expect(history[1]).toMatchObject({
      victories: 3,
      points: 1_288,
      juniorRaceCount: 9,
      juniorPodiums: 5,
    });
  });
});
