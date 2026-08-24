import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function settleCurrentRiderStateForMaintenance(): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc(
    "settle_current_rider_state_for_maintenance",
  );

  assertSettlement(error, "l’état quotidien des coureurs");
}

function assertSettlement(
  error: { message: string } | null,
  resource: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible d’actualiser ${resource} : ${error.message}`);
  }
}
