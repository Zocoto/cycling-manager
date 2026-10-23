"use server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { galaRegistrationSchema, type GalaRegistrationState } from "@/lib/game/season-four-gala-registration";

export async function saveSeasonFourGalaRegistrationAction(_previous: GalaRegistrationState, form: FormData): Promise<GalaRegistrationState> {
  const client = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await getAuthenticatedUser(client);
  if (authError || !user) return { status: "error", message: "Reconnectez-vous pour gérer votre inscription." };
  const intent = form.get("intent");
  if (intent !== "save" && intent !== "withdraw") return { status: "error", message: "Action du gala invalide." };
  let rpc;
  if (intent === "withdraw") rpc = client.rpc("withdraw_current_season_four_gala_registration");
  else {
    const raw = form.get("selection");
    if (typeof raw !== "string" || raw.length > 16384) return { status: "error", message: "Compositions du gala invalides." };
    let value: unknown;
    try { value = JSON.parse(raw); } catch { return { status: "error", message: "Compositions du gala invalides." }; }
    const parsed = galaRegistrationSchema.safeParse(value);
    if (!parsed.success) return { status: "error", message: "Sélectionnez 7 à 8 coureurs distincts pour chacune des trois courses du même programme." };
    rpc = client.rpc("save_current_season_four_gala_registration", { p_program: parsed.data.program, p_selections: parsed.data.selections });
  }
  try {
    const { error } = await rpc.abortSignal(AbortSignal.timeout(8000));
    if (error) {
      const known = /^(Les inscriptions|Aucune équipe|Coureur hors|Une inscription|Les compositions|Les inscriptions de ce programme|Plusieurs équipes)/.test(error.message);
      return { status: "error", message: known ? error.message : "Inscription non confirmée. Vérifiez votre sélection et réessayez ; les trois courses sont enregistrées ensemble, sans doublon." };
    }
  } catch {
    return { status: "error", message: "Confirmation indisponible. Rechargez la page pour vérifier votre inscription avant de réessayer." };
  }
  revalidatePath("/jeu/gala-saison-4");
  return { status: "success", message: intent === "withdraw" ? "Inscription retirée." : "Votre équipe est inscrite aux trois courses. Vous pouvez modifier les compositions jusqu’à la clôture." };
}
