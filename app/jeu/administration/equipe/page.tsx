import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GameHeader } from "@/components/game/game-header";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameStaffManagement } from "@/components/game/game-staff-management";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentGameStaffRole } from "@/services/game-staff-access";
import { getGameHeaderData } from "@/services/game-header-data";
import { getGameStaffMembers } from "@/services/game-product-news";
import { searchGameStaffAction, setGameStaffRoleAction } from "./actions";

export const metadata: Metadata = { title: "Gérer les admins" };

export default async function GameStaffAdministration() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  const role = await getCurrentGameStaffRole(supabase);
  if (role !== "owner") notFound();

  const [header, members] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getGameStaffMembers(supabase),
  ]);

  return <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
    <GameHeader simulatorEmail={user.email} displayName={header.displayName} sponsor={header.teamSponsorVisual} maxWidth="wide" />
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">Fondateur</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Gérer les admins</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#60756E]">Les nominations et retraits d’accès sont réservés au compte fondateur Zocoto. Les admins disposent des outils du jeu, mais ne peuvent pas gérer les rôles.</p>
        </div>
        <BackToOfficeLink />
      </header>
      <div className="mt-8">
        <GameStaffManagement members={members} searchAction={searchGameStaffAction} roleAction={setGameStaffRoleAction} />
      </div>
    </section>
  </main>;
}
