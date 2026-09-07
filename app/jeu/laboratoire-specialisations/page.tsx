import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { InfrastructureSpecializationLab } from "@/components/game/infrastructure-specialization-lab";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";

const PRIVATE_REVIEWER_DIRECTOR_ID = "3161715a-ad6a-4335-b820-45fc1969a849";

export const metadata: Metadata = {
  title: "Laboratoire privé des spécialisations",
  description: "Prototype privé et sans effet des spécialisations de bâtiments.",
  robots: { index: false, follow: false },
};

export default async function InfrastructureSpecializationLabPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);
  if (authenticationError || !user) redirect("/connexion");

  const profileResult = await supabase
    .from("sporting_directors")
    .select("id, display_name")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle<{ id: string; display_name: string }>();

  if (
    profileResult.error ||
    profileResult.data?.id !== PRIVATE_REVIEWER_DIRECTOR_ID
  ) {
    notFound();
  }

  const headerData = await getGameHeaderData(supabase, user.id);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17_0%,#0B302B_52%,#176951_100%)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.22)] sm:px-10 sm:py-11">
          <div aria-hidden="true" className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9BE0BC]">
                Phase 5 · Prototype privé
              </p>
              <span className="rounded-full border border-[#F3C969]/35 bg-[#F3C969]/12 px-3 py-1 text-[9px] font-black uppercase tracking-wide text-[#F9D989]">
                Roger Letesteur uniquement
              </span>
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight sm:text-5xl">
              Spécialiser les installations sans créer un choix dominant
            </h1>
            <p className="mt-5 max-w-3xl text-sm font-semibold leading-7 text-[#CBE6D8] sm:text-base">
              Cette page permet de comparer les identités proposées pour chaque
              bâtiment d’équipe et fédéral. Elle est volontairement débranchée :
              rien n’est sauvegardé, facturé ou appliqué au gameplay.
            </p>
          </div>
        </header>

        <div className="mt-7">
          <InfrastructureSpecializationLab />
        </div>
      </section>
    </main>
  );
}
