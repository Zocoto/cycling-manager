import { describe, expect, it } from "vitest";

import type { RiderPlanningEvent } from "./rider-season-planning";
import {
  findFormCampPlanningConflict,
  getFormCampRangeDuration,
  selectFormCampDayRange,
} from "./form-camp-planning";

describe("form camp planning", () => {
  it("sélectionne une plage future de un à trois jours", () => {
    const first = selectFormCampDayRange({
      currentRange: null,
      dayNumber: 12,
      currentDayNumber: 10,
    });
    expect(first).toEqual({ startDay: 12, endDay: 12 });

    const extended = selectFormCampDayRange({
      currentRange: first,
      dayNumber: 14,
      currentDayNumber: 10,
    });
    expect(extended).toEqual({ startDay: 12, endDay: 14 });
    expect(getFormCampRangeDuration(extended)).toBe(3);
  });

  it("redémarre une sélection trop longue et ignore les jours passés", () => {
    const currentRange = { startDay: 12, endDay: 12 };
    expect(
      selectFormCampDayRange({
        currentRange,
        dayNumber: 16,
        currentDayNumber: 10,
      }),
    ).toEqual({ startDay: 16, endDay: 16 });
    expect(
      selectFormCampDayRange({
        currentRange,
        dayNumber: 10,
        currentDayNumber: 10,
      }),
    ).toEqual(currentRange);
  });

  it("repère tout chevauchement dans le planning du coureur", () => {
    const race = {
      id: "race-1",
      riderId: "rider-1",
      type: "race",
      title: "Tour test",
      detail: "Course",
      startDay: 14,
      endDay: 16,
      status: "upcoming",
      href: null,
      raceCategoryCode: null,
    } satisfies RiderPlanningEvent;

    expect(
      findFormCampPlanningConflict([race], { startDay: 12, endDay: 14 }),
    ).toBe(race);
    expect(
      findFormCampPlanningConflict([race], { startDay: 11, endDay: 13 }),
    ).toBeNull();
  });
});
