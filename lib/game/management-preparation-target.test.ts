import { describe, expect, it } from "vitest";
import { getNextPendingPreparationTarget } from "./race-preparation-ordering";
import type { RaceCalendarEdition, RaceCalendarStage } from "./race-calendar";

const now = new Date("2026-10-19T10:00:00Z");
function stage(id: string, date: string, type: RaceCalendarStage["stageType"] = "road"): RaceCalendarStage {
  return { id, departureAt: date, distanceKm: 120, status: "planned", stageType: type, dayNumber: 5, daySlot: "early", stageNumber: 1, name: id, profileType: "flat", segments: [] };
}
function race(id: string, stages: RaceCalendarStage[], competitionType: RaceCalendarEdition["competitionType"] = "standard") {
  return { id, slug: id, stages, competitionType } as RaceCalendarEdition;
}
const prepared = { updatedAt: "2026-10-18", timeTrialUpdatedAt: "2026-10-18" };

describe("exact next pending preparation, using already loaded data", () => {
  it("skips a prepared stage and targets the next stage rather than the start of the tour", () => {
    const tour = race("tour", [stage("past", "2026-10-18T12:00Z"), { ...stage("tomorrow", "2026-10-20T12:00Z"), stageNumber: 2 }]);
    const classic = race("classic", [stage("today", "2026-10-19T12:00Z")]);
    const plans = new Map([["tour", { stages: {} }], ["classic", { stages: {} }]]);
    expect(getNextPendingPreparationTarget([tour, classic], plans, now)?.slug).toBe("classic");
    plans.set("classic", { stages: { today: prepared } });
    expect(getNextPendingPreparationTarget([tour, classic], plans, now)).toMatchObject({ slug: "tour", stageNumber: 2 });
    expect(tour.stages[0].id).toBe("past");
  });
  it("uses the specific time-trial save state, not the road plan", () => {
    const edition = race("tt", [stage("tt-stage", "2026-10-19T12:00Z", "individual_time_trial")]);
    const plans = new Map([["tt", { stages: { "tt-stage": { updatedAt: "saved", timeTrialUpdatedAt: null as string | null } } }]]);
    expect(getNextPendingPreparationTarget([edition], plans, now)?.slug).toBe("tt");
    plans.get("tt")!.stages["tt-stage"].timeTrialUpdatedAt = "saved";
    expect(getNextPendingPreparationTarget([edition], plans, now)).toBeNull();
  });
  it("excludes unregistered, cancelled and federation races", () => {
    const editions = [race("unregistered", [stage("u", "2026-10-19T12:00Z")]), race("cancelled", [{ ...stage("c", "2026-10-19T12:00Z"), status: "cancelled" }]), race("nations", [stage("n", "2026-10-19T12:00Z")], "nations_cup")];
    const plans = new Map([["cancelled", { stages: {} }], ["nations", { stages: {} }]]);
    expect(getNextPendingPreparationTarget(editions, plans, now)).toBeNull();
  });
});
