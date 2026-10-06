import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { PcmExportPanel } from "@/components/game/pcm-export-panel";
import { PcmGalaStartlistExportPanel } from "@/components/game/pcm-gala-startlist-export-panel";
import { canAccessPcmExport } from "@/lib/game/pcm-export/access";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";

export const metadata: Metadata = {
  title: "Export PCM26",
  description: "Outil privé de génération de la base Cyclostratège pour PCM26.",
};

export default async function PcmExportPage({ searchParams }: { searchParams: Promise<{ gala?: string }> }) {
  const seasonFinale = (await searchParams).gala === "fin-de-saison";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");
  if (!canAccessPcmExport(user.email)) notFound();

  const headerData = await getGameHeaderData(supabase, user.id);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorVisual}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <header className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#278B70]">
              Administration privée
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
              Export PCM26
            </h1>
            <p className="mt-4 text-base font-medium leading-7 text-[#557068]">
              {seasonFinale ? "Base spéciale Gala : les identités confirmées de la prochaine saison, avec les effectifs et notes de la saison du gala. Aucun changement dans le jeu."
                : "Génère une base PCM26 à partir des données actuellement actives dans Cyclostratège, puis la valide avant de la télécharger."}
            </p>
          </header>
          <BackToOfficeLink />
        </div>

        <PcmExportPanel seasonFinale={seasonFinale} />
        <PcmGalaStartlistExportPanel eventKey={seasonFinale ? "gala-des-puncheurs" : undefined} />
      </section>
    </main>
  );
}
