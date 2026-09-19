import "server-only";

import { unstable_cache } from "next/cache";

import { normalizeActivePublicWelcomeOffer } from "@/lib/marketing/welcome-offer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function loadActivePublicWelcomeOffer() {
  const admin = createSupabaseAdminClient();
  const result = await admin.rpc("get_active_public_welcome_campaign");

  if (result.error) {
    console.error(
      "Impossible de charger la campagne publique de bienvenue :",
      result.error.message,
    );
    return null;
  }

  return normalizeActivePublicWelcomeOffer(result.data);
}

export const getActivePublicWelcomeOffer = unstable_cache(
  loadActivePublicWelcomeOffer,
  ["active-public-welcome-offer"],
  { revalidate: 60 },
);
