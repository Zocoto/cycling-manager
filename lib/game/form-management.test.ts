import { describe, expect, it } from "vitest";

import { calculateStageFormCost, getStageFormCostRange } from "./form-management";

describe("calculateStageFormCost", () => {
  it("rend une étape de montagne plus coûteuse qu'une étape plate", () => {
    const flat = calculateStageFormCost({
      profileType: "flat",
      stageType: "road",
      distanceKm: 160,
      recovery: 50,
    });
    const mountain = calculateStageFormCost({
      profileType: "mountain",
      stageType: "road",
      distanceKm: 160,
      recovery: 50,
    });

    expect(flat).toBe(3);
    expect(mountain).toBe(7);
  });

  it("tient compte de la longueur et du relief d'un contre-la-montre", () => {
    const longMountainTimeTrial = calculateStageFormCost({
      profileType: "time_trial",
      stageType: "individual_time_trial",
      distanceKm: 50,
      recovery: 50,
      segments: [
        {
          segmentNumber: 1,
          distanceKm: 30,
          terrain: "climb",
          averageGradientPct: 5,
          surface: "asphalt",
          prime: null,
        },
        {
          segmentNumber: 2,
          distanceKm: 20,
          terrain: "flat",
          averageGradientPct: 0,
          surface: "asphalt",
          prime: null,
        },
      ],
    });

    expect(longMountainTimeTrial).toBe(7.5);
  });

  it("affiche une fourchette dépendant de la récupération", () => {
    expect(
      getStageFormCostRange({
        profileType: "hilly",
        stageType: "road",
        distanceKm: 150,
        segments: [],
      }),
    ).toEqual({ minimum: 4.5, maximum: 5.5 });
  });
});
