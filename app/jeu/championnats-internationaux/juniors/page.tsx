import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { InternationalChampionshipDirectory } from "@/components/game/international-championship-directory";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";

export const metadata: Metadata = {
  title: "Compétitions internationales juniors",
  description:
    "Consultez les profils et les sélections des CC, CM et Nations Cup juniors.",
};

export default async function JuniorInternationalChampionshipsPage() {
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
      includeJuniorChampionships: true,
    }),
  ]);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorVisual}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/jeu/centre-de-formation?dev=calendrier"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B302B]"
        >
          <span aria-hidden="true">←</span>
          Retour au calendrier DevTeam
        </Link>

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.18)] sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[42px] border-white/10"
          />
          <div className="relative max-w-4xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#F2C94C]">
              CC · CM · Nations Cup juniors
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              Compétitions internationales juniors
            </h1>
            <p className="mt-4 text-sm font-semibold leading-6 text-[#D6DFD2] sm:text-base">
              Retrouvez séparément les profils, les parcours et l’état des
              sélections fédérales de toutes les épreuves internationales de
              la relève.
            </p>
            <Link
              href="/jeu/selections-internationales?categorie=junior"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F2C94C] px-5 text-sm font-black text-[#183F37] transition hover:bg-[#FFDB63]"
            >
              Voir mes convocations juniors →
            </Link>
          </div>
        </header>

        <section className="mt-7">
          {calendar ? (
            <InternationalChampionshipDirectory
              calendar={calendar}
              audience="junior"
            />
          ) : (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-6 py-8 text-amber-950">
              <p className="text-lg font-black">
                Le calendrier international junior n’est pas disponible.
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
