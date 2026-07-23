import { describe, expect, it } from "vitest";

import {
  createRiderAvatarDesign,
  getRiderAvatarFeatureLayout,
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

  it("répartit toutes les nouvelles familles de traits", () => {
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
