"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isCyclogazetteGameAnswerCorrect,
  isCyclogazetteGameType,
} from "@/lib/game/cyclogazette-games";
import { isCyclogazetteSeasonTwoGalaEdition } from "@/lib/game/cyclogazette-season-quiz";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCyclogazetteSeasonQuizCorrectOptionIds,
  validateAndScoreCyclogazetteSeasonQuiz,
} from "@/services/cyclogazette-season-quiz";

export type CyclogazetteGameActionState = {
  result: "idle" | "success" | "failure";
  rewardCash: number;
  trophyUnlocked: boolean;
};

export type CyclogazettePollActionState = {
  result: "idle" | "success" | "failure";
  optionId: string | null;
};

export type CyclogazetteSeasonQuizActionState = {
  result: "idle" | "success" | "failure" | "incomplete";
  correctAnswers: number;
  rewardCash: number;
  answers: Record<string, string>;
  correctOptionIds: Record<string, string>;
  alreadyCompleted: boolean;
};

export async function publishMediaCenterArticleAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const includeSponsor = formData.get("includeSponsor") === "on";
  if (
    title.length < 5 ||
    title.length > 100 ||
    body.length < 40 ||
    body.length > 1600
  ) {
    redirect(
      "/jeu/gazette?erreur=" +
        encodeURIComponent(
          "Le titre doit contenir 5 à 100 caractères et la tribune 40 à 1 600 caractères.",
        ),
    );
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("publish_current_team_media_article", {
    p_title: title,
    p_body: body,
    p_include_sponsor: includeSponsor,
  });
  if (error) {
    redirect(
      `/jeu/gazette?erreur=${encodeURIComponent(error.message.slice(0, 300))}`,
    );
  }
  revalidatePath("/jeu/gazette");
  revalidatePath("/jeu");
  revalidatePath("/jeu/profil");
  redirect("/jeu/gazette?article=propose");
}

export async function validateCyclogazetteGameAction(
  _previousState: CyclogazetteGameActionState,
  formData: FormData,
): Promise<CyclogazetteGameActionState> {
  const editionId = String(formData.get("editionId") ?? "").trim();
  const gameTypeValue = String(formData.get("gameType") ?? "").trim();
  const answer = String(formData.get("answer") ?? "");
  if (!isUuid(editionId) || !isCyclogazetteGameType(gameTypeValue)) {
    return failureState();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);
  if (authenticationError || !user) return failureState();

  const admin = createSupabaseAdminClient();
  const [editionResult, latestEditionResult] = await Promise.all([
    admin
      .from("cyclogazette_editions")
      .select("id, issue_number")
      .eq("id", editionId)
      .maybeSingle<{ id: string; issue_number: number }>(),
    admin
      .from("cyclogazette_editions")
      .select("id")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>(),
  ]);

  if (
    editionResult.error ||
    latestEditionResult.error ||
    !editionResult.data ||
    latestEditionResult.data?.id !== editionResult.data.id ||
    !isCyclogazetteGameAnswerCorrect({
      issueNumber: Number(editionResult.data.issue_number),
      gameType: gameTypeValue,
      answer,
      variationKey: editionResult.data.id,
    })
  ) {
    return failureState();
  }

  const completionResult = await admin.rpc(
    "complete_cyclogazette_game_for_user",
    {
      p_auth_user_id: user.id,
      p_edition_id: editionId,
      p_game_type: gameTypeValue,
    },
  );
  if (completionResult.error) {
    console.error(
      "Impossible d’enregistrer la réussite au jeu de La Cyclogazette :",
      completionResult.error,
    );
    return failureState();
  }

  const payload =
    completionResult.data && typeof completionResult.data === "object"
      ? (completionResult.data as {
          rewardCash?: unknown;
          trophyUnlocked?: unknown;
        })
      : {};
  revalidatePath("/jeu/objectifs");
  revalidatePath("/jeu/finances");
  revalidatePath("/jeu/directeur-sportif");

  return {
    result: "success",
    rewardCash: Math.max(0, Number(payload.rewardCash) || 0),
    trophyUnlocked: payload.trophyUnlocked === true,
  };
}

export async function validateCyclogazetteSeasonQuizAction(
  _previousState: CyclogazetteSeasonQuizActionState,
  formData: FormData,
): Promise<CyclogazetteSeasonQuizActionState> {
  const editionId = String(formData.get("editionId") ?? "").trim();
  const scored = validateAndScoreCyclogazetteSeasonQuiz(formData);
  if (!isUuid(editionId) || !scored) return quizFailureState("incomplete");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);
  if (authenticationError || !user) return quizFailureState("failure");

  const admin = createSupabaseAdminClient();
  const [editionResult, latestEditionResult] = await Promise.all([
    admin
      .from("cyclogazette_editions")
      .select("id, seasons(game_year), season_days(day_number)")
      .eq("id", editionId)
      .maybeSingle<{
        id: string;
        seasons: { game_year: number } | null;
        season_days: { day_number: number } | null;
      }>(),
    admin
      .from("cyclogazette_editions")
      .select("id")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>(),
  ]);
  const edition = editionResult.data;
  if (
    editionResult.error ||
    latestEditionResult.error ||
    !edition ||
    latestEditionResult.data?.id !== edition.id ||
    !isCyclogazetteSeasonTwoGalaEdition({
      gameYear: Number(edition.seasons?.game_year),
      dayNumber: Number(edition.season_days?.day_number),
    })
  ) {
    return quizFailureState("failure");
  }

  const completionResult = await admin.rpc(
    "complete_cyclogazette_season_quiz_for_user",
    {
      p_auth_user_id: user.id,
      p_edition_id: editionId,
      p_correct_answers: scored.correctAnswers,
      p_answers: scored.answers,
    },
  );
  if (completionResult.error) {
    console.error(
      "Impossible d’enregistrer le quiz de fin de saison :",
      completionResult.error,
    );
    return quizFailureState("failure");
  }

  const payload =
    completionResult.data && typeof completionResult.data === "object"
      ? (completionResult.data as {
          status?: unknown;
          correctAnswers?: unknown;
          rewardCash?: unknown;
          answers?: unknown;
        })
      : {};
  const alreadyCompleted = payload.status === "already-completed";
  const answers =
    payload.answers && typeof payload.answers === "object"
      ? (payload.answers as Record<string, string>)
      : scored.answers;

  revalidatePath("/jeu/gazette");
  revalidatePath("/jeu/finances");

  return {
    result: "success",
    correctAnswers: Math.max(
      0,
      Math.min(10, Math.trunc(Number(payload.correctAnswers) || 0)),
    ),
    rewardCash: Math.max(0, Number(payload.rewardCash) || 0),
    answers,
    correctOptionIds: getCyclogazetteSeasonQuizCorrectOptionIds(),
    alreadyCompleted,
  };
}

export async function voteCyclogazettePollAction(
  _previousState: CyclogazettePollActionState,
  formData: FormData,
): Promise<CyclogazettePollActionState> {
  const pollId = String(formData.get("pollId") ?? "").trim();
  const optionId = String(formData.get("optionId") ?? "").trim();
  if (!isUuid(pollId) || !/^option-[1-4]$/.test(optionId)) {
    return { result: "failure", optionId: null };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);
  if (authenticationError || !user) {
    return { result: "failure", optionId: null };
  }

  const voteResult = await supabase.rpc("vote_cyclogazette_poll", {
    p_poll_id: pollId,
    p_option_id: optionId,
  });
  if (voteResult.error) {
    console.error(
      "Impossible d’enregistrer le vote de La Cyclogazette :",
      voteResult.error,
    );
    return { result: "failure", optionId: null };
  }

  const payload =
    voteResult.data && typeof voteResult.data === "object"
      ? (voteResult.data as { optionId?: unknown })
      : {};
  const recordedOptionId =
    typeof payload.optionId === "string" ? payload.optionId : optionId;

  return { result: "success", optionId: recordedOptionId };
}

function failureState(): CyclogazetteGameActionState {
  return { result: "failure", rewardCash: 0, trophyUnlocked: false };
}

function quizFailureState(
  result: "failure" | "incomplete",
): CyclogazetteSeasonQuizActionState {
  return {
    result,
    correctAnswers: 0,
    rewardCash: 0,
    answers: {},
    correctOptionIds: {},
    alreadyCompleted: false,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
