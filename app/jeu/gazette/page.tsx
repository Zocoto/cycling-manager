import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CyclogazetteArchiveNavigation } from "@/components/game/cyclogazette-archive-navigation";
import { CyclogazetteNewspaper } from "@/components/game/cyclogazette-newspaper";
import { CyclogazetteReadMarker } from "@/components/game/cyclogazette-read-marker";
import { GameHeader } from "@/components/game/game-header";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCyclogazetteArchive,
  getCyclogazetteEditionById,
  getLatestCyclogazetteEdition,
} from "@/services/cyclogazette";
import { getGameHeaderData } from "@/services/game-header-data";

export const metadata: Metadata = {
  title: "La Cyclogazette",
  description: "Le journal quotidien des courses, du mercato et des directeurs sportifs de Cyclo Stratège.",
};

export default async function CyclogazettePage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string | string[] }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");

  const params = await searchParams;
  const requestedEditionId = Array.isArray(params.edition)
    ? params.edition[0]
    : params.edition;
  const [headerData, latestEdition] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getLatestCyclogazetteEdition(),
  ]);
  const [archive, requestedEdition] = await Promise.all([
    getCyclogazetteArchive(),
    requestedEditionId && requestedEditionId !== latestEdition?.id
      ? getCyclogazetteEditionById(requestedEditionId)
      : Promise.resolve(null),
  ]);
  const edition = requestedEdition ?? latestEdition;

  return (
    <main className="min-h-screen bg-[#D9D4C8] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
        gazetteIsOpen
      />
      <div className="px-2 py-5 sm:px-5 sm:py-9 lg:px-8">
        {edition && latestEdition ? (
          <>
            <CyclogazetteReadMarker editionId={edition.id} />
            <CyclogazetteArchiveNavigation
              seasons={archive}
              currentEditionId={edition.id}
              latestEditionId={latestEdition.id}
            />
            <CyclogazetteNewspaper edition={edition} />
          </>
        ) : (
          <EmptyGazette />
        )}
      </div>
    </main>
  );
}

function EmptyGazette() {
  return (
    <section className="mx-auto max-w-[1100px] border border-[#9A8A65]/40 bg-[#F4EBD2] px-6 py-20 text-center shadow-[0_35px_100px_rgba(45,34,20,0.2)] sm:px-12">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A12742]">La rédaction prépare sa une</p>
      <h1 className="mt-4 font-serif text-5xl font-black tracking-[-0.05em] sm:text-7xl">La Cyclogazette</h1>
      <p className="mx-auto mt-5 max-w-xl font-serif text-lg italic leading-7 text-[#695D43]">La première édition sera mise sous presse ce soir à 20 h. Revenez découvrir les résultats, les mouvements du mercato et les réactions des Directeurs Sportifs.</p>
    </section>
  );
}
