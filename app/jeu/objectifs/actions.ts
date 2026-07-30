"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
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
