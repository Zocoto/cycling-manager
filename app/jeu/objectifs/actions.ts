"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  sanitizeInventoryReturnPath,
  sanitizeObjectivesReturnPath,
  withPageFeedback,
} from "@/lib/game/filtered-page-paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ClaimAlphaTesterTrophyState } from "@/app/jeu/objectifs/alpha-tester-trophy-state";

export async function claimGameObjectiveAction(formData: FormData) {
  const objectiveKey = readValue(formData, "objectiveKey");
  const returnPath = sanitizeObjectivesReturnPath(
    readValue(formData, "returnPath"),
  );

  if (!/^[a-z0-9_]{3,80}$/.test(objectiveKey)) {
    redirectWithMessage(
      returnPath,
      "erreur",
      "L’objectif transmis est invalide.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc("claim_current_game_objective", {
    p_objective_key: objectiveKey,
  });

  if (error) {
    redirectWithMessage(returnPath, "erreur", error.message);
  }

  revalidatePath("/jeu/objectifs");
  revalidatePath("/jeu");
  revalidatePath("/jeu/finances");
  revalidatePath("/jeu/inventaire");
  revalidatePath("/jeu/materiel");


  redirectWithMessage(
    returnPath,
    "succes",
    "Récompense récupérée : les gains ont été ajoutés à votre carrière."
  );
}
export async function claimDailyRewardAction(formData: FormData) {
  const rewardKey = readValue(formData, "rewardKey");

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rewardKey)) {
    redirectDailyRewardError(
      "/jeu/objectifs?onglet=quotidiennes",
      "Le cadeau sélectionné est invalide.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const result = await supabase.rpc("claim_current_daily_reward", {
    p_reward_key: rewardKey,
  });

  if (result.error) {
    redirectDailyRewardError(
      "/jeu/objectifs?onglet=quotidiennes",
      result.error.message,
    );
  }

  const message = readRewardResultMessage(
    result.data,
    "Cadeau ouvert ! Il a rejoint votre inventaire.",
  );
  revalidateDailyRewardPaths();
  redirect(
    "/jeu/objectifs?onglet=quotidiennes&succes=" +
      encodeURIComponent(message),
  );
}

export async function redeemDailyRewardAction(formData: FormData) {
  const inventoryId = readValue(formData, "inventoryId");
  const quantity = readPositiveInteger(formData, "quantity");
  const riderId = readOptionalUuid(formData, "riderId");
  const raceEditionId = readOptionalUuid(formData, "raceEditionId");
  const ratingKey = readValue(formData, "ratingKey");
  const abilityCode = readValue(formData, "abilityCode");
  const returnPath = readDailyRewardReturnPath(formData);

  if (!isUuid(inventoryId) || quantity === null) {
    redirectDailyRewardError(returnPath, "Ce cadeau n’est plus disponible.");
  }

  if (ratingKey && !/^[a-z_]+$/.test(ratingKey)) {
    redirectDailyRewardError(
      returnPath,
      "La statistique sélectionnée est invalide.",
    );
  }

  if (abilityCode && !/^[a-z0-9_]+$/.test(abilityCode)) {
    redirectDailyRewardError(
      returnPath,
      "La capacité sélectionnée est invalide.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const result = await supabase.rpc("redeem_current_daily_rewards", {
    p_inventory_id: inventoryId,
    p_quantity: quantity,
    p_rider_id: riderId,
    p_rating_key: ratingKey || null,
    p_ability_code: abilityCode || null,
    p_race_edition_id: raceEditionId,
  });

  if (result.error) redirectDailyRewardError(returnPath, result.error.message);

  const message = readRewardResultMessage(
    result.data,
    "Le cadeau a bien été utilisé.",
  );
  revalidateDailyRewardPaths();
  redirect(withPageFeedback(returnPath, "succes", message));
}

function revalidateDailyRewardPaths() {
  revalidatePath("/jeu");
  revalidatePath("/jeu/objectifs");
  revalidatePath("/jeu/inventaire");
  revalidatePath("/jeu/entrainement");
  revalidatePath("/jeu/centre-de-formation");
  revalidatePath("/jeu/calendrier");
  revalidatePath("/jeu/materiel");
}

function redirectDailyRewardError(
  path: string,
  message: string,
): never {
  redirect(withPageFeedback(path, "erreur", message.slice(0, 300)));
}

function readDailyRewardReturnPath(formData: FormData) {
  const value = readValue(formData, "returnPath");
  return value.startsWith("/jeu/inventaire")
    ? sanitizeInventoryReturnPath(value)
    : "/jeu/objectifs?onglet=quotidiennes";
}

function readPositiveInteger(formData: FormData, key: string) {
  const parsed = Number(readValue(formData, key));
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 1_000
    ? parsed
    : null;
}

function readRewardResultMessage(value: unknown, fallback: string) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }

  return fallback;
}

function readOptionalUuid(formData: FormData, key: string) {
  const value = readValue(formData, key);
  return isUuid(value) ? value : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}



export async function claimAlphaTesterTrophyAction(
  _previousState: ClaimAlphaTesterTrophyState,
  _formData: FormData
): Promise<ClaimAlphaTesterTrophyState> {
  void _previousState;
  void _formData;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    return {
      status: "error",
      message: "Votre session a expiré. Reconnectez-vous pour ouvrir ce cadeau.",
    };
  }

  const { error } = await supabase.rpc(
    "claim_current_sporting_director_trophy",
    { p_trophy_key: "alpha_tester" }
  );

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  return {
    status: "success",
    message: "Le trophée Alphatesteur rejoint définitivement votre galerie.",
  };
}
function redirectWithMessage(
  path: string,
  key: "succes" | "erreur",
  message: string
): never {
  redirect(withPageFeedback(path, key, message));
}

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
