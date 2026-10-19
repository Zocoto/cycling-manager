import { describe, expect, it } from "vitest";
import { annotateSponsorCalendar, buildSponsorRaceBrief, getSponsorDashboardFocus, getSponsorProjectPriorities, getSponsorRaceObjectives, hasSponsorRaceAffinity, isSponsorRaceReportFinal } from "./sponsor-project";
import { createSponsorProjectFixture } from "@/test/sponsor-project-fixture";
import type { OfficialRaceEditionResults } from "./race-results";

describe("read-only sponsor project presentation", () => {
  it("keeps an accepted upcoming objective visible after registration closes, without suggesting an inaccessible race", () => {
    const { project, calendar, edition, objective, quota } = createSponsorProjectFixture();
    expect(getSponsorDashboardFocus(project, calendar, [])?.id).toBe(quota.id);
    expect(getSponsorDashboardFocus(project, calendar, [edition])?.id).toBe(objective.id);
    calendar.editions = [{ ...edition, registrationPolicy: "closed", currentTeamRegistration: { status: "accepted", rosterCount: 8 } }];
    expect(getSponsorDashboardFocus(project, calendar, [])?.id).toBe(objective.id);
    calendar.editions[0].status = "cancelled";
    expect(getSponsorDashboardFocus(project, calendar, [])?.id).toBe(quota.id);
    expect(getSponsorDashboardFocus(project, { ...calendar, seasonId: "old" }, [edition])?.id).toBe(quota.id);
  });
  it("preserves the source calendar, every race, schedule, registration and rider", () => {
    const { calendar, project } = createSponsorProjectFixture();
    const before = structuredClone(calendar);
    const result = annotateSponsorCalendar(calendar, project);
    expect(calendar).toEqual(before); expect(result.editions).toHaveLength(before.editions.length);
    expect(result.editions[0]).toEqual({ ...before.editions[0], isSponsorObjective: true, sponsorInterest: "objective" });
    expect(result.editions[0].stages).toBe(calendar.editions[0].stages);
    expect(result.editions[0].engagedRiders).toBe(calendar.editions[0].engagedRiders);
  });
  it("does not attach another season's contract or an old race edition", () => {
    const { calendar, project, edition } = createSponsorProjectFixture();
    expect(annotateSponsorCalendar(calendar, { ...project, seasonId: "previous" })).toBe(calendar);
    expect(getSponsorRaceObjectives(project, { ...edition, id: "old-edition" })).toEqual([]);
    expect(annotateSponsorCalendar(calendar, null)).toBe(calendar);
  });
  it("does not confuse an affinity with an obligation or add rewards", () => {
    const { calendar, project } = createSponsorProjectFixture(); project.objectives = [];
    const result = annotateSponsorCalendar(calendar, project);
    expect(result.editions[0].sponsorInterest).toBe("affinity"); expect(result.editions[0].isSponsorObjective).toBe(false);
    expect(buildSponsorRaceBrief(project, result.editions[0])?.objectives).toEqual([]);
  });
  it.each([
    ["cobbled_classics", "one_day", "cobbles", false, true], ["cobbled_classics", "stage_race", "cobbles", false, false],
    ["ardennes_classics", "one_day", "hilly", false, true], ["medium_stage_races", "stage_race", "mountain", false, true],
    ["medium_stage_races", "stage_race", "mountain", true, false], ["grand_tour_general", "stage_race", "mountain", true, true],
    ["time_trials", "stage_race", "time_trial", false, true], ["sprints", "stage_race", "flat", false, true],
    ["national_preference", "one_day", "flat", false, false], ["youth_development", "one_day", "flat", false, false],
  ] as const)("matches %s only to its sporting scope", (philosophy, format, profile, grandTour, expected) => {
    const { edition, stage } = createSponsorProjectFixture();
    expect(hasSponsorRaceAffinity(philosophy, { ...edition, raceFormat: format, isGrandTour: grandTour, stages: [{ ...stage, profileType: profile }] })).toBe(expected);
  });
  it("does not label an entire tour as a sprint/TT objective because of one stage", () => {
    const { project, edition, stage } = createSponsorProjectFixture(); project.objectives = [];
    const tour = { ...edition, raceFormat: "stage_race" as const, stages: [stage, { ...stage, id: "tt", stageNumber: 2, stageType: "individual_time_trial" as const, profileType: "time_trial" as const }] };
    expect(buildSponsorRaceBrief({ ...project, philosophy: "time_trials" }, tour)?.scope).toBe("stages");
    expect(hasSponsorRaceAffinity("sprints", { ...tour, stages: [tour.stages[1]] })).toBe(false);
    expect(hasSponsorRaceAffinity("sprints", { ...edition, competitionType: "nations_cup" })).toBe(false);
  });
  it("selects at most three existing priorities without mutations or artificial failure", () => {
    const { project, objective } = createSponsorProjectFixture();
    project.objectives.push({ ...objective, id: "cancelled", status: "cancelled" }, { ...objective, id: "draft", status: "draft" }, { ...objective, id: "completed", status: "completed" });
    const before = structuredClone(project);
    expect(getSponsorProjectPriorities(project)).toHaveLength(3);
    expect(getSponsorProjectPriorities(project, "roster").map(item => item.id)).toEqual(["quota"]);
    expect(getSponsorProjectPriorities(project, "youth")).toEqual([]);
    expect(project).toEqual(before);
  });
  it("waits for a complete homologated tour and only reports on its last non-cancelled stage", () => {
    const { edition, stage } = createSponsorProjectFixture();
    const tour = { ...edition, raceFormat: "stage_race" as const, stages: [stage, { ...stage, id: "last", stageNumber: 2 }, { ...stage, id: "cancelled", stageNumber: 3, status: "cancelled" as const }] };
    const official: OfficialRaceEditionResults = { editionId: edition.id, isComplete: true, generalIsProvisional: false, general: [], secondary: [], attackParticipants: [],
      stages: [{ stageId: stage.id, stageNumber: 1, stageName: "1", results: [] }, { stageId: "last", stageNumber: 2, stageName: "2", results: [] }] };
    expect(isSponsorRaceReportFinal(tour, official, "last")).toBe(true);
    expect(isSponsorRaceReportFinal(tour, official, stage.id)).toBe(false);
    expect(isSponsorRaceReportFinal(tour, { ...official, isComplete: false }, "last")).toBe(false);
    expect(isSponsorRaceReportFinal(tour, { ...official, generalIsProvisional: true }, "last")).toBe(false);
    expect(isSponsorRaceReportFinal(tour, { ...official, editionId: "other" }, "last")).toBe(false);
    expect(isSponsorRaceReportFinal(tour, null, "last")).toBe(false);
  });
  it("annotates 5,000 races in a bounded pass without affecting their generation", () => {
    const { calendar, edition, project } = createSponsorProjectFixture();
    calendar.editions = Array.from({ length: 5000 }, (_, i) => ({ ...edition, id: `edition-${i}` }));
    const start = performance.now(); const result = annotateSponsorCalendar(calendar, project);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(result.editions).toHaveLength(5000);
    expect(result.editions.map(item => item.id)).toEqual(calendar.editions.map(item => item.id));
  });
});
