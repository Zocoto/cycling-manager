import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SeasonFiveGalaPreview } from "@/components/game/season-five-gala-preview";
import { SEASON_FIVE_GALA } from "@/lib/game/season-five-gala";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSeasonFiveGalaContext } from "@/services/season-five-gala-registration";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Le Gala des Lumières · Saison 5",
  description: "Six épreuves dans Pro Cycling Manager pour célébrer la fin de la saison 5.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function SeasonFiveGalaPage() {
  const session = await createSupabaseServerClient()
    .then(async client => ({ client, authentication: await getAuthenticatedUser(client) }))
    .catch(() => null);
  const authentication = session?.authentication;
  if (authentication?.error || !authentication?.data.user) {
    redirect(`/connexion?returnTo=${encodeURIComponent(SEASON_FIVE_GALA.route)}`);
  }

  // A single bounded RPC loads this DS's team, native ratings and registration.
  // The page adds no header queries, rewards mutation or polling.
  const context = await getCurrentSeasonFiveGalaContext(session!.client).catch(() => ({
    unavailable: true, isOpen: false, closesAt: SEASON_FIVE_GALA.registrationClosesAt,
    team: null, program: null, selections: {}, riders: [],
  }));
  const revision = JSON.stringify([context.team?.id, context.program, context.selections, context.isOpen]);
  return <SeasonFiveGalaPreview key={revision} registrationContext={context} />;
}
