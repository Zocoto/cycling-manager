import { describe, expect, it } from "vitest";

import {
  POST_RACE_INTERVIEW_QUESTION_POOL,
  selectPostRaceInterviewQuestions,
  type PostRaceInterviewContext,
  type PostRaceInterviewQuestion,
} from "@/lib/game/post-race-interview";

const BASE_CONTEXT: PostRaceInterviewContext = {
  questionVersion: 2,
  raceName: "La Classique des Lacs",
  stageName: "La Classique des Lacs",
  stageType: "road",
  weatherLabel: null,
  teamId: "team-1",
  teamName: "Veloria Mobilités",
  directorName: "Roger Letesteur",
  directorAvatarKey: null,
  riderName: "Timo Willems",
  bestRank: 1,
  gapLabel: null,
  uciRank: 3,
  divisionLabel: "Continentale",
  uciLeaderName: "Nils Champion",
  uciLeaderTeamName: "Aurore Racing",
  tookBreakaway: false,
  tookChase: false,
  raceFacts: {
    breakawayOccurred: false,
    crashOccurred: false,
    crosswindOccurred: false,
  },
  rivalry: null,
};

describe("questions après-course", () => {
  it("propose une bibliothèque largement étoffée et sans doublon", () => {
    expect(POST_RACE_INTERVIEW_QUESTION_POOL.length).toBeGreaterThanOrEqual(95);
    expect(
      new Set(POST_RACE_INTERVIEW_QUESTION_POOL.map(({ id }) => id)).size,
    ).toBe(POST_RACE_INTERVIEW_QUESTION_POOL.length);
  });

  it("sélectionne un résultat, un angle tactique ou factuel et une projection", () => {
    const questions = selectPostRaceInterviewQuestions(
      BASE_CONTEXT,
      "course:stage:team",
    );

    expect(questions[0].category).toBe("result");
    expect(["tactics", "race_fact"]).toContain(questions[1].category);
    expect(questions[2].category).toBe("outlook");
    expect(questions.every(({ text }) => !text.includes("{{"))).toBe(true);
  });

  it("adapte la question de résultat au niveau de performance", () => {
    const podium = selectPostRaceInterviewQuestions(
      { ...BASE_CONTEXT, bestRank: 2, gapLabel: "à 8 s" },
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
    const second = selectPostRaceInterviewQuestions(
      BASE_CONTEXT,
      "stable-seed",
    );

    expect(second).toEqual(first);
  });

  it("ne pose une question sur une autre équipe que de façon occasionnelle", () => {
    const context: PostRaceInterviewContext = {
      ...BASE_CONTEXT,
      bestRank: 7,
      rivalry: {
        kind: "opinion",
        teamId: "team-rival",
        teamName: "Échappée Boréale",
        directorName: "Jeanne Martin",
        riderName: "Milo Hansen",
        achievement: "winner",
      },
    };
    const closingQuestions = Array.from(
      { length: 80 },
      (_, index) =>
        selectPostRaceInterviewQuestions(context, `opinion-${index}`)[2],
    );
    const rivalryCount = closingQuestions.filter(
      ({ category }) => category === "rivalry",
    ).length;

    expect(rivalryCount).toBeGreaterThan(0);
    expect(rivalryCount).toBeLessThan(30);
    expect(
      closingQuestions.some(({ category }) => category === "outlook"),
    ).toBe(true);
  });

  it("ne présente jamais le deuxième comme le vainqueur", () => {
    const context: PostRaceInterviewContext = {
      ...BASE_CONTEXT,
      bestRank: 1,
      rivalry: {
        kind: "opinion",
        teamId: "team-rival",
        teamName: "Échappée Boréale",
        directorName: "Jeanne Martin",
        riderName: "Milo Hansen",
        achievement: "runner_up",
      },
    };
    const question = findSelectedQuestion(
      context,
      ({ category }) => category === "rivalry",
    );

    expect(question.id.startsWith("rivalry-runner-up-")).toBe(true);
    expect(question.text).not.toContain("s’est imposé");
    expect(question.text).toMatch(/deuxième|performance/);
  });

  it("reprend mot pour mot une vraie déclaration dans un rebond occasionnel", () => {
    const quote = "Cette équipe court avec beaucoup de panache.";
    const context: PostRaceInterviewContext = {
      ...BASE_CONTEXT,
      rivalry: {
        kind: "rebound",
        teamId: "team-rival",
        teamName: "Échappée Boréale",
        directorName: "Jeanne Martin",
        quote,
        sourceInterviewId: "interview-source",
      },
    };
    const question = findSelectedQuestion(
      context,
      ({ category }) => category === "rivalry",
    );

    expect(question).toMatchObject({
      category: "rivalry",
      subjectTeamId: "team-rival",
      sourceInterviewId: "interview-source",
    });
    expect(question.text).toContain(quote);
  });

  it("emploie exclusivement le pool tactique dédié sur un CLM individuel", () => {
    const context: PostRaceInterviewContext = {
      ...BASE_CONTEXT,
      stageType: "individual_time_trial",
      raceName: "Chrono des Lacs",
      stageName: "Chrono des Lacs",
    };
    const selections = Array.from({ length: 50 }, (_, index) =>
      selectPostRaceInterviewQuestions(context, `clm-${index}`),
    );

    expect(selections.every(([result]) => result.id.startsWith("clm-"))).toBe(
      true,
    );
    expect(
      selections.every(([, tactics]) => tactics.id.startsWith("clm-tactics-")),
    ).toBe(true);
    expect(selections.flat().some(({ id }) => id === "tactics-isolated")).toBe(
      false,
    );
    expect(
      selections.flat().some(({ text }) => text.includes("équipiers trop tôt")),
    ).toBe(false);
  });

  it("fait émerger les chutes, bordures, échappées et la météo quand elles sont réelles", () => {
    const contexts: Array<[string, PostRaceInterviewContext]> = [
      [
        "fact-crash-",
        {
          ...BASE_CONTEXT,
          raceFacts: {
            breakawayOccurred: false,
            crashOccurred: true,
            crosswindOccurred: false,
          },
        },
      ],
      [
        "fact-crosswind-",
        {
          ...BASE_CONTEXT,
          raceFacts: {
            breakawayOccurred: false,
            crashOccurred: false,
            crosswindOccurred: true,
          },
        },
      ],
      [
        "fact-team-breakaway-",
        {
          ...BASE_CONTEXT,
          tookBreakaway: true,
          raceFacts: {
            breakawayOccurred: true,
            crashOccurred: false,
            crosswindOccurred: false,
          },
        },
      ],
      [
        "fact-weather-",
        {
          ...BASE_CONTEXT,
          weatherLabel: "Vent soutenu",
        },
      ],
    ];

    for (const [prefix, context] of contexts) {
      const question = findSelectedQuestion(context, ({ id }) =>
        id.startsWith(prefix),
      );
      expect(question.category).toBe("race_fact");
      expect(question.text).not.toContain("{{");
    }
  });

  it("peut interroger le DS sur le leader du classement UCI", () => {
    const question = findSelectedQuestion(BASE_CONTEXT, ({ id }) =>
      id.startsWith("outlook-uci-leader"),
    );

    expect(question.text).toContain("Nils Champion");
    expect(question.text).toMatch(/Aurore Racing|leader UCI/);
  });
});

function findSelectedQuestion(
  context: PostRaceInterviewContext,
  predicate: (question: PostRaceInterviewQuestion) => boolean,
) {
  for (let index = 0; index < 1_000; index += 1) {
    const question = selectPostRaceInterviewQuestions(
      context,
      `search-${index}`,
    ).find(predicate);
    if (question) return question;
  }
  throw new Error("Aucune graine n’a produit la question attendue.");
}
