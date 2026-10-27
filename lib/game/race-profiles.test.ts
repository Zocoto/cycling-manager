import { describe, expect, it } from "vitest";

import {
  STANDARD_RACE_SEGMENT_KM,
  buildRaceSegments,
  ensureCompleteRaceSegments,
  getStageDistance,
  removeOneDayRaceMountainPrimes,
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

  it("retire les GPM d'une course d'un jour sans retirer son sprint intermediaire", () => {
    const segments = buildRaceSegments({
      distanceKm: 177,
      profileType: "mountain",
      seed: "classique",
      includeTourPrimes: true,
    });
    const hadIntermediateSprint =
      segments.some(
        (segment) =>
          segment.prime?.type ===
          "intermediate_sprint"
      );

    const sanitized =
      removeOneDayRaceMountainPrimes(
        segments,
        "one_day"
      );

    expect(
      sanitized.some(
        (segment) =>
          segment.prime?.type === "mountain"
      )
    ).toBe(false);
    expect(
      sanitized.some(
        (segment) =>
          segment.prime?.type ===
          "intermediate_sprint"
      )
    ).toBe(hadIntermediateSprint);
    expect(
      segments.some(
        (segment) =>
          segment.prime?.type === "mountain"
      )
    ).toBe(true);
  });

  it("conserve les GPM des courses par etapes", () => {
    const segments = buildRaceSegments({
      distanceKm: 177,
      profileType: "mountain",
      seed: "tour",
      includeTourPrimes: true,
    });

    expect(
      removeOneDayRaceMountainPrimes(
        segments,
        "stage_race"
      )
    ).toBe(segments);
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

  it("distingue la montagne des vallons par des cols moins nombreux et plus longs", () => {
    const mountain = buildRaceSegments({
      distanceKm: 190,
      profileType: "mountain",
      seed: "alpes",
    });
    const hilly = buildRaceSegments({
      distanceKm: 190,
      profileType: "hilly",
      seed: "alpes",
    });
    const climbDistances = (segments: typeof mountain) => {
      const climbs: number[] = [];
      let distance = 0;
      for (const segment of segments) {
        if (segment.terrain === "climb") distance += segment.distanceKm;
        else if (distance > 0) {
          climbs.push(distance);
          distance = 0;
        }
      }
      if (distance > 0) climbs.push(distance);
      return climbs;
    };
    const mountainClimbs = climbDistances(mountain);
    const hillyClimbs = climbDistances(hilly);

    expect(mountainClimbs.length).toBeLessThan(hillyClimbs.length);
    expect(Math.max(...mountainClimbs)).toBeGreaterThan(Math.max(...hillyClimbs));
    expect(mountain.at(-1)?.terrain).toBe("climb");
  });

  it("varie les finals vallonnés en privilégiant les arrivées pour puncheurs", () => {
    const profiles = Array.from({ length: 24 }, (_, index) =>
      buildRaceSegments({
        distanceKm: 147 + (index % 7),
        profileType: "hilly",
        seed: `vallons-${index}`,
      }),
    );
    const uphillFinishes = profiles.filter(
      (segments) => segments.at(-1)?.terrain === "climb",
    );
    const flatRunIns = profiles.filter(
      (segments) => segments.at(-1)?.terrain === "flat",
    );

    expect(uphillFinishes.length).toBeGreaterThanOrEqual(14);
    expect(flatRunIns.length).toBeGreaterThanOrEqual(3);
    for (const segments of uphillFinishes) {
      expect(segments.at(-1)?.distanceKm).toBeGreaterThanOrEqual(4);
      expect(segments.at(-1)?.distanceKm).toBeLessThanOrEqual(8);
      expect(segments.at(-1)?.averageGradientPct).toBeGreaterThanOrEqual(6.2);
    }
    for (const segments of flatRunIns) {
      expect(segments.at(-2)?.terrain).toBe("climb");
      expect(segments.at(-1)?.distanceKm).toBeGreaterThanOrEqual(6);
      expect(segments.at(-1)?.distanceKm).toBeLessThanOrEqual(10);
    }
    for (const [index, segments] of profiles.entries()) {
      expect(getStageDistance(segments)).toBe(147 + (index % 7));
    }
  });

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

describe("ensureCompleteRaceSegments", () => {
  it("expose les 21 tronçons effectifs du Monferrato lorsque les 19 tronçons stockés couvrent une autre distance", () => {
    const stored = Array.from({ length: 19 }, (_, index) => ({
      segmentNumber: index + 1,
      distanceKm: index === 18 ? 19 : 12,
      terrain: "flat" as const,
      averageGradientPct: 0,
      surface: "cobbles" as const,
      prime: null,
    }));
    expect(getStageDistance(stored)).toBe(235);
    const effective = ensureCompleteRaceSegments({
      segments: stored,
      distanceKm: 204,
      profileType: "cobbles",
      seed: "8855a85c-467b-4e8c-9535-cd59e97a9e3d",
    });

    expect(effective.map((segment) => segment.segmentNumber))
      .toEqual(Array.from({ length: 21 }, (_, index) => index + 1));
    expect(getStageDistance(effective)).toBe(204);
    expect(effective.at(-1)?.distanceKm).toBe(4);
  });

  it("respecte les identifiants d’un parcours complet aux tronçons non consécutifs", () => {
    const stored = [1, 7].map((segmentNumber) => ({
      segmentNumber, distanceKm: 20, terrain: "flat" as const,
      averageGradientPct: 0, surface: "asphalt" as const, prime: null,
    }));
    expect(ensureCompleteRaceSegments({
      segments: stored, distanceKm: 40, profileType: "flat", seed: "custom-route",
    })).toBe(stored);
  });

  it("conserve la même tolérance numérique que le contrôle des attaques en base", () => {
    const stored = [1, 2].map((segmentNumber) => ({
      segmentNumber, distanceKm: 102, terrain: "flat" as const,
      averageGradientPct: 0, surface: "asphalt" as const, prime: null,
    }));
    expect(ensureCompleteRaceSegments({
      segments: stored, distanceKm: 204.04, profileType: "flat", seed: "rounding-boundary",
    })).toBe(stored);
    // The existing browser/engine comparison uses double precision: this
    // difference is slightly larger than 0.05, so SQL must use the same rule.
    expect(ensureCompleteRaceSegments({
      segments: stored, distanceKm: 204.05, profileType: "flat", seed: "rounding-boundary",
    })).toHaveLength(21);
  });

  it("reconstruit une étape de 126 km lorsque seulement cinq tronçons ont été chargés", () => {
    const truncated = buildRaceSegments({
      distanceKm: 50,
      profileType: "sprint",
      seed: "profil-tronque",
    });

    const segments = ensureCompleteRaceSegments({
      segments: truncated,
      distanceKm: 126,
      profileType: "sprint",
      seed: "etape-126",
    });

    expect(segments).toHaveLength(13);
    expect(getStageDistance(segments)).toBe(126);
  });

  it("conserve un profil complet même si ses tronçons dépassent 10 km", () => {
    const complete = [
      {
        segmentNumber: 1,
        distanceKm: 25,
        terrain: "flat" as const,
        averageGradientPct: 0,
        surface: "asphalt" as const,
        prime: null,
      },
      {
        segmentNumber: 2,
        distanceKm: 15,
        terrain: "climb" as const,
        averageGradientPct: 5,
        surface: "asphalt" as const,
        prime: null,
      },
    ];

    expect(
      ensureCompleteRaceSegments({
        segments: complete,
        distanceKm: 40,
        profileType: "hilly",
        seed: "profil-variable",
      })
    ).toBe(complete);
  });
});
