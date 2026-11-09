"use server";

import { revalidatePath } from "next/cache";
import { isNationalChampionshipRoadPreset } from "@/lib/game/national-championship-road-route";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type NationalChampionshipRouteActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function saveNationalChampionshipRoadChoiceAction(
  _previous: NationalChampionshipRouteActionState,
  formData: FormData,
): Promise<NationalChampionshipRouteActionState> {
  const countryCode = String(formData.get("countryCode") ?? "").toUpperCase();
  const targetGameYear = Number(formData.get("targetGameYear"));
  const preset = formData.get("preset");
  if (!/^[A-Z]{2}$/.test(countryCode) || !Number.isInteger(targetGameYear) || targetGameYear < 2 || !isNationalChampionshipRoadPreset(preset)) {
    return { status: "error", message: "Ce profil de course est indisponible." };
  }

  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc("save_national_championship_road_choice", {
    p_country_code: countryCode,
    p_target_game_year: targetGameYear,
    p_preset_key: preset,
  });
  if (result.error) {
    if (result.error.code === "P0001") return { status: "error", message: result.error.message };
    console.error("Could not save the national championship route:", result.error.message);
    return { status: "error", message: "Impossible d’enregistrer le profil du championnat national." };
  }

  revalidatePath(`/jeu/federations/${countryCode.toLowerCase()}`);
  revalidatePath("/jeu");
  return { status: "success", message: "Profil enregistré pour la saison suivante." };
}
