import { describe, expect, it } from "vitest";

import {
  getRaceQuickPreviewTargetFromHref,
  summarizeCobbles,
} from "./race-quick-preview";

describe("race quick preview links", () => {
  it.each([
    [
      "/jeu/courses/tour-des-alpes#inscription",
      { slug: "tour-des-alpes", stageNumber: null },
    ],
    [
      "/jeu/resultats/tour-des-alpes",
      { slug: "tour-des-alpes", stageNumber: null },
    ],
    [
      "/jeu/resultats/tour-des-alpes/3?onglet=classement",
      { slug: "tour-des-alpes", stageNumber: 3 },
    ],
  ])("recognizes %s", (href, expected) => {
    expect(getRaceQuickPreviewTargetFromHref(href)).toEqual(expected);
  });

  it("ignores routes that are not race profiles", () => {
    expect(
      getRaceQuickPreviewTargetFromHref("/jeu/resultats"),
    ).toBeNull();
    expect(
      getRaceQuickPreviewTargetFromHref("/jeu/coureurs/123"),
    ).toBeNull();
  });
});

describe("cobbled sectors summary", () => {
  it("groups consecutive cobbled segments into the same sector", () => {
    expect(
      summarizeCobbles([
        createSegment(1, "asphalt", 12),
        createSegment(2, "cobbles", 4.5),
        createSegment(3, "cobbles", 3),
        createSegment(4, "asphalt", 10),
        createSegment(5, "cobbles", 2),
      ]),
    ).toEqual({
      sectorCount: 2,
      distanceKm: 9.5,
    });
  });
});

function createSegment(
  segmentNumber: number,
  surface: "asphalt" | "cobbles",
  distanceKm: number,
) {
  return {
    segmentNumber,
    distanceKm,
    terrain: "flat" as const,
    averageGradientPct: 0,
    surface,
    prime: null,
  };
}
