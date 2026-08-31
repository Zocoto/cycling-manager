"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isCyclogazetteGameAnswerCorrect,
  isCyclogazetteGameType,
} from "@/lib/game/cyclogazette-games";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CyclogazetteGameActionState = {
  result: "idle" | "success" | "failure";
  rewardCash: number;
  trophyUnlocked: boolean;
};

export type CyclogazettePollActionState = {
  result: "idle" | "success" | "failure";
  optionId: string | null;
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
