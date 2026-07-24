import { describe, expect, it } from "vitest";

import {
  TUTORIAL_RACE_SEGMENTS,
  TUTORIAL_RACE_SELECTION_SIZE,
  createTutorialRaceSeed,
  isTutorialRaceSelectionValid,
} from "@/lib/tutorial/tutorial-race";

describe("course d’initiation", () => {
  it("propose un parcours de 120 km en six tronçons", () => {
    expect(TUTORIAL_RACE_SEGMENTS).toHaveLength(6);
    expect(
      TUTORIAL_RACE_SEGMENTS.reduce(
        (total, segment) =>
          total + segment.distanceKm,
        0,
      ),
    ).toBe(120);
  });

  it("contient un secteur pavé et une montée", () => {
    expect(
      TUTORIAL_RACE_SEGMENTS.some(
        (segment) =>
          segment.surface === "cobbles",
      ),
    ).toBe(true);

    expect(
      TUTORIAL_RACE_SEGMENTS.some(
        (segment) =>
          segment.terrain === "climb",
      ),
    ).toBe(true);
  });

  it("exige exactement cinq coureurs différents", () => {
    const validIds = Array.from(
      { length: TUTORIAL_RACE_SELECTION_SIZE },
      (_, index) => `rider-${index}`,
    );

    expect(
      isTutorialRaceSelectionValid(validIds),
    ).toBe(true);

    expect(
      isTutorialRaceSelectionValid(
        validIds.slice(0, 4),
      ),
    ).toBe(false);

    expect(
      isTutorialRaceSelectionValid([
        ...validIds.slice(0, 4),
        validIds[0],
      ]),
    ).toBe(false);
  });

  it("génère une graine stable par Directeur Sportif", () => {
    expect(
      createTutorialRaceSeed("director-123"),
    ).toBe(
      createTutorialRaceSeed("director-123"),
    );

    expect(
      createTutorialRaceSeed("director-123"),
    ).not.toBe(
      createTutorialRaceSeed("director-456"),
    );
  });
});
