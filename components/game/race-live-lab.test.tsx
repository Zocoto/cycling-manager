import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  RaceGroupSnapshot,
  RacePrimeResult,
} from "@/lib/game/race-simulation";

import {
  PrimeClassificationPopup,
  RaceDirectorCar,
  RaceGapLine,
  RoadSurfaceDefinition,
} from "./race-live-lab";

describe("race visual primitives", () => {
  it("rotates only centered wheel rotors on the director car", () => {
    const markup = renderToStaticMarkup(<RaceDirectorCar isMoving />);

    expect(markup.match(/data-race-car-wheel="fine"/g)).toHaveLength(2);
    expect(markup.match(/data-race-car-wheel-rotor="centered"/g)).toHaveLength(2);
    expect(markup.match(/cm-race-car-wheel/g)).toHaveLength(2);
    expect(markup).not.toContain("transform-origin");
  });

  it("uses one continuous asphalt tone without visible lane bands", () => {
    const markup = renderToStaticMarkup(
      <svg>
        <RoadSurfaceDefinition id="road-test" surface="asphalt" />
      </svg>,
    );

    expect(markup).toContain('data-road-asphalt-texture="uniform"');
    expect(markup).toContain('fill="#35453F"');
    expect(markup).not.toContain("asphalt-base");
  });
});

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
describe("RaceGapLine", () => {
  it("centre la flèche de progression sur le trait entre les groupes", () => {
    const groups: RaceGroupSnapshot[] = [
      {
        id: "head",
        label: "Groupe de tête",
        type: "breakaway",
        riderIds: [],
        gapToLeaderSeconds: 0,
        averageEnergy: 62,
      },
      {
        id: "chase",
        label: "Groupe attardé",
        type: "chase",
        riderIds: [],
        gapToLeaderSeconds: 95,
        averageEnergy: 48,
      },
    ];
    const markup = renderToStaticMarkup(
      <RaceGapLine groups={groups} riderById={new Map()} />,
    );

    expect(markup).toContain('data-race-gap-arrow="on-line"');
    expect(markup).toContain("top-1/2");
    expect(markup).toContain("-translate-y-1/2");
    expect(markup).toContain("Groupe de tête");
  });
});