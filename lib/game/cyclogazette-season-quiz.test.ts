import { describe, expect, it } from "vitest";

import {
  CYCLOGAZETTE_SEASON_QUIZ_REWARD_PER_ANSWER,
  CYCLOGAZETTE_SEASON_TWO_QUIZ,
  isCyclogazetteSeasonTwoGalaEdition,
} from "./cyclogazette-season-quiz";

describe("Cyclogazette season-two quiz", () => {
  it("contains the ten approved questions without shipping an answer key", () => {
    expect(CYCLOGAZETTE_SEASON_TWO_QUIZ.questions).toHaveLength(10);
    expect(CYCLOGAZETTE_SEASON_TWO_QUIZ.questions[0]?.question).toContain(
      "Boucle des Provinces",
    );
    expect(CYCLOGAZETTE_SEASON_TWO_QUIZ.questions[9]?.question).toContain(
      "classement UCI collectif",
    );
    expect(
      CYCLOGAZETTE_SEASON_TWO_QUIZ.questions.every(
        (question) =>
          question.options.length === 4 &&
          !("correctOptionId" in question),
      ),
    ).toBe(true);
  });

  it("awards ten thousand euros per correct answer only on S2 J28", () => {
    expect(CYCLOGAZETTE_SEASON_QUIZ_REWARD_PER_ANSWER).toBe(10_000);
    expect(
      isCyclogazetteSeasonTwoGalaEdition({ gameYear: 2, dayNumber: 28 }),
    ).toBe(true);
    expect(
      isCyclogazetteSeasonTwoGalaEdition({ gameYear: 3, dayNumber: 28 }),
    ).toBe(false);
  });
});
