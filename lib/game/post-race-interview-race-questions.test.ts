import { describe, expect, it } from "vitest";

import {
  selectPostRaceInterviewQuestions,
  type PostRaceInterviewContext,
} from "./post-race-interview";
import {
  buildDetailedRaceInterviewQuestions,
  extractDetailedRaceInterviewFacts,
  type PostRaceInterviewDetailedRaceFacts,
} from "./post-race-interview-race-questions";
import type { RaceCourseJournalEntry } from "./race-course-journal";
import type { OfficialRiderResult } from "./race-results";
import type { StageSimulationResult } from "./race-simulation";

function result(
  riderId: string,
  teamId: "own" | "opponent",
  rank: number,
  elapsedTimeMs: number,
): OfficialRiderResult {
  return {
    riderId,
    riderName: riderId,
    teamId,
    teamName: teamId === "own" ? "Veloria" : "Aurore Racing",
    rank,
    status: "finished",
    elapsedTimeMs,
    gapToWinnerMs: elapsedTimeMs - 100_000,
    mountainPoints: 0,
    sprintPoints: 0,
    abandonmentReason: null,
  };
}

function questionContext(detailedRaceFacts: PostRaceInterviewDetailedRaceFacts | undefined): PostRaceInterviewContext {
  return {
    raceName: "Tour des Lacs",
    stageName: "Étape 2",
    teamId: "own",
    teamName: "Veloria",
    directorName: "Camille",
    directorAvatarKey: null,
    riderName: "Olivier",
    bestRank: null,
    gapLabel: null,
    uciRank: null,
    divisionLabel: null,
    tookBreakaway: false,
    tookChase: false,
    detailedRaceFacts,
  };
}

describe("questions factuelles de zone mixte", () => {
  it("retient le classement collectif du chrono, même si un coureur est premier", () => {
    const facts = extractDetailedRaceInterviewFacts({
      stageId: "stage-2",
      stageType: "team_time_trial",
      teamId: "own",
      stageResults: [
        result("Olivier", "own", 1, 100_000),
        result("Johan", "opponent", 2, 110_000),
        result("Elias", "opponent", 3, 110_000),
        result("Isaac", "opponent", 4, 110_000),
        result("Ari", "opponent", 5, 110_000),
        result("Maxime", "own", 6, 120_000),
        result("Alex", "own", 7, 120_000),
        result("Tim", "own", 8, 120_000),
      ],
    });

    expect(facts?.teamTimeTrial).toEqual({
      rank: 2, timeMs: 120_000, gapMs: 10_000, winnerTeam: "Aurore Racing",
    });
    const questions = buildDetailedRaceInterviewQuestions(questionContext(facts));
    expect(questions).toContainEqual(expect.objectContaining({
      id: "race-detail-team-time-1",
      topic: "ttt",
      text: expect.stringContaining("2e temps"),
      textEn: expect.stringContaining("finished 2nd"),
    }));
    expect(questions.some((question) => question.text.includes("Olivier"))).toBe(false);
    expect(selectPostRaceInterviewQuestions({
      ...questionContext(facts),
      stageType: "team_time_trial",
    }, "team-trial").slice(0, 2).map(({ category, topic }) => [category, topic])).toEqual([
      ["result", "ttt"],
      ["tactics", "ttt-strategy"],
    ]);
    expect(selectPostRaceInterviewQuestions({
      ...questionContext(undefined),
      stageType: "team_time_trial",
    }, "team-trial-without-timing").slice(0, 2).map(({ category, topic }) => [category, topic])).toEqual([
      ["result", "ttt"],
      ["tactics", "ttt-strategy"],
    ]);
  });

  it("retient une reprise seulement si le journal identifie le coureur repris dans la bonne simulation", () => {
    const simulation: StageSimulationResult = {
      stageId: "stage-2",
      seed: "test",
      resolvedRiders: [],
      timeline: [],
      results: [],
      primes: [],
      mountainPoints: {},
      sprintPoints: {},
    };
    const entry: RaceCourseJournalEntry = {
      id: "junction",
      kind: "junction",
      distanceKm: 76.5,
      title: "Jonction",
      detail: "Olivier et Johan apparaissent dans la jonction.",
      riderIds: ["Olivier", "Johan"],
    };
    const parameters = {
      stageId: "stage-2",
      teamId: "own",
      stageResults: [result("Olivier", "own", 1, 100_000), result("Johan", "opponent", 2, 130_000)],
      simulation,
    };
    const facts = extractDetailedRaceInterviewFacts({
      ...parameters, courseJournal: [{ ...entry, caughtRiderIds: ["Olivier"] }],
    });
    expect(buildDetailedRaceInterviewQuestions(questionContext(facts))).toContainEqual(expect.objectContaining({
      id: "race-detail-caught-1",
      text: expect.stringContaining("Olivier est repris au km 76,5"),
      textEn: expect.stringContaining("Olivier was caught at km 76.5"),
    }));
    for (const invalidFacts of [
      extractDetailedRaceInterviewFacts({ ...parameters, courseJournal: [entry] }),
      extractDetailedRaceInterviewFacts({
        ...parameters, simulation: { ...simulation, stageId: "stage-1" },
        courseJournal: [{ ...entry, caughtRiderIds: ["Olivier"] }],
      }),
    ]) {
      expect(buildDetailedRaceInterviewQuestions(questionContext(invalidFacts))
        .some((question) => question.topic === "catch")).toBe(false);
    }
  });
});
