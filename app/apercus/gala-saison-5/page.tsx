import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SeasonFiveGalaPreview } from "@/components/game/season-five-gala-preview";
import { canAccessSeasonFiveGalaPreview } from "@/lib/game/season-five-gala-access";
import { SEASON_FIVE_GALA } from "@/lib/game/season-five-gala";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Le Gala des Lumières · Saison 5",
  description: "Six épreuves dans Pro Cycling Manager pour célébrer la fin de la saison 5.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function SeasonFiveGalaPreviewPage() {
  // No game layout, gameplay queries, registration actions or reward grants.
  const authentication = await createSupabaseServerClient()
    .then(getAuthenticatedUser)
    .catch(() => null);
  if (!authentication?.data.user) {
    redirect(`/connexion?returnTo=${encodeURIComponent(SEASON_FIVE_GALA.route)}`);
  }
  if (authentication.error || !canAccessSeasonFiveGalaPreview(authentication.data.user.id)) {
    notFound();
  }

  return <SeasonFiveGalaPreview />;
}
