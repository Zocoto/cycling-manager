import "server-only";

import { buildCyclogazetteJerseyStories, type GazetteJerseyChangeRow } from "@/lib/game/cyclogazette-jerseys";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function loadCyclogazetteJerseyStories(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  calendarDate: string,
  now: Date,
) {
  const result = await admin.rpc("get_cyclogazette_jersey_changes", {
    p_issue_date: calendarDate,
    p_until: now.toISOString(),
  });
  if (result.error) {
    // Abort this publication so the existing idempotent retry can include the
    // announcements. Publishing silently without them would lose today's kits.
    throw new Error(`Impossible de charger les nouveaux maillots : ${result.error.message}`);
  }
  return buildCyclogazetteJerseyStories((result.data ?? []) as GazetteJerseyChangeRow[]);
}
