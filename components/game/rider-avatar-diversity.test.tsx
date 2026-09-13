import { createHash } from "node:crypto";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  createRiderAvatarDesign,
  createThirdGenerationRiderAvatarSeed,
} from "@/lib/rider-avatar";

import { RiderAvatar } from "./rider-avatar";

describe("rendu des portraits coureurs enrichis", () => {
  it("conserve au pixel vectoriel près trois portraits historiques", () => {
    const historicalCases = [
      {
        profileKey: "europe_west",
        seed: 42,
        hash: "fff87ca2ad976fdfdb45d43e334d160c450962acf000acb3bf6e6ffe91c4d266",
      },
      {
        profileKey: "central_africa",
        seed: 777,
        hash: "1f7032c328ca27c9c9c1653da7e0ff3371d5caa986a5cf6a30a8d0d097a0c37a",
      },
      {
        profileKey: "east_asia",
        seed: 123456,
        hash: "53050d9d83bb37343b2a666b1ed52542ba442e8be85c0f24a61310dd2873466f",
      },
    ] as const;

    for (const historicalCase of historicalCases) {
      const markup = renderToStaticMarkup(
        <RiderAvatar
          profileKey={historicalCase.profileKey}
          seed={historicalCase.seed}
          riderId={`historical-${historicalCase.seed}`}
        />,
      );

      expect(createHash("sha256").update(markup).digest("hex")).toBe(
        historicalCase.hash,
      );
    }
  });

  it("rend la barbe d’un jour comme une texture grise sous le visage", () => {
    const seed = findSeed((design) => design.facialHairStyle === "five-o-clock");
    const markup = renderToStaticMarkup(
      <RiderAvatar profileKey="europe_west" seed={seed} riderId="new-rider" />,
    );

    expect(markup).toContain('data-avatar-facial-hair="five-o-clock"');
    expect(markup).toContain('fill="#626966"');
    expect(markup).toContain('stroke-dasharray="0.7 1"');
  });

  it("rend les nouvelles coiffures et expressions sans changer de composant", () => {
    const longHairSeed = findSeed((design) => design.hairStyle === "ponytail");
    const expressiveSeed = findSeed(
      (design) => design.mouthStyle === "open-smile" && design.eyeStyle === "large",
    );

    const longHairMarkup = renderToStaticMarkup(
      <RiderAvatar profileKey="europe_west" seed={longHairSeed} riderId="long-hair" />,
    );
    const expressiveMarkup = renderToStaticMarkup(
      <RiderAvatar profileKey="europe_west" seed={expressiveSeed} riderId="expression" />,
    );

    expect(longHairMarkup).toContain("<ellipse");
    expect(expressiveMarkup).toContain('fill="#3A1E1B"');
    expect(expressiveMarkup).toContain('stroke="#F5EEE3"');
  });

  it("propose un portrait compact pour les longues listes", () => {
    const markup = renderToStaticMarkup(
      <RiderAvatar
        profileKey="europe_west"
        seed={42}
        riderId="compact-rider"
        renderMode="compact"
      />,
    );

    expect(markup).toContain('data-avatar-render-mode="compact"');
    expect(markup.match(/<(path|circle|ellipse|rect)\b/g)?.length).toBeLessThan(20);
  });

  it("rend les traits expressifs et les silhouettes capillaires de la v3", () => {
    const longHairSeed = findV3Seed(
      (design) => design.hairStyle === "shoulder-length",
    );
    const laughingSeed = findV3Seed(
      (design) => design.eyeStyle === "laughing",
    );
    const rictusSeed = findV3Seed(
      (design) => design.mouthStyle === "rictus",
    );
    const eagleNoseSeed = findV3Seed(
      (design) => design.noseStyle === "eagle",
    );

    const longHairMarkup = renderV3Avatar(longHairSeed, "long-hair-v3");
    const laughingMarkup = renderV3Avatar(laughingSeed, "laughing-v3");
    const rictusMarkup = renderV3Avatar(rictusSeed, "rictus-v3");
    const eagleNoseMarkup = renderV3Avatar(eagleNoseSeed, "eagle-nose-v3");

    expect(longHairMarkup).toContain('data-avatar-hair-style="shoulder-length"');
    expect(laughingMarkup).toContain('data-avatar-eye-style="laughing"');
    expect(rictusMarkup).toContain('data-avatar-mouth-style="rictus"');
    expect(eagleNoseMarkup).toContain('data-avatar-nose-style="eagle"');
  });
});

function renderV3Avatar(seed: string, riderId: string) {
  return renderToStaticMarkup(
    <RiderAvatar
      profileKey="europe_west"
      seed={seed}
      riderId={riderId}
      age={24}
    />,
  );
}

function findSeed(
  predicate: (design: ReturnType<typeof createRiderAvatarDesign>) => boolean,
) {
  for (let seed = 1; seed <= 100_000; seed += 1) {
    const design = createRiderAvatarDesign({
      profileKey: "europe_west",
      seed: -seed,
    });

    if (predicate(design)) return -seed;
  }

  throw new Error("Aucune graine de test compatible trouvée.");
}

function findV3Seed(
  predicate: (design: ReturnType<typeof createRiderAvatarDesign>) => boolean,
) {
  for (let identitySeed = 1; identitySeed <= 100_000; identitySeed += 1) {
    const seed = createThirdGenerationRiderAvatarSeed(identitySeed);
    const design = createRiderAvatarDesign({
      profileKey: "europe_west",
      seed,
      age: 24,
    });

    if (predicate(design)) return seed;
  }

  throw new Error("Aucune graine v3 de test compatible trouvée.");
}
