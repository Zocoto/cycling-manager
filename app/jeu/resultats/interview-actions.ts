"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { submitPostRaceInterview } from "@/services/post-race-interviews";

const interviewSchema = z.object({
  interviewId: z.string().uuid(),
  answers: z.array(z.string().trim().min(2).max(600)).min(2).max(3),
  closingNote: z.string().trim().max(500),
  eventChoiceId: z.string().trim().min(1).max(80).nullable(),
});

export async function submitPostRaceInterviewAction(input: unknown) {
  const payload = interviewSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Vous devez être connecté pour répondre à l’interview.");
  }

  const interview = await submitPostRaceInterview({
    authUserId: user.id,
    ...payload,
  });
  revalidatePath("/jeu/resultats", "layout");
  revalidatePath("/jeu/gazette");
  return interview;
}
