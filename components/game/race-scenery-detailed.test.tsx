import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  RaceBiotopeForeground,
  RaceSceneryBackdrop,
} from "./race-scenery-detailed";

describe("detailed race scenery", () => {
  const biotopeIdentity = {
    forest: 'data-race-biotope-detail="forest-canopy-depth"',
    fields: 'data-race-biotope-detail="farm-machinery"',
    meadow: 'data-race-biotope-detail="grazing-animals"',
    coast: 'data-race-biotope-detail="coastal-water-depth"',
    village: 'data-race-building-detail="village-cafe"',
    urban: 'data-race-biotope-detail="urban-facade-depth"',
  } as const;

  it.each(["forest", "fields", "meadow", "coast", "village", "urban"] as const)(
    "adds a fine-grain detail layer to %s scenery",
    (kind) => {
      const markup = renderToStaticMarkup(
        <RaceSceneryBackdrop
          kind={kind}
          isMoving
          showSpectators={false}
        />,
      );

      expect(markup).toContain(`data-detailed-race-scenery="${kind}"`);
      expect(markup).toContain("cm-race-scenery-scroll");
      expect(markup).toContain("cm-race-scenery-scroll-far");
      expect(markup).toContain('data-race-scenery-parallax="far"');
      expect(markup).toContain('data-race-scenery-parallax="near"');
      expect(markup.match(/data-race-scenery-atmosphere="continuous"/g)).toHaveLength(2);
      expect(markup).toContain(
        'data-race-scenery-track="right-to-left"',
      );
      expect(markup.match(/data-race-scenery-copy="seamless"/g)).toHaveLength(2);
      expect(markup.match(/data-race-scenery-tile="near"/g)).toHaveLength(2);
      expect(markup.match(/data-race-biotope-fidelity="enhanced"/g)).toHaveLength(2);
      expect(markup.split(biotopeIdentity[kind]).length - 1).toBe(2);
      expect(markup).not.toContain("-left-[8%]");
      expect(markup).not.toContain("w-[116%]");
      expect(markup).not.toContain("cm-race-scenery-detail");
      expect(markup).toContain("micro-lines");
      expect(markup).toContain('data-race-scenery-texture="ground-fibers"');
      expect(markup).toContain('data-race-scenery-depth="atmosphere"');
      expect(markup).toContain("stonework");
      expect(markup).toContain("stucco");
      expect(markup).toContain("data-race-scenery-detail=");
      if (kind === "village") {
        expect(markup).toContain('data-race-building-texture="weathered-stucco"');
        expect(markup).toContain('data-race-building-detail="village-cafe"');
        expect(markup).toContain('data-race-building-detail="rain-gutter"');
        expect(markup).toContain('data-race-building-archetype="stone-bourg-house"');
        expect(markup).toContain('data-race-building-archetype="wide-farm-house"');
        expect(markup).toContain('data-race-building-proportion="widened-facade"');
        expect(markup).toContain('data-race-building-window-proportion="residential"');
        expect(markup).toContain('data-race-building-detail="window-lintel"');
        expect(markup).toContain('data-race-building-detail="window-reflection"');
        expect(markup).toContain('data-race-building-texture="facade-patina"');
        expect(markup).toContain('data-race-scenery-seam-zone="neutral"');
      }
      if (kind === "forest") {
        expect(markup.match(/data-race-biotope-grounding="understory-baseline-207"/g)).toHaveLength(2);
      }
      expect((markup.match(/<path/g) ?? []).length).toBeGreaterThan(15);
    },
  );

  const foregroundIdentity = {
    forest: 'data-race-biotope-foreground-detail="forest-ferns"',
    fields: 'data-race-biotope-foreground-detail="field-crop-edge"',
    meadow: 'data-race-biotope-foreground-detail="meadow-flower-verge"',
    coast: 'data-race-biotope-foreground-detail="coastal-verge"',
    village: 'data-race-biotope-foreground-detail="village-verge"',
    urban: 'data-race-biotope-foreground-detail="urban-pavement"',
  } as const;

  it.each(["forest", "fields", "meadow", "coast", "village", "urban"] as const)(
    "keeps a %s-specific foreground below the road corridor",
    (kind) => {
      const markup = renderToStaticMarkup(
        <RaceBiotopeForeground
          kind={kind}
          roadLeftY={282}
          roadRightY={248}
          isMoving
        />,
      );

      expect(markup).toContain(`data-race-biotope-foreground="${kind}"`);
      expect(markup).toContain(foregroundIdentity[kind]);
      expect(markup).toContain("clip-path");
      expect(markup).toContain('data-race-biotope-foreground-flow="slope-corrected"');
      expect(markup).toContain("cm-race-biotope-foreground-scroll");
      expect(markup.match(/data-race-biotope-foreground-copy=/g)).toHaveLength(2);
    },
  );
});
