import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AchievementTrophyMark } from "@/components/game/achievement-trophy-mark";
import type { AchievementTrophyVisualVariant } from "@/lib/game/achievement-trophies";

const variants: AchievementTrophyVisualVariant[] = [
  "astrolabe",
  "panorama",
  "apparatus",
  "regalia",
  "switchback",
  "poker-chips",
];

const palette = {
  primary: "#48D9C0",
  secondary: "#D7FFF8",
  accent: "#342A64",
  glow: "rgba(72, 217, 192, 0.42)",
};

describe("AchievementTrophyMark", () => {
  it("renders six simple flat SVG identities without raster artwork or gradients", () => {
    const markup = variants
      .map((variant) =>
        renderToStaticMarkup(
          <AchievementTrophyMark variant={variant} palette={palette} />,
        ),
      )
      .join("");

    for (const variant of variants) {
      expect(markup).toContain(`data-achievement-trophy-mark="${variant}"`);
    }

    expect(markup).not.toContain("<image");
    expect(markup).not.toContain("Gradient");
  });
});
