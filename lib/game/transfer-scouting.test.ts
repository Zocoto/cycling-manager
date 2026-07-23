import { describe, expect, it } from "vitest";

import { RIDER_RATING_AXES, type RiderRatings } from "./rider-profile";
import {
  createExactTransferScoutingReport,
  createStandardTransferScoutingReport,
  formatScoutedPotentialValue,
  scoutedValueCouldMeetMinimum,
} from "./transfer-scouting";

const ratings: RiderRatings = {
  mountain: 64,
  hills: 71,
  recovery: 58,
  endurance: 67,
  resistance: 62,
  breakaway: 55,
  downhill: 69,
  acceleration: 73,
  sprint: 61,
  flat: 66,
  cobbles: 52,
  prologue: 57,
  timeTrial: 63,
};

describe("transfer scouting", () => {
  it("produit un rapport stable avec notes exactes, fourchettes et inconnues", () => {
    const input = {
      riderId: "0f1e2d3c-4b5a-6789-8abc-def012345678",
      seasonId: "season-1",
      ratings,
      potentialSteps: 6,
    };
    const first = createStandardTransferScoutingReport(input);
    const second = createStandardTransferScoutingReport(input);
    const values = RIDER_RATING_AXES.map((axis) => first.ratings[axis.key]);

    expect(second).toEqual(first);
    expect(values.filter((value) => value.kind === "exact")).toHaveLength(3);
    expect(values.filter((value) => value.kind === "range")).toHaveLength(6);
    expect(values.filter((value) => value.kind === "unknown")).toHaveLength(4);
  });

  it("conserve la vraie note à l'intérieur de chaque fourchette", () => {
    const report = createStandardTransferScoutingReport({
      riderId: "11111111-2222-4333-8444-555555555555",
      seasonId: "season-1",
      ratings,
      potentialSteps: 8,
    });

    for (const axis of RIDER_RATING_AXES) {
      const scouted = report.ratings[axis.key];
      if (scouted.kind !== "range") continue;

      expect(scouted.minimum).toBeLessThanOrEqual(ratings[axis.key]);
      expect(scouted.maximum).toBeGreaterThanOrEqual(ratings[axis.key]);
    }
  });

  it("affine le rapport selon le niveau de la Data Room", () => {
    const report = createStandardTransferScoutingReport({
      riderId: "data-room-rider",
      seasonId: "season-1",
      ratings,
      potentialSteps: 6,
      dataRoomLevel: 3,
    });
    const values = RIDER_RATING_AXES.map(
      (axis) => report.ratings[axis.key],
    );

    expect(values.filter((value) => value.kind === "exact")).toHaveLength(7);
    expect(values.filter((value) => value.kind === "range")).toHaveLength(6);
    expect(values.filter((value) => value.kind === "unknown")).toHaveLength(0);
    expect(report.potential.kind).toBe("range");
  });

  it("ne révèle jamais précisément le potentiel avec l'analyse standard", () => {
    const reports = Array.from({ length: 40 }, (_, index) =>
      createStandardTransferScoutingReport({
        riderId: `rider-${index}`,
        seasonId: "season-1",
        ratings,
        potentialSteps: (index % 8) + 1,
      })
    );

    expect(reports.every((report) => report.potential.kind !== "exact")).toBe(
      true
    );
    expect(
      reports.some((report) => formatScoutedPotentialValue(report.potential) === "?")
    ).toBe(true);
  });

  it("réserve le rapport totalement exact au DS propriétaire", () => {
    const report = createExactTransferScoutingReport({
      ratings,
      potentialSteps: 7,
    });

    expect(report.potential).toEqual({ kind: "exact", steps: 7 });
    expect(
      RIDER_RATING_AXES.every(
        (axis) => report.ratings[axis.key].kind === "exact"
      )
    ).toBe(true);
  });

  it("filtre uniquement sur les informations réellement visibles", () => {
    expect(
      scoutedValueCouldMeetMinimum(
        { kind: "range", minimum: 60, maximum: 66 },
        65
      )
    ).toBe(true);
    expect(
      scoutedValueCouldMeetMinimum({ kind: "unknown" }, 1)
    ).toBe(false);
  });
});
