"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function claimGameObjectiveAction(formData: FormData) {
  const objectiveKey = readValue(formData, "objectiveKey");

  if (!/^[a-z0-9_]{3,80}$/.test(objectiveKey)) {
    redirectWithMessage("erreur", "L’objectif transmis est invalide.");
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
    redirectWithMessage("erreur", error.message);
  }

  revalidatePath("/jeu/objectifs");
  revalidatePath("/jeu");
  revalidatePath("/jeu/finances");
  revalidatePath("/jeu/inventaire");
  revalidatePath("/jeu/materiel");

  redirectWithMessage(
    "succes",
    "Récompense récupérée : les gains ont été ajoutés à votre carrière."
  );
}

function redirectWithMessage(
  key: "succes" | "erreur",
  message: string
): never {
  redirect(
    `/jeu/objectifs?${key}=${encodeURIComponent(message.slice(0, 300))}`
  );
}

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
