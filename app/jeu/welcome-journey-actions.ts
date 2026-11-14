"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { NewcomerJourneyStepKey } from "@/lib/game/dashboard-assistant";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
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

export async function recordNewcomerReplayStartAction(
  stageId: string,
): Promise<boolean> {
  if (!z.uuid().safeParse(stageId).success) return false;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await getAuthenticatedUser(supabase);
  if (!user) return false;

  const { data: completed, error } = await supabase.rpc(
    "record_current_newcomer_replay_visit",
    { p_stage_id: stageId },
  );
  if (error) {
    console.error("newcomer_replay_visit_failed", error.code);
    return false;
  }

  if (completed) {
    revalidatePath("/jeu");
    revalidatePath("/jeu/objectifs");
  }
  return true;
}

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
