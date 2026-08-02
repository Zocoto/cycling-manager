import { describe, expect, it } from "vitest";

import {
  POST_RACE_INTERVIEW_QUESTION_POOL,
  selectPostRaceInterviewQuestions,
  type PostRaceInterviewContext,
} from "@/lib/game/post-race-interview";

const BASE_CONTEXT: PostRaceInterviewContext = {
  raceName: "La Classique des Lacs",
  stageName: "La Classique des Lacs",
  teamId: "team-1",
  teamName: "Veloria Mobilités",
  directorName: "Roger Letesteur",
  directorAvatarKey: null,
  riderName: "Timo Willems",
  bestRank: 1,
  gapLabel: null,
  uciRank: 3,
  divisionLabel: "Continentale",
  tookBreakaway: false,
  tookChase: false,
  rivalry: null,
};

describe("questions après-course", () => {
  it("conserve une bibliothèque éclectique de quarante-deux questions", () => {
    expect(POST_RACE_INTERVIEW_QUESTION_POOL).toHaveLength(42);
    expect(new Set(POST_RACE_INTERVIEW_QUESTION_POOL.map(({ id }) => id)).size).toBe(42);
  });

  it("sélectionne une question de résultat, une tactique et une de projection", () => {
    const questions = selectPostRaceInterviewQuestions(BASE_CONTEXT, "course:stage:team");

    expect(questions.map(({ category }) => category)).toEqual([
      "result",
      "tactics",
      "outlook",
    ]);
    expect(questions.every(({ text }) => !text.includes("{{"))).toBe(true);
  });

  it("adapte la question de résultat au niveau de performance", () => {
    const podium = selectPostRaceInterviewQuestions(
      { ...BASE_CONTEXT, bestRank: 2, gapLabel: "+ 8 s" },
      "podium",
    );
    const outside = selectPostRaceInterviewQuestions(
      { ...BASE_CONTEXT, bestRank: 18 },
      "outside",
    );

    expect(podium[0].id.startsWith("podium-")).toBe(true);
    expect(outside[0].id.startsWith("outside-")).toBe(true);
  });

  it("reste stable pour un même contexte et une même course", () => {
    const first = selectPostRaceInterviewQuestions(BASE_CONTEXT, "stable-seed");
    const second = selectPostRaceInterviewQuestions(BASE_CONTEXT, "stable-seed");

    expect(second).toEqual(first);
  });

  it("interroge un DS au sujet d’une équipe adverse quand le contexte le permet", () => {
    const questions = selectPostRaceInterviewQuestions(
      {
        ...BASE_CONTEXT,
        rivalry: {
          kind: "opinion",
          teamId: "team-rival",
          teamName: "Échappée Boréale",
          directorName: "Jeanne Martin",
          riderName: "Milo Hansen",
          achievement: "runner_up",
        },
      },
      "opinion-seed",
    );

    expect(questions[2]).toMatchObject({
      category: "rivalry",
      subjectTeamId: "team-rival",
    });
    expect(questions[2].text).not.toContain("{{");
    expect(questions[2].text).toMatch(/Échappée Boréale|Jeanne Martin/);
  });

  it("reprend mot pour mot une vraie déclaration dans la question de rebond", () => {
    const quote = "Cette équipe court avec beaucoup de panache.";
    const questions = selectPostRaceInterviewQuestions(
      {
        ...BASE_CONTEXT,
        rivalry: {
          kind: "rebound",
          teamId: "team-rival",
          teamName: "Échappée Boréale",
          directorName: "Jeanne Martin",
          quote,
          sourceInterviewId: "interview-source",
        },
      },
      "rebound-seed",
    );

    expect(questions[2]).toMatchObject({
      category: "rivalry",
      subjectTeamId: "team-rival",
      sourceInterviewId: "interview-source",
    });
    expect(questions[2].id.startsWith("rebound-")).toBe(true);
    expect(questions[2].text).toContain(quote);
  });
});
