import { describe, expect, it } from "vitest";

import {
  calculateFanClubAudience,
  calculateFanClubRiderPopularity,
  type FanClubSportingEvent,
} from "./fan-club-popularity";

function event(
  overrides: Partial<FanClubSportingEvent> = {},
): FanClubSportingEvent {
  return {
    id: "result-1",
    kind: "race_result",
    season: 3,
    day: 12,
    reason: "Tour test — Victoire",
    rank: 1,
    prestigeRank: 3,
    forCurrentTeam: true,
    ...overrides,
  };
}

function rider(events: FanClubSportingEvent[] = []) {
  return calculateFanClubRiderPopularity({
    id: "rider-1",
    name: "Alice Martin",
    initials: "AM",
    role: "Puncheuse",
    country: "France",
    nationalityMatchesTeam: true,
    activeSeason: 3,
    activeDay: 20,
    careerSeasons: [1, 2, 3],
    clubSeasons: [2, 3],
    events,
  });
}

describe("popularité réelle des coureurs", () => {
  it("transforme un résultat sportif en facteur et en historique explicite", () => {
    const popularity = rider([event()]);

    expect(popularity.factors[0]).toEqual({
      label: "Résultats récents",
      value: 7,
      maximum: 25,
    });
    expect(popularity.history.find((entry) => entry.reason === "Tour test — Victoire")).toMatchObject({
      reason: "Tour test — Victoire",
      season: 3,
      day: 12,
      category: "result",
    });
  });

  it("fait expirer la composante récente au changement de saison", () => {
    const popularity = calculateFanClubRiderPopularity({
      id: "rider-2",
      name: "Benoît Leroy",
      initials: "BL",
      role: "Rouleur",
      country: "Belgique",
      nationalityMatchesTeam: false,
      activeSeason: 3,
      activeDay: 10,
      careerSeasons: [1, 2, 3],
      clubSeasons: [1, 2, 3],
      events: [
        event({
          id: "old-result",
          season: 2,
          day: 24,
          reason: "Ancienne victoire",
        }),
      ],
    });

    expect(popularity.factors[0].value).toBe(0);
    expect(
      popularity.history.some(
        (entry) => entry.category === "decay" && entry.delta < 0,
      ),
    ).toBe(true);
  });

  it("autorise une première saison phénoménale à dépasser le plafond normal", () => {
    const events = Array.from({ length: 8 }, (_, index) =>
      event({
        id: `elite-${index}`,
        season: 1,
        day: index + 2,
        prestigeRank: 1,
      }),
    ).concat(
      Array.from({ length: 10 }, (_, index) =>
        event({
          id: `attack-${index}`,
          kind: "breakaway",
          season: 1,
          day: index + 2,
          rank: null,
          prestigeRank: 1,
        }),
      ),
    );
    const popularity = calculateFanClubRiderPopularity({
      id: "phenomenal",
      name: "Chloé Roy",
      initials: "CR",
      role: "Grimpeuse",
      country: "France",
      nationalityMatchesTeam: true,
      activeSeason: 1,
      activeDay: 20,
      careerSeasons: [1],
      clubSeasons: [1],
      events,
    });

    expect(popularity.phenomenalSeason).toBe(true);
    expect(popularity.popularity).toBeGreaterThan(60);
  });
});

describe("audience réelle du Fan Club", () => {
  it("augmente avec la réputation du DS et les résultats de son équipe", () => {
    const currentRider = rider();
    const withoutResults = calculateFanClubAudience({
      riders: [currentRider],
      directorReputation: 10,
      headquartersLevel: 1,
      activeSeason: 3,
      events: [],
    });
    const withResults = calculateFanClubAudience({
      riders: [currentRider],
      directorReputation: 50,
      headquartersLevel: 1,
      activeSeason: 3,
      events: [event()],
    });

    expect(withResults.supporterCount).toBeGreaterThan(
      withoutResults.supporterCount,
    );
    expect(withResults.breakdown.reputation).toBe(2_000);
    expect(withResults.breakdown.recentResults).toBeGreaterThan(0);
    expect(withResults.supporterTrend).toBeGreaterThan(0);
  });
});

