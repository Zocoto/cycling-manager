import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GameHeader } from "@/components/game/game-header";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { SeasonDraftPanel } from "@/components/game/season-draft-panel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { getGameHeaderData } from "@/services/game-header-data";
import { getSeasonDraftView } from "@/services/season-draft";

export const metadata: Metadata = { title: "Draft de début de saison", description: "Préparez vos choix et recrutez un coureur lors de la draft de début de saison." };

export default async function SeasonDraftPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  const [header, view] = await Promise.all([getGameHeaderData(supabase, user.id), getSeasonDraftView(supabase)]);
  return <main className="min-h-screen bg-[#F0F3EE] text-[#173D3A]">
    <GameHeader simulatorEmail={user.email} displayName={header.displayName} sponsor={header.teamSponsorVisual} maxWidth="wide" />
    <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-8"><div className="mb-4 flex justify-end"><BackToOfficeLink /></div>
      <SeasonDraftPanel key={view.edition?.id ?? "upcoming"} view={view} />
    </div>
  </main>;
}
