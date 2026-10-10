"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PostRaceInterviewSubmissionResult } from "@/lib/game/post-race-interview";
import { submitPostRaceInterview } from "@/services/post-race-interviews";

const interviewSchema = z.object({
  interviewId: z.string().uuid(),
  answers: z.array(z.string().trim().min(2).max(600)).min(2).max(3),
  closingNote: z.string().trim().max(500),
  eventChoiceId: z.string().trim().min(1).max(80).nullable(),
});

const playerFacingErrors = new Set([
  "Votre profil de Directeur Sportif est introuvable.",
  "Cette interview ne vous appartient pas ou n’existe plus.",
  "La zone mixte est fermée : l’interview est disponible uniquement le jour de la course, avant 20 h.",
  "Toutes les réponses de l’interview sont attendues.",
  "Chaque réponse doit contenir entre 2 et 600 caractères.",
  "Choisissez une réaction ou décidez de ne pas réagir.",
  "Cette réaction n’est pas proposée pour cet événement.",
  "La trésorerie de l’équipe est insuffisante pour cette réaction.",
]);

export async function submitPostRaceInterviewAction(
  input: unknown,
): Promise<PostRaceInterviewSubmissionResult> {
  const parsed = interviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Vérifiez vos réponses : 2 à 600 caractères par réponse et 500 caractères maximum pour le dernier mot." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return { ok: false, message: "Vous devez être connecté pour répondre à l’interview." };
    }

    const interview = await submitPostRaceInterview({
      authUserId: user.id,
      ...parsed.data,
    });
    revalidatePath("/jeu/resultats", "layout");
    revalidatePath("/jeu/gazette");
    return { ok: true, interview };
  } catch (error) {
    if (error instanceof Error && playerFacingErrors.has(error.message)) {
      return { ok: false, message: error.message };
    }
    console.error("Échec de l’enregistrement de l’interview de zone mixte :", error);
    return { ok: false, message: "L’interview n’a pas pu être enregistrée. Vos réponses sont conservées ; réessayez dans un instant." };
  }
}
