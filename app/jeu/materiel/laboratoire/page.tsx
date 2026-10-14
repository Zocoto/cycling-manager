import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { MaterialNavigation } from "@/components/game/material-navigation";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getCurrentTeamEquipmentRndOverview } from "@/services/team-equipment-rnd";
import { EquipmentRndWorkbench } from "@/components/game/equipment-rnd-workbench";
export const metadata: Metadata = { title: "Laboratoire R&D", description: "Choisissez votre matériel, votre ingénieur et l’orientation de vos essais. Suivez chaque évolution de vos prototypes." };
export const maxDuration = 300;
export default async function EquipmentLaboratoryPage({ searchParams }: { searchParams: Promise<{ recherche?: string; erreur?: string }> }) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  const [headerData, overview] = await Promise.all([getGameHeaderData(supabase, user.id), getCurrentTeamEquipmentRndOverview(user.id, supabase)]);
  if (!overview) redirect("/jeu");
  return <main className="min-h-screen bg-[#EEF4F0] text-[#183F37]">
    <GameHeader simulatorEmail={user.email} displayName={headerData.displayName} sponsor={headerData.teamSponsorVisual} maxWidth="wide" />
    <section className="mx-auto max-w-[1500px] px-4 py-7 sm:px-8 sm:py-10">
      <BackToOfficeLink /><MaterialNavigation activeHref="/jeu/materiel/laboratoire" />
      <EquipmentRndWorkbench overview={overview} query={query} />
    </section>
  </main>;
}
