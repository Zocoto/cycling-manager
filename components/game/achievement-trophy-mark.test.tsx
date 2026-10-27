import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AchievementTrophyMark } from "@/components/game/achievement-trophy-mark";
import { ACHIEVEMENT_TROPHY_DEFINITIONS, type AchievementTrophyVisualVariant } from "@/lib/game/achievement-trophies";
import { PROSPECTIVE_ACHIEVEMENT_KEYS } from "@/lib/game/prospective-achievements";
import { buildTrophyGallery, getLockedTrophyTargets } from "@/lib/game/trophy-gallery";
import { SportingDirectorTrophyTile } from "./sporting-director-trophy-tile";
import { TrophyGallery } from "./trophy-gallery";

const variants: AchievementTrophyVisualVariant[] = [...new Set(Object.values(ACHIEVEMENT_TROPHY_DEFINITIONS).map(trophy => trophy.visualVariant))];

const palette = {
  primary: "#48D9C0",
  secondary: "#D7FFF8",
  accent: "#342A64",
  glow: "rgba(72, 217, 192, 0.42)",
};

describe("AchievementTrophyMark", () => {
  it("renders every catalogue identity as a lightweight flat SVG", () => {
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
    expect(markup).toContain('data-achievement-symbol="presidential-seal"');
  });

  it("gives every recent trophy and the welcome trophy distinct geometry even with identical colours", () => {
    const recentVariants: AchievementTrophyVisualVariant[] = [
      ...PROSPECTIVE_ACHIEVEMENT_KEYS.map(key => ACHIEVEMENT_TROPHY_DEFINITIONS[`journey_${key}`].visualVariant),
      ACHIEVEMENT_TROPHY_DEFINITIONS.premiers_tours_de_roue.visualVariant,
    ];
    const silhouettes = recentVariants.map(variant => renderToStaticMarkup(
      <AchievementTrophyMark variant={variant} palette={palette} />,
    ).replace(/data-achievement-(?:trophy-mark|symbol)="[^"]*"/g, ""));
    expect(new Set(recentVariants).size).toBe(recentVariants.length);
    expect(new Set(silhouettes).size).toBe(recentVariants.length);
    expect(recentVariants).not.toContain("panorama");
    expect(variants).toHaveLength(Object.keys(ACHIEVEMENT_TROPHY_DEFINITIONS).length);
  });

  it("uses the same new designs for existing awards, their gallery and public DS profile", () => {
    const entries = Object.entries(ACHIEVEMENT_TROPHY_DEFINITIONS);
    const gallery = buildTrophyGallery({ raceWins: [], teamUciTitles: [], riderUciTitles: [],
      specialAwards: entries.map(([key], index) => ({
        id: `earned-${index}`, trophyKey: key as keyof typeof ACHIEVEMENT_TROPHY_DEFINITIONS,
        availableAt: "2026-10-16T12:00:00Z", claimedAt: "2026-10-16T12:00:00Z", href: "/jeu/objectifs",
      })),
    });
    const privateMarkup = renderToStaticMarkup(<TrophyGallery gallery={gallery} />);
    const publicMarkup = renderToStaticMarkup(<SportingDirectorTrophyTile gallery={gallery} />);
    for (const [key, definition] of entries) {
      const award = gallery.trophies.find(trophy => trophy.title === definition.title);
      expect(award?.visualVariant).toBe(definition.visualVariant);
      expect(award?.wonAt).toBe("2026-10-16T12:00:00Z");
      expect(privateMarkup).toContain(`data-achievement-trophy-mark="${definition.visualVariant}"`);
      expect(publicMarkup).toContain(`data-achievement-trophy-mark="${definition.visualVariant}"`);
      expect(getLockedTrophyTargets(gallery.trophies).some(trophy => trophy.id === `locked:achievement:${key}`)).toBe(false);
    }
  });
});
