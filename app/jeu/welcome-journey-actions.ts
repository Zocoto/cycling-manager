"use server";

import { revalidatePath } from "next/cache";

import type { NewcomerJourneyStepKey } from "@/lib/game/dashboard-assistant";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_STEP_KEYS = new Set<NewcomerJourneyStepKey>([
  "claim_daily_reward",
  "post_global_chat_message",
  "configure_training",
  "recruit_staff_member",
  "place_auction_bid",
  "register_for_race",
  "prepare_race",
  "follow_race_live",
]);

export async function claimNewcomerJourneyStepAction(
  stepKey: NewcomerJourneyStepKey,
  _formData: FormData,
): Promise<void> {
  void _formData;

  if (!ALLOWED_STEP_KEYS.has(stepKey)) {
    throw new Error("Étape de bienvenue inconnue.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    throw new Error("Votre session a expiré. Reconnectez-vous pour continuer.");
  }

  const { error } = await supabase.rpc(
    "claim_current_newcomer_journey_step",
    { p_step_key: stepKey },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/jeu");
  revalidatePath("/jeu/objectifs");
}
