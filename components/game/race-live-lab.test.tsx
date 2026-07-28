import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RacePrimeResult } from "@/lib/game/race-simulation";

import { PrimeClassificationPopup } from "./race-live-lab";

describe("PrimeClassificationPopup", () => {
  it("reste compact et replié par défaut sur téléphone", () => {
    const primeResult: RacePrimeResult = {
      segmentNumber: 4,
      prime: {
        type: "intermediate_sprint",
        category: null,
        pointsScale: [10, 6, 4, 2, 1],
      },
      classification: Array.from({ length: 5 }, (_, index) => ({
        riderId: `rider-${index + 1}`,
        rank: index + 1,
        points: [10, 6, 4, 2, 1][index],
      })),
    };
    const riderById = new Map(
      primeResult.classification.map(({ riderId, rank }) => [
        riderId,
        {
          name: `Coureur ${rank}`,
          teamName: `Équipe ${rank}`,
        },
      ]),
    );
    const markup = renderToStaticMarkup(
      <PrimeClassificationPopup
        primeResult={primeResult}
        riderById={riderById}
      />,
    );

    expect(markup).toContain(
      'data-mobile-prime-classification="compact"',
    );
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-label="Afficher le top 5"');
    expect(
      markup.match(/data-mobile-visibility="expandable"/g),
    ).toHaveLength(2);
    expect(markup).toContain("hidden lg:grid");
  });
});
