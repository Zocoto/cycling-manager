"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const withdrawalSchema = z.object({
  editionId: z.string().uuid(),
  riderId: z.string().uuid(),
  discipline: z.enum(["route", "contre-la-montre"]),
});

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
  revalidatePath("/jeu/resultats");
  revalidatePath("/jeu");
}
