import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  RaceGroupSnapshot,
  RacePrimeResult,
  RaceTimelineSnapshot,
  StageRaceStandings,
  StageSimulationResult,
} from "@/lib/game/race-simulation";

import {
  PreviousStageStandings,
  PrimeClassificationPopup,
  RaceDirectorCar,
  RaceGapLine,
  RoadTextureOverlay,
  RoadSurfaceDefinition,
  buildLiveClassificationRows,
  getGroupScreenPosition,
} from "./race-live-lab";

describe("buildLiveClassificationRows", () => {
  it("bascule sur les rangs officiels à la fin du direct", () => {
    const snapshot: RaceTimelineSnapshot = {
      segmentNumber: 1,
      completedDistanceKm: 162,
      groups: [
        {
          id: "finish-group",
          label: "Groupe de tête",
          type: "peloton",
          riderIds: ["mirza", "tolosa", "mansour", "sidibe"],
          gapToLeaderSeconds: 0,
          averageEnergy: 20,
        },
      ],
      incidents: [],
      abandonments: [],
      commentary: [],
    };
    const officialResults: StageSimulationResult["results"] = [
      {
        riderId: "sidibe",
        rank: 1,
        status: "finished",
        elapsedTimeSeconds: 16_570,
        gapToWinnerSeconds: 0,
        energyAfter: 20,
        injury: null,
        abandonment: null,
      },
      {
        riderId: "mirza",
        rank: 2,
        status: "finished",
        elapsedTimeSeconds: 16_570,
        gapToWinnerSeconds: 0,
        energyAfter: 20,
        injury: null,
        abandonment: null,
      },
      {
        riderId: "tolosa",
        rank: 3,
        status: "finished",
        elapsedTimeSeconds: 16_570,
        gapToWinnerSeconds: 0,
        energyAfter: 20,
        injury: null,
        abandonment: null,
      },
      {
        riderId: "mansour",
        rank: 4,
        status: "finished",
        elapsedTimeSeconds: 16_570,
        gapToWinnerSeconds: 0,
        energyAfter: 20,
        injury: null,
        abandonment: null,
      },
    ];

    expect(
      buildLiveClassificationRows({
        snapshot,
        officialResults,
        isRaceFinished: false,
      }).map(({ riderId }) => riderId)
    ).toEqual(["mirza", "tolosa", "mansour", "sidibe"]);
    expect(
      buildLiveClassificationRows({
        snapshot,
        officialResults,
        isRaceFinished: true,
      }).map(({ riderId, position }) => [position, riderId])
    ).toEqual([
      [1, "sidibe"],
      [2, "mirza"],
      [3, "tolosa"],
      [4, "mansour"],
    ]);
  });
});

describe("PreviousStageStandings", () => {
  it("affiche en bas du replay les classements établis après l’étape précédente", () => {
    const standings: StageRaceStandings = {
      general: [{ riderId: "rider-1", elapsedTimeSeconds: 12_345 }],
      mountain: [{ riderId: "rider-1", points: 18 }],
      sprint: [{ riderId: "rider-1", points: 24 }],
      youth: [{ riderId: "rider-1", elapsedTimeSeconds: 12_345 }],
      teams: [
        {
          teamId: "team-1",
          teamName: "Équipe Test",
          elapsedTimeSeconds: 12_345,
        },
      ],
    };
    const riderById = new Map([
      [
        "rider-1",
        {
          name: "Coureur Test",
          teamName: "Équipe Test",
          teamPrimaryColor: "#76543A",
          teamSecondaryColor: "#E6D7C4",
        },
      ],
    ]);

    const markup = renderToStaticMarkup(
      <PreviousStageStandings
        stageNumber={2}
        standings={standings}
        riderById={riderById}
      />,
    );

    expect(markup).toContain("data-replay-previous-stage-standings");
    expect(markup).toContain("Classements après l’étape 1");
    expect(markup).toContain("Coureur Test");
    expect(markup).toContain("Meilleur grimpeur");
    expect(markup).toContain("Meilleur sprinteur");
    expect(markup).toContain("Meilleur jeune");
    expect(markup).toContain("Meilleure équipe");
  });
});

describe("race visual primitives", () => {
  it("conserve une trajectoire continue lorsque deux groupes se croisent", () => {
    const leader: RaceGroupSnapshot = {
      id: "leader",
      label: "Peloton",
      type: "peloton",
      riderIds: ["leader"],
      gapToLeaderSeconds: 0,
      averageEnergy: 70,
    };
    const murray: RaceGroupSnapshot = {
      id: "murray",
      label: "Murray",
      type: "dropped",
      riderIds: ["murray"],
      gapToLeaderSeconds: 211,
      averageEnergy: 60,
    };
    const delayedPack: RaceGroupSnapshot = {
      id: "delayed-pack",
      label: "Groupe retardé",
      type: "dropped",
      riderIds: ["rider-1", "rider-2"],
      gapToLeaderSeconds: 280,
      averageEnergy: 55,
    };
    const beforeCatch = [leader, murray, delayedPack];
    const afterCatch = [
      leader,
      { ...delayedPack, gapToLeaderSeconds: 199 },
      { ...murray, gapToLeaderSeconds: 214 },
    ];
    const murrayBefore = getGroupScreenPosition(murray, beforeCatch);
    const delayedPackBefore = getGroupScreenPosition(
      delayedPack,
      beforeCatch,
    );
    const delayedPackAfter = getGroupScreenPosition(afterCatch[1], afterCatch);
    const murrayAfter = getGroupScreenPosition(afterCatch[2], afterCatch);

    expect(murrayBefore).toBeGreaterThan(delayedPackBefore);
    expect(delayedPackAfter).toBeGreaterThan(murrayAfter);
    expect(Math.abs(murrayAfter - murrayBefore)).toBeLessThan(12);
    expect(Math.abs(delayedPackAfter - delayedPackBefore)).toBeLessThan(12);
  });

  it("rotates only centered wheel rotors on the director car", () => {
    const markup = renderToStaticMarkup(<RaceDirectorCar isMoving />);

    expect(markup.match(/data-race-car-wheel="fine"/g)).toHaveLength(2);
    expect(markup.match(/data-race-car-wheel-rotor="centered"/g)).toHaveLength(2);
    expect(markup.match(/cm-race-car-wheel/g)).toHaveLength(2);
    expect(markup).toContain('data-race-car-front="right"');
    expect(markup).not.toContain("transform-origin");
  });

  it("uses one continuous asphalt tone without visible lane bands", () => {
    const markup = renderToStaticMarkup(
      <svg>
        <RoadSurfaceDefinition id="road-test" surface="asphalt" />
      </svg>,
    );

    expect(markup).toContain('data-road-asphalt-texture="layered-mineral"');
    expect(markup).toContain('fill="#35453F"');
    expect(markup).not.toContain("asphalt-base");
  });

  it("draws fine volumetric grey-brown cobbles", () => {
    const markup = renderToStaticMarkup(
      <svg>
        <RoadSurfaceDefinition id="cobble-test" surface="cobbles" />
      </svg>,
    );
    expect(markup).toContain('data-road-cobble-texture="volumetric-grid"');
    expect(markup).toContain("cobble-test-cobble-base");
    expect(markup).toContain("#AAA08F");
    expect(markup).not.toContain('fill="#67645C"');
  });

  it("moves cobbles from right to left with the SVG road-marking rhythm", () => {
    const markup = renderToStaticMarkup(
      <svg>
        <RoadSurfaceDefinition
          id="moving-cobbles"
          surface="cobbles"
          isMoving
        />
      </svg>,
    );

    expect(markup).toContain('data-road-cobble-flow="right-to-left"');
    expect(markup).toContain('dur="0.62s"');
    expect(markup).toContain('to="-36"');
  });

  it("moves top-view cobbles with the road-marking strip rhythm", () => {
    const markup = renderToStaticMarkup(
      <RoadTextureOverlay surface="cobbles" isMoving />,
    );

    expect(markup).toContain("cm-race-cobble-flow-strip");
    expect(markup).toContain('data-road-flow-direction="right-to-left"');
  });});

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
