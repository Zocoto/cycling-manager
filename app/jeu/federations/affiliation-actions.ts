"use server";

import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AmateurTeamAffiliationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const schema = z.object({
  countryId: z.string().uuid(),
  confirmed: z.literal("yes"),
});

export async function changeAmateurTeamNationalAffiliationAction(
  _previousState: AmateurTeamAffiliationActionState,
  formData: FormData,
): Promise<AmateurTeamAffiliationActionState> {
  const parsed = schema.safeParse({
    countryId: formData.get("countryId"),
    confirmed: formData.get("confirmed"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Confirmez la naturalisation de l’équipe et de l’entraîneur.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();
  if (authenticationError || !user) {
    return { status: "error", message: "Votre session a expiré." };
  }

  const result = await supabase.rpc(
    "change_current_amateur_team_national_affiliation",
    { p_country_id: parsed.data.countryId },
  );
  if (result.error) {
    console.error("Échec de la naturalisation de la structure amateure :", {
      code: result.error.code,
      message: result.error.message,
    });
    return {
      status: "error",
      message:
        result.error.message || "La naturalisation n’a pas abouti.",
    };
  }

  const payload = result.data as { countryName?: string } | null;
  revalidatePath("/jeu/federations/[codePays]", "page");
  revalidatePath("/jeu/sponsoring");
  revalidatePath("/jeu/directeur-sportif");
  revalidatePath("/jeu/equipe");
  refresh();
  return {
    status: "success",
    message: `Naturalisation finalisée${payload?.countryName ? ` : ${payload.countryName}` : ""}. Votre équipe amateure et votre profil d’entraîneur sont désormais alignés avec la fédération. La nouvelle nationalité de l’équipe sera prise en compte dans les prochaines affinités sponsors.`,
  };
}
