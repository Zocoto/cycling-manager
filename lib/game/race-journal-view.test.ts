import { describe, expect, it } from "vitest";
import { createRaceJournalFixture } from "@/test/race-journal-fixture";
import { buildTeamJournalView, resolveRaceJournalView, TEAM_JOURNAL_MAX_EVENTS } from "./race-journal-view";
import { RACE_COURSE_JOURNAL_MAX_ENTRIES } from "./race-course-journal";

describe("journal presentation without gameplay changes", () => {
  it.each([
    [null, true, true, "race"], ["team", true, true, "team"], ["team", true, false, "race"],
    ["invalid", true, true, "race"], ["team", false, true, "team"], [null, false, true, "team"],
  ])("chooses a valid view for %s / %s / %s", (preference, race, team, expected) => {
    expect(resolveRaceJournalView(preference, race as boolean, team as boolean)).toBe(expected);
  });
  it("preserves official results and all recorded event data", () => {
    const {report} = createRaceJournalFixture();
    const before = structuredClone(report);
    Object.freeze(report.events); Object.freeze(report.riders);
    const view = buildTeamJournalView(report);
    expect(report).toEqual(before);
    expect(view.finishedCount).toBe(2);
    expect(view.best?.result.riderId).toBe("leader");
    expect(view.eventsByRider.get("helper")).toHaveLength(3);
    expect(view.eventsByRider.get("injured")).toHaveLength(1);
    expect(view.overview.map(event => event.distanceKm)).toEqual([0, 42, 88, 99]);
  });
  it("does not promote an abandoned rider with a historical numeric rank", () => {
    const {report} = createRaceJournalFixture(); report.riders[2].result.rank = 1;
    expect(buildTeamJournalView(report).best?.result.riderId).toBe("leader");
    report.riders.forEach(rider => { rider.result.status = "did_not_finish"; });
    expect(buildTeamJournalView(report).best).toBeNull();
  });
  it("deduplicates records and indexes only the concerned own riders", () => {
    const {report} = createRaceJournalFixture();
    report.events.push(report.events[0], {...report.events[0], id: "foreign", riderIds: ["foreign"]}, {...report.events[0], id: "invalid", distanceKm: NaN});
    report.events[0] = {...report.events[0], riderIds: ["helper", "leader", "helper"]};
    const view = buildTeamJournalView(report);
    expect(view.eventCount).toBe(4);
    expect(view.eventsByRider.has("foreign")).toBe(false);
    expect(view.eventsByRider.get("helper")).toHaveLength(3);
  });
  it("bounds the overview but preserves every rider detail, including late incidents", () => {
    const {report} = createRaceJournalFixture();
    report.events = Array.from({length: 5_000}, (_, i) => ({id: `comment-${i}`, title: "Fait", detail: "Recorded event", riderIds: ["leader"], distanceKm: i / 100}));
    report.events.push({id: "abandon-late", title: "Abandon", detail: "Recorded abandonment", riderIds: ["injured"], distanceKm: 150});
    const start = performance.now();
    const view = buildTeamJournalView(report);
    expect(performance.now() - start).toBeLessThan(1_000);
    expect(TEAM_JOURNAL_MAX_EVENTS).toBe(RACE_COURSE_JOURNAL_MAX_ENTRIES);
    expect(view.overview).toHaveLength(26);
    expect(view.overview.at(-1)?.id).toBe("abandon-late");
    expect(view.eventsByRider.get("leader")).toHaveLength(5_000);
    expect(view.eventCount).toBe(5_001);
  });
});
