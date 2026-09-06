"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseAnsweredInternationalSelectionDecisions } from "@/lib/game/international-selection-batch";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { respondToInternationalChampionshipSelections } from "@/services/international-championship-selections";

export async function answerInternationalSelectionsAction(formData: FormData) {
  const candidateIds = formData
    .getAll("candidateId")
    .filter((value): value is string => typeof value === "string");
  const parsed = parseAnsweredInternationalSelectionDecisions(
    candidateIds.map((candidateId) => ({
      candidateId,
      decision: formData.get(`decision:${candidateId}`),
      acknowledgedConflicts: formData
        .getAll(`acknowledgedConflict:${candidateId}`)
        .filter((value): value is string => typeof value === "string"),
    })),
  );

  if (!parsed.success) {
    const message =
      parsed.reason === "empty"
        ? "Choisissez au moins une convocation à valider ou à refuser."
        : "La décision transmise est invalide.";
    redirect(
      `/jeu/selections-internationales?erreur=${encodeURIComponent(message)}`,
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

  try {
    await respondToInternationalChampionshipSelections({
      supabase,
      decisions: parsed.decisions.map((decision) => ({
        candidateId: decision.candidateId,
        accept: decision.decision === "confirm",
        acknowledgedConflicts: decision.acknowledgedConflicts,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "La décision n’a pas pu être enregistrée.";
    redirect(
      `/jeu/selections-internationales?erreur=${encodeURIComponent(
        message.slice(0, 240)
      )}`
    );
  }

  revalidatePath("/jeu");
  revalidatePath("/jeu/selections-internationales");
  revalidatePath("/jeu/championnats-internationaux");
  revalidatePath("/jeu/calendrier");
  revalidatePath("/jeu/boite-mail");
  redirect("/jeu/selections-internationales");
}
