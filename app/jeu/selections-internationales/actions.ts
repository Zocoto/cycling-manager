"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { respondToInternationalChampionshipSelections } from "@/services/international-championship-selections";

const decisionSchema = z.object({
  candidateId: z.string().uuid(),
  decision: z.enum(["confirm", "decline"]),
  acknowledgedConflicts: z.array(z.string().trim().min(1).max(300)).max(40),
});

const decisionBatchSchema = z
  .array(decisionSchema)
  .min(1)
  .max(100)
  .superRefine((decisions, context) => {
    const candidateIds = new Set<string>();

    for (const decision of decisions) {
      if (candidateIds.has(decision.candidateId)) {
        context.addIssue({
          code: "custom",
          message: "Une convocation ne peut apparaître qu’une fois.",
        });
      }
      candidateIds.add(decision.candidateId);
    }
  });

export async function answerInternationalSelectionsAction(formData: FormData) {
  const candidateIds = formData
    .getAll("candidateId")
    .filter((value): value is string => typeof value === "string");
  const parsed = decisionBatchSchema.safeParse(
    candidateIds.map((candidateId) => ({
      candidateId,
      decision: formData.get(`decision:${candidateId}`),
      acknowledgedConflicts: formData
        .getAll(`acknowledgedConflict:${candidateId}`)
        .filter((value): value is string => typeof value === "string"),
    })),
  );

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
    await respondToInternationalChampionshipSelections({
      supabase,
      decisions: parsed.data.map((decision) => ({
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
