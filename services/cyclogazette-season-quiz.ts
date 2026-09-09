import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CyclogazetteEdition } from "@/lib/game/cyclogazette";
import {
  CYCLOGAZETTE_SEASON_QUIZ_REWARD_PER_ANSWER,
  CYCLOGAZETTE_SEASON_TWO_QUIZ,
  isCyclogazetteSeasonTwoGalaEdition,
} from "@/lib/game/cyclogazette-season-quiz";

const CORRECT_OPTION_IDS: Readonly<Record<string, string>> = {
  q1: "b",
  q2: "c",
  q3: "b",
  q4: "c",
  q5: "d",
  q6: "b",
  q7: "a",
  q8: "b",
  q9: "a",
  q10: "c",
};

type QuizAttemptRow = {
  answers: unknown;
  correct_answers: number;
  reward_cash: number;
};

export type CyclogazetteSeasonQuizOverview = {
  editionId: string;
  rewardPerCorrectAnswer: number;
  questions: typeof CYCLOGAZETTE_SEASON_TWO_QUIZ.questions;
  isPlayable: boolean;
  attempt: {
    answers: Record<string, string>;
    correctAnswers: number;
    rewardCash: number;
    correctOptionIds: Record<string, string>;
  } | null;
};

export async function getCyclogazetteSeasonQuizOverview({
  supabase,
  edition,
  latestEditionId,
}: {
  supabase: SupabaseClient;
  edition: CyclogazetteEdition;
  latestEditionId: string;
}): Promise<CyclogazetteSeasonQuizOverview | null> {
  if (
    !isCyclogazetteSeasonTwoGalaEdition({
      gameYear: Math.ceil(edition.issueNumber / 28),
      dayNumber: edition.dayNumber,
    })
  ) {
    return null;
  }

  const attemptResult = await supabase
    .from("cyclogazette_season_quiz_attempts")
    .select("answers, correct_answers, reward_cash")
    .eq("edition_id", edition.id)
    .maybeSingle<QuizAttemptRow>();
  if (attemptResult.error) {
    console.error(
      "Impossible de charger le quiz de fin de saison :",
      attemptResult.error,
    );
  }

  const attempt = attemptResult.data
    ? {
        answers: normalizeQuizAnswers(attemptResult.data.answers),
        correctAnswers: Math.max(
          0,
          Math.min(10, Math.trunc(Number(attemptResult.data.correct_answers) || 0)),
        ),
        rewardCash: Math.max(0, Number(attemptResult.data.reward_cash) || 0),
        correctOptionIds: { ...CORRECT_OPTION_IDS },
      }
    : null;

  return {
    editionId: edition.id,
    rewardPerCorrectAnswer: CYCLOGAZETTE_SEASON_QUIZ_REWARD_PER_ANSWER,
    questions: CYCLOGAZETTE_SEASON_TWO_QUIZ.questions,
    isPlayable: edition.id === latestEditionId && !attempt,
    attempt,
  };
}

export function validateAndScoreCyclogazetteSeasonQuiz(
  formData: FormData,
): { answers: Record<string, string>; correctAnswers: number } | null {
  const answers: Record<string, string> = {};
  for (const question of CYCLOGAZETTE_SEASON_TWO_QUIZ.questions) {
    const optionId = String(formData.get(`quiz-${question.id}`) ?? "").trim();
    if (!question.options.some((option) => option.id === optionId)) return null;
    answers[question.id] = optionId;
  }

  return {
    answers,
    correctAnswers: Object.entries(answers).filter(
      ([questionId, optionId]) => CORRECT_OPTION_IDS[questionId] === optionId,
    ).length,
  };
}

export function getCyclogazetteSeasonQuizCorrectOptionIds() {
  return { ...CORRECT_OPTION_IDS };
}

function normalizeQuizAnswers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([questionId, optionId]) =>
        CYCLOGAZETTE_SEASON_TWO_QUIZ.questions.some(
          (question) =>
            question.id === questionId &&
            question.options.some((option) => option.id === optionId),
        ),
    ),
  ) as Record<string, string>;
}
