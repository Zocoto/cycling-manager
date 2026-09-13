import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { NationsCupAutoRefresh } from "@/components/game/nations-cup-auto-refresh";
import { NationsCupEventTabs } from "@/components/game/nations-cup-event-tabs";
import { NationsCupStandings } from "@/components/game/nations-cup-standings";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getNationsCupOverview } from "@/services/nations-cup";

export const metadata: Metadata = {
  title: "Classement Nations Cup",
  description:
    "Classement général, divisions, groupes et résultats des cinq épreuves de la Nations Cup.",
};

export default async function NationsCupPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");

  const [headerData, overview] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getNationsCupOverview(),
  ]);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />
      <section className="mx-auto max-w-[1500px] px-5 py-9 sm:px-8 sm:py-12">
        <BackToOfficeLink />
        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.18)] sm:px-10 sm:py-10">
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F2C94C]">
              {overview?.seasonName ?? "Saison active"} · rendez-vous J24
            </p>
            <h1 className="mt-3 text-3xl font-black sm:text-5xl">
              Nations Cup professionnelle
            </h1>
            <p className="mt-4 max-w-4xl text-sm font-semibold leading-6 text-[#D6DFD2] sm:text-base">
              Cinq coureurs différents par nation, cinq terrains et un seul
              classement cumulé. Les places donnent de 50 à 1 point au top 16.
            </p>
          </div>
        </header>

        {!overview || overview.gameYear < 3 ? (
          <section className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white p-8 shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
            <h2 className="text-2xl font-black text-[#183F37]">Première édition en Saison 3</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#60756E]">
              La page publiera automatiquement les divisions, groupes et résultats dès l’ouverture de la S3, puis se mettra à jour après chaque arrivée.
            </p>
          </section>
        ) : (
          <>
            <NationsCupAutoRefresh
              enabled={
                overview.currentDayNumber >= 24
                && overview.events.some((event) => event.status !== "completed")
              }
            />
            <NationsCupEventTabs events={overview.events} />
            <NationsCupStandings
              events={overview.events}
              standings={overview.standings}
            />
          </>
        )}
      </section>
    </main>
  );
}
