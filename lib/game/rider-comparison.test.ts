import { describe, expect, it } from "vitest";

import {
  buildComparableRiderOverall,
  buildComparableRiderRatings,
  compareRiderValues,
} from "./rider-comparison";
import type { RiderRatings } from "./rider-profile";
import type { TransferScoutingReport } from "./transfer-scouting";

const ratings: RiderRatings = {
  mountain: 70,
  hills: 71,
  recovery: 72,
  endurance: 73,
  resistance: 74,
  breakaway: 75,
  downhill: 76,
  acceleration: 77,
  sprint: 78,
  flat: 79,
  cobbles: 80,
  prologue: 81,
  timeTrial: 82,
};

describe("rider comparison", () => {
  it("compares exact ratings and calculates the same overall scale", () => {
    const left = buildComparableRiderRatings({
      ratings,
      scoutingReport: null,
    });
    const right = buildComparableRiderRatings({
      ratings: { ...ratings, mountain: 69 },
      scoutingReport: null,
    });

    expect(left.mountain.display).toBe("70");
    expect(compareRiderValues(left.mountain, right.mountain)).toBe("left");
    expect(
      buildComparableRiderOverall({ ratings, scoutingReport: null }).display,
    ).toBe("76");
  });

  it("does not choose a winner when scouting ranges overlap", () => {
    const scoutingReport: TransferScoutingReport = {
      overall: { kind: "range", minimum: 70, maximum: 74 },
      potential: { kind: "unknown" },
      ratings: Object.fromEntries(
        Object.keys(ratings).map((key) => [
          key,
          key === "mountain"
            ? { kind: "range", minimum: 68, maximum: 74 }
            : { kind: "unknown" },
        ]),
      ) as TransferScoutingReport["ratings"],
    };
    const left = buildComparableRiderRatings({
      ratings: null,
      scoutingReport,
    });
    const right = buildComparableRiderRatings({
      ratings: { ...ratings, mountain: 72 },
      scoutingReport: null,
    });

    expect(left.mountain.display).toBe("68–74");
    expect(left.mountain.plotValue).toBe(71);
    expect(compareRiderValues(left.mountain, right.mountain)).toBe(
      "undetermined",
    );
    expect(compareRiderValues(left.hills, right.hills)).toBe("undetermined");
  });

  it("points to a scouted rider only when the full range is stronger", () => {
    const strongerRange = {
      display: "80–84",
      minimum: 80,
      maximum: 84,
      plotValue: 82,
      estimated: true,
    };
    const exact = {
      display: "75",
      minimum: 75,
      maximum: 75,
      plotValue: 75,
      estimated: false,
    };

    expect(compareRiderValues(strongerRange, exact)).toBe("left");
    expect(compareRiderValues(exact, strongerRange)).toBe("right");
  });
});
