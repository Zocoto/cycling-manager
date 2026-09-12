"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseAnsweredInternationalSelectionDecisions } from "@/lib/game/international-selection-batch";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { respondToInternationalChampionshipSelections } from "@/services/international-championship-selections";

export async function answerFederationCallupAction(formData: FormData) {
  const input = z.object({ memberId: z.string().uuid(), decision: z.enum(["confirm", "decline"]) })
    .safeParse({ memberId: formData.get("memberId"), decision: formData.get("decision") });
  if (!input.success) redirect("/jeu/selections-internationales?erreur=Décision%20invalide");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const { error } = await supabase.rpc("respond_to_national_federation_preselection", {
    p_member_id: input.data.memberId, p_accept: input.data.decision === "confirm",
  });
  if (error) redirect(`/jeu/selections-internationales?erreur=${encodeURIComponent(error.message.slice(0, 240))}`);
  revalidatePath("/jeu");
  revalidatePath("/jeu/selections-internationales");
  revalidatePath("/jeu/federations/[codePays]", "page");
  revalidatePath("/jeu/championnats-internationaux");
  revalidatePath("/jeu/calendrier");
  revalidatePath("/jeu/courses/[slug]", "page");
  revalidatePath("/jeu/boite-mail");
  redirect("/jeu/selections-internationales");
}

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
