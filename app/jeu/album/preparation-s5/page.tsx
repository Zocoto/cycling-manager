import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GameHeader } from "@/components/game/game-header";
import { CycloStickersSeasonFivePreparation } from "@/components/game/cyclo-stickers-season-five-preparation";
import { canAccessCollectorAlbum } from "@/lib/game/collector-album-access";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";

export const metadata: Metadata = {
  title: "Préparation privée de l’album S5",
  robots: { index: false, follow: false },
};

/** Separate from /jeu/album?saison=5, which remains the real S4 collection. */
export default async function SeasonFiveAlbumPreparationPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  if (!canAccessCollectorAlbum(user.id)) notFound();
  const header = await getGameHeaderData(supabase, user.id);
  return <main className="min-h-screen bg-[#edf0e8] text-[#193d36]">
    <GameHeader simulatorEmail={user.email} displayName={header.displayName} sponsor={header.teamSponsorVisual} maxWidth="wide" collectorAlbumAvailable />
    <CycloStickersSeasonFivePreparation ownerName={header.displayName} />
  </main>;
}
