import { describe, expect, it } from "vitest";

import {
  canSimulateRaceEdition,
  getEstimatedLiveDurationMinutes,
  getStageLiveState,
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
