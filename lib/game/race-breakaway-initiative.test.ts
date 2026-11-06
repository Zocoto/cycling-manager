import { describe, expect, it } from "vitest";

import {
  getDomestiqueBreakawayInitiativeChance,
  MAX_DOMESTIQUE_BREAKAWAY_INITIATIVE_CHANCE,
  type DomestiqueBreakawayInitiativeContext,
} from "./race-breakaway-initiative";

const neutral: DomestiqueBreakawayInitiativeContext = {
  breakawayRating: 68,
  form: 85,
};
const chance = (changes: Partial<DomestiqueBreakawayInitiativeContext> = {}) =>
  getDomestiqueBreakawayInitiativeChance({ ...neutral, ...changes });

describe("spontaneous domestique breakaway initiative", () => {
  it("keeps an ordinary helper's initiative exceptional", () => {
    expect(chance()).toBeCloseTo(0.025);
    expect(chance({ breakawayRating: 40 })).toBeCloseTo(0.025);
    expect(chance({ breakawayRating: 79 })).toBeCloseTo(0.0625);
    expect(chance({ breakawayRating: 90 })).toBeCloseTo(0.1);
    expect(chance({ breakawayRating: 100 })).toBeCloseTo(0.1);
  });

  it("adds distinct motivation for a favorite race, home country and panache", () => {
    expect(chance({ favoriteRaceBonus: 2 })).toBeCloseTo(0.07);
    expect(chance({ riderCountryCode: "FR", raceCountryCode: "FR" })).toBeCloseTo(0.06);
    expect(chance({ hasPanache: true })).toBeCloseTo(0.045);
    expect(chance({ favoriteRaceBonus: 2, hasPanache: true,
      riderCountryCode: "FR", raceCountryCode: "FR" })).toBeCloseTo(0.125);
  });

  it("requires the rider's own nationality to match the race", () => {
    expect(chance({ riderCountryCode: "FR", raceCountryCode: "BE" })).toBeCloseTo(chance());
    expect(chance({ riderCountryCode: " fr ", raceCountryCode: "FR" })).toBeCloseTo(0.06);
    for (const code of [undefined, null, "", " ", "FRA", "🇫🇷"]) {
      expect(chance({ riderCountryCode: code, raceCountryCode: code })).toBeCloseTo(chance());
    }
  });

  it("does not turn missing or invalid favorite data into extra motivation", () => {
    for (const favoriteRaceBonus of [undefined, 0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(chance({ favoriteRaceBonus })).toBeCloseTo(chance());
    }
  });

  it("progressively reduces initiatives for tired riders", () => {
    expect(chance({ form: 20 })).toBe(0);
    expect(chance({ form: 45 })).toBe(0);
    expect(chance({ form: 65 })).toBeCloseTo(chance() / 2);
    expect(chance({ form: 100 })).toBeCloseTo(chance());
    const probabilities = [45, 55, 65, 75, 85, 95].map((form) => chance({ form }));
    expect(probabilities).toEqual([...probabilities].sort((first, second) => first - second));
  });

  it("respects conservative and aggressive team postures", () => {
    expect(chance({ collectivePosture: "conservative" })).toBeCloseTo(0.0125);
    expect(chance({ collectivePosture: "balanced" })).toBeCloseTo(0.025);
    expect(chance({ collectivePosture: "aggressive" })).toBeCloseTo(0.03);
  });

  it.each(["sprint", "general_classification"] as const)(
    "halves an unplanned initiative when the team's objective is %s",
    (objective) => {
      expect(chance({ objective })).toBeCloseTo(chance() / 2);
      expect(chance({ objective, collectivePosture: "conservative" })).toBeCloseTo(chance() / 4);
    },
  );

  it("preserves support for teams with major and medium favorites", () => {
    expect(chance({ favoriteTier: "major" })).toBeCloseTo(0.01);
    expect(chance({ favoriteTier: "medium" })).toBeCloseTo(0.0175);
    expect(chance({ favoriteTier: "none" })).toBeCloseTo(0.025);
  });

  it("never exceeds twenty percent even with every incentive and an aggressive posture", () => {
    expect(chance({
      breakawayRating: 100,
      favoriteRaceBonus: 2,
      riderCountryCode: "FR",
      raceCountryCode: "FR",
      hasPanache: true,
      collectivePosture: "aggressive",
    })).toBe(MAX_DOMESTIQUE_BREAKAWAY_INITIATIVE_CHANCE);
  });

  it("applies favorite-team restraint before the final cap", () => {
    expect(chance({ breakawayRating: 90, favoriteRaceBonus: 2,
      riderCountryCode: "FR", raceCountryCode: "FR", hasPanache: true,
      collectivePosture: "aggressive", favoriteTier: "major" })).toBeCloseTo(0.096);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "returns no initiative for a non-finite form or breakaway rating (%s)",
    (value) => {
      expect(chance({ form: value })).toBe(0);
      expect(chance({ breakawayRating: value })).toBe(0);
    },
  );

  it("is deterministic and never changes its input", () => {
    const context = Object.freeze({ ...neutral, favoriteRaceBonus: 2 });
    expect(getDomestiqueBreakawayInitiativeChance(context)).toBe(
      getDomestiqueBreakawayInitiativeChance(context),
    );
    expect(context).toEqual({ ...neutral, favoriteRaceBonus: 2 });
  });
});
