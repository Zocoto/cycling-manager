import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SeasonFiveGalaPreview } from "@/components/game/season-five-gala-preview";
import { canAccessSeasonFiveGalaPreview } from "@/lib/game/season-five-gala-access";
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

export default async function SeasonFiveGalaPreviewPage() {
  const session = await createSupabaseServerClient()
    .then(async client => ({ client, authentication: await getAuthenticatedUser(client) }))
    .catch(() => null);
  const authentication = session?.authentication;
  if (!authentication?.data.user) {
    redirect(`/connexion?returnTo=${encodeURIComponent(SEASON_FIVE_GALA.route)}`);
  }
  if (authentication.error || !canAccessSeasonFiveGalaPreview(authentication.data.user.id)) {
    notFound();
  }

  // A single bounded RPC loads this DS's team, native ratings and registration.
  // No GameLayout, header queries, rewards mutation or polling is added.
  const context = await getCurrentSeasonFiveGalaContext(session!.client).catch(() => ({
    unavailable: true, isOpen: false, closesAt: SEASON_FIVE_GALA.registrationClosesAt,
    team: null, program: null, selections: {}, riders: [],
  }));
  const revision = JSON.stringify([context.team?.id, context.program, context.selections, context.isOpen]);
  return <SeasonFiveGalaPreview key={revision} registrationContext={context} />;
}
