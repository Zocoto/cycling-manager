import "server-only";

import { cache } from "react";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const settleDueTrainingState = cache(async (): Promise<void> => {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("settle_due_training_sessions_throttled");

  assertSettlement(error, "les entraînements quotidiens");
});

export const settleCurrentHealthAndFormState = cache(
  async (): Promise<void> => {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc(
      "settle_current_health_and_form_throttled",
    );

    assertSettlement(error, "la santé et la forme des coureurs");
  },
);

export const settleCurrentRiderState = cache(async (): Promise<void> => {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("settle_current_rider_state_throttled");

  assertSettlement(error, "l’état quotidien des coureurs");
});

function assertSettlement(
  error: { message: string } | null,
  resource: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible d’actualiser ${resource} : ${error.message}`);
  }
}
