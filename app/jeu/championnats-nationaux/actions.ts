"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const withdrawalSchema = z.object({
  editionId: z.string().uuid(),
  riderId: z.string().uuid(),
  discipline: z.enum(["route", "contre-la-montre"]),
});

const riderIdsSchema = z.array(z.string().uuid()).max(100);

export async function saveNationalChampionshipSelectionsAction(
  formData: FormData,
) {
  const riderIdsResult = riderIdsSchema.safeParse(formData.getAll("riderId"));
  const roadIdsResult = riderIdsSchema.safeParse(formData.getAll("road"));
  const timeTrialIdsResult = riderIdsSchema.safeParse(
    formData.getAll("timeTrial"),
  );
  if (
    !riderIdsResult.success ||
    !roadIdsResult.success ||
    !timeTrialIdsResult.success ||
    new Set(riderIdsResult.data).size !== riderIdsResult.data.length
  ) {
    throw new Error("La grille d’inscriptions transmise est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);
  if (authenticationError || !user) {
    throw new Error("Vous devez être connecté pour gérer les inscriptions.");
  }

  const roadIds = new Set(roadIdsResult.data);
  const timeTrialIds = new Set(timeTrialIdsResult.data);
  const managedRiderIds = new Set(riderIdsResult.data);
  if (
    [...roadIds, ...timeTrialIds].some(
      (riderId) => !managedRiderIds.has(riderId),
    )
  ) {
    throw new Error("Un coureur sélectionné ne fait pas partie de l’effectif.");
  }

  const { error } = await supabase.rpc(
    "save_current_team_national_championship_selections",
    {
      p_selections: riderIdsResult.data.map((riderId) => ({
        rider_id: riderId,
        road: roadIds.has(riderId),
        time_trial: timeTrialIds.has(riderId),
      })),
    },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/jeu/championnats-nationaux");
  revalidatePath("/jeu/calendrier");
  revalidatePath("/jeu/resultats");
  revalidatePath("/jeu");
  redirect("/jeu/championnats-nationaux?enregistrement=confirme");
}

export async function withdrawNationalChampionshipRiderAction(
  formData: FormData,
) {
  const input = withdrawalSchema.safeParse({
    editionId: formData.get("editionId"),
    riderId: formData.get("riderId"),
    discipline: formData.get("discipline"),
  });
  if (!input.success) {
    throw new Error("Le retrait demandé est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);
  if (authenticationError || !user) {
    throw new Error("Vous devez être connecté pour retirer un coureur.");
  }

  const { error } = await supabase.rpc(
    "withdraw_current_team_national_championship_rider",
    {
      p_race_edition_id: input.data.editionId,
      p_rider_id: input.data.riderId,
    },
  );
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(
    `/jeu/championnats-nationaux/${input.data.discipline}`,
  );
  revalidatePath("/jeu/championnats-nationaux");
  revalidatePath("/jeu/resultats");
  revalidatePath("/jeu");
}
