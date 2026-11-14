import { describe, expect, it } from "vitest";

import {
  POST_RACE_INTERVIEW_QUESTION_POOL,
  selectPostRaceInterviewQuestions,
  type PostRaceInterviewContext,
} from "./post-race-interview";
import {
  buildPostRaceEditorialQuestions,
  type PostRaceInterviewEditorialFacts,
} from "./post-race-interview-editorial";

const FACTS = {
  recentArrival: {
    riderName: "Ali Mercier",
    gameDay: 7,
    otherTeamName: "Horizon Racing",
  },
  recentDeparture: {
    riderName: "Nils Hansen",
    gameDay: 8,
    otherTeamName: "Sierra Cycling",
    isSale: true,
  },
  seasonLeader: {
    riderName: "Timo Willems",
    daysRaced: 6,
    wins: 0,
    topTenFinishes: 0,
  },
  opponent: {
    teamId: "team-2",
    teamName: "Nord Racing",
    riderName: "Milo Morel",
    rank: 1,
    ownRiderRank: 11,
    gapToOwnSeconds: 65.42,
    teammateFinishesInTopTen: 2,
  },
} satisfies PostRaceInterviewEditorialFacts;

const CONTEXT: PostRaceInterviewContext = {
  raceName: "La Classique des Lacs",
  stageName: "La Classique des Lacs",
  stageType: "road",
  teamId: "team-1",
  teamName: "Veloria Mobilités",
  directorName: "Roger Letesteur",
  directorAvatarKey: null,
  riderName: "Timo Willems",
  bestRank: 11,
  gapLabel: null,
  uciRank: null,
  divisionLabel: null,
  tookBreakaway: false,
  tookChase: false,
  editorialFacts: FACTS,
};

describe("questions éditoriales en zone mixte", () => {
  it("produit des variantes bilingues sans identifiant partagé avec le catalogue historique", () => {
    const questions = buildPostRaceEditorialQuestions(CONTEXT);
    const ids = questions.map(({ id }) => id);
    const legacyIds = new Set(POST_RACE_INTERVIEW_QUESTION_POOL.map(({ id }) => id));

    expect(questions.length).toBeGreaterThan(40);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some((id) => legacyIds.has(id))).toBe(false);
    expect(questions.every(({ text, textEn, topic }) => text && textEn && topic)).toBe(true);
    expect(questions.every(({ subjectTeamId }) => subjectTeamId === undefined)).toBe(true);
  });

  it("réserve les questions de vente à une vente confirmée", () => {
    const questions = buildPostRaceEditorialQuestions({
      ...CONTEXT,
      editorialFacts: { ...FACTS, recentDeparture: { ...FACTS.recentDeparture, isSale: false } },
    });

    expect(questions).toEqual(expect.arrayContaining([
      expect.objectContaining({ topic: "transfers-departure" }),
      expect.objectContaining({ topic: "transfers-market" }),
    ]));
    expect(questions.some(({ topic }) => topic === "transfers-sale")).toBe(false);
    expect(buildPostRaceEditorialQuestions({ ...CONTEXT, editorialFacts: undefined })).toEqual([]);
  });

  it("contextualise une saison sans résultat et une saison avec une victoire", () => {
    const questions = (daysRaced: number, wins: number, topTenFinishes: number) =>
      buildPostRaceEditorialQuestions({
        ...CONTEXT,
        editorialFacts: {
          seasonLeader: { ...FACTS.seasonLeader, daysRaced, wins, topTenFinishes },
        },
      });

    expect(questions(4, 0, 0)).toEqual([]);
    expect(questions(6, 0, 0)).toContainEqual(expect.objectContaining({
      id: "season-leader-no-top-ten",
      text: expect.stringContaining("n’avait pas encore signé de top 10"),
    }));
    expect(questions(6, 0, 2).map(({ id }) => id)).toContain("season-leader-convert");
    expect(questions(6, 1, 1).map(({ id }) => id)).toContain("season-leader-repeat");
    expect(questions(6, 1, 1).map(({ id }) => id)).not.toContain("season-leader-no-top-ten");
  });

  it("distingue le même temps au classement d’un écart chronométré", () => {
    const withGap = buildPostRaceEditorialQuestions(CONTEXT);
    const sameTime = buildPostRaceEditorialQuestions({
      ...CONTEXT,
      editorialFacts: { opponent: { ...FACTS.opponent, gapToOwnSeconds: 0, sameTimeAsOwn: true } },
    });
    const withoutTime = buildPostRaceEditorialQuestions({
      ...CONTEXT,
      editorialFacts: { opponent: { ...FACTS.opponent, gapToOwnSeconds: null } },
    });

    expect(withGap).toContainEqual(expect.objectContaining({
      id: "opponent-gap",
      text: expect.stringContaining("1 min 5,42 s"),
      textEn: expect.stringContaining("1 min 5.42 s"),
    }));
    expect(sameTime.map(({ id }) => id)).toContain("opponent-same-time");
    expect(sameTime.map(({ id }) => id)).not.toContain("opponent-gap");
    expect(withoutTime.map(({ id }) => id)).not.toContain("opponent-same-time");
    expect(withoutTime.map(({ id }) => id)).not.toContain("opponent-gap");
  });

  it("propose un regard vers la suite même sans transfert récent dans la version 4", () => {
    const context = { ...CONTEXT, questionVersion: 4, editorialFacts: undefined };
    const questions = buildPostRaceEditorialQuestions(context);

    expect(questions.filter(({ topic }) => topic === "transfers-future")).toHaveLength(4);
    expect(questions.filter(({ topic }) => topic === "season-next-block")).toHaveLength(4);
    expect(questions.every(({ textEn }) => Boolean(textEn))).toBe(true);
    expect(questions).toContainEqual(expect.objectContaining({
      id: "season-next-block-rotation",
      text: expect.stringContaining("Timo Willems termine à la 11e place."),
    }));
    expect(buildPostRaceEditorialQuestions({ ...context, bestRank: null })
      .every(({ topic }) => topic === "transfers-future")).toBe(true);
    expect(buildPostRaceEditorialQuestions({ ...context, stageType: "team_time_trial", bestRank: 1 }))
      .toContainEqual(expect.objectContaining({
        id: "season-next-block-rotation",
        text: expect.stringContaining("Veloria Mobilités termine à la 1re place."),
      }));
  });
});

describe("rotation des questions de fin d’entretien", () => {
  it("change de sujet lorsque la dernière question a déjà traité celui-ci", () => {
    const seed = "editorial-topic-rotation";
    const first = selectPostRaceInterviewQuestions(CONTEXT, seed);
    const next = selectPostRaceInterviewQuestions(CONTEXT, seed, [first[2]]);

    expect(first[2].topic).toBeDefined();
    expect(next[2].topic).toBeDefined();
    expect(next[2].topic).not.toBe(first[2].topic);
    expect(next[2].id).not.toBe(first[2].id);
    expect(new Set(next.map(({ id }) => id)).size).toBe(3);
  });

  it("change de formulation si un seul sujet d’actualité est disponible", () => {
    const context = { ...CONTEXT, editorialFacts: { recentArrival: FACTS.recentArrival } };
    const seed = "editorial-variant-rotation";
    const first = selectPostRaceInterviewQuestions(context, seed)[2];
    const next = selectPostRaceInterviewQuestions(context, seed, [first])[2];

    expect(first.topic).toBe("transfers-arrival");
    expect(next.topic).toBe(first.topic);
    expect(next.id).not.toBe(first.id);
  });

  it("revient à la projection historique en l’absence de faits éditoriaux", () => {
    const questions = selectPostRaceInterviewQuestions(
      { ...CONTEXT, editorialFacts: undefined },
      "outlook-fallback",
    );

    expect(questions[2].category).toBe("outlook");
  });
});
