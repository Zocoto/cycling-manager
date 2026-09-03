"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { respondToInternationalChampionshipSelection } from "@/services/international-championship-selections";

const decisionSchema = z.object({
  candidateId: z.string().uuid(),
  decision: z.enum(["confirm", "decline"]),
  acknowledgedConflicts: z.array(z.string().trim().min(1).max(300)).max(40),
});

export async function answerInternationalSelectionAction(
  formData: FormData
) {
  const parsed = decisionSchema.safeParse({
    candidateId: formData.get("candidateId"),
    decision: formData.get("decision"),
    acknowledgedConflicts: formData
      .getAll("acknowledgedConflict")
      .filter((value): value is string => typeof value === "string"),
  });

  if (!parsed.success) {
    redirect(
      "/jeu/selections-internationales?erreur=La+décision+transmise+est+invalide."
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
    await respondToInternationalChampionshipSelection({
      supabase,
      candidateId: parsed.data.candidateId,
      accept: parsed.data.decision === "confirm",
      acknowledgedConflicts: parsed.data.acknowledgedConflicts,
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
  redirect(
    `/jeu/selections-internationales?decision=${
      parsed.data.decision === "confirm" ? "confirmee" : "refusee"
    }`
  );
}
