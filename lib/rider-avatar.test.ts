import { describe, expect, it } from "vitest";

import {
  createRiderAvatarDesign,
  getRiderAvatarFeatureLayout,
  isExpandedRiderAvatarSeed,
  RIDER_AVATAR_PROFILE_KEYS,
} from "./rider-avatar";

describe("générateur de portraits coureurs", () => {
  it("reproduit exactement le même visage avec la même graine", () => {
    const first = createRiderAvatarDesign({
      profileKey: "europe_west",
      seed: "123456789",
      age: 24,
    });
    const second = createRiderAvatarDesign({
      profileKey: "europe_west",
      seed: "123456789",
      age: 24,
    });

    expect(second).toEqual(first);
  });

  it("conserve les visages historiques attribués avant la v2", () => {
    const historicalCases = [
      {
        profileKey: "europe_west",
        seed: 42,
        expected: {
          version: 1,
          hairStyle: "curly",
          eyeStyle: "round",
          noseStyle: "compact",
          mouthStyle: "full",
          earStyle: "small",
          faceShape: "round",
          facialHairStyle: "clean",
          eyeColor: "#6C768B",
          geometrySignature: "8-10-12-4-8-8-4-4-5-9-4-3-8-1-4-9-7-6-1-0",
        },
      },
      {
        profileKey: "central_africa",
        seed: 777,
        expected: {
          version: 1,
          hairStyle: "shaved",
          eyeStyle: "deep",
          noseStyle: "broad",
          mouthStyle: "narrow",
          earStyle: "rounded",
          faceShape: "long",
          facialHairStyle: "clean",
          eyeColor: "#503D2C",
          geometrySignature: "12-9-12-6-5-5-7-4-1-9-6-5-5-0-1-6-4-3-0-0",
        },
      },
      {
        profileKey: "east_asia",
        seed: 123456,
        expected: {
          version: 1,
          hairStyle: "messy",
          eyeStyle: "deep",
          noseStyle: "angular",
          mouthStyle: "full",
          earStyle: "attached",
          faceShape: "heart",
          facialHairStyle: "short-beard",
          eyeColor: "#2B211A",
          geometrySignature: "2-5-1-9-9-2-7-0-9-2-1-3-8-5-4-5-2-4-1-0",
        },
      },
    ] as const;

    for (const historicalCase of historicalCases) {
      const design = createRiderAvatarDesign(historicalCase);

      expect(design).toMatchObject(historicalCase.expected);
      expect(design.rightEyeColor).toBe(design.eyeColor);
      expect(design.gazeStyle).toBe("centered");
      expect(design.browStyle).toBe("classic");
    }
  });

  it("produit une géométrie distincte pour 10 000 graines successives", () => {
    const signatures = new Set<string>();

    for (let seed = 1; seed <= 10_000; seed += 1) {
      const design = createRiderAvatarDesign({
        profileKey: "europe_west",
        seed,
      });

      signatures.add(design.geometrySignature);
    }

    expect(signatures.size).toBe(10_000);
  });

  it("conserve une séparation nette entre le nez et la bouche", () => {
    for (let seed = 1; seed <= 10_000; seed += 1) {
      const design = createRiderAvatarDesign({
        profileKey: "europe_west",
        seed,
      });
      const layout = getRiderAvatarFeatureLayout(design);

      expect(layout.mouthY - layout.noseTipY).toBeGreaterThanOrEqual(3.1);
      expect(layout.faceBottom - layout.mouthY).toBeLessThanOrEqual(7.7);
      expect(layout.faceBottom - layout.mouthY).toBeGreaterThanOrEqual(5.8);
    }
  });

  it("préserve toutes les familles historiques pour les graines positives", () => {
    const eyeStyles = new Set<string>();
    const noseStyles = new Set<string>();
    const mouthStyles = new Set<string>();
    const earStyles = new Set<string>();
    const faceShapes = new Set<string>();

    for (let seed = 1; seed <= 4_000; seed += 1) {
      const design = createRiderAvatarDesign({
        profileKey: "europe_west",
        seed,
      });

      eyeStyles.add(design.eyeStyle);
      noseStyles.add(design.noseStyle);
      mouthStyles.add(design.mouthStyle);
      earStyles.add(design.earStyle);
      faceShapes.add(design.faceShape);
    }

    expect(eyeStyles.size).toBe(10);
    expect(noseStyles.size).toBe(10);
    expect(mouthStyles.size).toBe(10);
    expect(earStyles.size).toBe(6);
    expect(faceShapes.size).toBe(7);
  });

  it("répartit toutes les familles enrichies sur les nouvelles graines", () => {
    const hairStyles = new Set<string>();
    const eyeStyles = new Set<string>();
    const noseStyles = new Set<string>();
    const mouthStyles = new Set<string>();
    const earStyles = new Set<string>();
    const faceShapes = new Set<string>();
    const facialHairStyles = new Set<string>();
    const gazeStyles = new Set<string>();

    for (let seed = 1; seed <= 24_000; seed += 1) {
      const profileKey =
        seed % 3 === 0
          ? "central_africa"
          : seed % 3 === 1
            ? "europe_west"
            : "east_asia";
      const design = createRiderAvatarDesign({ profileKey, seed: -seed });

      hairStyles.add(design.hairStyle);
      eyeStyles.add(design.eyeStyle);
      noseStyles.add(design.noseStyle);
      mouthStyles.add(design.mouthStyle);
      earStyles.add(design.earStyle);
      faceShapes.add(design.faceShape);
      facialHairStyles.add(design.facialHairStyle);
      gazeStyles.add(design.gazeStyle);
    }

    expect(hairStyles).toEqual(
      new Set([
        "afro",
        "braids",
        "buzz",
        "coily",
        "crop",
        "curly",
        "dreadlocks",
        "football-curl",
        "fringe",
        "long-dreadlocks",
        "man-bun",
        "messy",
        "mohawk",
        "ponytail",
        "quiff",
        "shaved",
        "short-locks",
        "side-part",
        "slicked",
        "undercut",
        "waves",
      ]),
    );
    expect(eyeStyles.size).toBe(15);
    expect(noseStyles.size).toBe(16);
    expect(mouthStyles.size).toBe(16);
    expect(earStyles.size).toBe(10);
    expect(faceShapes.size).toBe(9);
    expect(facialHairStyles).toEqual(
      new Set([
        "chinstrap",
        "clean",
        "five-o-clock",
        "full-beard",
        "goatee",
        "handlebar",
        "light-beard",
        "long-beard",
        "moustache",
        "sideburns",
        "short-beard",
        "stubble",
        "thick-moustache",
      ]),
    );
    expect(gazeStyles).toEqual(
      new Set(["centered", "crossed", "left", "right", "wall-eyed"]),
    );
  });

  it("garde cheveux longs, fortes pilosités et strabisme rares", () => {
    const sampleSize = 32_000;
    let longHairCount = 0;
    let heavyFacialHairCount = 0;
    let fiveOClockCount = 0;
    let strabismusCount = 0;

    for (let seed = 1; seed <= sampleSize; seed += 1) {
      const design = createRiderAvatarDesign({
        profileKey: "europe_west",
        seed: -seed,
      });

      if (["man-bun", "ponytail", "long-dreadlocks"].includes(design.hairStyle)) {
        longHairCount += 1;
      }
      if (
        ["full-beard", "handlebar", "long-beard", "thick-moustache"].includes(
          design.facialHairStyle,
        )
      ) {
        heavyFacialHairCount += 1;
      }
      if (design.facialHairStyle === "five-o-clock") fiveOClockCount += 1;
      if (["crossed", "wall-eyed"].includes(design.gazeStyle)) {
        strabismusCount += 1;
      }
    }

    expect(longHairCount / sampleSize).toBeGreaterThan(0);
    expect(longHairCount / sampleSize).toBeLessThan(0.15);
    expect(heavyFacialHairCount / sampleSize).toBeGreaterThan(0);
    expect(heavyFacialHairCount / sampleSize).toBeLessThan(0.05);
    expect(fiveOClockCount / sampleSize).toBeGreaterThan(0.1);
    expect(strabismusCount / sampleSize).toBeGreaterThan(0);
    expect(strabismusCount / sampleSize).toBeLessThan(0.03);
  });

  it("active la v2 uniquement avec les nouvelles graines négatives", () => {
    expect(isExpandedRiderAvatarSeed(-42)).toBe(true);
    expect(isExpandedRiderAvatarSeed("-42")).toBe(true);
    expect(isExpandedRiderAvatarSeed(42)).toBe(false);
    expect(isExpandedRiderAvatarSeed("42")).toBe(false);

    expect(
      createRiderAvatarDesign({ profileKey: "europe_west", seed: -42 }).version,
    ).toBe(2);
    expect(
      createRiderAvatarDesign({ profileKey: "europe_west", seed: 42 }).version,
    ).toBe(1);
  });

  it("prend en charge les 22 profils géographiques de la base", () => {
    const groups = new Set(
      RIDER_AVATAR_PROFILE_KEYS.map(
        (profileKey, index) =>
          createRiderAvatarDesign({
            profileKey,
            seed: index + 1,
          }).profileGroup
      )
    );

    expect(RIDER_AVATAR_PROFILE_KEYS).toHaveLength(22);
    expect(groups).toEqual(
      new Set([
        "africa",
        "east_asia",
        "europe",
        "latin_america",
        "mixed",
        "south_asia",
        "southeast_asia",
        "west_asia",
      ])
    );
  });

  it("reste robuste si une ancienne donnée d’avatar manque", () => {
    const design = createRiderAvatarDesign({
      profileKey: null,
      seed: null,
      fallbackKey: "rider-legacy-id",
    });

    expect(design.profileKey).toBe("north_america");
    expect(design.seed).toMatch(/^\d+$/);
  });
});
