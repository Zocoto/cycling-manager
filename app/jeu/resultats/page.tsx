import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { RaceLiveLab } from "@/components/game/race-live-lab";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";

export const metadata: Metadata = {
  title: "Résultats / Live",
  description:
    "Testez le premier moteur de simulation de courses de Cyclostratège.",
};

export default async function RaceResultsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const headerData = await getGameHeaderData(supabase, user.id);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <header className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
              Résultats / Live
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              La course devient visible.
            </h1>
            <p className="mt-5 text-lg font-medium leading-8 text-[#48665F]">
              Cette première version permet de rejouer une simulation complète,
              tronçon par tronçon, puis d’inspecter les groupes, écarts, événements
              et classements produits par le moteur.
            </p>
          </header>

          <Link
            href="/jeu/calendrier"
            className="inline-flex min-h-11 items-center rounded-xl border border-[#176951]/25 bg-white px-4 text-sm font-black text-[#176951] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            ← Retour au calendrier
          </Link>
        </div>

        <div className="mt-7 rounded-2xl border border-amber-300/55 bg-amber-50 px-5 py-4 text-sm font-semibold leading-6 text-amber-950">
          <strong>Prototype testable :</strong> le moteur utilise déjà les règles
          prévues pour la production, mais les scénarios de cette page sont des
          pelotons de démonstration. Le déclenchement serveur à 20 h, la persistance
          des résultats et le chat multijoueur seront branchés dans une livraison
          distincte après validation de l’équilibrage.
        </div>

        <div className="mt-8">
          <RaceLiveLab />
        </div>
      </div>
    </main>
  );
}
