import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { GameGuideContent } from "@/components/guide/game-guide-content";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";

export const metadata: Metadata = {
  title: "Guide du Directeur Sportif",
  description: "Consultez le manuel de Cyclo Stratège sans quitter votre partie.",
  alternates: { canonical: "/guide" },
};

export default async function ConnectedGuidePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await getAuthenticatedUser(supabase);

  if (error || !user) redirect("/connexion");

  const headerData = await getGameHeaderData(supabase, user.id);

  return (
    <main className="min-h-screen min-w-0 bg-[#EAF5F3] pb-24 text-[#082A2A] sm:pb-8">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorVisual}
        maxWidth="wide"
      />
      <div className="mx-auto max-w-7xl px-5 py-4 sm:px-8">
        <BackToOfficeLink />
      </div>
      <GameGuideContent inGame />
    </main>
  );
}
