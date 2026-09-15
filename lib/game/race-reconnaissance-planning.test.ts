import { describe, expect, it } from "vitest";

import {
  canCompleteRecognitionBeforeStage,
  getRecognitionDateCandidates,
  getShortestRecognitionDurationDays,
  getUpcomingRecognitionDays,
  type RecognitionPlanningRider,
} from "@/lib/game/race-reconnaissance-planning";

const seasonDays = Array.from({ length: 28 }, (_, index) => ({
  dayNumber: index + 1,
  calendarDate: `2026-07-${String(index + 1).padStart(2, "0")}`,
}));

describe("race reconnaissance planning", () => {
  it("exposes a J+2 race when an express one-day preparer is available", () => {
    expect(getShortestRecognitionDurationDays([2, 1])).toBe(1);
    expect(
      canCompleteRecognitionBeforeStage({
        currentDayNumber: 5,
        stageDayNumber: 7,
        durationDays: 1,
      }),
    ).toBe(true);
    expect(
      canCompleteRecognitionBeforeStage({
        currentDayNumber: 5,
        stageDayNumber: 7,
        durationDays: 2,
      }),
    ).toBe(false);
  });

  it("keeps the standard two-day duration without an express preparer", () => {
    expect(getShortestRecognitionDurationDays([])).toBe(2);
    expect(getShortestRecognitionDurationDays([2, 0, Number.NaN])).toBe(2);
    expect(
      canCompleteRecognitionBeforeStage({
        currentDayNumber: 5,
        stageDayNumber: 8,
        durationDays: Number.NaN,
      }),
    ).toBe(true);
  });

  it("keeps only future days in the planning calendar", () => {
    expect(
      getUpcomingRecognitionDays({
        seasonDays,
        currentDayNumber: 10,
      }).map((day) => day.dayNumber),
    ).toEqual(Array.from({ length: 18 }, (_, index) => index + 11));
  });

  it("keeps a currently unavailable rider selectable for later dates", () => {
    const rider = createRider("rider-a", [
      {
        startDayNumber: 9,
        endDayNumber: 11,
        reason: "Blessure en cours",
      },
    ]);

    const candidates = getRecognitionDateCandidates({
      stage: {
        dayNumber: 15,
        editionStartDayNumber: 15,
        editionEndDayNumber: 15,
      },
      currentDayNumber: 10,
      seasonDays,
      riders: [rider],
    });

    expect(
      candidates
        .filter((candidate) => candidate.available)
        .map((candidate) => candidate.dayNumber),
    ).toEqual([12, 13]);
  });

  it("returns only two-day windows shared by every selected rider", () => {
    const firstRider = createRider("rider-a", [
      {
        startDayNumber: 11,
        endDayNumber: 12,
        reason: "Course engagée",
      },
    ]);
    const secondRider = createRider("rider-b", [
      {
        startDayNumber: 13,
        endDayNumber: 14,
        reason: "Stage de forme",
      },
    ]);

    const candidates = getRecognitionDateCandidates({
      stage: {
        dayNumber: 18,
        editionStartDayNumber: 18,
        editionEndDayNumber: 18,
      },
      currentDayNumber: 10,
      seasonDays,
      riders: [firstRider, secondRider],
    });

    expect(
      candidates
        .filter((candidate) => candidate.available)
        .map((candidate) => candidate.dayNumber),
    ).toEqual([15, 16]);
  });

  it("supports a one-day express reconnaissance", () => {
    const rider = createRider("rider-a", [
      {
        startDayNumber: 13,
        endDayNumber: 13,
        reason: "Course engagée",
      },
    ]);

    const candidates = getRecognitionDateCandidates({
      stage: {
        dayNumber: 15,
        editionStartDayNumber: 15,
        editionEndDayNumber: 15,
      },
      currentDayNumber: 10,
      seasonDays,
      riders: [rider],
      durationDays: 1,
    });

    expect(
      candidates
        .filter((candidate) => candidate.available)
        .map((candidate) => [candidate.dayNumber, candidate.endDayNumber]),
    ).toEqual([
      [11, 11],
      [12, 12],
      [14, 14],
    ]);
  });
});

function createRider(
  id: string,
  unavailabilities: RecognitionPlanningRider["unavailabilities"],
): RecognitionPlanningRider {
  return {
    id,
    firstName: "Test",
    lastName: id,
    unavailabilities,
  };
}
