import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { InternationalChampionshipDirectory } from "@/components/game/international-championship-directory";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { INTERNATIONAL_SELECTIONS_HREF } from "@/lib/game/international-championship-navigation";
import { getGameHeaderData } from "@/services/game-header-data";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";

export const metadata: Metadata = {
  title: "Championnats continentaux et mondiaux",
  description:
    "Consultez les profils, les détails et les startlists des CC et CM de la saison.",
};

export default async function InternationalChampionshipsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const [headerData, calendar] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getActiveSeasonRaceCalendar(supabase, new Date(), {
      includeEngagedRiders: false,
      includeEngagedCounts: true,
      includeIneligibleRegionalRaces: true,
    }),
  ]);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/jeu/calendrier"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B302B]"
        >
          <span aria-hidden="true">←</span>
          Retour au calendrier
        </Link>

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.18)] sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[42px] border-white/10"
          />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#F2C94C]">
                CC &amp; CM · Vue générale
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
                Championnats internationaux
              </h1>
              <p className="mt-4 text-sm font-semibold leading-6 text-[#D6DFD2] sm:text-base">
                Retrouvez tous les profils des championnats continentaux et
                mondiaux, puis ouvrez directement la startlist ou la fiche
                détaillée de chaque épreuve.
              </p>
            </div>
            <Link
              href={INTERNATIONAL_SELECTIONS_HREF}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#F2C94C] px-5 text-sm font-black text-[#183F37] transition hover:bg-[#FFDB63] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Voir mes convocations →
            </Link>
          </div>
        </header>

        <section className="mt-7">
          {calendar ? (
            <InternationalChampionshipDirectory calendar={calendar} />
          ) : (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-6 py-8 text-amber-950">
              <p className="text-lg font-black">
                Le calendrier international n’est pas disponible.
              </p>
              <p className="mt-2 text-sm font-semibold">
                Réessayez dans quelques instants.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
