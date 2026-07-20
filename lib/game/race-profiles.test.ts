import { describe, expect, it } from "vitest";

import {
  STANDARD_RACE_SEGMENT_KM,
  buildRaceSegments,
  getStageDistance,
} from "./race-profiles";

describe("buildRaceSegments", () => {
  it("découpe 154 km en quinze tronçons de 10 km puis un de 4 km", () => {
    const segments = buildRaceSegments({
      distanceKm: 154,
      profileType: "sprint",
      seed: "littoral",
    });

    expect(segments).toHaveLength(16);
    expect(segments.slice(0, -1).every((segment) => segment.distanceKm === STANDARD_RACE_SEGMENT_KM)).toBe(true);
    expect(segments.at(-1)?.distanceKm).toBe(4);
    expect(getStageDistance(segments)).toBe(154);
  });

  it("respecte la cohérence terrain/pente", () => {
    const segments = buildRaceSegments({
      distanceKm: 177,
      profileType: "mountain",
      seed: "tyrol",
      includeTourPrimes: true,
    });

    for (const segment of segments) {
      if (segment.terrain === "flat") {
        expect(segment.averageGradientPct).toBe(0);
      } else if (segment.terrain === "climb") {
        expect(segment.averageGradientPct).toBeGreaterThan(0);
      } else {
        expect(segment.averageGradientPct).toBeLessThan(0);
      }
    }
  });

  it("place des pavés uniquement sur le profil pavé", () => {
    const cobbled = buildRaceSegments({
      distanceKm: 166,
      profileType: "cobbles",
      seed: 4,
    });
    const hilly = buildRaceSegments({
      distanceKm: 171,
      profileType: "hilly",
      seed: 4,
    });

    expect(cobbled.some((segment) => segment.surface === "cobbles")).toBe(true);
    expect(hilly.every((segment) => segment.surface === "asphalt")).toBe(true);
  });

  it("place des GPM et un sprint intermédiaire sur les tours", () => {
    const segments = buildRaceSegments({
      distanceKm: 177,
      profileType: "mountain",
      seed: "tour",
      includeTourPrimes: true,
    });

    expect(segments.some((segment) => segment.prime?.type === "mountain")).toBe(true);
    expect(segments.some((segment) => segment.prime?.type === "intermediate_sprint")).toBe(true);
  });

  it("reproduit exactement un profil à graine identique", () => {
    const input = {
      distanceKm: 192,
      profileType: "hilly" as const,
      seed: "profil-rejouable",
      includeTourPrimes: true,
    };

    expect(buildRaceSegments(input)).toEqual(buildRaceSegments(input));
  });
});
