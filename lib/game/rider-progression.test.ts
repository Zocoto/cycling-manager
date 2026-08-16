import { describe, expect, it } from "vitest";

import {
  DEFAULT_RIDER_PROGRESSION_STATS,
  createProgressionValues,
  getProgressionChartBounds,
  RIDER_PROGRESSION_SERIES,
  type RiderProgressionSeason,
} from "@/lib/game/rider-progression";
import { RIDER_RATING_AXES } from "@/lib/game/rider-profile";

describe("rider progression", () => {
  it("adds the general average to the thirteen rider ratings", () => {
    const values = createProgressionValues({
      mountain: 70,
      hills: 69,
      flat: 68,
      timeTrial: 67,
      cobbles: 66,
      sprint: 65,
      acceleration: 64,
      downhill: 63,
      endurance: 62,
      resistance: 61,
      recovery: 60,
      breakaway: 59,
      prologue: 58,
    });

    expect(values.average).toBe(64);
    expect(values.mountain).toBe(70);
    expect(Object.keys(values)).toHaveLength(14);
  });

  it("assigns one distinct color to every selectable series", () => {
    expect(RIDER_PROGRESSION_SERIES).toHaveLength(14);
    expect(
      new Set(RIDER_PROGRESSION_SERIES.map((series) => series.color)).size,
    ).toBe(RIDER_PROGRESSION_SERIES.length);
    expect(RIDER_PROGRESSION_SERIES[0]).toMatchObject({
      key: "average",
      shortLabel: "MOY",
      shortLabelEn: "AVG",
      label: "Moyenne générale",
      labelEn: "Overall average",
    });
  });

  it("shows every primary rating by default", () => {
    const primaryRatings = RIDER_RATING_AXES.filter(
      (axis) => axis.importance === "primary",
    ).map((axis) => axis.key);

    expect(DEFAULT_RIDER_PROGRESSION_STATS).toEqual(primaryRatings);
    expect(DEFAULT_RIDER_PROGRESSION_STATS).toHaveLength(6);
    expect(DEFAULT_RIDER_PROGRESSION_STATS).not.toContain("average");
  });

  it("keeps a readable vertical range around flat progressions", () => {
    const ratings = {
      mountain: 70,
      hills: 60,
      flat: 60,
      timeTrial: 60,
      cobbles: 60,
      sprint: 60,
      acceleration: 60,
      downhill: 60,
      endurance: 60,
      resistance: 60,
      recovery: 60,
      breakaway: 60,
      prologue: 60,
    };
    const season: RiderProgressionSeason = {
      seasonId: "season-1",
      seasonName: "Saison 2026",
      gameYear: 2026,
      isCurrent: true,
      points: [
        { dayNumber: 0, values: createProgressionValues(ratings) },
        {
          dayNumber: 14,
          values: createProgressionValues({ ...ratings, mountain: 71 }),
        },
      ],
    };

    const bounds = getProgressionChartBounds([season], ["mountain"]);

    expect(bounds.minimum).toBeLessThanOrEqual(70);
    expect(bounds.maximum).toBeGreaterThanOrEqual(71);
    expect(bounds.maximum - bounds.minimum).toBeGreaterThanOrEqual(10);
  });
});
