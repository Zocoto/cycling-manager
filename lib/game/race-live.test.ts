import { describe, expect, it } from "vitest";

import {
  canSimulateRaceEdition,
  getEstimatedLiveDurationMinutes,
  getRaceExperienceAvailability,
  getRaceResultsHref,
  getStageLiveState,
  selectRaceStageForLiveAccess,
} from "./race-live";

const STAGE = {
  departureAt: "2026-07-20T18:00:00.000Z",
  distanceKm: 150,
  status: "planned" as const,
};

describe("getStageLiveState", () => {
  it("programme une course de 150 km sur 25 minutes", () => {
    expect(getEstimatedLiveDurationMinutes(150)).toBe(25);
    expect(
      getStageLiveState(STAGE, new Date("2026-07-20T17:59:59.000Z"))
    ).toMatchObject({ status: "scheduled", progress: 0 });
  });

  it("fait progresser le live selon l'heure réelle", () => {
    const state = getStageLiveState(
      STAGE,
      new Date("2026-07-20T18:12:30.000Z")
    );

    expect(state.status).toBe("live");
    expect(state.progress).toBeCloseTo(0.5, 3);
  });

  it("rend le replay disponible après la fenêtre live", () => {
    expect(
      getStageLiveState(STAGE, new Date("2026-07-20T18:25:00.000Z"))
    ).toMatchObject({ status: "finished", progress: 1 });
  });
});

describe("canSimulateRaceEdition", () => {
  it("refuse une course sans engagé", () => {
    expect(
      canSimulateRaceEdition({
        slug: "course-vide",
        engagedRiderCount: 0,
      })
    ).toBe(false);
  });

  it("conserve le Critérium de Namur comme démonstration", () => {
    expect(
      canSimulateRaceEdition({
        slug: "criterium-de-namur",
        engagedRiderCount: 0,
      })
    ).toBe(true);
  });
});

describe("accès direct aux résultats et au live", () => {
  const stages = [
    {
      id: "stage-1",
      dayNumber: 4,
      stageNumber: 1,
      name: "Étape 1",
      stageType: "road" as const,
      status: "planned" as const,
      profileType: "flat" as const,
      distanceKm: 120,
      daySlot: "early" as const,
      departureAt: "2026-07-20T14:00:00.000Z",
      segments: [],
    },
    {
      id: "stage-2",
      dayNumber: 5,
      stageNumber: 2,
      name: "Étape 2",
      stageType: "road" as const,
      status: "planned" as const,
      profileType: "hilly" as const,
      distanceKm: 150,
      daySlot: "late" as const,
      departureAt: "2026-07-21T18:00:00.000Z",
      segments: [],
    },
  ];

  it("construit un lien profond vers la course demandée", () => {
    expect(getRaceResultsHref("tour de l'avenir")).toBe(
      "/jeu/resultats?course=tour%20de%20l'avenir#course-live"
    );
  });

  it("ouvre l'étape en direct en priorité", () => {
    const now = new Date("2026-07-21T18:10:00.000Z");

    expect(getRaceExperienceAvailability(stages, now)).toBe("live");
    expect(selectRaceStageForLiveAccess(stages, now)?.id).toBe("stage-2");
  });

  it("ouvre le dernier replay lorsque la course est passée", () => {
    const now = new Date("2026-07-21T19:00:00.000Z");

    expect(getRaceExperienceAvailability(stages, now)).toBe("replay");
    expect(selectRaceStageForLiveAccess(stages, now)?.id).toBe("stage-2");
  });
});
