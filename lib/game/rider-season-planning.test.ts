import { describe, expect, it } from "vitest";

import {
  assignRiderPlanningEventLanes,
  countRiderPlannedDays,
  getRiderPlanningEventStatus,
  type RiderPlanningEvent,
} from "@/lib/game/rider-season-planning";

describe("rider season planning", () => {
  it("distingue les événements terminés, actifs et futurs", () => {
    expect(
      getRiderPlanningEventStatus({
        startDay: 2,
        endDay: 4,
        currentDayNumber: 8,
      }),
    ).toBe("completed");
    expect(
      getRiderPlanningEventStatus({
        startDay: 7,
        endDay: 9,
        currentDayNumber: 8,
      }),
    ).toBe("active");
    expect(
      getRiderPlanningEventStatus({
        startDay: 12,
        endDay: 12,
        currentDayNumber: 8,
      }),
    ).toBe("upcoming");
  });

  it("place les événements qui se chevauchent sur des lignes distinctes", () => {
    const layout = assignRiderPlanningEventLanes([
      createEvent("race", 4, 7),
      createEvent("injury", 6, 9),
      createEvent("form_camp", 10, 11),
    ]);

    expect(layout.laneCount).toBe(2);
    expect(layout.events.map((event) => event.lane)).toEqual([0, 1, 0]);
  });

  it("compte chaque journée occupée une seule fois", () => {
    expect(
      countRiderPlannedDays([
        createEvent("race", 4, 7),
        createEvent("injury", 6, 9),
      ]),
    ).toBe(6);
  });
});

function createEvent(
  type: RiderPlanningEvent["type"],
  startDay: number,
  endDay: number,
): RiderPlanningEvent {
  return {
    id: `${type}-${startDay}-${endDay}`,
    riderId: "rider-1",
    type,
    title: type,
    detail: type,
    startDay,
    endDay,
    status: "upcoming",
    href: null,
    raceCategoryCode: null,
  };
}
