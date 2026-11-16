"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  getJuniorRaceInstructions,
  JUNIOR_ROAD_INSTRUCTIONS,
  JUNIOR_TIME_TRIAL_INSTRUCTIONS,
  type JuniorRacePreparationSaveState,
} from "@/lib/game/junior-race-preparation";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const preparationSchema = z.object({
  stageId: z.uuid(),
  registrationId: z.uuid(),
  scope: z.enum(["club", "federation"]),
  stageType: z.enum(["road", "individual_time_trial"]),
  assignments: z.array(z.object({
    riderId: z.uuid(),
    instruction: z.enum([...JUNIOR_ROAD_INSTRUCTIONS, ...JUNIOR_TIME_TRIAL_INSTRUCTIONS]),
  })).min(1).max(20),
}).refine(({ stageType, assignments }) => {
  const allowed = getJuniorRaceInstructions(stageType);
  return new Set(assignments.map(({ riderId }) => riderId)).size === assignments.length &&
    assignments.every(({ instruction }) => allowed.includes(instruction)) &&
    assignments.filter(({ instruction }) => instruction === "leader").length <= 1;
});

export async function saveJuniorRacePreparationAction(
  _previous: JuniorRacePreparationSaveState,
  formData: FormData,
): Promise<JuniorRacePreparationSaveState> {
  const assignments = Array.from(formData.entries()).flatMap(([key, instruction]) =>
    key.startsWith("rider:") ? [{ riderId: key.slice("rider:".length), instruction }] : [],
  );
  const parsed = preparationSchema.safeParse({
    stageId: formData.get("stageId"),
    registrationId: formData.get("registrationId"),
    scope: formData.get("scope"),
    stageType: formData.get("stageType"),
    assignments,
  });
  if (!parsed.success) return { status: "error", message: "Vérifiez les consignes de l’étape et réessayez." };

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authenticationError } = await getAuthenticatedUser(supabase);
  if (!user || authenticationError) redirect("/connexion");

  const { stageId, registrationId, scope } = parsed.data;
  const { error } = await supabase.rpc("save_current_junior_race_preparation", {
    p_stage_id: stageId,
    p_registration_id: registrationId,
    p_scope: scope,
    p_instructions: parsed.data.assignments,
  });
  if (error) {
    return {
      status: "error",
      message: "Le plan n’a pas pu être enregistré. Rechargez la page pour vérifier l’engagement et l’échéance.",
    };
  }

  revalidatePath("/jeu/preparation-course/juniors");
  return { status: "saved", assignments: parsed.data.assignments };
}
