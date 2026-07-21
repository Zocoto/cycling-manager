import { describe, expect, it } from "vitest";

import {
  STANDARD_RACE_SEGMENT_KM,
  buildRaceSegments,
  getStageDistance,
  resolveRaceProfileType,
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

  it.each(["alpes", "andes", "tyrol", "atlas"])(
    "dessine de grands cols de trois à six tronçons (%s)",
    (seed) => {
      const segments = buildRaceSegments({
        distanceKm: 190,
        profileType: "mountain",
        seed,
      });
      const climbLengths: number[] = [];
      let currentLength = 0;

      for (const segment of segments) {
        if (segment.terrain === "climb") {
          currentLength += 1;
          expect(segment.averageGradientPct).toBeGreaterThanOrEqual(5.8);
        } else if (currentLength > 0) {
          climbLengths.push(currentLength);
          currentLength = 0;
        }
      }
      if (currentLength > 0) climbLengths.push(currentLength);

      expect(Math.max(...climbLengths)).toBeGreaterThanOrEqual(3);
      expect(Math.max(...climbLengths)).toBeLessThanOrEqual(6);
    }
  );

  it.each([181, 194, 207])(
    "termine une étape de montagne à son point culminant (%s km)",
    (distanceKm) => {
      const segments = buildRaceSegments({
        distanceKm,
        profileType: "mountain",
        seed: `sommet-${distanceKm}`,
      });
      let elevation = 0;
      const elevations = segments.map((segment) => {
        elevation +=
          segment.distanceKm * segment.averageGradientPct * 10;
        return elevation;
      });

      expect(segments.at(-1)?.terrain).toBe("climb");
      expect(elevations.at(-1)).toBe(Math.max(...elevations));
    }
  );

  it("reclasse une étape plate terminée par une côte intense", () => {
    const segments = buildRaceSegments({
      distanceKm: 154,
      profileType: "sprint",
      seed: "littoral",
    });
    const finish = segments.at(-1);

    if (!finish) throw new Error("Le dernier tronçon est manquant.");
    finish.terrain = "climb";
    finish.averageGradientPct = 5.8;

    expect(resolveRaceProfileType("sprint", segments)).toBe("hilly");
  });

  it("reclasse en montagne une longue ascension, même avant l'arrivée", () => {
    const segments = buildRaceSegments({
      distanceKm: 170,
      profileType: "flat",
      seed: "grand-col",
    });

    for (const index of [6, 7, 8, 9]) {
      segments[index].terrain = "climb";
      segments[index].averageGradientPct = 6.5;
    }

    expect(resolveRaceProfileType("flat", segments)).toBe("mountain");
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
