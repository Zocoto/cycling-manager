import { describe, expect, it } from "vitest";

import { SPONSORS } from "@/data/sponsors";

import {
  getSponsorMinimumReputation,
  SPONSOR_PRESTIGE_REPUTATION_THRESHOLDS,
  isSponsorEligibleForReputation,
} from "./sponsor-prestige";

describe("paliers de réputation des sponsors", () => {
  it("utilise les nouveaux seuils par prestige", () => {
    expect(SPONSOR_PRESTIGE_REPUTATION_THRESHOLDS).toEqual({
      1: 0,
      2: 30,
      3: 75,
      4: 300,
      5: 750,
    });
  });

  it.each([
    [3, 100, 75],
    [4, 500, 300],
    [5, 1_000, 750],
  ] as const)(
    "convertit l'ancien seuil du prestige %i de %i à %i",
    (prestige, legacyMinimum, expectedMinimum) => {
      expect(
        getSponsorMinimumReputation({
          prestige,
          minimumReputation: legacyMinimum,
        }),
      ).toBe(expectedMinimum);
    },
  );

  it("conserve une exigence spécifique lorsqu'elle dépasse le palier", () => {
    expect(
      getSponsorMinimumReputation({ prestige: 3, minimumReputation: 90 }),
    ).toBe(90);
  });

  it("ouvre tous les sponsors 5/5 à 750 sans attendre la réputation maximale", () => {
    const prestigeFiveSponsors = SPONSORS.filter(
      (sponsor) => sponsor.prestige === 5,
    );

    expect(prestigeFiveSponsors.length).toBeGreaterThan(0);
    expect(
      prestigeFiveSponsors.every(
        (sponsor) =>
          !isSponsorEligibleForReputation(sponsor, 749) &&
          isSponsorEligibleForReputation(sponsor, 750),
      ),
    ).toBe(true);
  });
});
