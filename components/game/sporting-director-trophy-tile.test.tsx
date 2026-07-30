import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SportingDirectorTrophyTile } from "@/components/game/sporting-director-trophy-tile";
import { buildTrophyGallery } from "@/lib/game/trophy-gallery";

describe("SportingDirectorTrophyTile", () => {
  it("shows claimed distinctions on the public sporting director profile", () => {
    const gallery = buildTrophyGallery({
      raceWins: [],
      teamUciTitles: [],
      riderUciTitles: [],
      specialAwards: [
        {
          id: "alpha-award",
          trophyKey: "alpha_tester",
          availableAt: "2026-07-30T08:00:00.000Z",
          claimedAt: "2026-07-30T09:00:00.000Z",
          href: null,
        },
      ],
    });

    const markup = renderToStaticMarkup(
      <SportingDirectorTrophyTile gallery={gallery} />
    );

    expect(markup).toContain("Trophées du DS");
    expect(markup).toContain("Alphatesteur");
    expect(markup).toContain("Phase Alpha");
  });

  it("does not expose an unopened reward", () => {
    const gallery = buildTrophyGallery({
      raceWins: [],
      teamUciTitles: [],
      riderUciTitles: [],
      claimableTrophies: [
        {
          key: "alpha_tester",
          availableAt: "2026-07-30T08:00:00.000Z",
          title: "Alphatesteur",
          description: "Cadeau privé",
          avatarFrameKey: "alpha_tester",
          palette: {
            primary: "#48D9C0",
            secondary: "#D7FFF8",
            accent: "#342A64",
            glow: "rgba(72, 217, 192, 0.42)",
          },
        },
      ],
    });

    const markup = renderToStaticMarkup(
      <SportingDirectorTrophyTile gallery={gallery} />
    );

    expect(markup).toContain("Aucun trophée exposé");
    expect(markup).not.toContain("Cadeau privé");
  });
});