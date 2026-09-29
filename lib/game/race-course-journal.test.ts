import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import { simulateRaceStage } from "./race-simulation";
import {
  buildRaceCourseJournal,
  RACE_COURSE_JOURNAL_MAX_ENTRIES,
} from "./race-course-journal";

describe("buildRaceCourseJournal", () => {
  it("résume chronologiquement une course vallonnée jusqu’à la victoire", () => {
    const simulation = simulateRaceStage(
      createDemoSimulationInput("collines-ardennes", 7),
    );
    const journal = buildRaceCourseJournal({ simulation });

    expect(journal.length).toBeLessThanOrEqual(
      RACE_COURSE_JOURNAL_MAX_ENTRIES,
    );
    expect(journal[0]).toMatchObject({ kind: "start", distanceKm: 0 });
    expect(journal.some((entry) => entry.kind === "breakaway")).toBe(true);
    expect(journal.some((entry) => entry.kind === "gap")).toBe(true);
    expect(journal.some((entry) => entry.kind === "junction")).toBe(true);
    expect(journal.some((entry) => entry.kind === "attack")).toBe(true);
    expect(journal.at(-1)).toMatchObject({ kind: "finish", title: "Victoire" });
    expect(journal.at(-1)?.detail).toContain("s’impose");
    expect(journal.map((entry) => entry.distanceKm)).toEqual(
      [...journal].map((entry) => entry.distanceKm).sort((a, b) => a - b),
    );
  });

  it("conserve les chutes et les avaries sans recopier tout le direct", () => {
    const simulation = simulateRaceStage(
      createDemoSimulationInput("sprint-littoral", 7),
    );
    const journal = buildRaceCourseJournal({ simulation });
    const incidentTitles = journal
      .filter((entry) => entry.kind === "incident")
      .map((entry) => entry.title);

    expect(incidentTitles).toContain("Chute");
    expect(incidentTitles).toContain("Avarie mécanique");
    expect(journal.length).toBeLessThan(simulation.timeline.length);
    expect(journal.filter((entry) => entry.kind === "finish")).toHaveLength(1);
  });
});
