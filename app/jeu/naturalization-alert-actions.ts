"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DashboardAssistantLine } from "@/lib/game/dashboard-assistant";

export type NaturalizationIgnoreState = { error: string | null };

export async function ignoreNaturalizationAlertAction(
  target: NonNullable<DashboardAssistantLine["naturalizationTarget"]>,
  _previous: NaturalizationIgnoreState,
  _formData: FormData,
): Promise<NaturalizationIgnoreState> {
  void _previous;
  void _formData;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!target || !["professional", "youth"].includes(target.subjectType) ||
    !uuid.test(target.subjectId) || !uuid.test(target.targetCountryId)) {
    return { error: "Cette alerte de naturalisation est invalide." };
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authenticationError } = await supabase.auth.getUser();
  if (authenticationError || !user) return { error: "Votre session a expiré. Reconnectez-vous pour continuer." };
  const { error } = await supabase.rpc("ignore_current_naturalization_alert", {
    p_subject_type: target.subjectType, p_subject_id: target.subjectId, p_target_country_id: target.targetCountryId,
  });
  if (error) return { error: error.message };
  revalidatePath("/jeu");
  return { error: null };
}
